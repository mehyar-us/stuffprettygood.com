import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseFeed } from './fetch-spg-rss.mjs';

export const COLLECTOR_VERSION = 'opportunity-collectors.v1';

const DEFAULT_REGISTRY_PATH = 'data/opportunity-source-registry.json';
const DEFAULT_OUTPUT_PATH = 'data/opportunity-desk/opportunity-source-runs.json';
const DEFAULT_OPPORTUNITIES_PATH = 'data/opportunity-desk/opportunities.json';
const NO_SECRET_RE = /(api[_-]?key|token|password|secret|authorization|bearer)=[^&\s]+/ig;
const RISK_TERMS = /(certification|required registration|bonding|insurance|nda|exclusive|security clearance|pricing proposal|tax|bank|kyc)/i;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}/${day}/${year}`;
}

function daysAgoDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function scrubUrl(value = '') {
  return String(value || '').replace(NO_SECRET_RE, '$1=REDACTED');
}

function dedupeKey(parts) {
  return createHash('sha256').update(parts.filter(Boolean).join('|').toLowerCase()).digest('hex').slice(0, 24);
}

function safeText(value, limit = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function gateEvidence(source, raw, extra = {}) {
  return {
    source_type: source.source_type,
    source_name: source.name,
    source_url: scrubUrl(extra.source_url || raw.source_url || raw.url || source.endpoint || source.feed_url || source.access_terms_ref),
    source_record_id: safeText(extra.source_record_id || raw.noticeId || raw.notice_id || raw.id || raw.opportunityId || raw.number || raw.award_id || raw.generated_internal_id || ''),
    collected_at: new Date().toISOString(),
    allowed_access_method: source.allowed_access_method,
    access_terms_ref: source.access_terms_ref,
    collection_rate_limit: source.rate_limit || source.collection_rate_limit || null,
    parser_version: COLLECTOR_VERSION,
    source_health_status: 'ok',
    gate_status: 'draft_only',
    gate_ref: source.gate_ref || 't_370312f0',
    external_action_type: 'none',
    data_classification: 'public',
    pii_present: 'none',
    secret_present: false,
    owner_profile: source.owner_profile,
    company_fit: source.company_fit || 'mixed',
    ...extra
  };
}

function termsRiskFlags(text) {
  const flags = [];
  if (RISK_TERMS.test(text)) flags.push('needs_requirements_review');
  if (/set-aside|small business|8\(a\)|hubzone|sdvosb|wosb/i.test(text)) flags.push('certification_status_must_be_verified');
  if (/due|deadline|response date|close date/i.test(text)) flags.push('deadline_review_required');
  return [...new Set(flags)];
}

function scoreOpportunity(input) {
  const hay = `${input.title || ''} ${input.description || ''} ${(input.tags || []).join(' ')}`.toLowerCase();
  let score = 30;
  if (/software|website|web|crm|automation|ai|data|marketing|media|content|analytics/.test(hay)) score += 28;
  if (/sources sought|rfi|market research|forecast|award|subcontract/.test(hay)) score += 14;
  if (/grant|training|workforce|small business/.test(hay)) score += 8;
  const risks = termsRiskFlags(hay);
  score -= risks.length * 8;
  return {
    overall_score: Math.max(0, Math.min(100, score)),
    recommendation: score >= 68 && risks.length === 0 ? 'pursue' : score >= 45 ? 'watch' : 'reject',
    confidence: input.source_record_id ? 0.74 : 0.58,
    missing_fields: ['human_reviewer', 'final_decision'],
    risk_flags: risks,
    explanation: 'Deterministic internal triage score from public source metadata; not an external decision.'
  };
}

function firstCashWindowDays(source) {
  if (Number.isFinite(Number(source.first_cash_window_days))) return Number(source.first_cash_window_days);
  if (source.source_type === 'spg_proof_signal') return 1;
  if (source.source_type === 'affiliate_sponsor_opportunity') return 3;
  if (source.source_type === 'local_smb_lead' || source.source_type === 'marketplace_job' || source.source_type === 'job_posting_lead') return 14;
  if (source.family === 'state_local') return 45;
  if (source.family === 'prime_portal' || source.family === 'subcontracting') return 60;
  return null;
}

function expectedValueConfidence(value, basis) {
  if (!value) return null;
  if (/posted|award|public|native/i.test(basis || '')) return 0.72;
  return 0.48;
}

function fitScoreDimensions(source, score, valueEstimate) {
  return {
    ...(source.source_fit_dimensions || {}),
    deterministic_score: score.overall_score,
    expected_value_signal: valueEstimate ? 'present' : 'missing',
    source_priority: source.source_priority || 50
  };
}

function normalizeOpportunity(source, raw, extra = {}) {
  const title = safeText(extra.title || raw.title || raw.opportunityTitle || raw.description || raw.AwardDescription || raw.award_description || raw.synopsis?.opportunityTitle || 'Untitled opportunity', 180);
  const agency = safeText(extra.agency || raw.department || raw.agency || raw.awarding_agency_name || raw.funder || raw.synopsis?.agencyName || raw.source_name || source.name, 160);
  const sourceRecordId = safeText(extra.source_record_id || raw.noticeId || raw.id || raw.opportunityId || raw.award_id || raw.number || raw.generated_internal_id || title, 120);
  const sourceUrl = scrubUrl(extra.source_url || raw.uiLink || raw.url || raw.generated_internal_url || source.endpoint || source.access_terms_ref || '');
  const dueDate = extra.due_date || raw.responseDeadLine || raw.closeDate || raw.due_date || raw.closeoutDate || null;
  const description = safeText(extra.description || raw.description || raw.AwardDescription || raw.award_description || raw.synopsis?.description || '', 360);
  const valueEstimate = extra.value_estimate || raw.award_amount || raw.generated_value_estimate || null;
  const score = scoreOpportunity({ title, description, tags: extra.tags || [], source_record_id: sourceRecordId });
  const opportunity = {
    dedupe_key: dedupeKey([source.id, sourceRecordId, title, sourceUrl]),
    source_id: source.id,
    source_family: source.family,
    title,
    buyer_sponsor_agency_network: agency,
    opportunity_type: source.source_type === 'grant' ? 'grant' : ['marketplace_job', 'job_posting_lead'].includes(source.source_type) ? 'service' : source.source_type === 'federal_award_intel' ? 'government_award_intel' : source.source_type === 'state_local_procurement' ? 'state_local_procurement' : source.source_type === 'subcontract_prime_portal' ? 'prime_portal' : source.source_type === 'affiliate_sponsor_opportunity' ? 'affiliate_program' : source.source_type === 'spg_proof_signal' ? 'proof_signal' : 'government',
    company_fit: source.company_fit || 'mixed',
    due_date: dueDate,
    value_estimate: valueEstimate,
    expected_value_usd: valueEstimate,
    expected_value_basis: source.expected_value_basis || (valueEstimate ? 'source native amount where available' : 'missing_source_value'),
    expected_value_confidence: expectedValueConfidence(valueEstimate, source.expected_value_basis),
    revenue_model: source.source_type === 'grant' ? 'grant_funding' : ['marketplace_job', 'job_posting_lead', 'local_smb_lead'].includes(source.source_type) ? 'service_revenue' : source.source_type === 'affiliate_sponsor_opportunity' ? 'affiliate_or_sponsor_revenue' : source.source_type === 'spg_proof_signal' ? 'proof_supported_offer_revenue' : 'services_or_software',
    fit_score_dimensions: fitScoreDimensions(source, score, valueEstimate),
    first_cash_window_days: firstCashWindowDays(source),
    first_cash_window_basis: source.first_cash_window_days ? 'source_registry_seed' : 'default_by_source_type',
    route_owner_profile: source.route_owner_profile || source.owner_profile || 'productops',
    spg_proof_signals: source.family === 'spg_proof' ? ['aggregate_offer_clicks', 'disclosure_status', 'proof_packet_status'] : [],
    status: score.recommendation,
    next_best_action: score.recommendation === 'pursue' ? 'internal_go_no_go_memo' : score.recommendation === 'watch' ? 'monitor_next_run' : 'archive_unless_new_evidence',
    external_action_type: 'none',
    gate_status: 'draft_only',
    evidence: gateEvidence(source, raw, { source_url: sourceUrl, source_record_id: sourceRecordId, due_date: dueDate }),
    score,
    ai_summary: description || `Public metadata signal from ${source.name}.`,
    created_by_collector: COLLECTOR_VERSION
  };
  opportunity.source_snapshot_hash = stableHash({ title, agency, sourceRecordId, sourceUrl, dueDate, description });
  return opportunity;
}

async function fetchJson(url, options = {}, fetchImpl = fetch) {
  const res = await fetchImpl(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url, options = {}, fetchImpl = fetch) {
  const res = await fetchImpl(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function collectSamGov(source, options = {}) {
  const env = options.env ?? process.env;
  const apiKey = env[source.credential_ref_env];
  if (!apiKey) return { skipped: true, skip_reason: `missing_env:${source.credential_ref_env}`, opportunities: [] };
  const q = source.query || {};
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(q.limit || source.max_items || 25),
    postedFrom: q.postedFrom || formatDate(daysAgoDate(q.postedFrom_days_ago || 2)),
    postedTo: q.postedTo === 'today' || !q.postedTo ? formatDate(new Date()) : q.postedTo
  });
  if (q.ptype && !String(q.ptype).includes(',')) params.set('ptype', q.ptype);
  const data = await fetchJson(`${source.endpoint}?${params}`, { headers: { 'user-agent': 'MehyarMediaOpportunityFinder/1.0' } }, options.fetchImpl || fetch);
  const rows = data.opportunitiesData || data.data || [];
  return { opportunities: rows.slice(0, q.limit || source.max_items || 25).map((row) => normalizeOpportunity(source, row, { source_url: row.uiLink || row.link || source.endpoint })) };
}

export async function collectUsaSpending(source, options = {}) {
  const q = source.query || {};
  const start = daysAgoDate(q.time_period_days || 90).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  const body = {
    filters: {
      keywords: q.keywords || [],
      time_period: [{ start_date: start, end_date: end }],
      award_type_codes: q.award_type_codes || ['A', 'B', 'C', 'D']
    },
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Description', 'Start Date', 'End Date'],
    page: 1,
    limit: q.limit || source.max_items || 25,
    sort: 'Award Amount',
    order: 'desc'
  };
  const data = await fetchJson(source.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'MehyarMediaOpportunityFinder/1.0' }, body: JSON.stringify(body) }, options.fetchImpl || fetch);
  const rows = data.results || data.data?.results || [];
  return { opportunities: rows.map((row) => normalizeOpportunity(source, row, {
    title: row.Description || row.description || `Award intelligence: ${row['Recipient Name'] || row.recipient_name || 'recipient unknown'}`,
    agency: row['Awarding Agency'] || row.awarding_agency_name,
    source_record_id: row['Award ID'] || row.award_id,
    value_estimate: row['Award Amount'] || row.award_amount,
    source_url: 'https://www.usaspending.gov/search/'
  })) };
}

export async function collectGrantsGov(source, options = {}) {
  const q = source.query || {};
  const payload = {
    keyword: q.keyword || '',
    oppStatuses: q.oppStatuses || 'posted|forecasted',
    rows: q.rows || source.max_items || 25,
    startRecordNum: 0
  };
  const data = await fetchJson(source.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'MehyarMediaOpportunityFinder/1.0' }, body: JSON.stringify(payload) }, options.fetchImpl || fetch);
  const rows = data.oppHits || data.opportunities || data.data?.oppHits || data.data || [];
  return { opportunities: rows.slice(0, q.rows || source.max_items || 25).map((row) => normalizeOpportunity(source, row, {
    title: row.title || row.opportunityTitle,
    agency: row.agencyName || row.agency,
    source_record_id: row.id || row.number || row.opportunityId,
    due_date: row.closeDate || row.closeoutDate,
    source_url: row.id ? `https://www.grants.gov/search-results-detail/${row.id}` : 'https://www.grants.gov/search-grants'
  })) };
}

function rssSourceFromRegistry(source, entry) {
  return {
    ...source,
    id: entry.id || source.id,
    name: entry.name || source.name,
    category: entry.category || source.source_type,
    allowed_use: entry.allowed_use || 'metadata_only',
    homepage_url: entry.homepage_url || entry.feed_url,
    feed_url: entry.feed_url,
    access_terms_ref: entry.terms_url || source.access_terms_ref
  };
}

export async function collectRssRegistry(source, options = {}) {
  const registry = readJson(source.registry_path, { sources: [] });
  if (!registry?.sources?.length) return { skipped: true, skip_reason: `missing_or_empty_registry:${source.registry_path}`, opportunities: [] };
  const opportunities = [];
  const errors = [];
  for (const entry of registry.sources.filter((item) => item.enabled && item.risk !== 'blocked').slice(0, 10)) {
    const rssSource = rssSourceFromRegistry(source, entry);
    try {
      const xml = await fetchText(entry.feed_url, { headers: { 'user-agent': 'MehyarMediaOpportunityFinder/1.0' } }, options.fetchImpl || fetch);
      opportunities.push(...parseFeed(xml, rssSource).slice(0, 5).map((item) => normalizeOpportunity(source, item, {
        title: item.title,
        agency: item.source_name,
        source_url: item.url,
        source_record_id: item.url,
        description: item.summary_excerpt,
        tags: item.matched_lanes || []
      })));
    } catch (error) {
      errors.push({ source_id: entry.id || source.id, error: safeText(error.message, 160) });
    }
  }
  return { opportunities, errors };
}

export async function collectPostings(source, options = {}) {
  const opportunities = [];
  for (const entry of (source.feeds || []).slice(0, 10)) {
    const rssSource = rssSourceFromRegistry(source, entry);
    const xml = await fetchText(entry.feed_url, { headers: { 'user-agent': 'MehyarMediaOpportunityFinder/1.0' } }, options.fetchImpl || fetch);
    opportunities.push(...parseFeed(xml, rssSource).slice(0, 10).map((item) => normalizeOpportunity(source, item, {
      title: item.title,
      agency: item.source_name,
      source_url: item.url,
      source_record_id: item.url,
      description: item.summary_excerpt,
      tags: ['demand_signal', 'public_posting']
    })));
  }
  return { opportunities };
}

export async function collectSource(source, options = {}) {
  switch (source.family) {
    case 'sam_gov': return collectSamGov(source, options);
    case 'usaspending': return collectUsaSpending(source, options);
    case 'grants_gov': return collectGrantsGov(source, options);
    case 'rss': return collectRssRegistry(source, options);
    case 'postings': return collectPostings(source, options);
    default: return { skipped: true, skip_reason: `unsupported_family:${source.family}`, opportunities: [] };
  }
}

function mergeOpportunities(existing, incoming) {
  const byKey = new Map();
  for (const item of existing || []) byKey.set(item.dedupe_key, item);
  for (const item of incoming || []) byKey.set(item.dedupe_key, { ...(byKey.get(item.dedupe_key) || {}), ...item, updated_at: new Date().toISOString() });
  return [...byKey.values()].sort((a, b) => (b.score?.overall_score || 0) - (a.score?.overall_score || 0));
}

export async function runCollectors({ registryPath = DEFAULT_REGISTRY_PATH, outputPath = DEFAULT_OUTPUT_PATH, opportunitiesPath = DEFAULT_OPPORTUNITIES_PATH, fetchImpl = fetch, env = process.env } = {}) {
  const registry = readJson(registryPath);
  if (!registry?.sources?.length) throw new Error(`Source registry missing sources: ${registryPath}`);
  const prior = readJson(outputPath, { runs: [] });
  const allOpportunities = [];
  const runs = [];
  for (const source of registry.sources.filter((item) => item.enabled !== false)) {
    const started_at = new Date().toISOString();
    try {
      const result = await collectSource(source, { fetchImpl, env });
      const opportunities = result.opportunities || [];
      allOpportunities.push(...opportunities);
      runs.push({
        run_id: `${todayUtc()}-${source.id}`,
        source_id: source.id,
        source_family: source.family,
        status: result.skipped ? 'skipped' : result.errors?.length ? 'warning' : 'ok',
        skip_reason: result.skip_reason || null,
        started_at,
        finished_at: new Date().toISOString(),
        opportunity_count: opportunities.length,
        error: result.errors?.length ? result.errors.map((item) => `${item.source_id}:${item.error}`).join('; ').slice(0, 500) : null,
        collector_version: COLLECTOR_VERSION,
        source_health_after: result.skipped ? 'needs_review' : result.errors?.length ? 'warning' : 'ok',
        source_health_reason: result.skipped ? result.skip_reason : result.errors?.length ? 'collector warnings present' : 'collector completed',
        next_run_after: source.refresh_cadence === 'daily' || source.schedule === 'daily' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null
      });
    } catch (error) {
      runs.push({
        run_id: `${todayUtc()}-${source.id}`,
        source_id: source.id,
        source_family: source.family,
        status: /HTTP 403|HTTP 429/.test(error.message) ? 'blocked' : 'error',
        skip_reason: null,
        started_at,
        finished_at: new Date().toISOString(),
        opportunity_count: 0,
        error: safeText(error.message, 220),
        collector_version: COLLECTOR_VERSION
      });
    }
  }
  const sourceRuns = {
    generated_at: new Date().toISOString(),
    schema_version: 'opportunity_source_runs.v1',
    guardrails: registry.guardrails,
    latest_runs: runs,
    runs: [...runs, ...(prior.runs || []).filter((run) => !runs.some((newRun) => newRun.run_id === run.run_id))].slice(0, 300)
  };
  const existingOpportunities = readJson(opportunitiesPath, { opportunities: [] });
  const opportunities = {
    generated_at: new Date().toISOString(),
    schema_version: 'opportunity_records.v1',
    collector_version: COLLECTOR_VERSION,
    guardrails: registry.guardrails,
    opportunities: mergeOpportunities(existingOpportunities.opportunities || [], allOpportunities).slice(0, 500)
  };
  ensureParent(outputPath);
  ensureParent(opportunitiesPath);
  writeFileSync(outputPath, JSON.stringify(sourceRuns, null, 2) + '\n');
  writeFileSync(opportunitiesPath, JSON.stringify(opportunities, null, 2) + '\n');
  return { status: 'opportunity_collectors_complete', run_count: runs.length, ok_count: runs.filter((run) => run.status === 'ok').length, skipped_count: runs.filter((run) => run.status === 'skipped').length, error_count: runs.filter((run) => ['error', 'blocked'].includes(run.status)).length, opportunity_count: opportunities.opportunities.length, outputPath, opportunitiesPath };
}

async function main() {
  const result = await runCollectors({ registryPath: process.argv[2] || DEFAULT_REGISTRY_PATH, outputPath: process.argv[3] || DEFAULT_OUTPUT_PATH, opportunitiesPath: process.argv[4] || DEFAULT_OPPORTUNITIES_PATH });
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => {
  console.error(JSON.stringify({ status: 'opportunity_collectors_failed', error: safeText(error.message, 300) }, null, 2));
  process.exitCode = 1;
});
