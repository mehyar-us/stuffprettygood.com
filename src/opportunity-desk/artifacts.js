import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_PATHS = Object.freeze({
  dailyPullLatest: 'data/daily-pull/latest.json',
  sourceRuns: 'data/opportunity-desk/opportunity-source-runs.json',
  opportunities: 'data/opportunity-desk/opportunities.json',
  sourceRegistry: 'data/opportunity-source-registry.json',
});

const SECRET_OR_PII = /(?:password|passwd|api[_-]?key|secret|token|bearer|authorization|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b)/i;

export function defaultArtifactPaths(overrides = {}) {
  return { ...DEFAULT_PATHS, ...overrides };
}

export function buildOpportunityOperationsSnapshot({ spgStore, artifactPaths = DEFAULT_PATHS } = {}) {
  const paths = defaultArtifactPaths(artifactPaths);
  const dailyPull = readArtifact(paths.dailyPullLatest);
  const sourceRunsDoc = readArtifact(paths.sourceRuns);
  const opportunitiesDoc = readArtifact(paths.opportunities);
  const sourceRegistryDoc = readArtifact(paths.sourceRegistry);

  const latestRuns = normalizeRuns(sourceRunsDoc?.latest_runs || sourceRunsDoc?.runs || []);
  const sourceRuns = normalizeRuns(sourceRunsDoc?.runs || sourceRunsDoc?.latest_runs || []);
  const latestRunsBySource = new Map(latestRuns.map((run) => [run.source_id, run]));
  const sources = normalizeSources(sourceRegistryDoc?.sources || [], latestRunsBySource);
  const opportunities = normalizeOpportunities(opportunitiesDoc?.opportunities || []);
  const spgCounts = summarizeSpgCounts(spgStore);
  const spgReadiness = sanitizeSpgReadiness(spgStore?.networkReadiness?.() || null);
  const blockerSet = new Set();

  for (const run of latestRuns) {
    if (run.status !== 'ok' || run.skip_reason || run.error) {
      blockerSet.add([run.source_id, run.status, run.skip_reason || run.error || run.source_health_reason].filter(Boolean).join(': '));
    }
  }
  for (const blocker of spgReadiness?.hard_blockers || []) blockerSet.add(`spg:${blocker}`);

  const sourceHealth = countBy(sources, 'source_health');
  const countsByStatus = countBy(opportunities, 'status');
  const countsByFamily = countBy(opportunities, 'source_family');
  const topFirstCash = [...opportunities]
    .filter((opp) => Number.isFinite(opp.first_cash_window_days))
    .sort((a, b) => {
      const dayDiff = a.first_cash_window_days - b.first_cash_window_days;
      if (dayDiff !== 0) return dayDiff;
      return (b.score || 0) - (a.score || 0);
    })
    .slice(0, 10);

  return {
    contract_version: 'opportunity-operations-v1',
    generated_at: dailyPull?.generated_at || opportunitiesDoc?.generated_at || sourceRunsDoc?.generated_at || null,
    guardrails: sanitizeArray([...(dailyPull?.guardrails || []), ...(opportunitiesDoc?.guardrails || []), ...(sourceRunsDoc?.guardrails || [])]),
    deploy_status: sanitizeText(dailyPull?.deploy_status || 'unknown'),
    last_run: {
      generated_at: dailyPull?.generated_at || null,
      latest_source_finished_at: latestRuns.map((run) => run.finished_at).filter(Boolean).sort().at(-1) || null,
      status: sanitizeText(dailyPull?.status || 'unknown'),
      log_file: sanitizeText(dailyPull?.log_file || null),
      source_families: sanitizeArray(dailyPull?.source_families || []),
    },
    daily_pull: {
      generated_at: dailyPull?.generated_at || null,
      status: sanitizeText(dailyPull?.status || 'unknown'),
      deploy_status: sanitizeText(dailyPull?.deploy_status || 'unknown'),
      source_families: sanitizeArray(dailyPull?.source_families || []),
      counts: sanitizeObjectNumbers(dailyPull?.counts || {}),
      opportunity_source_health: sanitizeObjectNumbers(dailyPull?.opportunity_source_health || {}),
      log_file: sanitizeText(dailyPull?.log_file || null),
    },
    counts: {
      opportunities: opportunities.length,
      source_runs: sourceRuns.length,
      latest_runs: latestRuns.length,
      sources: sources.length,
      blockers: blockerSet.size,
      spg_offer_records: spgCounts.offer_records,
      spg_offer_candidates: spgCounts.offer_candidates,
      spg_source_items: spgCounts.source_items,
      spg_page_placements: spgCounts.page_placements,
    },
    source_health: sourceHealth,
    source_runs: {
      latest_runs: latestRuns,
      counts_by_status: countBy(sourceRuns, 'status'),
      counts_by_family: countBy(sourceRuns, 'source_family'),
      latest_finished_at: latestRuns.map((run) => run.finished_at).filter(Boolean).sort().at(-1) || null,
    },
    sources,
    opportunities,
    opportunity_counts: {
      total: opportunities.length,
      by_status: countsByStatus,
      by_family: countsByFamily,
    },
    top_first_cash_opportunities: topFirstCash,
    blockers: [...blockerSet],
    spg: {
      counts: spgCounts,
      network_readiness: spgReadiness,
    },
  };
}

function readArtifact(relativePath) {
  const full = resolve(process.cwd(), relativePath);
  if (!existsSync(full)) return null;
  return JSON.parse(readFileSync(full, 'utf8'));
}

function normalizeRuns(runs) {
  return runs
    .filter(Boolean)
    .map((run) => ({
      run_id: sanitizeText(run.run_id || null),
      source_id: sanitizeText(run.source_id || null),
      source_family: sanitizeText(run.source_family || null),
      status: sanitizeText(run.status || 'unknown'),
      skip_reason: sanitizeText(run.skip_reason || null),
      started_at: sanitizeText(run.started_at || null),
      finished_at: sanitizeText(run.finished_at || null),
      opportunity_count: safeNumber(run.opportunity_count),
      collector_version: sanitizeText(run.collector_version || null),
      source_health_after: sanitizeText(run.source_health_after || null),
      source_health_reason: sanitizeText(run.source_health_reason || null),
      error: sanitizeText(run.error || null),
    }));
}

function normalizeSources(sources, latestRunsBySource) {
  return sources
    .filter(Boolean)
    .map((source) => {
      const latestRun = latestRunsBySource.get(source.id) || null;
      return {
        source_id: sanitizeText(source.id || null),
        source_name: sanitizeText(source.name || null),
        source_family: sanitizeText(source.family || null),
        source_type: sanitizeText(source.source_type || null),
        enabled: Boolean(source.enabled),
        allowed_access_method: sanitizeText(source.allowed_access_method || null),
        owner_profile: sanitizeText(source.owner_profile || null),
        route_owner_profile: sanitizeText(source.route_owner_profile || null),
        business_line: sanitizeText(source.business_line || null),
        source_health: sanitizeText(latestRun?.source_health_after || source.source_health || (source.enabled ? 'unknown' : 'blocked')),
        source_priority: safeNumber(source.source_priority),
        first_cash_window_days: safeNumber(source.first_cash_window_days),
        expected_value_basis: sanitizeText(source.expected_value_basis || null),
        last_run_at: sanitizeText(latestRun?.finished_at || null),
        latest_run_status: sanitizeText(latestRun?.status || null),
        latest_run_error: sanitizeText(latestRun?.error || latestRun?.skip_reason || null),
      };
    });
}

function normalizeOpportunities(opportunities) {
  return opportunities
    .filter(Boolean)
    .map((record) => {
      const evidenceRefs = sanitizeArray([
        ...(record.evidence_refs || []),
        record.evidence?.source_record_id,
        record.evidence?.source_url,
        record.source_snapshot_hash ? `sha256:${record.source_snapshot_hash}` : null,
      ]);
      return {
        opportunity_id: sanitizeText(record.opportunity_id || record.dedupe_key || null),
        source_id: sanitizeText(record.source_id || null),
        source_family: sanitizeText(record.source_family || null),
        title: sanitizeText(record.title || null),
        summary: sanitizeText(record.summary || record.ai_summary || record.score?.explanation || null),
        buyer_org_name: sanitizeText(record.buyer_org_name || record.buyer_sponsor_agency_network || null),
        buyer_domain: sanitizeText(record.buyer_domain || null),
        geography: sanitizeText(record.geography || record.jurisdiction || null),
        jurisdiction: sanitizeText(record.jurisdiction || null),
        opportunity_type: sanitizeText(record.opportunity_type || null),
        company_fit: sanitizeText(record.company_fit || null),
        revenue_model: sanitizeText(record.revenue_model || null),
        status: sanitizeText(record.status || record.score?.recommendation || 'unknown'),
        gate_status: sanitizeText(record.gate_status || record.evidence?.gate_status || 'unknown'),
        next_best_action: sanitizeText(record.next_best_action || null),
        external_action_type: sanitizeText(record.external_action_type || null),
        route_owner_profile: sanitizeText(record.route_owner_profile || record.evidence?.owner_profile || null),
        owner_profile: sanitizeText(record.owner_profile || record.evidence?.owner_profile || null),
        first_cash_path: sanitizeText(record.first_cash_path || record.next_best_action || null),
        first_cash_window_days: safeNumber(record.first_cash_window_days),
        expected_value_usd: safeNumber(record.expected_value_usd ?? record.value_estimate),
        expected_value_basis: sanitizeText(record.expected_value_basis || null),
        score: safeNumber(record.score?.overall_score ?? record.priority_score),
        confidence: safeNumber(record.score?.confidence),
        updated_at: sanitizeText(record.updated_at || record.evidence?.collected_at || null),
        due_date: sanitizeText(record.due_date || null),
        risk_flags: sanitizeArray(record.score?.risk_flags || []),
        fit_tags: sanitizeArray([record.company_fit, ...(record.fit_tags || [])]),
        proof_required: sanitizeArray(record.proof_required || []),
        suppression_status: sanitizeText(record.suppression_status || 'unknown'),
        privacy_pii_handling: sanitizeText(record.privacy_pii_handling || record.evidence?.pii_present || 'public_org_only'),
        evidence_refs: evidenceRefs,
        external_url: sanitizeText(record.external_url || record.evidence?.source_url || null),
        fit_score_dimensions: sanitizeObjectNumbers(record.fit_score_dimensions || {}),
        score_explanation: sanitizeText(record.score?.explanation || null),
        spg_proof_signals_count: Array.isArray(record.spg_proof_signals) ? record.spg_proof_signals.length : 0,
      };
    })
    .filter((record) => record.title && !SECRET_OR_PII.test(JSON.stringify(record)));
}

function summarizeSpgCounts(spgStore) {
  const state = spgStore?.state || {};
  return {
    offer_records: safeNumber(state.offers?.length),
    offer_candidates: safeNumber(state.offer_candidates?.length),
    source_items: safeNumber(state.source_items?.length),
    page_placements: safeNumber(state.page_placements?.length),
    ingestion_runs: safeNumber(state.ingestion_runs?.length),
    sources: safeNumber(state.sources?.length),
    offer_accounts: safeNumber(state.offer_accounts?.length),
  };
}

function sanitizeSpgReadiness(readiness) {
  if (!readiness) return null;
  return {
    score: safeNumber(readiness.score),
    confidence: typeof readiness.confidence === 'number' ? readiness.confidence : null,
    readiness_status: sanitizeText(readiness.readiness_status || null),
    hard_blockers: sanitizeArray(readiness.hard_blockers || []),
    missing_data: sanitizeArray(readiness.missing_data || []),
    source_age: sanitizeText(readiness.source_age || null),
    refresh_cadence: sanitizeText(readiness.refresh_cadence || null),
  };
}

function countBy(records, key) {
  return records.reduce((acc, record) => {
    const value = sanitizeText(record?.[key] || 'unknown') || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function sanitizeArray(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => sanitizeText(value)).filter(Boolean))];
}

function sanitizeObjectNumbers(value) {
  return Object.fromEntries(Object.entries(value || {}).map(([key, entry]) => [sanitizeText(key), safeNumber(entry)]).filter(([key]) => key));
}

function sanitizeText(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text || SECRET_OR_PII.test(text)) return null;
  return text;
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
