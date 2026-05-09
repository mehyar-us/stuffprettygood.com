import http from 'node:http';

import { auditLog } from './core/audit.js';
import { AuthStore, seedAdmin } from './core/auth.js';
import { buildDashboard } from './core/dashboard.js';
import { collectDatabaseStatus } from './core/database-status.js';
import { CommandCenterStore, routeEntityFromPath } from './core/command-center.js';
import { evaluateCampaignTransition } from './compliance/gates.js';
import { SuppressionStore } from './compliance/suppression.js';
import { evaluateSegmentPlan } from './segments/builder.js';

export function createApp({
  authStore = new AuthStore({ auditLog }),
  audit = auditLog,
  commandCenter = new CommandCenterStore({ auditLog: audit }),
  databaseStatus = collectDatabaseStatus,
  suppressionStore = new SuppressionStore({ auditLog: audit }),
} = {}) {
  seedAdmin(authStore);
  commandCenter.seedFirstBrand();

  return async function app(req, res) {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const method = req.method || 'GET';
      const pathname = normalizePathname(url.pathname);

      if (method === 'GET' && PUBLIC_HEALTH_PATHS.has(pathname)) {
        return sendJson(res, 200, { status: 'healthy', service: 'mehyarmedia-crm', massSendingEnabled: false });
      }

      if ((method === 'POST' || method === 'GET') && pathname === '/api/preferences/unsubscribe') {
        const body = method === 'GET' ? {} : await readJson(req);
        const token = method === 'GET' ? url.searchParams.get('token') : body.token;
        const brandId = method === 'GET' ? url.searchParams.get('brandId') : body.brandId;
        const scope = method === 'GET' ? (url.searchParams.get('scope') || 'brand_and_global') : (body.scope || 'brand_and_global');
        const result = suppressionStore.recordEmailUnsubscribe({
          token,
          brandId,
          scope,
          actorId: 'public-unsubscribe',
          requestId: req.headers['x-request-id'] || null,
        });
        return sendJson(res, 200, {
          ok: true,
          massSendingEnabled: false,
          suppression: {
            categories: result.categories,
            effectiveBeforeFutureEligibility: true,
          },
        });
      }

      if ((method === 'POST' || method === 'GET') && pathname === '/api/preferences/sms-stop') {
        const body = method === 'GET' ? {} : await readJson(req);
        const token = method === 'GET' ? url.searchParams.get('token') : body.token;
        const brandId = method === 'GET' ? url.searchParams.get('brandId') : body.brandId;
        const result = suppressionStore.recordSmsStop({
          token,
          brandId,
          actorId: 'public-sms-stop',
          requestId: req.headers['x-request-id'] || null,
        });
        return sendJson(res, 200, {
          ok: true,
          massSendingEnabled: false,
          suppression: {
            categories: result.categories,
            effectiveBeforeFutureEligibility: true,
          },
        });
      }

      if (method === 'POST' && pathname === '/api/consent-reviews') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'compliance:evaluate' });
        if (!session) return null;
        const body = await readJson(req);
        const contactHash = String(body.contactHash || '').trim();
        if (!contactHash) return sendJson(res, 422, { error: 'contactHash is required', massSendingEnabled: false });
        audit.record({
          actorId: session.userId,
          action: 'consent.review.changed',
          resourceType: 'consent_review',
          resourceId: contactHash,
          metadata: {
            brandId: body.brandId || null,
            reviewStatus: body.reviewStatus || null,
            consentChannel: body.consentChannel || null,
          },
        });
        return sendJson(res, 200, { ok: true, massSendingEnabled: false, review: { contactHash, reviewStatus: body.reviewStatus || null } });
      }

      const blockedExecutionAction = blockedExecutionActionFor(pathname);
      if (method === 'POST' && blockedExecutionAction) {
        const token = bearerToken(req);
        const session = authStore.getSession(token);
        audit.record({
          actorId: session?.userId || 'anonymous',
          action: `execution.${blockedExecutionAction}.denied`,
          resourceType: 'execution_control',
          resourceId: pathname,
          metadata: {
            path: pathname,
            method,
            reason: 'phase_1_no_send_export_or_provider_push',
            authenticated: Boolean(session),
          },
        });
        return sendJson(res, 403, { error: `${blockedExecutionAction.replace('_', ' ')} blocked in Phase 1`, massSendingEnabled: false });
      }

      if (method === 'GET' && pathname === '/api/dashboard') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'dashboard:read' });
        if (!session) return null;
        audit.record({ actorId: session.userId, action: 'dashboard.viewed', resourceType: 'dashboard' });
        const database = await databaseStatus();
        return sendJson(res, 200, buildDashboard({ authStore, auditLog: audit, commandCenter, database }));
      }

      if (method === 'GET' && pathname === '/api/command-center') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'command_center:read' });
        if (!session) return null;
        audit.record({ actorId: session.userId, action: 'command_center.viewed', resourceType: 'command_center' });
        return sendJson(res, 200, commandCenter.buildSummary());
      }

      if (method === 'POST' && pathname === '/api/brands/seed-required') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const summary = commandCenter.seedFirstBrand();
        audit.record({ actorId: session.userId, action: 'brands.required_seeded', resourceType: 'brands', metadata: { counts: summary.counts } });
        return sendJson(res, 200, summary);
      }

      const campaignDraftMatch = pathname.match(/^\/api\/campaign-drafts\/([^/]+)$/);
      if (method === 'GET' && campaignDraftMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        const record = commandCenter.get('campaigns', decodeURIComponent(campaignDraftMatch[1]));
        if (!record || record.status !== 'draft') return sendJson(res, 404, { error: 'campaign draft not found' });
        return sendJson(res, 200, { record, massSendingEnabled: false });
      }

      const entityType = routeEntityFromPath(pathname);
      if (entityType && method === 'GET') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        return sendJson(res, 200, { records: commandCenter.list(entityType) });
      }
      if (entityType && method === 'POST') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        const record = commandCenter.create(entityType, body, { actorId: session.userId });
        return sendJson(res, 201, { record });
      }

      if (method === 'POST' && pathname === '/api/legacy-source/inspect') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        const body = await readJson(req);
        const legacySource = commandCenter.inspectLegacySource({ ...body, actorId: session.userId });
        return sendJson(res, 200, legacySource);
      }

      if (method === 'GET' && pathname === '/api/auth/users') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'users:manage' });
        if (!session) return null;
        return sendJson(res, 200, { users: authStore.listUsers() });
      }

      if (method === 'POST' && pathname === '/api/auth/users') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'users:manage' });
        if (!session) return null;
        const body = await readJson(req);
        const user = authStore.createUser({ ...body, actorId: session.userId });
        return sendJson(res, 201, { user });
      }

      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJson(req);
        const result = authStore.login(body);
        return sendJson(res, result.ok ? 200 : 401, result);
      }

      if (method === 'GET' && pathname === '/api/auth/session') {
        const session = authStore.getSession(bearerToken(req));
        if (!session) {
          auditAccessDenied({ audit, req, pathname, reason: 'missing_session' });
        }
        return sendJson(res, session ? 200 : 401, { ok: Boolean(session), session });
      }

      if (method === 'GET' && pathname === '/api/audit') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'audit:read' });
        if (!session) return null;
        const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10);
        return sendJson(res, 200, { events: audit.list({ limit }) });
      }

      if (method === 'POST' && pathname === '/api/campaigns/evaluate-transition') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'compliance:evaluate' });
        if (!session) return null;
        const body = await readJson(req);
        const decision = evaluateCampaignTransition({ ...body, actorId: session.userId });
        audit.record({ actorId: decision.actorId, action: 'campaign.transition.evaluated', resourceType: 'campaign', resourceId: decision.campaignId, metadata: { targetStatus: decision.targetStatus, decision: decision.decision } });
        return sendJson(res, 200, decision);
      }

      if (method === 'POST' && pathname === '/api/segments/evaluate') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'segments:evaluate' });
        if (!session) return null;
        const body = await readJson(req);
        const plan = evaluateSegmentPlan(body);
        audit.record({ actorId: session.userId, action: 'segment.plan.evaluated', resourceType: 'segment', resourceId: body.name || null, metadata: { ok: plan.ok, riskTier: plan.riskTier, usableCount: plan.suppressionOverlap.usableCount } });
        return sendJson(res, plan.ok ? 200 : 422, plan);
      }

      return sendJson(res, 404, { error: 'not found' });
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }
  };
}

export function startServer({ port = Number(process.env.PORT || 3000), host = process.env.HOST || '127.0.0.1' } = {}) {
  const server = http.createServer(createApp());
  return server.listen(port, host, () => {
    console.log(`Mehyar Media CRM listening on http://${host}:${port}`);
  });
}

const PUBLIC_HEALTH_PATHS = new Set(['/health', '/crm/health', '/crm-health']);

function normalizePathname(pathname) {
  if (pathname.startsWith('/crm/api/')) return pathname.replace('/crm/api/', '/api/');
  if (pathname === '/crm/api') return '/api';
  return pathname;
}

function blockedExecutionActionFor(pathname) {
  if (pathname === '/api/campaigns/send') return 'send';
  if (pathname === '/api/campaigns/export') return 'export';
  if (pathname === '/api/campaigns/provider-push') return 'provider_push';
  return null;
}

function requirePermission({ req, res, authStore, audit, pathname, permission }) {
  const token = bearerToken(req);
  const session = authStore.getSession(token);
  if (!session) {
    auditAccessDenied({ audit, req, pathname, permission, reason: 'missing_session' });
    sendJson(res, 401, { error: 'authentication required', massSendingEnabled: false });
    return null;
  }

  if (!session.permissions.includes(permission)) {
    auditAccessDenied({ audit, req, pathname, permission, reason: 'missing_permission', session });
    sendJson(res, 403, { error: 'forbidden', massSendingEnabled: false });
    return null;
  }

  return session;
}

function auditAccessDenied({ audit, req, pathname, permission = null, reason, session = null }) {
  audit.record({
    actorId: session?.userId || 'anonymous',
    action: 'access.denied',
    resourceType: 'access_control',
    resourceId: pathname,
    metadata: {
      path: pathname,
      method: req.method || 'GET',
      permission,
      reason,
      role: session?.role || null,
    },
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('request too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid json'));
      }
    });
  });
}

function actorFromRequest(req) {
  return req.headers['x-actor-id'] || 'anonymous';
}

function bearerToken(req) {
  const authorization = req.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : authorization;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
