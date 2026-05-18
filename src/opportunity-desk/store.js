import crypto from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEFAULT_STORE_PATH = 'data/opportunity-desk-store.json';
const CONTRACT_VERSION = 'opportunity-desk-api-v1';
const SCORE_MODEL_VERSION = 'opportunity-score-v1';
const MEMO_PROMPT_VERSION = 'opportunity-memo-v1';
const SECRET_PATTERN = /(?:password|passwd|api[_-]?key|secret|token|bearer|authorization|sk_live_|pk_live_|-----BEGIN)/i;
const RAW_PII_PATTERN = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b)/i;

const SOURCE_FAMILIES = new Set(['sam_gov', 'usaspending', 'grants_gov', 'state_local', 'local_smb', 'rss', 'affiliate', 'sponsor', 'job_board', 'postings', 'marketplace', 'subcontracting', 'prime_portal', 'internal_network', 'spg_proof', 'manual']);
const ACCESS_METHODS = new Set(['api', 'official_api', 'rss', 'scrape', 'public_page', 'manual', 'schema_only', 'webhook', 'csv_import', 'partner_export']);
const HEALTH_STATES = new Set(['ok', 'warning', 'blocked', 'needs_review', 'disabled']);
const OPPORTUNITY_TYPES = new Set(['grant', 'contract', 'subcontract', 'sponsorship', 'affiliate_program', 'job_signal', 'marketplace_rfp', 'content_signal', 'partnership', 'internal_referral', 'local_smb_lead', 'service', 'government', 'government_award_intel', 'state_local_procurement', 'prime_portal', 'proof_signal']);
const STATUSES = new Set(['new', 'scored', 'pursue', 'watch', 'reject', 'needs_data', 'needs_partner', 'needs_approval', 'blocked', 'archived', 'routed', 'pursuing', 'submitted', 'won', 'lost', 'stale', 'duplicate']);
const GATE_STATUSES = new Set(['not_required', 'pending', 'approved', 'rejected', 'expired', 'needs_review']);
const SUPPRESSION_STATUSES = new Set(['unknown', 'not_applicable', 'clear', 'blocked', 'needs_review']);
const ROUTE_TYPES = new Set(['product_brief', 'collector', 'backend_api', 'ui_build', 'comply_review', 'scout_research', 'sales_prep', 'devops_job', 'data_quality', 'review']);
const INTERNAL_MEMO_BANNER = 'INTERNAL DECISION SUPPORT — NOT EXTERNAL COPY';
const BLOCKED_EXTERNAL_ACTIONS = ['bid', 'grant_submission', 'proposal', 'affiliate_application', 'sponsor_outreach', 'account_creation', 'paid_account', 'kyc_tax_bank', 'mass_send', 'public_publish', 'legal_claim', 'raw_pii_export'];

export const SCORE_WEIGHTS = Object.freeze({
  speed_to_cash: 15,
  expected_value: 14,
  gross_margin: 10,
  existing_asset_fit: 13,
  audience_channel_fit: 10,
  compliance_risk: -12,
  reputation_risk: -10,
  automation_potential: 10,
  recurring_revenue_potential: 10,
  operational_complexity: -8,
  boss_attention_required: -10,
  source_quality: 8,
  evidence_strength: 8,
  deadline_urgency_fit: 4,
  strategic_option_value: 10,
});

export class OpportunityDeskStore {
  constructor({ path = DEFAULT_STORE_PATH, auditLog = null, now = () => new Date() } = {}) {
    this.path = resolve(process.cwd(), path);
    this.auditLog = auditLog;
    this.now = now;
    this.state = existsSync(this.path)
      ? JSON.parse(readFileSync(this.path, 'utf8'))
      : seedState(now(), { seedFixtures: shouldSeedFixtures(this.path), baseDir: process.cwd() });
  }

  listSources(filters = {}) {
    return filterRecords(this.state.source_registry, filters, ['source_id', 'source_name', 'source_family', 'active', 'source_health', 'owner_department', 'route_owner_profile', 'business_line', 'access_method']);
  }

  createSource(input, { actorId = 'system' } = {}) {
    const source = normalizeSource(input, this.now());
    if (this.state.source_registry.some((item) => item.source_family === source.source_family && item.source_name === source.source_name)) throw statusError(409, 'source_family + source_name already exists');
    this.state.source_registry.push(source);
    this.audit(actorId, 'opportunity.source.created', 'opportunity_source', source.source_id, { source_family: source.source_family, source_health: source.source_health });
    this.persist();
    return publicSource(source);
  }

  updateSource(sourceId, input, { actorId = 'system' } = {}) {
    const index = this.state.source_registry.findIndex((source) => source.source_id === sourceId || source.source_name === sourceId);
    if (index < 0) throw statusError(404, 'source not found');
    const source = normalizeSource({ ...this.state.source_registry[index], ...input, updated_at: this.now().toISOString() }, this.now());
    this.state.source_registry[index] = source;
    this.audit(actorId, 'opportunity.source.updated', 'opportunity_source', source.source_id, { source_health: source.source_health, active: source.active });
    this.persist();
    return publicSource(source);
  }

  listSourceRuns(filters = {}) {
    return filterRecords(this.state.source_runs, filters, ['source_id', 'source_family', 'status', 'privacy_review_required']);
  }

  recordSourceRun(input, { actorId = 'system' } = {}) {
    const source = this.sourceById(input.source_id || input.sourceId);
    if (!source) throw statusError(404, 'source_id not found');
    if (!canRunSource(source)) throw statusError(422, 'source is not eligible to run: active source with ok/warning health and allowed access method required');
    const rawRecords = Array.isArray(input.records) ? input.records : Array.isArray(input.opportunities) ? input.opportunities : [];
    const startedAt = input.started_at || input.startedAt || this.now().toISOString();
    const run = {
      run_id: input.run_id || id('run'),
      source_id: source.source_id,
      source_family: source.source_family,
      started_at: startedAt,
      finished_at: input.finished_at || input.finishedAt || this.now().toISOString(),
      status: input.status || 'completed',
      fetch_window_start: input.fetch_window_start || null,
      fetch_window_end: input.fetch_window_end || null,
      external_cursor: input.external_cursor || null,
      request_count: number(input.request_count, 1),
      records_seen: rawRecords.length || number(input.records_seen, 0),
      records_new: 0,
      records_updated: 0,
      records_rejected: 0,
      data_age_min: input.data_age_min ?? null,
      data_age_max: input.data_age_max ?? null,
      http_status_summary: input.http_status_summary || {},
      error_summary: sanitizeText(input.error_summary || ''),
      schema_version_observed: input.schema_version_observed || null,
      parser_version: input.parser_version || 'manual-v1',
      completeness_pct: number(input.completeness_pct, 0),
      duplicate_pct: number(input.duplicate_pct, 0),
      stale_pct: number(input.stale_pct, 0),
      parse_error_pct: number(input.parse_error_pct, 0),
      quality_metrics: input.quality_metrics || {},
      privacy_review_required: Boolean(input.privacy_review_required),
      created_at: this.now().toISOString(),
    };
    const opportunities = [];
    const rejected = [];
    for (const raw of rawRecords) {
      const payload = { ...raw, source_id: source.source_id, latest_source_run_id: run.run_id };
      const safety = payloadSafety(payload);
      if (safety.secret_present || safety.raw_pii_present) {
        rejected.push({ external_id: raw.external_id || null, blocker_classes: safety.blocker_classes });
        continue;
      }
      const before = this.state.opportunities.length;
      const opportunity = this.upsertOpportunity(payload, { actorId, persist: false });
      opportunities.push(opportunity);
      if (this.state.opportunities.length > before) run.records_new += 1;
      else run.records_updated += 1;
    }
    run.records_rejected = rejected.length;
    if (!run.completeness_pct && run.records_seen) run.completeness_pct = Math.round(((run.records_new + run.records_updated) / run.records_seen) * 100);
    this.state.source_runs.push(run);
    source.last_run_at = run.finished_at;
    source.source_health = run.records_rejected > 0 || run.privacy_review_required ? 'warning' : source.source_health;
    this.state.source_health_logs.push({
      health_log_id: id('health'),
      source_id: source.source_id,
      source_run_id: run.run_id,
      source_health: source.source_health,
      health_reason: sanitizeText(run.records_rejected > 0 ? `${run.records_rejected} unsafe/rejected records` : input.source_health_reason || ''),
      http_status_summary: run.http_status_summary,
      records_seen: run.records_seen,
      records_rejected: run.records_rejected,
      stale_pct: run.stale_pct,
      parse_error_pct: run.parse_error_pct,
      checked_by_profile: actorId,
      checked_at: run.finished_at,
    });
    this.audit(actorId, 'opportunity.source_run.recorded', 'opportunity_source_run', run.run_id, { source_id: source.source_id, records_seen: run.records_seen, records_new: run.records_new, records_updated: run.records_updated, records_rejected: run.records_rejected });
    this.persist();
    return { ...run, opportunities, rejected_records: rejected, blocked_side_effects: blockedSideEffects() };
  }

  listOpportunities(filters = {}) {
    return this.state.opportunities
      .filter((opportunity) => opportunityMatchesFilters(opportunity, filters, this.sourceById(opportunity.source_id)))
      .map((opportunity) => publicOpportunity(opportunity, this.sourceById(opportunity.source_id)));
  }

  upsertOpportunity(input, { actorId = 'system', persist = true } = {}) {
    const opportunity = normalizeOpportunity(input, this.now());
    const bySourceExternal = opportunity.external_id ? this.state.opportunities.findIndex((item) => item.source_id === opportunity.source_id && item.external_id === opportunity.external_id) : -1;
    const byDedupe = this.state.opportunities.findIndex((item) => item.dedupe_key === opportunity.dedupe_key);
    const index = bySourceExternal >= 0 ? bySourceExternal : byDedupe;
    if (index >= 0) {
      const merged = { ...this.state.opportunities[index], ...opportunity, opportunity_id: this.state.opportunities[index].opportunity_id, created_at: this.state.opportunities[index].created_at, updated_at: this.now().toISOString() };
      this.state.opportunities[index] = merged;
      if (persist) {
        this.audit(actorId, 'opportunity.record.updated', 'opportunity', merged.opportunity_id, { status: merged.status, gate_status: merged.gate_status });
        this.persist();
      }
      return publicOpportunity(merged);
    }
    this.state.opportunities.push(opportunity);
    if (persist) {
      this.audit(actorId, 'opportunity.record.created', 'opportunity', opportunity.opportunity_id, { status: opportunity.status, gate_status: opportunity.gate_status });
      this.persist();
    }
    return publicOpportunity(opportunity);
  }

  patchOpportunity(opportunityId, input, { actorId = 'system' } = {}) {
    const index = this.findOpportunityIndex(opportunityId);
    const current = this.state.opportunities[index];
    const next = normalizeOpportunity({ ...current, ...input, opportunity_id: current.opportunity_id, updated_at: this.now().toISOString() }, this.now());
    if (isExternalCommitmentTransition(next) && !hasLiveApproval(next)) throw statusError(403, 'external action blocked until gate_status=approved with unexpired approval_ref');
    this.state.opportunities[index] = next;
    this.audit(actorId, 'opportunity.record.patched', 'opportunity', next.opportunity_id, { status: next.status, gate_status: next.gate_status });
    this.persist();
    return publicOpportunity(next);
  }

  scoreOpportunity(opportunityId, input = {}, { actorId = 'system' } = {}) {
    const opportunity = this.getOpportunity(opportunityId);
    const dimensions = normalizeDimensions({ ...deriveDimensionScores(opportunity, this.sourceById(opportunity.source_id)), ...(input.raw_dimension_scores || input.dimensions || {}) });
    const { weightedScore, explanation } = calculateWeightedScore(dimensions, SCORE_WEIGHTS);
    const missingFields = missingOpportunityFields(opportunity);
    const confidence = clamp(number(input.confidence_score, Math.max(35, Math.min(95, 92 - missingFields.length * 8 - riskPenalty(opportunity)))));
    const gateBlocked = opportunity.gate_status && !['not_required', 'approved'].includes(opportunity.gate_status);
    const falsePositiveRisk = input.false_positive_risk || (missingFields.length >= 4 || gateBlocked ? 'high' : missingFields.length >= 2 ? 'medium' : 'low');
    const score = {
      score_id: input.score_id || id('score'),
      opportunity_id: opportunity.opportunity_id,
      model_version: input.model_version || SCORE_MODEL_VERSION,
      raw_dimension_scores: dimensions,
      weights: { ...SCORE_WEIGHTS },
      weighted_score: weightedScore,
      confidence_score: confidence,
      false_positive_risk: falsePositiveRisk,
      missing_fields: missingFields,
      source_age_hours: sourceAgeHours(opportunity),
      privacy_pii_handling: opportunity.privacy_pii_handling || 'public_org_only',
      refresh_cadence: this.sourceById(opportunity.source_id)?.refresh_cadence || null,
      score_explanation: input.score_explanation || explanation,
      recommendation_band: recommendationBand(weightedScore, confidence, falsePositiveRisk, opportunity.gate_status),
      created_by_profile: actorId,
      created_at: this.now().toISOString(),
    };
    this.state.opportunity_scores.push(score);
    this.patchOpportunity(opportunity.opportunity_id, { status: score.recommendation_band.status, latest_score_id: score.score_id }, { actorId });
    this.audit(actorId, 'opportunity.score.created', 'opportunity_score', score.score_id, { opportunity_id: opportunity.opportunity_id, weighted_score: score.weighted_score, confidence_score: score.confidence_score, recommendation: score.recommendation_band.status });
    this.persist();
    return score;
  }

  createMemo(opportunityId, input = {}, { actorId = 'system' } = {}) {
    const opportunity = this.getOpportunity(opportunityId);
    const safety = payloadSafety({ opportunity, input });
    if (safety.secret_present || safety.raw_pii_present || input.pii_present === 'raw_pii_detected' || input.secret_present === true) throw statusError(422, 'AI memo generation blocked until raw PII/secrets are redacted');
    const latestScore = this.latestScore(opportunity.opportunity_id);
    const evidenceRefs = normalizeArray(input.input_evidence_refs || opportunity.evidence_refs || []).slice(0, 20);
    const missing = latestScore?.missing_fields || missingOpportunityFields(opportunity);
    const memo = {
      memo_id: input.memo_id || id('memo'),
      opportunity_id: opportunity.opportunity_id,
      source_run_id: input.source_run_id || opportunity.latest_source_run_id || null,
      memo_type: input.memo_type || 'triage',
      model_provider: input.model_provider || 'interface_only',
      model_name: input.model_name || 'no-external-call',
      prompt_version: input.prompt_version || MEMO_PROMPT_VERSION,
      input_evidence_refs: evidenceRefs,
      memo_markdown: sanitizeMemo(input.memo_markdown || buildMemoMarkdown(opportunity, latestScore, evidenceRefs, missing, input.memo_type || 'triage')),
      confidence_score: clamp(number(input.confidence_score, latestScore?.confidence_score || 60)),
      hallucination_risk: input.hallucination_risk || (!evidenceRefs.length || missing.length >= 3 ? 'needs_review' : 'low'),
      human_review_status: input.human_review_status || 'pending',
      created_by_profile: actorId,
      created_at: this.now().toISOString(),
      blocked_external_actions: blockedSideEffects(),
      label: INTERNAL_MEMO_BANNER,
    };
    this.state.ai_memos.push(memo);
    this.audit(actorId, 'opportunity.memo.created', 'opportunity_ai_memo', memo.memo_id, { opportunity_id: opportunity.opportunity_id, memo_type: memo.memo_type, human_review_status: memo.human_review_status });
    this.persist();
    return memo;
  }

  recordDecision(opportunityId, input = {}, { actorId = 'system' } = {}) {
    const opportunity = this.getOpportunity(opportunityId);
    const decision = String(input.decision || '').trim();
    if (!decision) throw statusError(422, 'decision is required');
    const externalAction = input.external_action_type || 'none';
    if (externalAction !== 'none' && !hasLiveApproval({ ...opportunity, gate_status: input.gate_status || opportunity.gate_status, approval_expires_at: input.approval_expires_at || opportunity.approval_expires_at, approval_ref: input.approval_ref || opportunity.approval_ref })) throw statusError(403, 'external action decision blocked without approved gate_ref and unexpired approval');
    const log = {
      decision_id: input.decision_id || id('dec'),
      opportunity_id: opportunity.opportunity_id,
      score_id: input.score_id || opportunity.latest_score_id || this.latestScore(opportunity.opportunity_id)?.score_id || null,
      decision,
      decision_reason: sanitizeText(input.decision_reason || input.reason || ''),
      decision_owner_profile: input.decision_owner_profile || actorId,
      decision_confidence: clamp(number(input.decision_confidence, 70)),
      expected_value_snapshot_usd: opportunity.expected_value_usd ?? null,
      first_cash_window_snapshot_days: opportunity.first_cash_window_days ?? null,
      route_owner_profile: opportunity.route_owner_profile,
      gate_status_snapshot: opportunity.gate_status,
      decision_deadline: input.decision_deadline || null,
      next_review_at: input.next_review_at || null,
      risk_acceptance_notes: sanitizeText(input.risk_acceptance_notes || ''),
      external_action_type: externalAction,
      gate_ref: input.gate_ref || opportunity.approval_ref || null,
      decided_at: this.now().toISOString(),
    };
    this.state.decision_logs.push(log);
    const statusByDecision = { pursue: 'pursue', reject: 'reject', watch: 'watch', route_to_kanban: 'routed', request_more_data: 'needs_data', mark_duplicate: 'duplicate', mark_stale: 'stale', archive: 'archived' };
    if (statusByDecision[decision]) this.patchOpportunity(opportunity.opportunity_id, { status: statusByDecision[decision] }, { actorId });
    this.audit(actorId, 'opportunity.decision.recorded', 'opportunity_decision', log.decision_id, { opportunity_id: opportunity.opportunity_id, decision });
    this.persist();
    return log;
  }

  proposeKanbanRoute(opportunityId, input = {}, { actorId = 'system' } = {}) {
    const opportunity = this.getOpportunity(opportunityId);
    const routeType = input.route_type || 'review';
    if (!ROUTE_TYPES.has(routeType)) throw statusError(422, 'invalid route_type');
    const externalAction = input.external_action_type || 'none';
    if (externalAction !== 'none' && !hasLiveApproval(opportunity)) throw statusError(403, 'external side-effect route blocked without gate_status=approved and unexpired approval_ref');
    const draft = sanitizeKanbanDraft({
      title: input.title || `Opportunity Desk: ${opportunity.title}`,
      assignee_profile: input.assignee_profile || ownerForRoute(routeType),
      desired_outcome: input.desired_outcome || `Evaluate and execute safe internal prep for ${opportunity.title}.`,
      evidence_refs: normalizeArray(input.evidence_refs || opportunity.evidence_refs || []).slice(0, 20),
      constraints: normalizeArray(input.constraints || ['No external submissions, outreach, account creation, payment, public publishing, or raw PII export without gate_ref approval.']),
      acceptance_criteria: normalizeArray(input.acceptance_criteria || [`Source evidence reviewed`, `Decision logged in Opportunity Desk`, `No external action taken`]),
      blocker_conditions: normalizeArray(input.blocker_conditions || [`Missing evidence`, `gate_status is not approved for external action`, `raw PII/credential-like payload detected`]),
      no_external_action_statement: 'No external submissions or commitments authorized by this route.',
      gate_ref: input.gate_ref || opportunity.approval_ref || null,
    });
    const route = {
      routing_id: input.routing_id || id('route'),
      opportunity_id: opportunity.opportunity_id,
      decision_id: input.decision_id || null,
      kanban_task_id: input.kanban_task_id || null,
      kanban_board: input.kanban_board || 'mehyar-media',
      assignee_profile: draft.assignee_profile,
      route_type: routeType,
      route_status: input.kanban_task_id ? 'created' : 'proposed',
      acceptance_criteria: draft.acceptance_criteria,
      sanitized_kanban_draft: draft,
      created_by_profile: actorId,
      created_at: this.now().toISOString(),
      blocked_side_effects: blockedSideEffects(),
    };
    this.state.kanban_routing_refs.push(route);
    this.recordDecision(opportunity.opportunity_id, { decision: 'route_to_kanban', decision_reason: `Route proposed: ${routeType}`, decision_confidence: 80 }, { actorId });
    this.audit(actorId, 'opportunity.kanban_route.proposed', 'opportunity_kanban_route', route.routing_id, { opportunity_id: opportunity.opportunity_id, route_type: routeType, route_status: route.route_status });
    this.persist();
    return route;
  }

  listSuppressionChecks(filters = {}) {
    return filterRecords(this.state.suppression_checks, filters, ['opportunity_id', 'account_id', 'check_type', 'status']);
  }

  createSuppressionCheck(input = {}, { actorId = 'system' } = {}) {
    const status = input.status || 'needs_review';
    if (!SUPPRESSION_STATUSES.has(status)) throw statusError(422, 'invalid suppression status');
    const check = {
      suppression_check_id: input.suppression_check_id || id('sup'),
      opportunity_id: input.opportunity_id || null,
      account_id: input.account_id || null,
      check_type: input.check_type || 'source_terms',
      status,
      checked_at: input.checked_at || this.now().toISOString(),
      checked_by_profile: input.checked_by_profile || actorId,
      evidence_ref_id: input.evidence_ref_id || null,
      notes: sanitizeText(input.notes || ''),
    };
    this.state.suppression_checks.push(check);
    if (check.opportunity_id) {
      const index = this.findOpportunityIndex(check.opportunity_id, { throwIfMissing: false });
      if (index >= 0) this.state.opportunities[index].suppression_status = worstSuppression(this.state.opportunities[index].suppression_status, check.status);
    }
    this.audit(actorId, 'opportunity.suppression_check.created', 'opportunity_suppression_check', check.suppression_check_id, { status: check.status, check_type: check.check_type });
    this.persist();
    return check;
  }

  getDigest({ date = this.now().toISOString().slice(0, 10), scope = 'default' } = {}) {
    const existing = this.state.daily_digest_snapshots.find((digest) => digest.digest_date === date && digest.snapshot_scope === scope);
    if (existing) return existing;
    const scored = this.state.opportunity_scores.slice().sort((a, b) => b.weighted_score - a.weighted_score || b.confidence_score - a.confidence_score);
    const topIds = [...new Set(scored.map((score) => score.opportunity_id))].slice(0, 10);
    const opportunities = topIds.map((id) => this.getOpportunity(id));
    const digest = {
      digest_id: id('digest'),
      digest_date: date,
      snapshot_scope: scope,
      top_opportunity_ids: topIds,
      counts_by_status: countsBy(this.state.opportunities, 'status'),
      counts_by_source: countsBy(this.state.opportunities, 'source_id'),
      counts_by_type: countsBy(this.state.opportunities, 'opportunity_type'),
      source_performance_summary: sourcePerformance(this.state),
      top_recommendations: opportunities.slice(0, 5).map(compactOpportunity),
      stale_kill_list: this.state.opportunities.filter((item) => isStale(item, this.now())).slice(0, 10).map(compactOpportunity),
      fast_cash_pick: opportunities.find((item) => item.first_cash_path) ? compactOpportunity(opportunities.find((item) => item.first_cash_path)) : null,
      asset_building_pick: opportunities.find((item) => normalizeArray(item.fit_tags).some((tag) => /asset|mehyarsoft|axial|media/i.test(tag))) ? compactOpportunity(opportunities.find((item) => normalizeArray(item.fit_tags).some((tag) => /asset|mehyarsoft|axial|media/i.test(tag)))) : null,
      strategic_pick: opportunities[0] ? compactOpportunity(opportunities[0]) : null,
      generated_by_profile: 'system',
      generated_at: this.now().toISOString(),
      massSendingEnabled: false,
      externalActionsEnabled: false,
    };
    this.state.daily_digest_snapshots.push(digest);
    this.persist();
    return digest;
  }

  dashboard() {
    const latestScores = new Map();
    for (const score of this.state.opportunity_scores) latestScores.set(score.opportunity_id, score);
    const rows = this.state.opportunities.map((opportunity) => ({ ...compactOpportunity(opportunity), score: latestScores.get(opportunity.opportunity_id)?.weighted_score ?? null, confidence: latestScores.get(opportunity.opportunity_id)?.confidence_score ?? null })).sort((a, b) => (b.score || 0) - (a.score || 0));
    const digest = this.getDigest();
    const sourceHealthRows = this.state.source_registry.map((source) => sourceHealthRow(source, this.state));
    return {
      contract_version: CONTRACT_VERSION,
      massSendingEnabled: false,
      externalActionsEnabled: false,
      blocked_external_actions: blockedSideEffects(),
      daily_digest: digest,
      source_health: sourceHealthRows,
      opportunity_inbox_counts: countsBy(this.state.opportunities, 'status'),
      top_money_lanes: moneyLanes(this.state),
      ai_memo_queue: this.state.ai_memos.slice(-10).map((memo) => ({ memo_id: memo.memo_id, opportunity_id: memo.opportunity_id, memo_type: memo.memo_type, human_review_status: memo.human_review_status, confidence_score: memo.confidence_score, label: memo.label })),
      decision_queue: rows.filter((row) => ['new', 'scored', 'needs_data', 'needs_approval', 'watch'].includes(row.status)).slice(0, 25),
      kanban_route_proposals: this.state.kanban_routing_refs.slice(-20),
      revenue_process_board: revenueProcessBoard(this.state, latestScores),
      gate_alerts: gateAlerts(this.state),
      seed_data_status: seedDataStatus(this.state),
      counts: {
        sources: this.state.source_registry.length,
        source_runs: this.state.source_runs.length,
        opportunities: this.state.opportunities.length,
        scores: this.state.opportunity_scores.length,
        ai_memos: this.state.ai_memos.length,
        kanban_routes: this.state.kanban_routing_refs.length,
      },
      pursue_now: rows.filter((row) => row.status === 'pursue').slice(0, 10),
      watch: rows.filter((row) => row.status === 'watch').slice(0, 10),
      risk_queue: rows.filter((row) => ['needs_approval', 'blocked'].includes(row.status) || !['not_required', 'approved'].includes(row.gate_status)).slice(0, 10),
      stale_queue: this.state.opportunities.filter((item) => isStale(item, this.now())).slice(0, 10).map(compactOpportunity),
      source_health_counts: countsBy(this.state.source_registry, 'source_health'),
      kanban_execution_bridge: filterRecords(this.state.kanban_routing_refs, {}, ['route_status']).slice(-20),
    };
  }

  getOpportunity(opportunityId) {
    return this.state.opportunities[this.findOpportunityIndex(opportunityId)];
  }

  latestScore(opportunityId) {
    return this.state.opportunity_scores.filter((score) => score.opportunity_id === opportunityId).at(-1) || null;
  }

  sourceById(sourceId) {
    return this.state.source_registry.find((source) => source.source_id === sourceId || source.source_name === sourceId) || null;
  }

  findOpportunityIndex(opportunityId, { throwIfMissing = true } = {}) {
    const index = this.state.opportunities.findIndex((item) => item.opportunity_id === opportunityId || item.external_id === opportunityId || item.dedupe_key === opportunityId);
    if (index < 0 && throwIfMissing) throw statusError(404, 'opportunity not found');
    return index;
  }

  persist() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(this.state, null, 2)}\n`);
  }

  audit(actorId, action, resourceType, resourceId, metadata = {}) {
    this.auditLog?.record({ actorId, action, resourceType, resourceId, metadata });
  }
}

function seedState(now, { seedFixtures = false, baseDir = process.cwd() } = {}) {
  const created = now.toISOString();
  const state = {
    contract_version: CONTRACT_VERSION,
    source_registry: [normalizeSource({ source_id: 'src_manual_revenue_research', source_family: 'manual', source_name: 'Manual revenue research', source_url: 'internal://manual-opportunity-research', owner_department: 'scout', access_method: 'manual', active: true, source_health: 'ok', refresh_cadence: 'ad_hoc', quality_baseline_score: 65, contact_policy: 'internal_research_only', privacy_risk_level: 'low' }, now)],
    source_runs: [],
    opportunities: [],
    opportunity_scores: [],
    ai_memos: [],
    decision_logs: [],
    kanban_routing_refs: [],
    daily_digest_snapshots: [],
    source_health_logs: [],
    account_records: [],
    network_records: [],
    attachments_evidence_refs: [],
    suppression_checks: [],
    created_at: created,
  };
  if (seedFixtures) hydrateFixtureState(state, now, baseDir);
  return state;
}

function normalizeSource(input, now) {
  const sourceFamily = input.source_family || 'manual';
  const accessMethod = input.access_method || 'manual';
  const credentialRef = input.credential_ref_env || null;
  if (!SOURCE_FAMILIES.has(sourceFamily)) throw statusError(422, 'invalid source_family');
  if (!ACCESS_METHODS.has(accessMethod)) throw statusError(422, 'invalid access_method');
  if (credentialRef && !/^env:[A-Z0-9_]+$/.test(credentialRef)) throw statusError(422, 'credential_ref_env must be env:VARNAME only, never a secret value');
  const sourceHealth = input.source_health || (input.active === false ? 'blocked' : 'needs_review');
  if (!HEALTH_STATES.has(sourceHealth)) throw statusError(422, 'invalid source_health');
  return {
    source_id: input.source_id || id('src'),
    source_family: sourceFamily,
    source_name: sanitizeText(input.source_name || input.name || sourceFamily),
    source_url: safeUri(input.source_url || input.url || null),
    owner_department: sanitizeText(input.owner_department || 'scout'),
    access_method: accessMethod,
    auth_required: Boolean(input.auth_required),
    credential_ref_env: credentialRef,
    license_terms: sanitizeText(input.license_terms || ''),
    contact_policy: sanitizeText(input.contact_policy || 'internal_research_only'),
    privacy_risk_level: input.privacy_risk_level || 'low',
    refresh_cadence: input.refresh_cadence || 'manual',
    expected_latency_minutes: number(input.expected_latency_minutes, 1440),
    active: input.active !== false,
    quality_baseline_score: clamp(number(input.quality_baseline_score, 50)),
    source_notes: sanitizeText(input.source_notes || ''),
    source_type: sanitizeText(input.source_type || 'source_registry_entry'),
    source_priority: clamp(number(input.source_priority, 50)),
    route_owner_profile: sanitizeText(input.route_owner_profile || input.owner_profile || 'scout'),
    business_line: sanitizeText(input.business_line || input.company_fit || 'mixed'),
    source_health_reason: sanitizeText(input.source_health_reason || ''),
    source_health_checked_at: input.source_health_checked_at || null,
    source_risk: normalizeArray(input.source_risk),
    source_fit_dimensions: input.source_fit_dimensions || {},
    source_health: sourceHealth,
    rate_limit: input.rate_limit || { requests_per_minute: 10 },
    kill_switch: input.kill_switch !== false,
    created_at: input.created_at || now.toISOString(),
    updated_at: input.updated_at || now.toISOString(),
    last_run_at: input.last_run_at || null,
  };
}

function normalizeOpportunity(input, now) {
  const safety = payloadSafety(input);
  if (safety.secret_present || safety.raw_pii_present) throw statusError(422, `payload blocked: ${safety.blocker_classes.join(', ')}`);
  const sourceId = input.source_id || 'src_manual_revenue_research';
  const type = input.opportunity_type || 'partnership';
  if (!OPPORTUNITY_TYPES.has(type)) throw statusError(422, 'invalid opportunity_type');
  const status = input.status || 'new';
  if (!STATUSES.has(status)) throw statusError(422, 'invalid opportunity status');
  const gateStatus = input.gate_status || inferGateStatus(input);
  if (!GATE_STATUSES.has(gateStatus)) throw statusError(422, 'invalid gate_status');
  const suppression = input.suppression_status || 'unknown';
  if (!SUPPRESSION_STATUSES.has(suppression)) throw statusError(422, 'invalid suppression_status');
  const title = sanitizeText(input.title || 'Untitled opportunity');
  const buyerOrg = sanitizeText(input.buyer_org_name || input.buyer || 'Unknown buyer');
  const externalId = input.external_id || null;
  const dueAt = input.due_at || null;
  const dedupeKey = input.dedupe_key || hash(`${sourceId}:${externalId || ''}:${buyerOrg}:${title}:${dueAt || ''}`).slice(0, 24);
  return {
    opportunity_id: input.opportunity_id || id('opp'),
    source_id: sourceId,
    latest_source_run_id: input.latest_source_run_id || null,
    external_id: externalId,
    external_url: safeUri(input.external_url || null),
    opportunity_type: type,
    title,
    summary: sanitizeText(input.summary || ''),
    buyer_org_name: buyerOrg,
    buyer_domain: sanitizeDomain(input.buyer_domain || ''),
    geography: sanitizeText(input.geography || ''),
    jurisdiction: sanitizeText(input.jurisdiction || ''),
    amount_min: input.amount_min ?? null,
    amount_max: input.amount_max ?? null,
    expected_value_usd: input.expected_value_usd ?? input.value_estimate ?? null,
    expected_value_basis: sanitizeText(input.expected_value_basis || ''),
    expected_value_confidence: input.expected_value_confidence ?? null,
    currency: input.currency || 'USD',
    due_at: dueAt,
    posted_at: input.posted_at || null,
    source_updated_at: input.source_updated_at || null,
    estimated_start_at: input.estimated_start_at || null,
    fit_tags: normalizeArray(input.fit_tags),
    fit_score_dimensions: input.fit_score_dimensions || {},
    revenue_model: sanitizeText(input.revenue_model || ''),
    status,
    dedupe_key: dedupeKey,
    public_contact_url: safeUri(input.public_contact_url || null),
    public_contact_email_domain: sanitizeDomain(input.public_contact_email_domain || ''),
    compliance_flags: normalizeArray(input.compliance_flags),
    suppression_status: suppression,
    evidence_refs: normalizeArray(input.evidence_refs || input.source_evidence_refs).map(safeEvidenceRef),
    first_cash_path: sanitizeText(input.first_cash_path || ''),
    first_cash_window_days: input.first_cash_window_days ?? null,
    first_cash_window_basis: sanitizeText(input.first_cash_window_basis || ''),
    required_assets: normalizeArray(input.required_assets),
    eligibility: sanitizeText(input.eligibility || ''),
    required_docs: normalizeArray(input.required_docs),
    proof_required: normalizeArray(input.proof_required),
    spg_proof_signals: normalizeArray(input.spg_proof_signals),
    partner_needed: Boolean(input.partner_needed),
    gate_status: gateStatus,
    external_action_type: input.external_action_type || 'none',
    approval_ref: input.approval_ref || input.gate_ref || null,
    approval_expires_at: input.approval_expires_at || null,
    privacy_pii_handling: input.privacy_pii_handling || 'public_org_only',
    route_state: input.route_state || 'not_routed',
    route_owner_profile: input.route_owner_profile || input.owner_profile || 'productops',
    owner_profile: input.owner_profile || 'productops',
    latest_score_id: input.latest_score_id || null,
    created_at: input.created_at || now.toISOString(),
    updated_at: input.updated_at || now.toISOString(),
    blocked_external_actions: blockedSideEffects(),
  };
}

function payloadSafety(payload) {
  const serialized = JSON.stringify(payload || {});
  const credentialOnly = /"credential_ref_env"\s*:\s*"env:[A-Z0-9_]+"/ig;
  const scrubbed = serialized.replace(credentialOnly, '"credential_ref_env":"env:SAFE_REF"');
  const secret = SECRET_PATTERN.test(scrubbed);
  const pii = RAW_PII_PATTERN.test(scrubbed);
  return { secret_present: secret, raw_pii_present: pii, blocker_classes: [...(secret ? ['secret_like_payload'] : []), ...(pii ? ['raw_pii_like_payload'] : [])] };
}

function calculateWeightedScore(dimensions, weights) {
  let positiveMax = 0;
  let positive = 0;
  let penaltyMax = 0;
  let penalty = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const value = clamp(number(dimensions[key], 50));
    if (weight >= 0) {
      positiveMax += weight * 100;
      positive += weight * value;
    } else {
      penaltyMax += Math.abs(weight) * 100;
      penalty += Math.abs(weight) * value;
    }
  }
  const score = clamp(Math.round(((positive / positiveMax) * 100 * 0.78 + ((penaltyMax - penalty) / penaltyMax) * 100 * 0.22) * 10) / 10);
  return { weightedScore: score, explanation: `Weighted fit ${score}/100 using transparent v1 dimensions; risk dimensions are lower-is-better and reduce the final score.` };
}

function deriveDimensionScores(opportunity, source = null) {
  const hasDue = Boolean(opportunity.due_at);
  const evidence = normalizeArray(opportunity.evidence_refs).length;
  const amount = Number(opportunity.amount_max || opportunity.amount_min || 0);
  const complianceRisk = ['approved', 'not_required'].includes(opportunity.gate_status) ? 20 : opportunity.gate_status === 'pending' ? 65 : 80;
  return {
    speed_to_cash: opportunity.first_cash_path ? 80 : hasDue ? 65 : 45,
    expected_value: amount > 250000 ? 85 : amount > 50000 ? 70 : opportunity.expected_value_usd ? 60 : 40,
    gross_margin: ['affiliate_program', 'sponsorship', 'content_signal', 'proof_signal'].includes(opportunity.opportunity_type) ? 75 : amount > 100000 ? 55 : 65,
    existing_asset_fit: normalizeArray(opportunity.fit_tags).length ? 78 : 45,
    audience_channel_fit: /media|axial|spg|stuffprettygood/i.test(JSON.stringify(opportunity.fit_tags)) ? 80 : 50,
    compliance_risk: complianceRisk,
    reputation_risk: normalizeArray(opportunity.compliance_flags).length ? 60 : 25,
    automation_potential: ['rss', 'affiliate', 'job_signal', 'content_signal'].includes(opportunity.opportunity_type) ? 75 : 50,
    recurring_revenue_potential: ['affiliate_program', 'sponsorship', 'partnership'].includes(opportunity.opportunity_type) ? 80 : 45,
    operational_complexity: opportunity.partner_needed ? 70 : 35,
    boss_attention_required: opportunity.gate_status === 'needs_review' || opportunity.gate_status === 'pending' ? 75 : 35,
    source_quality: source?.quality_baseline_score || 50,
    evidence_strength: Math.min(95, 30 + evidence * 20),
    deadline_urgency_fit: hasDue ? 70 : 45,
    strategic_option_value: normalizeArray(opportunity.fit_tags).length ? 70 : 50,
  };
}

function normalizeDimensions(input) {
  const output = {};
  for (const key of Object.keys(SCORE_WEIGHTS)) output[key] = clamp(number(input[key], 50));
  return output;
}

function recommendationBand(score, confidence, risk, gateStatus) {
  if (!['not_required', 'approved'].includes(gateStatus)) return { status: 'needs_approval', band: 'risk_queue', reason: 'gate risk blocks auto-route' };
  if (risk === 'high' || confidence < 75) return { status: score >= 70 ? 'watch' : 'blocked', band: 'human_review_required', reason: 'confidence/risk requires review' };
  if (score >= 85) return { status: 'pursue', band: 'priority_pursue', reason: '85+ priority pursue' };
  if (score >= 70) return { status: 'watch', band: 'watch_or_research', reason: '70–84 watch/research' };
  if (score >= 50) return { status: 'watch', band: 'digest_only', reason: '50–69 digest only' };
  return { status: 'reject', band: 'reject_or_kill', reason: '<50 reject unless strategic exception' };
}

function buildMemoMarkdown(opportunity, score, evidenceRefs, missing, memoType = 'triage') {
  const scoreLine = score ? `${score.weighted_score}/100 confidence ${score.confidence_score}/100` : 'not scored yet';
  const sourceProof = evidenceRefs.join(', ') || 'No evidence refs attached.';
  const gates = `gate_status=${opportunity.gate_status}; suppression_status=${opportunity.suppression_status}; external_action_type=${opportunity.external_action_type}`;
  if (memoType === 'application_plan') {
    return `${INTERNAL_MEMO_BANNER}\n\nAI application helper: ${opportunity.title} from ${opportunity.buyer_org_name}; score ${scoreLine}.\n\nApply path: 1) verify source evidence, terms, deadline, and eligibility; 2) identify the official application/bid/contact surface from source refs only; 3) build an internal requirements checklist; 4) draft a claim-safe response/proposal outline; 5) request Boss/ComplyOps approval before any external submission, outreach, account creation, spend, KYC/tax/bank step, or public claim.\n\nLikely package angle: ${opportunity.first_cash_path || opportunity.summary || 'Needs first-cash/service angle from source evidence.'}\n\nRequired info to collect: buyer/org details, official URL, deadline, eligibility, required docs/assets, price/value basis, decision maker role if public org-only, submission format, account/registration requirements, and disallowed traffic/claim terms.\n\nDraft response outline: Problem observed → Mehyar capability fit → proof/assets available → low-risk pilot path → compliance/approval caveats → next internal milestone.\n\nMissing fields: ${missing.join(', ') || 'None detected.'}\n\nCompliance gates: ${gates}.\n\nEvidence refs: ${sourceProof}\n\nRecommendation: ${score?.recommendation_band?.status || 'request_more_data'} — AI can prepare the internal checklist and draft, but cannot submit/apply/contact/publish.\n\nNext action: Create a sanitized Kanban prep task with evidence, required docs, and approval gate.\n\nKill criteria: No official source URL, unsupported eligibility, false capability/past-performance claim needed, terms prohibit channel/use, raw PII required, or approval gate cannot clear.`;
  }
  return `${INTERNAL_MEMO_BANNER}\n\nReality: ${opportunity.title} from ${opportunity.buyer_org_name}; score ${scoreLine}.\n\nFit: ${normalizeArray(opportunity.fit_tags).join(', ') || 'Fit tags missing.'}\n\nBuyer pain: ${opportunity.summary || 'Needs source-backed buyer pain.'}\n\nFirst-cash path: ${opportunity.first_cash_path || 'Missing first-cash path.'}\n\nRequired proof: ${normalizeArray(opportunity.proof_required).join(', ') || 'Proof requirements missing.'}\n\nMissing fields: ${missing.join(', ') || 'None detected.'}\n\nCompliance gates: ${gates}.\n\nEvidence refs: ${sourceProof}\n\nRecommendation: ${score?.recommendation_band?.status || 'request_more_data'} — keep all outputs internal until ComplyOps/Boss approval.\n\nNext action: Route safe internal prep only or request missing evidence.\n\nKill criteria: Missing source evidence, unsupported claims, blocked suppression/source terms, or expired/unapproved gate.`;
}

function sanitizeMemo(value) {
  const text = sanitizeText(value, 8000);
  if (!text.includes(INTERNAL_MEMO_BANNER)) return `${INTERNAL_MEMO_BANNER}\n\n${text}`;
  return text;
}

function sanitizeKanbanDraft(draft) {
  const serialized = JSON.stringify(draft);
  if (SECRET_PATTERN.test(serialized) || RAW_PII_PATTERN.test(serialized)) throw statusError(422, 'Kanban draft blocked: raw PII or secret-like content detected');
  return draft;
}

function publicSource(source) { return { ...source, credential_ref_env: source.credential_ref_env || null }; }
function publicOpportunity(opportunity, source = null) {
  return {
    ...opportunity,
    source_name: source?.source_name || opportunity.source_name || null,
    source_family: source?.source_family || opportunity.source_family || null,
    source_business_line: source?.business_line || null,
    source_route_owner_profile: source?.route_owner_profile || null,
    blocked_external_actions: blockedSideEffects(),
  };
}
function compactOpportunity(opportunity) { return { opportunity_id: opportunity.opportunity_id, title: opportunity.title, buyer_org_name: opportunity.buyer_org_name, opportunity_type: opportunity.opportunity_type, status: opportunity.status, gate_status: opportunity.gate_status, suppression_status: opportunity.suppression_status, expected_value_usd: opportunity.expected_value_usd, first_cash_window_days: opportunity.first_cash_window_days, first_cash_path: opportunity.first_cash_path, route_owner_profile: opportunity.route_owner_profile, owner_profile: opportunity.owner_profile, due_at: opportunity.due_at, partner_needed: opportunity.partner_needed, source_id: opportunity.source_id, source_family: opportunity.source_family, source_name: opportunity.source_name }; }
function filterRecords(records, filters, allowedKeys) { return records.filter((record) => allowedKeys.every((key) => filters[key] == null || String(record[key]) === String(filters[key]))); }
function opportunityMatchesFilters(opportunity, filters = {}, source = null) {
  const allowedKeys = ['source_id', 'source_family', 'source_name', 'status', 'opportunity_type', 'buyer_domain', 'gate_status', 'suppression_status', 'owner_profile', 'route_owner_profile'];
  return allowedKeys.every((key) => {
    if (filters[key] == null || filters[key] === '') return true;
    const value = key === 'source_family' ? (source?.source_family || opportunity.source_family)
      : key === 'source_name' ? (source?.source_name || opportunity.source_name)
      : opportunity[key];
    return String(value) === String(filters[key]);
  });
}
function normalizeArray(value) { return [...new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => sanitizeText(item, 500)).filter(Boolean))]; }
function sanitizeText(value, max = 1200) { return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(SECRET_PATTERN, '[redacted_secret_like]').replace(RAW_PII_PATTERN, '[redacted_pii_like]').trim().slice(0, max); }
function safeUri(value) { if (!value) return null; const text = String(value); if (SECRET_PATTERN.test(text) || RAW_PII_PATTERN.test(text)) throw statusError(422, 'unsafe URI contains secret/PII-like content'); return text.slice(0, 500); }
function safeEvidenceRef(value) { const text = sanitizeText(value, 500); if (/^https?:\/\//.test(text) || /^[a-z]+_[a-z0-9_:-]+/i.test(text) || text.startsWith('kanban:') || text.startsWith('sha256:')) return text; return `note:${hash(text).slice(0, 12)}`; }
function sanitizeDomain(value) { return String(value || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/[^a-z0-9.-]/g, '').slice(0, 255) || null; }
function inferGateStatus(input) { return input.external_action_type && input.external_action_type !== 'none' ? 'pending' : 'not_required'; }
function isExternalActionRequested(opportunity) { return opportunity.external_action_type && opportunity.external_action_type !== 'none'; }
function isExternalCommitmentTransition(opportunity) { return isExternalActionRequested(opportunity) && ['pursuing', 'submitted', 'won'].includes(opportunity.status); }
function hasLiveApproval(opportunity) { return opportunity.gate_status === 'approved' && Boolean(opportunity.approval_ref) && (!opportunity.approval_expires_at || Date.parse(opportunity.approval_expires_at) > Date.now()); }
function canRunSource(source) { return source.active && ['ok', 'warning'].includes(source.source_health) && ACCESS_METHODS.has(source.access_method) && source.kill_switch !== false; }
function blockedSideEffects() { return [...BLOCKED_EXTERNAL_ACTIONS]; }
function missingOpportunityFields(opportunity) { return ['title', 'buyer_org_name', 'summary', 'evidence_refs', 'first_cash_path', 'fit_tags'].filter((key) => Array.isArray(opportunity[key]) ? opportunity[key].length === 0 : !opportunity[key]); }
function riskPenalty(opportunity) { return (opportunity.gate_status !== 'not_required' ? 15 : 0) + (normalizeArray(opportunity.compliance_flags).length * 5); }
function sourceAgeHours(opportunity) { const stamp = opportunity.source_updated_at || opportunity.posted_at || opportunity.updated_at; return stamp ? Math.max(0, Math.round((Date.now() - Date.parse(stamp)) / 36_000) / 10) : null; }
function sourcePerformance(state) { return state.source_registry.map((source) => ({ source_id: source.source_id, source_family: source.source_family, source_health: source.source_health, active: source.active, runs: state.source_runs.filter((run) => run.source_id === source.source_id).length, opportunities: state.opportunities.filter((opportunity) => opportunity.source_id === source.source_id).length })); }
function sourceHealthRow(source, state) {
  const runs = state.source_runs.filter((run) => run.source_id === source.source_id);
  const latest = runs.at(-1) || null;
  const credentialRef = source.credential_ref_env || null;
  return {
    source_id: source.source_id,
    source_name: source.source_name,
    source_family: source.source_family,
    source_health: source.source_health,
    source_health_reason: source.source_health_reason || latest?.error_summary || latest?.error || '',
    last_run_status: latest?.status || 'never_run',
    last_run_at: latest?.finished_at || latest?.created_at || source.last_run_at || null,
    records_seen: latest?.records_seen || 0,
    records_new: latest?.records_new || 0,
    records_updated: latest?.records_updated || 0,
    records_rejected: latest?.records_rejected || 0,
    credential_ref_env: credentialRef ? credentialRef.replace(/^env:/, '') : null,
    key_status: credentialRef ? 'configured_by_name' : source.auth_required ? 'missing' : source.access_method === 'schema_only' ? 'disabled_until_gate' : 'not_required',
    access_method: source.access_method,
    rate_limit: source.rate_limit,
    kill_switch: source.kill_switch !== false,
    next_run: source.refresh_cadence || 'manual',
  };
}
function moneyLanes(state) {
  const seeds = [
    ['CRM/RevOps Rescue micro-offer', 'MehyarSoft/Mehyar Media', 'Public job-posting demand signals', 'Package internal CRM rescue sprint offer', 'productops', 'GATE_OPP_JOB_POSTING_OUTREACH'],
    ['Sponsor-funded reactivation proof packet', 'Axial/Mehyar Media', 'Sponsors and networks', 'Prepare claim-safe internal proof packet', 'arman', 'GATE_OPP_SPONSOR_OUTREACH'],
    ['Amazon-first SPG offer wall', 'StuffPrettyGood', 'Consumer affiliate audience', 'Use approved offer links/disclosures only', 'webdev', 'GATE_OPP_AFFILIATE_APPLICATION'],
    ['Server-side affiliate/offer feed', 'StuffPrettyGood', 'Affiliate networks', 'Keep env-key status by name and terms review visible', 'dataeng', 'GATE_OPP_AFFILIATE_APPLICATION'],
    ['SAM.gov/state/local quick-turn services watch', 'MehyarSoft', 'Public agencies', 'Scout official opportunities and route internal briefs', 'scout', 'GATE_OPP_GOV_BID_PROPOSAL'],
    ['Grant-funded grantee implementation support', 'Mehyar Media', 'Grant recipients', 'Track grantee support lanes, no grant submission', 'productops', 'GATE_OPP_GRANT_APPLICATION'],
  ];
  return seeds.map(([lane_name, company_fit, buyer, first_cash_path, owner, gate_class]) => {
    const matching = state.opportunities.filter((opp) => JSON.stringify([opp.title, opp.summary, opp.fit_tags, opp.opportunity_type, opp.revenue_model]).toLowerCase().includes(lane_name.split(' ')[0].toLowerCase()));
    return { lane_name, company_fit, buyer, pain: 'Revenue signal requires safe internal triage before external action.', promise_angle: first_cash_path, revenue_model: 'services/affiliate/sponsorship depending lane', source_families_feeding: [...new Set(matching.map((opp) => opp.source_id))], first_cash_path, proof_required: ['source evidence', 'claim-safe proof', 'gate check'], owner, gate_class, current_count: matching.length, kill_criteria: 'Kill if evidence is weak, gate cannot be approved, or source terms/suppression block use.', next_route_recommendation: 'Draft sanitized Kanban route proposal only.' };
  });
}
function revenueProcessBoard(state, latestScores) {
  const columns = [
    ['signal_collected', (opp) => ['new', 'watch'].includes(opp.status)],
    ['scored', (opp) => Boolean(latestScores.get(opp.opportunity_id))],
    ['memo_ready', (opp) => state.ai_memos.some((memo) => memo.opportunity_id === opp.opportunity_id)],
    ['decision_needed', (opp) => ['new', 'scored', 'needs_data'].includes(opp.status)],
    ['routed_internally', (opp) => state.kanban_routing_refs.some((route) => route.opportunity_id === opp.opportunity_id) || opp.status === 'routed'],
    ['waiting_on_data_or_gate', (opp) => ['needs_data', 'needs_approval', 'blocked'].includes(opp.status) || !['not_required', 'approved'].includes(opp.gate_status)],
    ['killed_or_learned', (opp) => ['reject', 'archived', 'stale', 'duplicate', 'lost'].includes(opp.status)],
  ];
  return columns.map(([column, predicate]) => ({ column, count: state.opportunities.filter(predicate).length, cards: state.opportunities.filter(predicate).slice(0, 10).map((opp) => ({ ...compactOpportunity(opp), current_step: column, next_action: opp.first_cash_path || 'Review internally', blocker: !['not_required', 'approved'].includes(opp.gate_status) ? `gate_status=${opp.gate_status}` : null, kanban_route_task_ref: state.kanban_routing_refs.find((route) => route.opportunity_id === opp.opportunity_id)?.kanban_task_id || null })) }));
}
function gateAlerts(state) {
  return state.opportunities.filter((opp) => opp.external_action_type !== 'none' || !['not_required', 'approved'].includes(opp.gate_status)).slice(0, 20).map((opp) => ({ opportunity_id: opp.opportunity_id, title: opp.title, gate_status: opp.gate_status, external_action_type: opp.external_action_type, allowed: false, reasons: ['External action disabled until gate_status=approved, approval_ref exists, approval is unexpired, caps/owner/kill switch/evidence/audit are present.'], nextSafeAction: 'Continue internal scoring, memo, evidence review, or sanitized Kanban routing only.' }));
}
function seedDataStatus(state) {
  const requiredFamilies = ['sam_gov', 'usaspending', 'grants_gov', 'rss', 'postings', 'spg_proof'];
  const families = new Set(state.source_registry.map((source) => source.source_family));
  return { no_empty_state_ready: state.opportunities.length > 0 && state.source_registry.length > 0, opportunity_count: state.opportunities.length, source_count: state.source_registry.length, required_source_families_present: requiredFamilies.filter((family) => families.has(family)), missing_source_families: requiredFamilies.filter((family) => !families.has(family)), uses_internal_seed_when_live_absent: true, forbidden_claims_status: 'no fake public proof, customer, revenue, certification, or raw PII allowed in seed rows' };
}
function countsBy(records, key) { return records.reduce((acc, record) => { const value = record[key] ?? 'unknown'; acc[value] = (acc[value] || 0) + 1; return acc; }, {}); }
function isStale(opportunity, now) { return opportunity.due_at && Date.parse(opportunity.due_at) < now.getTime() && !['reject', 'archived', 'lost', 'won'].includes(opportunity.status); }
function worstSuppression(current, next) { const rank = { blocked: 5, needs_review: 4, unknown: 3, clear: 2, not_applicable: 1 }; return rank[next] > rank[current] ? next : current; }
function shouldSeedFixtures(path) { return resolve(path) === resolve(process.cwd(), DEFAULT_STORE_PATH); }
function hydrateFixtureState(state, now, baseDir) {
  const sourcePayload = readFixtureJson(baseDir, 'data/opportunity-source-registry.json');
  const runsPayload = readFixtureJson(baseDir, 'data/opportunity-desk/opportunity-source-runs.json');
  const opportunitiesPayload = readFixtureJson(baseDir, 'data/opportunity-desk/opportunities.json');

  for (const row of Array.isArray(sourcePayload?.sources) ? sourcePayload.sources : []) {
    try {
      const source = normalizeSource({
        source_id: row.id || row.source_id,
        source_family: row.family || row.source_family || 'manual',
        source_name: row.name || row.source_name || row.id || row.source_id,
        source_url: row.endpoint || row.endpoint_url || row.registry_path || row.public_url || row.source_url || null,
        access_method: row.allowed_access_method === 'official_api' ? 'api' : (row.access_method || row.allowed_access_method || 'manual'),
        auth_required: Boolean(row.auth_required || row.credential_ref_env),
        credential_ref_env: row.credential_ref_env ? (String(row.credential_ref_env).startsWith('env:') ? row.credential_ref_env : `env:${row.credential_ref_env}`) : null,
        refresh_cadence: row.refresh_cadence || row.schedule || sourcePayload.defaults?.schedule || 'daily',
        rate_limit: row.rate_limit || sourcePayload.defaults?.rate_limit || { requests_per_minute: 10 },
        owner_department: row.owner_department || row.owner_profile || row.route_owner_profile || 'scout',
        route_owner_profile: row.route_owner_profile || row.owner_profile || row.owner_department || 'scout',
        source_health: row.source_health || 'ok',
        source_priority: row.source_priority || 50,
        active: row.active !== false && row.enabled !== false,
        business_line: row.business_line || row.company_fit || 'mixed',
        source_type: row.source_type || 'source_registry_entry',
        source_risk: row.source_risk || row.kill_criteria || [],
        source_fit_dimensions: row.source_fit_dimensions || {},
        contact_policy: row.contact_policy || 'internal_research_only',
      }, now);
      if (!state.source_registry.some((item) => item.source_id === source.source_id)) state.source_registry.push(source);
    } catch {}
  }

  for (const run of Array.isArray(runsPayload?.latest_runs) ? runsPayload.latest_runs : []) {
    state.source_runs.push({ ...run, records_seen: Number(run.opportunity_count || run.records_seen || 0), records_new: Number(run.records_new || 0), records_updated: Number(run.records_updated || 0), records_rejected: Number(run.records_rejected || 0), created_at: run.finished_at || now.toISOString() });
  }

  for (const row of (Array.isArray(opportunitiesPayload?.opportunities) ? opportunitiesPayload.opportunities : []).slice(0, 200)) {
    try {
      const evidence = row.evidence || {};
      const opportunity = normalizeOpportunity({
        source_id: row.source_id || 'src_manual_revenue_research', external_id: row.external_id || evidence.source_record_id || row.dedupe_key, external_url: evidence.source_url || row.external_url || null,
        opportunity_type: row.opportunity_type || 'partnership', title: row.title || 'Untitled opportunity', summary: row.ai_summary || row.summary || '', buyer_org_name: row.buyer_org_name || row.buyer_sponsor_agency_network || 'Unknown buyer', buyer_domain: row.buyer_domain || null,
        expected_value_usd: row.expected_value_usd ?? row.value_estimate ?? null, expected_value_basis: row.expected_value_basis || 'collector_estimate', due_at: row.due_date || null, posted_at: evidence.collected_at || row.posted_at || now.toISOString(), source_updated_at: evidence.collected_at || row.updated_at || now.toISOString(),
        fit_tags: row.fit_tags || [row.company_fit].filter(Boolean), revenue_model: row.revenue_model || '', status: mapFixtureStatus(row.status), compliance_flags: row.score?.risk_flags || [], suppression_status: row.suppression_status || 'not_applicable', evidence_refs: [evidence.source_url, evidence.source_record_id, ...(row.evidence_refs || [])].filter(Boolean), first_cash_path: row.first_cash_path || row.next_best_action || '', first_cash_window_days: row.first_cash_window_days ?? null, first_cash_window_basis: row.first_cash_window_basis || '', spg_proof_signals: row.spg_proof_signals || [], gate_status: mapFixtureGateStatus(row.gate_status || evidence.gate_status), external_action_type: row.external_action_type || 'none', approval_ref: evidence.gate_ref || row.approval_ref || null, privacy_pii_handling: 'public_org_only', route_state: row.route_state || 'not_routed', route_owner_profile: evidence.owner_profile || row.route_owner_profile || 'productops', owner_profile: evidence.owner_profile || row.owner_profile || 'productops', dedupe_key: row.dedupe_key, created_at: row.updated_at || now.toISOString(), updated_at: row.updated_at || now.toISOString(),
      }, now);
      if (!state.opportunities.some((item) => item.dedupe_key === opportunity.dedupe_key)) state.opportunities.push(opportunity);
    } catch {}
  }
}
function readFixtureJson(baseDir, relativePath) { const full = resolve(baseDir, relativePath); return existsSync(full) ? JSON.parse(readFileSync(full, 'utf8')) : null; }
function mapFixtureStatus(status) { if (status === 'draft_only') return 'needs_approval'; return STATUSES.has(status) ? status : 'watch'; }
function mapFixtureGateStatus(status) { if (status === 'draft_only') return 'pending'; return GATE_STATUSES.has(status) ? status : 'not_required'; }

function ownerForRoute(routeType) { return ({ collector: 'scout', backend_api: 'leadfs', ui_build: 'webdev', comply_review: 'complyops', devops_job: 'devops', data_quality: 'dataeng', scout_research: 'scout', sales_prep: 'arman', product_brief: 'productops', review: 'leadfs' })[routeType] || 'productops'; }
function number(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function clamp(value) { return Math.max(0, Math.min(100, Math.round(value * 10) / 10)); }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function statusError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error; }
