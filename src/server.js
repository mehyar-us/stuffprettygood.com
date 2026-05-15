import http from 'node:http';

import { auditLog } from './core/audit.js';
import { AuthStore, seedAdmin } from './core/auth.js';
import { buildDashboard } from './core/dashboard.js';
import { collectDatabaseStatus } from './core/database-status.js';
import { loadDailyPullSummary } from './core/daily-pull-summary.js';
import { JobsStore } from './core/jobs.js';
import { CommandCenterStore, routeEntityFromPath } from './core/command-center.js';
import { evaluateCampaignTransition } from './compliance/gates.js';
import { SuppressionStore } from './compliance/suppression.js';
import { evaluateSegmentPlan } from './segments/builder.js';
import { buildOpportunityOperationsSnapshot, defaultArtifactPaths } from './opportunity-desk/artifacts.js';
import { OpportunityDeskStore } from './opportunity-desk/store.js';
import { renderOpportunityDeskHtml } from './opportunity-desk/ui.js';
import { SpgDurableStore } from './spg/durable-store.js';

export function createApp({
  authStore = new AuthStore({ auditLog }),
  audit = auditLog,
  commandCenter = new CommandCenterStore({ auditLog: audit }),
  databaseStatus = collectDatabaseStatus,
  suppressionStore = new SuppressionStore({ auditLog: audit }),
  opportunityDesk = new OpportunityDeskStore({ auditLog: audit }),
  spgStore = new SpgDurableStore({ auditLog: audit }),
  jobsStore = new JobsStore({ auditLog: audit }),
  opportunityArtifactPaths = defaultArtifactPaths(),
} = {}) {
  const configuredAdminCredentials = process.env.CRM_ADMIN_EMAIL || process.env.CRM_ADMIN_PASSWORD
    ? { email: process.env.CRM_ADMIN_EMAIL, password: process.env.CRM_ADMIN_PASSWORD }
    : undefined;
  seedAdmin(authStore, configuredAdminCredentials);
  commandCenter.seedFirstBrand();

  return async function app(req, res) {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const method = req.method || 'GET';
      const pathname = normalizePathname(url.pathname);

      if (method === 'GET' && PUBLIC_HEALTH_PATHS.has(pathname)) {
        return sendJson(res, 200, { status: 'healthy', service: 'mehyarmedia-crm', massSendingEnabled: false });
      }

      if (method === 'GET' && pathname === '/offers') {
        return sendJson(res, 200, {
          brand: 'stuffprettygood',
          route_contract: 'card -> /offers/<slug> -> /go/<slug>',
          massSendingEnabled: false,
          providerPushEnabled: false,
          offers: spgStore.listOffers(Object.fromEntries(url.searchParams), { publicOnly: true }),
        });
      }

      const publicOfferMatch = pathname.match(/^\/offers\/([^/]+)$/);
      if (method === 'GET' && publicOfferMatch) {
        const offer = spgStore.getPublicOffer(decodeURIComponent(publicOfferMatch[1]));
        return offer
          ? sendJson(res, 200, { brand: 'stuffprettygood', route_contract: 'card -> /offers/<slug> -> /go/<slug>', massSendingEnabled: false, providerPushEnabled: false, offer })
          : sendJson(res, 404, { error: 'offer not found', massSendingEnabled: false, providerPushEnabled: false });
      }

      const publicGoMatch = pathname.match(/^\/go\/([^/]+)$/);
      if (method === 'GET' && publicGoMatch) {
        const result = spgStore.resolveGoRedirect(decodeURIComponent(publicGoMatch[1]), {
          route_path: `${pathname}${url.search}`,
          surface: url.searchParams.get('surface') || url.searchParams.get('utm_source') || 'go_route',
          source_channel: url.searchParams.get('utm_source') || null,
          attribution_ref: url.searchParams.get('click_ref') || url.searchParams.get('ref') || null,
          session_ref: url.searchParams.get('session_ref') || null,
        }, { actorId: actorFromRequest(req) });
        if (result.status === 'blocked') return sendJson(res, 422, result);
        return sendRedirect(res, 302, result.destination_url);
      }

      if ((method === 'GET' || method === 'HEAD') && pathname === '/crm/opportunity-desk') {
        if (method === 'HEAD') return sendHtml(res, 200, '');
        return sendHtml(res, 200, renderOpportunityDeskHtml());
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


      if (method === 'GET' && pathname === '/api/spg/offers/public') {
        return sendJson(res, 200, { brand: 'stuffprettygood', massSendingEnabled: false, offers: spgStore.listOffers(Object.fromEntries(url.searchParams), { publicOnly: true }) });
      }

      if (method === 'GET' && pathname === '/api/spg/page-placements/public') {
        return sendJson(res, 200, { brand: 'stuffprettygood', placements: spgStore.listPagePlacements(Object.fromEntries(url.searchParams), { publicOnly: true }) });
      }

      if (method === 'GET' && pathname === '/api/spg/offer-wall/public') {
        return sendJson(res, 200, {
          brand: 'stuffprettygood',
          massSendingEnabled: false,
          providerPushEnabled: false,
          surface: url.searchParams.get('surface') || 'home',
          offers: spgStore.listOfferWall(Object.fromEntries(url.searchParams), { publicOnly: true }),
        });
      }

      if (method === 'POST' && pathname === '/api/spg/events') {
        const body = await readJson(req);
        const result = spgStore.recordPublicEvent(body, { actorId: actorFromRequest(req) });
        return sendJson(res, result.status === 'accepted' ? 202 : 422, result);
      }

      if (method === 'POST' && pathname === '/api/spg/signup') {
        const body = await readJson(req);
        const result = spgStore.recordSignup(body, { actorId: 'public-signup' });
        return sendJson(res, result.status === 'accepted' ? 202 : 422, result);
      }

      if (method === 'POST' && pathname === '/api/spg/preferences') {
        const body = await readJson(req);
        const result = spgStore.recordPreferences(body, { actorId: 'public-preferences' });
        return sendJson(res, result.status === 'accepted' ? 202 : 422, result);
      }

      if (method === 'POST' && pathname === '/api/spg/unsubscribe') {
        const body = await readJson(req);
        return sendJson(res, 202, spgStore.recordUnsubscribe(body, { actorId: 'public-unsubscribe' }));
      }

      if (method === 'GET' && pathname === '/api/spg/sources') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        return sendJson(res, 200, { sources: spgStore.listSources(Object.fromEntries(url.searchParams)) });
      }

      if (method === 'GET' && pathname === '/api/spg/offer-accounts') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        return sendJson(res, 200, { accounts: spgStore.listOfferAccounts(Object.fromEntries(url.searchParams)) });
      }

      if (method === 'POST' && pathname === '/api/spg/sources') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 201, { source: spgStore.createSource(body, { actorId: session.userId }) });
      }

      const spgSourceMatch = pathname.match(/^\/api\/spg\/sources\/([^/]+)$/);
      if (method === 'PATCH' && spgSourceMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 200, { source: spgStore.updateSource(decodeURIComponent(spgSourceMatch[1]), body, { actorId: session.userId }) });
      }

      if (method === 'POST' && pathname === '/api/spg/ingest/run') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        const result = spgStore.runIngestion(body, { actorId: session.userId });
        return sendJson(res, 202, { massSendingEnabled: false, providerPushEnabled: false, ...result });
      }

      if (method === 'GET' && pathname === '/api/spg/source-items') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        return sendJson(res, 200, { source_items: spgStore.listSourceItems(Object.fromEntries(url.searchParams)) });
      }

      const spgSourceItemReviewMatch = pathname.match(/^\/api\/spg\/source-items\/([^/]+)\/review$/);
      if (method === 'POST' && spgSourceItemReviewMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 200, { source_item: spgStore.reviewSourceItem(decodeURIComponent(spgSourceItemReviewMatch[1]), body, { actorId: session.userId }) });
      }

      if (method === 'GET' && pathname === '/api/spg/offer-candidates') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        return sendJson(res, 200, { offer_candidates: spgStore.listOfferCandidates(Object.fromEntries(url.searchParams)) });
      }

      const spgCandidatePromoteMatch = pathname.match(/^\/api\/spg\/offer-candidates\/([^/]+)\/promote$/);
      if (method === 'POST' && spgCandidatePromoteMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        return sendJson(res, 200, spgStore.promoteOfferCandidate(decodeURIComponent(spgCandidatePromoteMatch[1]), { actorId: session.userId }));
      }

      if (method === 'GET' && pathname === '/api/spg/offers') {
        const session = authStore.getSession(bearerToken(req));
        const canReadAdminInventory = Boolean(session?.permissions.includes('records:read'));
        return sendJson(res, 200, { offers: spgStore.listOffers(Object.fromEntries(url.searchParams), { publicOnly: !canReadAdminInventory }) });
      }

      if (method === 'POST' && pathname === '/api/spg/offers') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 201, { offer: spgStore.createOffer(body, { actorId: session.userId }) });
      }

      const spgOfferMatch = pathname.match(/^\/api\/spg\/offers\/([^/]+)$/);
      if (method === 'PATCH' && spgOfferMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 200, { offer: spgStore.updateOffer(decodeURIComponent(spgOfferMatch[1]), body, { actorId: session.userId }) });
      }

      if (method === 'GET' && pathname === '/api/spg/page-placements') {
        const session = authStore.getSession(bearerToken(req));
        const canReadAdminInventory = Boolean(session?.permissions.includes('records:read'));
        return sendJson(res, 200, { placements: spgStore.listPagePlacements(Object.fromEntries(url.searchParams), { publicOnly: !canReadAdminInventory }) });
      }

      if (method === 'GET' && pathname === '/api/spg/proof/network-readiness') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        return sendJson(res, 200, spgStore.networkReadiness());
      }

      if (method === 'GET' && pathname === '/api/opportunity-desk/sources') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        const operations = buildOpportunityOperationsSnapshot({ spgStore, artifactPaths: opportunityArtifactPaths });
        const sources = opportunityDesk.state.source_registry.length > 1 ? opportunityDesk.listSources(Object.fromEntries(url.searchParams)) : filterArtifactRecords(operations.sources, Object.fromEntries(url.searchParams), ['source_family', 'enabled', 'source_health', 'owner_profile', 'allowed_access_method']);
        return sendJson(res, 200, { sources, externalActionsEnabled: false, operations_contract_version: operations.contract_version });
      }

      if (method === 'POST' && pathname === '/api/opportunity-desk/sources') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 201, { source: opportunityDesk.createSource(body, { actorId: session.userId }), externalActionsEnabled: false });
      }

      const opportunitySourceMatch = pathname.match(/^\/api\/opportunity-desk\/sources\/([^/]+)$/);
      if (method === 'PATCH' && opportunitySourceMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 200, { source: opportunityDesk.updateSource(decodeURIComponent(opportunitySourceMatch[1]), body, { actorId: session.userId }), externalActionsEnabled: false });
      }

      if (method === 'GET' && pathname === '/api/opportunity-desk/source-runs') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        const operations = buildOpportunityOperationsSnapshot({ spgStore, artifactPaths: opportunityArtifactPaths });
        const sourceRuns = opportunityDesk.state.source_runs.length ? opportunityDesk.listSourceRuns(Object.fromEntries(url.searchParams)) : filterArtifactRecords(operations.source_runs.latest_runs, Object.fromEntries(url.searchParams), ['source_id', 'status', 'source_family']);
        return sendJson(res, 200, { source_runs: sourceRuns, externalActionsEnabled: false, operations_contract_version: operations.contract_version });
      }

      if (method === 'POST' && pathname === '/api/opportunity-desk/source-runs') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 202, opportunityDesk.recordSourceRun(body, { actorId: session.userId }));
      }

      if (method === 'GET' && pathname === '/api/opportunity-desk/opportunities') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        const operations = buildOpportunityOperationsSnapshot({ spgStore, artifactPaths: opportunityArtifactPaths });
        const opportunities = opportunityDesk.state.opportunities.length ? opportunityDesk.listOpportunities(Object.fromEntries(url.searchParams)) : filterArtifactRecords(operations.opportunities, Object.fromEntries(url.searchParams), ['source_id', 'status', 'opportunity_type', 'gate_status', 'route_owner_profile', 'source_family']);
        return sendJson(res, 200, { opportunities, externalActionsEnabled: false, operations_contract_version: operations.contract_version });
      }

      if (method === 'POST' && pathname === '/api/opportunity-desk/opportunities') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 201, { opportunity: opportunityDesk.upsertOpportunity(body, { actorId: session.userId }), externalActionsEnabled: false });
      }

      const opportunityRecordMatch = pathname.match(/^\/api\/opportunity-desk\/opportunities\/([^/]+)$/);
      if (method === 'PATCH' && opportunityRecordMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 200, { opportunity: opportunityDesk.patchOpportunity(decodeURIComponent(opportunityRecordMatch[1]), body, { actorId: session.userId }), externalActionsEnabled: false });
      }

      const opportunityScoreMatch = pathname.match(/^\/api\/opportunity-desk\/opportunities\/([^/]+)\/score$/);
      if (method === 'POST' && opportunityScoreMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 201, { score: opportunityDesk.scoreOpportunity(decodeURIComponent(opportunityScoreMatch[1]), body, { actorId: session.userId }), externalActionsEnabled: false });
      }

      const opportunityMemoMatch = pathname.match(/^\/api\/opportunity-desk\/opportunities\/([^/]+)\/memos$/);
      if (method === 'POST' && opportunityMemoMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 201, { memo: opportunityDesk.createMemo(decodeURIComponent(opportunityMemoMatch[1]), body, { actorId: session.userId }), externalActionsEnabled: false });
      }

      const opportunityDecisionMatch = pathname.match(/^\/api\/opportunity-desk\/opportunities\/([^/]+)\/decision$/);
      if (method === 'POST' && opportunityDecisionMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 201, { decision: opportunityDesk.recordDecision(decodeURIComponent(opportunityDecisionMatch[1]), body, { actorId: session.userId }), externalActionsEnabled: false });
      }

      const opportunityRouteMatch = pathname.match(/^\/api\/opportunity-desk\/opportunities\/([^/]+)\/route-kanban$/);
      if (method === 'POST' && opportunityRouteMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 201, { route: opportunityDesk.proposeKanbanRoute(decodeURIComponent(opportunityRouteMatch[1]), body, { actorId: session.userId }), externalActionsEnabled: false });
      }

      const opportunityActionMatch = pathname.match(/^\/api\/opportunity-desk\/opportunities\/([^/]+)\/action$/);
      if (method === 'POST' && opportunityActionMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        const opportunityId = decodeURIComponent(opportunityActionMatch[1]);
        const operations = buildOpportunityOperationsSnapshot({ spgStore, artifactPaths: opportunityArtifactPaths });
        const actionResult = performOpportunityAction({ opportunityDesk, opportunityId, body, operations, actorId: session.userId });
        return sendJson(res, 201, { ...actionResult, externalActionsEnabled: false, massSendingEnabled: false });
      }

      if (method === 'GET' && pathname === '/api/opportunity-desk/digest') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        return sendJson(res, 200, { digest: opportunityDesk.getDigest({ date: url.searchParams.get('date') || undefined, scope: url.searchParams.get('scope') || undefined }) });
      }

      if (method === 'GET' && pathname === '/api/opportunity-desk/dashboard') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'dashboard:read' });
        if (!session) return null;
        const operations = buildOpportunityOperationsSnapshot({ spgStore, artifactPaths: opportunityArtifactPaths });
        const dashboard = opportunityDesk.state.opportunities.length ? opportunityDesk.dashboard() : {
          contract_version: operations.contract_version,
          massSendingEnabled: false,
          externalActionsEnabled: false,
          blocked_external_actions: ['bid', 'grant_submission', 'proposal', 'affiliate_application', 'sponsor_outreach', 'account_creation', 'paid_account', 'kyc_tax_bank', 'mass_send', 'public_publish', 'legal_claim', 'raw_pii_export'],
          daily_digest: {
            top_recommendations: operations.top_first_cash_opportunities.slice(0, 10),
            fast_cash_pick: operations.top_first_cash_opportunities[0] || null,
            source_performance_summary: operations.source_runs.latest_runs || [],
            externalActionsEnabled: false,
          },
          source_health: operations.sources.map((source) => ({
            source_id: source.source_id,
            source_name: source.source_name,
            source_family: source.source_family,
            source_health: source.source_health,
            last_run_status: operations.source_runs.latest_runs.find((run) => run.source_id === source.source_id)?.status || 'never_run',
            credential_ref_env: source.credential_ref_env ? String(source.credential_ref_env).replace(/^env:/, '') : null,
            key_status: source.credential_ref_env ? 'configured_by_name' : 'not_required',
            access_method: source.allowed_access_method || source.access_method,
            kill_switch: source.kill_switch !== false,
          })),
          opportunity_inbox_counts: operations.opportunities.reduce((acc, row) => { acc[row.status || 'unknown'] = (acc[row.status || 'unknown'] || 0) + 1; return acc; }, {}),
          top_money_lanes: operations.sources.slice(0, 10).map((source) => ({ lane_name: source.source_name, owner: source.route_owner_profile || source.owner_profile, gate_class: 'review_required_before_external_action', current_count: operations.opportunities.filter((row) => row.source_id === source.source_id).length, next_route_recommendation: 'Draft sanitized Kanban route proposal only.' })),
          ai_memo_queue: [],
          decision_queue: operations.opportunities.slice(0, 25),
          kanban_route_proposals: [],
          revenue_process_board: [
            { column: 'signal_collected', count: operations.opportunities.length, cards: operations.opportunities.slice(0, 10) },
            { column: 'waiting_on_data_or_gate', count: operations.opportunities.filter((row) => !['not_required', 'approved'].includes(row.gate_status || 'not_required')).length, cards: operations.opportunities.filter((row) => !['not_required', 'approved'].includes(row.gate_status || 'not_required')).slice(0, 10) },
          ],
          gate_alerts: operations.opportunities.filter((row) => !['not_required', 'approved'].includes(row.gate_status || 'not_required')).map((row) => ({ opportunity_id: row.opportunity_id, gate_status: row.gate_status, allowed: false, nextSafeAction: 'Internal review only.' })),
          seed_data_status: { no_empty_state_ready: operations.opportunities.length > 0, opportunity_count: operations.opportunities.length, source_count: operations.sources.length, uses_internal_seed_when_live_absent: true },
          counts: {
            sources: operations.counts.sources,
            source_runs: operations.counts.source_runs,
            opportunities: operations.counts.opportunities,
            scores: 0,
            ai_memos: 0,
            kanban_routes: 0,
            blockers: operations.counts.blockers,
            spg_offer_records: operations.counts.spg_offer_records,
            spg_offer_candidates: operations.counts.spg_offer_candidates,
            spg_source_items: operations.counts.spg_source_items,
            spg_page_placements: operations.counts.spg_page_placements,
          },
          pursue_now: operations.opportunities.filter((row) => row.status === 'pursue').slice(0, 10),
          watch: operations.opportunities.filter((row) => row.status === 'watch').slice(0, 10),
          risk_queue: operations.opportunities.filter((row) => !['not_required', 'approved'].includes(row.gate_status || 'not_required')).slice(0, 10),
          stale_queue: operations.opportunities.filter((row) => ['stale', 'duplicate'].includes(row.status)).slice(0, 10),
          source_health_counts: operations.source_health,
          kanban_execution_bridge: [],
          operations_summary: operations,
        };
        if (!dashboard.operations_summary) dashboard.operations_summary = operations;
        return sendJson(res, 200, dashboard);
      }

      if (method === 'GET' && pathname === '/api/opportunity-desk/operations') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'dashboard:read' });
        if (!session) return null;
        return sendJson(res, 200, buildOpportunityOperationsSnapshot({ spgStore, artifactPaths: opportunityArtifactPaths }));
      }

      if (method === 'GET' && pathname === '/api/daily-pull/summary') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'dashboard:read' });
        if (!session) return null;
        return sendJson(res, 200, { summary: loadDailyPullSummary(), internalActionsOnly: true, massSendingEnabled: false });
      }

      if (method === 'GET' && pathname === '/api/jobs') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'dashboard:read' });
        if (!session) return null;
        return sendJson(res, 200, {
          jobs: jobsStore.listJobs(),
          allowlistOnly: true,
          externalActionsEnabled: false,
          massSendingEnabled: false,
        });
      }

      if (method === 'POST' && pathname === '/api/jobs/run') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        const run = jobsStore.runJob(String(body.job_id || ''), { actorId: session.userId });
        return sendJson(res, 202, {
          run,
          allowlistOnly: true,
          externalActionsEnabled: false,
          massSendingEnabled: false,
        });
      }

      const jobRunMatch = pathname.match(/^\/api\/jobs\/runs\/([^/]+)$/);
      if (method === 'GET' && jobRunMatch) {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'dashboard:read' });
        if (!session) return null;
        const run = jobsStore.getRun(decodeURIComponent(jobRunMatch[1]));
        return run ? sendJson(res, 200, { run }) : sendJson(res, 404, { error: 'job run not found' });
      }

      if (method === 'GET' && pathname === '/api/opportunity-desk/suppression-checks') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:read' });
        if (!session) return null;
        return sendJson(res, 200, { suppression_checks: opportunityDesk.listSuppressionChecks(Object.fromEntries(url.searchParams)), externalActionsEnabled: false });
      }

      if (method === 'POST' && pathname === '/api/opportunity-desk/suppression-checks') {
        const session = requirePermission({ req, res, authStore, audit, pathname, permission: 'records:write' });
        if (!session) return null;
        const body = await readJson(req);
        return sendJson(res, 201, { suppression_check: opportunityDesk.createSuppressionCheck(body, { actorId: session.userId }), externalActionsEnabled: false });
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
  if (pathname.startsWith('/crm-api/')) return pathname.replace('/crm-api/', '/api/');
  if (pathname === '/crm-api') return '/api';
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

function sendHtml(res, statusCode, body) {
  res.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function sendRedirect(res, statusCode, location) {
  res.writeHead(statusCode, {
    location,
    'cache-control': 'no-store',
  });
  res.end('');
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

function filterArtifactRecords(records, filters, keys) {
  return records.filter((record) => keys.every((key) => filters[key] == null || String(record[key]) === String(filters[key])));
}

function performOpportunityAction({ opportunityDesk, opportunityId, body = {}, operations = {}, actorId }) {
  ensureOpportunityAvailable({ opportunityDesk, opportunityId, operations, actorId });
  const action = String(body.action || '').trim().toLowerCase();
  if (!['pursue', 'watch', 'reject', 'assign_owner', 'create_kanban_task', 'draft_memo'].includes(action)) {
    const error = new Error('unsupported opportunity action');
    error.statusCode = 422;
    throw error;
  }

  let actionResult;
  if (['pursue', 'watch', 'reject'].includes(action)) {
    const decision = opportunityDesk.recordDecision(opportunityId, {
      decision: action,
      rationale: body.reason || body.rationale || `${action} selected from Opportunity Desk one-click controls.`,
      next_action: body.next_action || (action === 'pursue' ? 'Create internal execution task and draft memo.' : action === 'watch' ? 'Keep in watch queue for next daily pull.' : 'Reject from active money queue.'),
      requires_boss_approval: action === 'pursue',
    }, { actorId });
    actionResult = { kind: 'decision', decision };
  } else if (action === 'assign_owner') {
    const owner = cleanOwner(body.owner_profile || body.owner || body.assignee_profile || 'productops');
    const opportunity = opportunityDesk.patchOpportunity(opportunityId, {
      owner_profile: owner,
      route_owner_profile: owner,
    }, { actorId });
    actionResult = { kind: 'assignment', owner_profile: owner, opportunity };
  } else if (action === 'create_kanban_task') {
    const route = opportunityDesk.proposeKanbanRoute(opportunityId, {
      route_type: body.route_type || 'sales_prep',
      assignee_profile: cleanOwner(body.owner_profile || body.assignee_profile || 'arman'),
      route_status: 'proposed',
      priority: body.priority || 'P0',
      blocked_external_actions: ['bid_submission', 'grant_application', 'outreach', 'email_send', 'sms_send', 'spend', 'provider_push'],
      no_external_action_statement: 'No external action, outreach, bid, application, spend, email/SMS, provider push, tax/bank/KYC, or public claim is authorized by this Kanban draft.',
    }, { actorId });
    actionResult = { kind: 'kanban_route', route };
  } else if (action === 'draft_memo') {
    const memo = opportunityDesk.createMemo(opportunityId, {
      model_name: body.model_name || 'crm-internal-ai-helper',
      memo_type: body.memo_type || 'go_no_go',
      memo_markdown: body.memo_markdown || null,
      confidence: body.confidence ?? 0.72,
      recommended_decision: body.recommended_decision || null,
      next_best_action: body.next_best_action || 'Review internally, assign owner, then create a gated Kanban execution task if worth pursuing.',
      risk_flags: body.risk_flags || ['external_actions_blocked_until_boss_approval'],
      proof_gaps: body.proof_gaps || ['confirm buyer fit', 'confirm deadline', 'confirm allowed response path'],
    }, { actorId });
    actionResult = { kind: 'memo', memo };
  }

  return {
    action_result: actionResult,
    opportunity: opportunityDesk.getOpportunity(opportunityId),
    blocked_external_actions: ['bid_submission', 'grant_application', 'outreach', 'email_send', 'sms_send', 'spend', 'provider_push'],
  };
}

function ensureOpportunityAvailable({ opportunityDesk, opportunityId, operations = {}, actorId }) {
  try {
    return opportunityDesk.getOpportunity(opportunityId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }
  const artifact = (operations.opportunities || []).find((record) => record.opportunity_id === opportunityId || record.dedupe_key === opportunityId);
  if (!artifact) {
    const error = new Error('opportunity not found');
    error.statusCode = 404;
    throw error;
  }
  return opportunityDesk.upsertOpportunity({
    opportunity_id: artifact.opportunity_id || opportunityId,
    source_id: artifact.source_id || 'artifact_source',
    external_id: artifact.external_id || artifact.notice_id || artifact.opportunity_id || opportunityId,
    opportunity_type: normalizeOpportunityType(artifact.opportunity_type),
    title: artifact.title,
    summary: artifact.summary || artifact.score_explanation || artifact.first_cash_path || artifact.next_best_action,
    buyer_org_name: artifact.buyer_org_name || artifact.buyer_sponsor_agency_network || 'Unknown public buyer',
    buyer_domain: artifact.buyer_domain,
    geography: artifact.geography || artifact.jurisdiction,
    jurisdiction: artifact.jurisdiction,
    source_url: artifact.external_url || artifact.source_url,
    source_snapshot_hash: artifact.source_snapshot_hash,
    evidence_refs: artifact.evidence_refs || [artifact.external_url || artifact.source_url || artifact.source_id].filter(Boolean),
    collected_at: artifact.updated_at || new Date().toISOString(),
    gate_status: normalizeGateStatus(artifact.gate_status),
    status: normalizeOpportunityStatus(artifact.status),
    fit_tags: artifact.fit_tags || [artifact.company_fit, artifact.source_family].filter(Boolean),
    risk_flags: artifact.risk_flags || [],
    proof_required: artifact.proof_required || [],
    next_best_action: artifact.next_best_action || artifact.first_cash_path,
    first_cash_path: artifact.first_cash_path || artifact.next_best_action,
    expected_value_usd: artifact.expected_value_usd,
    owner_profile: artifact.owner_profile || artifact.route_owner_profile,
    route_owner_profile: artifact.route_owner_profile || artifact.owner_profile,
    privacy_pii_handling: artifact.privacy_pii_handling || 'public_org_only',
    suppression_status: artifact.suppression_status || 'not_applicable',
    due_date: artifact.due_date,
  }, { actorId });
}

function normalizeOpportunityType(value) {
  const map = { government_contract: 'contract', affiliate_offer: 'affiliate_program', sponsor: 'sponsorship', job_posting_signal: 'job_signal', service_lead: 'service', content_trend: 'content_signal' };
  const normalized = map[value] || value;
  const allowed = new Set(['grant', 'contract', 'subcontract', 'sponsorship', 'affiliate_program', 'job_signal', 'marketplace_rfp', 'content_signal', 'partnership', 'internal_referral', 'local_smb_lead', 'service', 'government', 'government_award_intel', 'state_local_procurement', 'prime_portal', 'proof_signal']);
  return allowed.has(normalized) ? normalized : 'service';
}

function normalizeOpportunityStatus(value) {
  const map = { rejected: 'reject' };
  const normalized = map[value] || value;
  const allowed = new Set(['new', 'scored', 'pursue', 'watch', 'reject', 'needs_data', 'needs_partner', 'needs_approval', 'blocked', 'archived', 'routed', 'stale', 'duplicate']);
  return allowed.has(normalized) ? normalized : 'watch';
}

function normalizeGateStatus(value) {
  const allowed = new Set(['not_required', 'needs_review', 'blocked', 'approved']);
  return allowed.has(value) ? value : 'needs_review';
}

function cleanOwner(value) {
  return String(value || 'productops').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48) || 'productops';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
