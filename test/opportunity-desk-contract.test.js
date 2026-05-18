import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { AuditLog } from '../src/core/audit.js';
import { AuthStore, seedAdmin } from '../src/core/auth.js';
import { createApp } from '../src/server.js';
import { OpportunityDeskStore } from '../src/opportunity-desk/store.js';
import { SpgDurableStore } from '../src/spg/durable-store.js';

function tempOpportunityDesk(auditLog) {
  const dir = mkdtempSync(join(tmpdir(), 'opportunity-desk-'));
  return new OpportunityDeskStore({ path: join(dir, 'opportunity-desk-store.json'), auditLog });
}

function tempSpgStore(auditLog) {
  const dir = mkdtempSync(join(tmpdir(), 'spg-durable-'));
  return new SpgDurableStore({ path: join(dir, 'spg-durable-store.json'), auditLog });
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

test('Opportunity Desk API enforces auth and source credential refs are env-only', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
  const opportunityDesk = tempOpportunityDesk(auditLog);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, opportunityDesk }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const denied = await requestJson(`${baseUrl}/api/opportunity-desk/sources`);
    assert.equal(denied.status, 401);

    const login = await requestJson(`${baseUrl}/api/auth/login`, { method: 'POST', body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' } });
    const headers = { authorization: `Bearer ${login.body.session.id}` };

    const created = await requestJson(`${baseUrl}/api/opportunity-desk/sources`, {
      method: 'POST',
      headers,
      body: {
        source_family: 'affiliate',
        source_name: 'Safe affiliate public program list',
        source_url: 'https://example.com/programs',
        access_method: 'api',
        auth_required: true,
        credential_ref_env: 'env:OPPORTUNITY_AFFILIATE_API_KEY',
        source_health: 'ok',
        active: true,
        owner_department: 'scout',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.source.credential_ref_env, 'env:OPPORTUNITY_AFFILIATE_API_KEY');
    assert.equal(created.body.source.route_owner_profile, 'scout');
    assert.equal(created.body.externalActionsEnabled, false);

    const secretValue = await requestJson(`${baseUrl}/api/opportunity-desk/sources`, {
      method: 'POST',
      headers,
      body: { source_family: 'rss', source_name: 'Bad secret', access_method: 'api', credential_ref_env: 'sk_liv...owed', source_health: 'ok' },
    });
    assert.equal(secretValue.status, 422);
    assert.match(secretValue.body.error, /credential_ref_env/);
  } finally {
    await close(server);
  }
});

test('Opportunity Desk ingests normalized opportunities, scores, memoizes, and routes sanitized Kanban drafts', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
  const opportunityDesk = tempOpportunityDesk(auditLog);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, opportunityDesk }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const login = await requestJson(`${baseUrl}/api/auth/login`, { method: 'POST', body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' } });
    const headers = { authorization: `Bearer ${login.body.session.id}` };

    const source = await requestJson(`${baseUrl}/api/opportunity-desk/sources`, {
      method: 'POST',
      headers,
      body: { source_id: 'src_rss_public_test', source_family: 'rss', source_name: 'Public RSS revenue feed', source_url: 'https://example.com/rss', access_method: 'rss', source_health: 'ok', active: true, quality_baseline_score: 82, refresh_cadence: 'daily' },
    });
    assert.equal(source.status, 201);

    const ingest = await requestJson(`${baseUrl}/api/opportunity-desk/source-runs`, {
      method: 'POST',
      headers,
      body: {
        source_id: 'src_rss_public_test',
        parser_version: 'test-parser-v1',
        records: [
          {
            external_id: 'rss-001',
            external_url: 'https://example.com/public-sponsor-signal',
            opportunity_type: 'sponsorship',
            title: 'AI tools sponsor package research',
            summary: 'Public sponsor signal for AI tool audience monetization.',
            buyer_org_name: 'Example Sponsor Co',
            buyer_domain: 'example.com',
            fit_tags: ['Mehyar Media', 'Axial', 'asset-building'],
            evidence_refs: ['https://example.com/public-sponsor-signal'],
            first_cash_path: 'Internal sponsor brief and proof checklist before any outreach.',
            proof_required: ['audience fit summary', 'claim-safe media kit'],
            gate_status: 'not_required',
            suppression_status: 'not_applicable',
          },
          {
            external_id: 'rss-raw-pii',
            opportunity_type: 'sponsorship',
            title: 'Unsafe raw person email jane@example.com',
            buyer_org_name: 'Unsafe Co',
          },
        ],
      },
    });
    assert.equal(ingest.status, 202);
    assert.equal(ingest.body.records_new, 1);
    assert.equal(ingest.body.records_rejected, 1);
    assert.equal(opportunityDesk.state.source_health_logs.length, 1);
    assert.equal(opportunityDesk.state.source_health_logs[0].records_rejected, 1);
    assert.ok(ingest.body.blocked_side_effects.includes('public_publish'));
    const opportunityId = ingest.body.opportunities[0].opportunity_id;

    const score = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/${opportunityId}/score`, { method: 'POST', headers, body: {} });
    assert.equal(score.status, 201);
    for (const field of ['raw_dimension_scores', 'weights', 'weighted_score', 'confidence_score', 'false_positive_risk', 'missing_fields', 'source_age_hours', 'privacy_pii_handling', 'refresh_cadence', 'score_explanation', 'recommendation_band']) {
      assert.ok(Object.hasOwn(score.body.score, field), `${field} missing`);
    }
    assert.equal(score.body.externalActionsEnabled, false);

    const memo = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/${opportunityId}/memos`, { method: 'POST', headers, body: {} });
    assert.equal(memo.status, 201);
    assert.match(memo.body.memo.memo_markdown, /INTERNAL DECISION SUPPORT/);
    assert.match(memo.body.memo.memo_markdown, /Evidence refs/);
    assert.equal(memo.body.memo.model_name, 'no-external-call');
    assert.doesNotMatch(JSON.stringify(memo.body), /jane@example\.com|sk_live/i);

    const applicationPlan = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/${opportunityId}/memos`, { method: 'POST', headers, body: { memo_type: 'application_plan' } });
    assert.equal(applicationPlan.status, 201);
    assert.equal(applicationPlan.body.memo.memo_type, 'application_plan');
    assert.match(applicationPlan.body.memo.memo_markdown, /AI application helper/);
    assert.match(applicationPlan.body.memo.memo_markdown, /Apply path/);
    assert.match(applicationPlan.body.memo.memo_markdown, /cannot submit\/apply\/contact\/publish/);

    const route = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/${opportunityId}/route-kanban`, {
      method: 'POST',
      headers,
      body: { route_type: 'product_brief', acceptance_criteria: ['Evidence reviewed', 'No external outreach'] },
    });
    assert.equal(route.status, 201);
    assert.equal(route.body.route.route_status, 'proposed');
    assert.equal(route.body.route.sanitized_kanban_draft.no_external_action_statement, 'No external submissions or commitments authorized by this route.');
    assert.ok(route.body.route.blocked_side_effects.includes('affiliate_application'));

    const digest = await requestJson(`${baseUrl}/api/opportunity-desk/digest?date=2026-05-15&scope=test`, { headers });
    assert.equal(digest.status, 200);
    assert.ok(digest.body.digest.top_opportunity_ids.includes(opportunityId));

    const dashboard = await requestJson(`${baseUrl}/api/opportunity-desk/dashboard`, { headers });
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.externalActionsEnabled, false);
    assert.equal(dashboard.body.counts.opportunities, 1);
    for (const key of ['daily_digest', 'source_health', 'opportunity_inbox_counts', 'top_money_lanes', 'ai_memo_queue', 'decision_queue', 'kanban_route_proposals', 'revenue_process_board', 'gate_alerts', 'seed_data_status']) {
      assert.ok(Object.hasOwn(dashboard.body, key), `dashboard missing ${key}`);
    }
    assert.ok(dashboard.body.top_money_lanes.length >= 5);
    assert.equal(dashboard.body.seed_data_status.no_empty_state_ready, true);
  } finally {
    await close(server);
  }
});

test('Opportunity Desk blocks publish/commitment transitions without live approval', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
  const opportunityDesk = tempOpportunityDesk(auditLog);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, opportunityDesk }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const login = await requestJson(`${baseUrl}/api/auth/login`, { method: 'POST', body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' } });
    const headers = { authorization: `Bearer ${login.body.session.id}` };
    const created = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities`, {
      method: 'POST',
      headers,
      body: {
        source_id: 'src_manual_revenue_research',
        external_id: 'manual-gated-001',
        opportunity_type: 'affiliate_program',
        title: 'Affiliate application candidate',
        buyer_org_name: 'Network Co',
        evidence_refs: ['https://example.com/program'],
        expected_value_usd: 500,
        expected_value_basis: 'public commission estimate',
        first_cash_window_days: 14,
        route_owner_profile: 'arman',
        external_action_type: 'affiliate_application',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.opportunity.gate_status, 'pending');

    const blockedPatch = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/${created.body.opportunity.opportunity_id}`, {
      method: 'PATCH',
      headers,
      body: { status: 'submitted', external_action_type: 'affiliate_application' },
    });
    assert.equal(blockedPatch.status, 403);

    const blockedDecision = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/${created.body.opportunity.opportunity_id}/decision`, {
      method: 'POST',
      headers,
      body: { decision: 'pursue', external_action_type: 'affiliate_application' },
    });
    assert.equal(blockedDecision.status, 403);

    const safeDecision = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/${created.body.opportunity.opportunity_id}/decision`, {
      method: 'POST',
      headers,
      body: { decision: 'watch', decision_reason: 'Internal prep only until approval.' },
    });
    assert.equal(safeDecision.status, 201);
    assert.equal(safeDecision.body.decision.expected_value_snapshot_usd, 500);
    assert.equal(safeDecision.body.decision.first_cash_window_snapshot_days, 14);
    assert.equal(safeDecision.body.decision.route_owner_profile, 'arman');
    assert.equal(safeDecision.body.decision.gate_status_snapshot, 'pending');
  } finally {
    await close(server);
  }
});

test('Opportunity Desk operations endpoint is authenticated, artifact-backed, and sanitized', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
  const opportunityDesk = tempOpportunityDesk(auditLog);
  const spgStore = tempSpgStore(auditLog);
  const fixtureDir = mkdtempSync(join(tmpdir(), 'opportunity-artifacts-'));
  const artifactPaths = {
    dailyPullLatest: join(fixtureDir, 'data/daily-pull/latest.json'),
    sourceRuns: join(fixtureDir, 'data/opportunity-desk/opportunity-source-runs.json'),
    opportunities: join(fixtureDir, 'data/opportunity-desk/opportunities.json'),
    sourceRegistry: join(fixtureDir, 'data/opportunity-source-registry.json'),
  };

  writeJson(artifactPaths.dailyPullLatest, {
    generated_at: '2026-05-15T12:00:00.000Z',
    status: 'ok',
    deploy_status: 'watch',
    source_families: ['contracts', 'rss'],
    counts: { spg_offer_records: 4, spg_page_placements: 2, spg_offer_candidates: 1 },
    opportunity_source_health: { ok: 1, warning: 1 },
    guardrails: ['No raw PII in public payloads', 'Env-key-name-only credential refs'],
    log_file: 'logs/daily-pull.log',
  });
  writeJson(artifactPaths.sourceRuns, {
    generated_at: '2026-05-15T12:05:00.000Z',
    guardrails: ['No external actions'],
    latest_runs: [
      {
        run_id: 'run_contracts_001',
        source_id: 'sam_gov_contract_opportunities',
        source_family: 'contracts',
        status: 'ok',
        finished_at: '2026-05-15T12:04:00.000Z',
        opportunity_count: 3,
        source_health_after: 'ok',
      },
      {
        run_id: 'run_rss_001',
        source_id: 'public_rss_revenue_signals',
        source_family: 'rss',
        status: 'warning',
        finished_at: '2026-05-15T12:03:00.000Z',
        opportunity_count: 1,
        source_health_after: 'warning',
        error: 'rate_limited',
      },
    ],
  });
  writeJson(artifactPaths.opportunities, {
    generated_at: '2026-05-15T12:06:00.000Z',
    guardrails: ['Sanitized internal ops only'],
    opportunities: [
      {
        opportunity_id: 'opp_safe_001',
        source_id: 'sam_gov_contract_opportunities',
        source_family: 'contracts',
        title: 'Claims-safe AI modernization support contract',
        buyer_org_name: 'Public Agency',
        opportunity_type: 'contract',
        company_fit: 'high',
        revenue_model: 'services',
        status: 'pursue',
        gate_status: 'approved',
        next_best_action: 'Prepare internal brief',
        route_owner_profile: 'arman',
        first_cash_window_days: 21,
        expected_value_usd: 24000,
        expected_value_basis: 'public estimate',
        score: { overall_score: 88, confidence: 0.77, risk_flags: ['procurement_timing'] },
        updated_at: '2026-05-15T12:06:00.000Z',
      },
      {
        opportunity_id: 'opp_pii_002',
        source_id: 'public_rss_revenue_signals',
        source_family: 'rss',
        title: 'Unsafe raw contact jane@example.com',
        buyer_org_name: 'Unsafe Co',
        opportunity_type: 'sponsorship',
        status: 'watch',
      },
    ],
  });
  writeJson(artifactPaths.sourceRegistry, {
    schema_version: 'opportunity_source_registry.v2',
    sources: [
      {
        id: 'sam_gov_contract_opportunities',
        name: 'SAM.gov public opportunities',
        family: 'contracts',
        source_type: 'api',
        enabled: true,
        allowed_access_method: 'api',
        owner_profile: 'dataeng',
        route_owner_profile: 'arman',
        business_line: 'mehyarmedia',
        source_priority: 90,
        first_cash_window_days: 21,
        expected_value_basis: 'public award ranges',
      },
      {
        id: 'public_rss_revenue_signals',
        name: 'Public revenue RSS',
        family: 'rss',
        source_type: 'rss',
        enabled: true,
        allowed_access_method: 'rss',
        owner_profile: 'scout',
        route_owner_profile: 'productops',
        business_line: 'axial',
      },
    ],
  });

  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, opportunityDesk, spgStore, opportunityArtifactPaths: artifactPaths }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const denied = await requestJson(`${baseUrl}/api/opportunity-desk/operations`);
    assert.equal(denied.status, 401);

    const login = await requestJson(`${baseUrl}/api/auth/login`, { method: 'POST', body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' } });
    const headers = { authorization: `Bearer ${login.body.session.id}` };

    const operations = await requestJson(`${baseUrl}/api/opportunity-desk/operations`, { headers });
    assert.equal(operations.status, 200);
    assert.equal(operations.body.contract_version, 'opportunity-operations-v1');
    assert.equal(operations.body.generated_at, '2026-05-15T12:00:00.000Z');
    assert.equal(operations.body.counts.opportunities, 1);
    assert.equal(operations.body.counts.sources, 2);
    assert.equal(operations.body.counts.latest_runs, 2);
    assert.equal(operations.body.source_health.ok, 1);
    assert.equal(operations.body.source_health.warning, 1);
    assert.equal(operations.body.top_first_cash_opportunities[0].opportunity_id, 'opp_safe_001');
    assert.equal(operations.body.sources[0].route_owner_profile, 'arman');
    assert.equal(operations.body.source_runs.latest_runs[1].error, 'rate_limited');
    assert.ok(operations.body.blockers.some((item) => /rate_limited/.test(item)));
    assert.deepEqual(operations.body.guardrails.sort(), ['Env-key-name-only credential refs', 'No external actions', 'No raw PII in public payloads', 'Sanitized internal ops only'].sort());
    assert.doesNotMatch(JSON.stringify(operations.body), /jane@example\.com|password|token|secret|bearer/i);

    const dashboard = await requestJson(`${baseUrl}/api/opportunity-desk/dashboard`, { headers });
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.operations_summary.contract_version, 'opportunity-operations-v1');
    assert.equal(dashboard.body.externalActionsEnabled, false);
    assert.ok(Array.isArray(dashboard.body.source_health));
    assert.ok(Array.isArray(dashboard.body.revenue_process_board));
    assert.equal(dashboard.body.seed_data_status.no_empty_state_ready, true);

    const sources = await requestJson(`${baseUrl}/api/opportunity-desk/sources?source_family=contracts`, { headers });
    assert.equal(sources.status, 200);
    assert.equal(sources.body.operations_contract_version, 'opportunity-operations-v1');
    assert.equal(sources.body.sources.length, 1);
    assert.equal(sources.body.sources[0].source_id, 'sam_gov_contract_opportunities');

    const sourceRuns = await requestJson(`${baseUrl}/api/opportunity-desk/source-runs?status=warning`, { headers });
    assert.equal(sourceRuns.status, 200);
    assert.equal(sourceRuns.body.source_runs.length, 1);
    assert.equal(sourceRuns.body.source_runs[0].source_id, 'public_rss_revenue_signals');

    const opportunities = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities?status=pursue`, { headers });
    assert.equal(opportunities.status, 200);
    assert.equal(opportunities.body.operations_contract_version, 'opportunity-operations-v1');
    assert.equal(opportunities.body.opportunities.length, 1);
    assert.equal(opportunities.body.opportunities[0].opportunity_id, 'opp_safe_001');
    assert.equal(opportunities.body.externalActionsEnabled, false);
  } finally {
    await close(server);
  }
});

test('Opportunity Desk source-level filters enrich opportunity detail from source registry', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
  const opportunityDesk = tempOpportunityDesk(auditLog);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, opportunityDesk }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const login = await requestJson(`${baseUrl}/api/auth/login`, { method: 'POST', body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' } });
    const headers = { authorization: `Bearer ${login.body.session.id}` };

    await requestJson(`${baseUrl}/api/opportunity-desk/sources`, {
      method: 'POST',
      headers,
      body: { source_id: 'src_filter_rss', source_family: 'rss', source_name: 'Public revenue RSS', source_url: 'https://example.com/rss', access_method: 'rss', source_health: 'ok', active: true, route_owner_profile: 'scout' },
    });
    await requestJson(`${baseUrl}/api/opportunity-desk/sources`, {
      method: 'POST',
      headers,
      body: { source_id: 'src_filter_affiliate', source_family: 'affiliate', source_name: 'Affiliate watchlist', source_url: 'https://example.com/affiliate', access_method: 'public_page', source_health: 'ok', active: true, route_owner_profile: 'productops' },
    });
    await requestJson(`${baseUrl}/api/opportunity-desk/opportunities`, {
      method: 'POST',
      headers,
      body: { opportunity_id: 'opp_filter_rss', source_id: 'src_filter_rss', external_id: 'rss-filter-001', opportunity_type: 'sponsorship', title: 'RSS sponsor signal', buyer_org_name: 'RSS Buyer', expected_value_usd: 1200, expected_value_basis: 'public sponsorship estimate', evidence_refs: ['https://example.com/rss-signal'], required_docs: ['media kit'], eligibility: 'public program fit', due_at: '2026-06-01T00:00:00.000Z' },
    });
    await requestJson(`${baseUrl}/api/opportunity-desk/opportunities`, {
      method: 'POST',
      headers,
      body: { opportunity_id: 'opp_filter_affiliate', source_id: 'src_filter_affiliate', external_id: 'affiliate-filter-001', opportunity_type: 'affiliate_program', title: 'Affiliate program signal', buyer_org_name: 'Affiliate Buyer', expected_value_usd: 800, expected_value_basis: 'commission basis', evidence_refs: ['https://example.com/affiliate-program'], required_docs: ['terms review'], eligibility: 'publisher account required' },
    });

    const byFamily = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities?source_family=rss`, { headers });
    assert.equal(byFamily.status, 200);
    assert.equal(byFamily.body.opportunities.length, 1);
    assert.equal(byFamily.body.opportunities[0].opportunity_id, 'opp_filter_rss');
    assert.equal(byFamily.body.opportunities[0].source_name, 'Public revenue RSS');
    assert.equal(byFamily.body.opportunities[0].source_family, 'rss');
    assert.equal(byFamily.body.opportunities[0].buyer_org_name, 'RSS Buyer');
    assert.equal(byFamily.body.opportunities[0].expected_value_basis, 'public sponsorship estimate');
    assert.equal(byFamily.body.opportunities[0].due_at, '2026-06-01T00:00:00.000Z');
    assert.deepEqual(byFamily.body.opportunities[0].required_docs, ['media kit']);
    assert.equal(byFamily.body.opportunities[0].eligibility, 'public program fit');
    assert.deepEqual(byFamily.body.opportunities[0].evidence_refs, ['https://example.com/rss-signal']);
    assert.equal(byFamily.body.externalActionsEnabled, false);

    const byName = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities?source_name=Affiliate%20watchlist`, { headers });
    assert.equal(byName.status, 200);
    assert.equal(byName.body.opportunities.length, 1);
    assert.equal(byName.body.opportunities[0].opportunity_id, 'opp_filter_affiliate');

    const run = await requestJson(`${baseUrl}/api/opportunity-desk/source-runs`, { method: 'POST', headers, body: { source_id: 'src_filter_rss', status: 'completed', records: [] } });
    assert.equal(run.status, 202);
    const runs = await requestJson(`${baseUrl}/api/opportunity-desk/source-runs?source_family=rss`, { headers });
    assert.equal(runs.status, 200);
    assert.equal(runs.body.source_runs.length, 1);
    assert.equal(runs.body.source_runs[0].source_id, 'src_filter_rss');
  } finally {
    await close(server);
  }
});

test('Opportunity Desk one-click actions persist safe decisions, owner assignment, Kanban draft, and memo', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
  const opportunityDesk = tempOpportunityDesk(auditLog);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, opportunityDesk }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const denied = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/opp_action_001/action`, {
      method: 'POST',
      body: { action: 'watch' },
    });
    assert.equal(denied.status, 401);

    const login = await requestJson(`${baseUrl}/api/auth/login`, { method: 'POST', body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' } });
    const headers = { authorization: `Bearer ${login.body.session.id}` };
    const created = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities`, {
      method: 'POST',
      headers,
      body: {
        opportunity_id: 'opp_action_001',
        source_id: 'src_manual_revenue_research',
        external_id: 'action-001',
        opportunity_type: 'service',
        title: 'CRM rescue sprint demand signal',
        summary: 'Public job-posting demand for CRM cleanup.',
        buyer_org_name: 'Example Company',
        fit_tags: ['mehyarsoft', 'crm'],
        evidence_refs: ['https://example.com/job-posting'],
        first_cash_path: 'Package internal CRM rescue sprint offer.',
        expected_value_usd: 3500,
      },
    });
    assert.equal(created.status, 201);

    const pursue = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/opp_action_001/action`, {
      method: 'POST',
      headers,
      body: { action: 'pursue', reason: 'Fast service revenue lane.' },
    });
    assert.equal(pursue.status, 201);
    assert.equal(pursue.body.action_result.kind, 'decision');
    assert.equal(pursue.body.opportunity.status, 'pursue');
    assert.equal(pursue.body.externalActionsEnabled, false);

    const assign = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/opp_action_001/action`, {
      method: 'POST',
      headers,
      body: { action: 'assign_owner', owner_profile: 'productops' },
    });
    assert.equal(assign.status, 201);
    assert.equal(assign.body.action_result.kind, 'assignment');
    assert.equal(assign.body.opportunity.owner_profile, 'productops');
    assert.equal(assign.body.opportunity.route_owner_profile, 'productops');

    const memo = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/opp_action_001/action`, {
      method: 'POST',
      headers,
      body: { action: 'draft_memo' },
    });
    assert.equal(memo.status, 201);
    assert.equal(memo.body.action_result.kind, 'memo');
    assert.match(memo.body.action_result.memo.memo_markdown, /INTERNAL DECISION SUPPORT/);

    const route = await requestJson(`${baseUrl}/api/opportunity-desk/opportunities/opp_action_001/action`, {
      method: 'POST',
      headers,
      body: { action: 'create_kanban_task', route_type: 'sales_prep', owner_profile: 'arman' },
    });
    assert.equal(route.status, 201);
    assert.equal(route.body.action_result.kind, 'kanban_route');
    assert.equal(route.body.action_result.route.route_status, 'proposed');
    assert.equal(route.body.action_result.route.assignee_profile, 'arman');
    assert.match(route.body.action_result.route.sanitized_kanban_draft.no_external_action_statement, /No external/);
    assert.doesNotMatch(JSON.stringify(route.body), /password|token|secret|bearer|jane@example\.com/i);
  } finally {
    await close(server);
  }
});

test('CRM Opportunity Desk UI exposes one-click safe action controls', () => {
  const app = readFileSync(new URL('../public/crm-login.js', import.meta.url), 'utf8');
  for (const marker of ['data-opportunity-action="pursue"', 'data-opportunity-action="watch"', 'data-opportunity-action="reject"', 'data-opportunity-action="assign_owner"', 'data-opportunity-action="create_kanban_task"', 'data-opportunity-action="draft_memo"', 'opportunity-detail-drawer', 'opportunityQueueBoard', 'opportunitySourceFilterBar', 'data-source-filter', 'Source ID', 'Source name', 'Source family', 'AI go/no-go memo', 'Decision log', 'Kanban route proposal']) {
    assert.match(app, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(app, /\/opportunity-desk\/opportunities\/\$\{encodeURIComponent\(opportunityId\)\}\/action/);
  assert.match(app, /opportunity-action-output/);

  const loggedInDesk = readFileSync(new URL('../src/opportunity-desk/ui.js', import.meta.url), 'utf8');
  for (const marker of ['Daily Digest', 'Source health', 'env-name only', 'data-action="score"', 'data-action="memo"', 'data-action="route"', 'data-action="needs_approval"', 'Source ID', 'Source name', 'Source family', 'Value basis', 'Required docs', 'Eligibility', 'AI go/no-go memo', 'Kanban route proposal', 'External action blocker']) {
    assert.match(loggedInDesk, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(loggedInDesk, /const API_BASE = '\/crm\/api'/);
  assert.match(loggedInDesk, /API_BASE \+ path\.slice\(4\)/);
  assert.match(loggedInDesk, /credential_ref_env \|\| source\.required_key_name \|\| source\.env_key_name/);
  assert.doesNotMatch(loggedInDesk, /credential_value|api_key_value|secret_value/i);
});

test('CRM namespace aliases authenticated API routes for production-mounted Opportunity Desk', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth, { email: 'admin@example.com', password: 'safe-password' });
  const opportunityDesk = tempOpportunityDesk(auditLog);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, opportunityDesk }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const denied = await requestJson(`${baseUrl}/crm/api/opportunity-desk/opportunities`);
    assert.equal(denied.status, 401);
    assert.notEqual(denied.body.error, 'not found');

    const login = await requestJson(`${baseUrl}/crm/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { email: 'admin@example.com', password: 'safe-password' },
    });
    assert.equal(login.status, 200);
    assert.ok(login.body.session.id);

    const headers = { authorization: `Bearer ${login.body.session.id}` };
    const [dashboard, opportunities, sources] = await Promise.all([
      requestJson(`${baseUrl}/crm/api/opportunity-desk/dashboard`, { headers }),
      requestJson(`${baseUrl}/crm/api/opportunity-desk/opportunities`, { headers }),
      requestJson(`${baseUrl}/crm/api/opportunity-desk/sources`, { headers }),
    ]);
    assert.equal(dashboard.status, 200);
    assert.equal(opportunities.status, 200);
    assert.equal(sources.status, 200);
    assert.ok(Array.isArray(opportunities.body.opportunities));
    assert.ok(Array.isArray(sources.body.sources));
  } finally {
    await close(server);
  }
});

test('Opportunity Desk migration is additive and defines lifecycle tables', () => {
  const migration = readFileSync(new URL('../db/005_opportunity_desk_schema.sql', import.meta.url), 'utf8');
  for (const table of ['opportunity_source_registry', 'opportunity_source_runs', 'opportunities', 'opportunity_scores', 'opportunity_ai_memos', 'opportunity_decision_logs', 'opportunity_kanban_routing_refs', 'opportunity_daily_digest_snapshots', 'opportunity_suppression_checks']) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`));
  }
  assert.doesNotMatch(migration, /drop table|truncate table|delete from/i);
  assert.match(migration, /credential_ref_env/);
  assert.match(migration, /expected_value_usd/);
  assert.match(migration, /first_cash_window_days/);
  assert.match(migration, /route_owner_profile/);
  assert.match(migration, /spg_proof_signals_json/);
  assert.match(migration, /opportunity_source_health_logs/);
  assert.match(migration, /INTERNAL DECISION SUPPORT/);
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function requestJson(url, { method = 'GET', headers = {}, body = null } = {}) {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
