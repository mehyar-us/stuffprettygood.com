import http from 'node:http';

import { auditLog } from './core/audit.js';
import { AuthStore, seedAdmin } from './core/auth.js';
import { buildDashboard } from './core/dashboard.js';
import { CommandCenterStore, routeEntityFromPath } from './core/command-center.js';
import { evaluateCampaignTransition } from './compliance/gates.js';
import { evaluateSegmentPlan } from './segments/builder.js';

export function createApp({ authStore = new AuthStore({ auditLog }), audit = auditLog, commandCenter = new CommandCenterStore({ auditLog: audit }) } = {}) {
  seedAdmin(authStore);
  commandCenter.seedFirstBrand();

  return async function app(req, res) {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const method = req.method || 'GET';

      if (method === 'GET' && (url.pathname === '/health' || url.pathname === '/crm-health')) {
        return sendJson(res, 200, { status: 'healthy', service: 'mehyarmedia-crm', massSendingEnabled: false });
      }

      if (method === 'GET' && url.pathname === '/api/dashboard') {
        audit.record({ actorId: actorFromRequest(req), action: 'dashboard.viewed', resourceType: 'dashboard' });
        return sendJson(res, 200, buildDashboard({ authStore, auditLog: audit, commandCenter }));
      }

      if (method === 'GET' && url.pathname === '/api/command-center') {
        audit.record({ actorId: actorFromRequest(req), action: 'command_center.viewed', resourceType: 'command_center' });
        return sendJson(res, 200, commandCenter.buildSummary());
      }

      if (method === 'POST' && url.pathname === '/api/brands/seed-required') {
        const summary = commandCenter.seedFirstBrand();
        audit.record({ actorId: actorFromRequest(req), action: 'brands.required_seeded', resourceType: 'brands', metadata: { counts: summary.counts } });
        return sendJson(res, 200, summary);
      }

      const campaignDraftMatch = url.pathname.match(/^\/api\/campaign-drafts\/([^/]+)$/);
      if (method === 'GET' && campaignDraftMatch) {
        const record = commandCenter.get('campaigns', decodeURIComponent(campaignDraftMatch[1]));
        if (!record || record.status !== 'draft') return sendJson(res, 404, { error: 'campaign draft not found' });
        return sendJson(res, 200, { record, massSendingEnabled: false });
      }

      const entityType = routeEntityFromPath(url.pathname);
      if (entityType && method === 'GET') {
        return sendJson(res, 200, { records: commandCenter.list(entityType) });
      }
      if (entityType && method === 'POST') {
        const body = await readJson(req);
        const record = commandCenter.create(entityType, body, { actorId: actorFromRequest(req) });
        return sendJson(res, 201, { record });
      }

      if (method === 'POST' && url.pathname === '/api/legacy-source/inspect') {
        const body = await readJson(req);
        const legacySource = commandCenter.inspectLegacySource({ ...body, actorId: actorFromRequest(req) });
        return sendJson(res, 200, legacySource);
      }

      if (method === 'GET' && url.pathname === '/api/auth/users') {
        return sendJson(res, 200, { users: authStore.listUsers() });
      }

      if (method === 'POST' && url.pathname === '/api/auth/users') {
        const body = await readJson(req);
        const user = authStore.createUser({ ...body, actorId: actorFromRequest(req) });
        return sendJson(res, 201, { user });
      }

      if (method === 'POST' && url.pathname === '/api/auth/login') {
        const body = await readJson(req);
        const result = authStore.login(body);
        return sendJson(res, result.ok ? 200 : 401, result);
      }

      if (method === 'GET' && url.pathname === '/api/auth/session') {
        const session = authStore.getSession(bearerToken(req));
        return sendJson(res, session ? 200 : 401, { ok: Boolean(session), session });
      }

      if (method === 'GET' && url.pathname === '/api/audit') {
        const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10);
        return sendJson(res, 200, { events: audit.list({ limit }) });
      }

      if (method === 'POST' && url.pathname === '/api/campaigns/evaluate-transition') {
        const body = await readJson(req);
        const decision = evaluateCampaignTransition({ ...body, actorId: body.actorId || actorFromRequest(req) });
        audit.record({ actorId: decision.actorId, action: 'campaign.transition.evaluated', resourceType: 'campaign', resourceId: decision.campaignId, metadata: { targetStatus: decision.targetStatus, decision: decision.decision } });
        return sendJson(res, 200, decision);
      }

      if (method === 'POST' && url.pathname === '/api/segments/evaluate') {
        const body = await readJson(req);
        const plan = evaluateSegmentPlan(body);
        audit.record({ actorId: actorFromRequest(req), action: 'segment.plan.evaluated', resourceType: 'segment', resourceId: body.name || null, metadata: { ok: plan.ok, riskTier: plan.riskTier, usableCount: plan.suppressionOverlap.usableCount } });
        return sendJson(res, plan.ok ? 200 : 422, plan);
      }

      return sendJson(res, 404, { error: 'not found' });
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message, details: error.details || null });
    }
  };
}

export function startServer({ port = Number(process.env.PORT || 3000), host = process.env.HOST || '127.0.0.1' } = {}) {
  const server = http.createServer(createApp());
  return server.listen(port, host, () => {
    console.log(`Mehyar Media CRM listening on http://${host}:${port}`);
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
