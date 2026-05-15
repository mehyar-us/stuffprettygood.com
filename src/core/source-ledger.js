const PROVENANCE_STATES = ['verified', 'pending', 'simulated', 'blocked', 'missing'];
const ENTITY_TYPES = ['opportunity', 'spg_offer', 'job', 'campaign_prerequisite'];
const SOURCE_CLASSES = ['SPG offer feed', 'public opportunity feed', 'job posting', 'RSS', 'government', 'affiliate/network', 'legacy audience', 'operator entry', 'system job'];
const SUPPRESSION_STATUSES = ['not_applicable', 'verified_clear', 'pending', 'blocked', 'unknown'];
const RUN_STATUSES = ['queued', 'running', 'ok', 'warning', 'error', 'blocked', 'skipped'];
const SECRET_PATTERN = /(?:(?:password|passwd|api[_-]?key|secret|token|bearer|authorization)\s*[:=]\s*\S+|sk_live_[A-Za-z0-9]+|pk_live_[A-Za-z0-9]+|-----BEGIN|AKIA[0-9A-Z]{16})/i;
const RAW_PII_PATTERN = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\b\d{3}-\d{2}-\d{4}\b)/i;

export const SOURCE_LEDGER_CONTRACT_VERSION = 'source-ledger-provenance-v1';

export const PROVENANCE_STATE_DEFINITIONS = Object.freeze({
  verified: 'Loaded from a real source artifact, live service, DB query, or audited operator entry and passed freshness/health checks.',
  pending: 'Source or artifact exists, but freshness, health, consent, suppression, or reviewer validation has not passed yet.',
  simulated: 'Prototype/test-only fixture that must be excluded from production revenue views and action queues.',
  blocked: 'Source/action exists, but a compliance, credential, health, suppression, consent, or authority gate prevents use.',
  missing: 'No real data exists yet; display an honest empty state and the next action instead of fake rows.',
});

export const SOURCE_LEDGER_ENTITY_TYPES = Object.freeze([...ENTITY_TYPES]);
export const SOURCE_LEDGER_SOURCE_CLASSES = Object.freeze([...SOURCE_CLASSES]);

export function buildSourceArtifact(input = {}) {
  assertSafePayload(input, 'source_artifact');
  const artifact = {
    artifact_ref: cleanText(input.artifact_ref || input.artifactRef || null),
    source_id: cleanText(input.source_id || input.sourceId || null),
    source_name: cleanText(input.source_name || input.sourceName || null),
    source_class: enumValue(input.source_class || input.sourceClass, SOURCE_CLASSES, 'operator entry'),
    artifact_type: cleanText(input.artifact_type || input.artifactType || 'source_artifact'),
    artifact_uri: cleanText(input.artifact_uri || input.artifactUri || input.path || null),
    artifact_hash: cleanHash(input.artifact_hash || input.artifactHash || null),
    produced_by_run_id: cleanText(input.produced_by_run_id || input.producedByRunId || null),
    observed_at: cleanText(input.observed_at || input.observedAt || null),
    source_updated_at: cleanText(input.source_updated_at || input.sourceUpdatedAt || null),
    freshness_sla_hours: safeNumber(input.freshness_sla_hours ?? input.freshnessSlaHours),
    credential_ref_env: cleanCredentialRef(input.credential_ref_env || input.credentialRefEnv || null),
    no_raw_pii_asserted: input.no_raw_pii_asserted !== false,
    no_raw_secret_asserted: input.no_raw_secret_asserted !== false,
  };

  artifact.artifact_state = artifact.artifact_ref && artifact.source_id ? 'present' : 'missing';
  artifact.source_age_hours = sourceAgeHours(artifact.source_updated_at || artifact.observed_at, input.now || new Date());
  artifact.freshness_state = freshnessState(artifact.source_age_hours, artifact.freshness_sla_hours);
  return artifact;
}

export function buildRunDelta(input = {}) {
  assertSafePayload(input, 'run_delta');
  const recordsSeen = safeNumber(input.records_seen ?? input.recordsSeen) || 0;
  const recordsRejected = safeNumber(input.records_rejected ?? input.recordsRejected) || 0;
  const delta = {
    run_id: cleanText(input.run_id || input.runId || null),
    source_id: cleanText(input.source_id || input.sourceId || null),
    status: enumValue(input.status, RUN_STATUSES, 'skipped'),
    started_at: cleanText(input.started_at || input.startedAt || null),
    finished_at: cleanText(input.finished_at || input.finishedAt || null),
    records_seen: recordsSeen,
    records_added: safeNumber(input.records_added ?? input.recordsAdded) || 0,
    records_updated: safeNumber(input.records_updated ?? input.recordsUpdated) || 0,
    records_rejected: recordsRejected,
    records_blocked: safeNumber(input.records_blocked ?? input.recordsBlocked) || 0,
    artifacts_written: normalizeRefs(input.artifacts_written || input.artifactsWritten || []),
    top_errors: normalizeRefs(input.top_errors || input.topErrors || []),
    no_raw_pii_asserted: input.no_raw_pii_asserted !== false,
    no_raw_secret_asserted: input.no_raw_secret_asserted !== false,
  };
  delta.rejection_rate = recordsSeen ? Number((recordsRejected / recordsSeen).toFixed(4)) : 0;
  delta.delta_state = delta.status === 'ok' && !recordsRejected ? 'verified' : delta.status === 'blocked' ? 'blocked' : delta.status === 'skipped' ? 'missing' : 'pending';
  return delta;
}

export function buildProvenanceRecord(input = {}) {
  assertSafePayload(input, 'provenance_record');
  const entityType = enumValue(input.entity_type || input.entityType, ENTITY_TYPES, null);
  if (!entityType) throw new Error('entity_type must be one of opportunity, spg_offer, job, campaign_prerequisite');

  const artifactRefs = normalizeRefs(input.artifact_refs || input.artifactRefs || []);
  const sourceArtifacts = (input.source_artifacts || input.sourceArtifacts || []).map((artifact) => buildSourceArtifact({ ...artifact, now: input.now }));
  for (const artifact of sourceArtifacts) {
    if (artifact.artifact_ref) artifactRefs.push(artifact.artifact_ref);
  }
  const uniqueArtifactRefs = [...new Set(artifactRefs)].filter(Boolean);
  const sourceRef = cleanText(input.source_ref || input.sourceRef || sourceArtifacts[0]?.source_id || null);
  const requestedState = enumValue(input.provenance_state || input.provenanceState, PROVENANCE_STATES, 'missing');
  const suppressionStatus = enumValue(input.suppression_status || input.suppressionStatus, SUPPRESSION_STATUSES, entityType === 'campaign_prerequisite' ? 'unknown' : 'not_applicable');
  const runDelta = input.run_delta || input.runDelta ? buildRunDelta(input.run_delta || input.runDelta) : null;

  const record = {
    contract_version: SOURCE_LEDGER_CONTRACT_VERSION,
    entity_type: entityType,
    entity_id: cleanText(input.entity_id || input.entityId || null),
    display_name: cleanText(input.display_name || input.displayName || input.title || null),
    provenance_state: requestedState,
    source_ref: sourceRef,
    artifact_refs: uniqueArtifactRefs,
    source_artifacts: sourceArtifacts,
    latest_run_delta: runDelta,
    source_age_hours: minSourceAge(sourceArtifacts),
    suppression_status: suppressionStatus,
    consent_state: cleanText(input.consent_state || input.consentState || null),
    gate_status: cleanText(input.gate_status || input.gateStatus || null),
    owner_profile: cleanText(input.owner_profile || input.ownerProfile || null),
    route_owner_profile: cleanText(input.route_owner_profile || input.routeOwnerProfile || null),
    next_action: cleanText(input.next_action || input.nextAction || null),
    missing_data: normalizeRefs(input.missing_data || input.missingData || []),
    blocker_classes: normalizeRefs(input.blocker_classes || input.blockerClasses || []),
    confidence_score: clamp(safeNumber(input.confidence_score ?? input.confidenceScore) ?? defaultConfidence(requestedState)),
    production_visible: false,
    actionable: false,
    no_raw_pii_asserted: input.no_raw_pii_asserted !== false,
    no_raw_secret_asserted: input.no_raw_secret_asserted !== false,
  };

  const proof = hasSourceProof(record);
  const safeSuppression = ['not_applicable', 'verified_clear'].includes(record.suppression_status);
  if (record.provenance_state === 'verified' && proof && safeSuppression) {
    record.production_visible = true;
    record.actionable = true;
  }
  if (record.provenance_state === 'pending' && proof) {
    record.production_visible = false;
    record.actionable = false;
  }
  if (record.provenance_state === 'missing' && !record.next_action) {
    record.next_action = 'Add source artifact or operator proof before showing this record as real.';
  }
  if (record.provenance_state === 'blocked' && !record.blocker_classes.length) {
    record.blocker_classes = ['gate_or_source_blocked'];
  }
  return record;
}

export function buildProductionProvenanceView(records = []) {
  return records.map((record) => buildProvenanceRecord(record)).filter((record) => record.production_visible && record.provenance_state === 'verified');
}

export function buildLedgerSummary(records = []) {
  const normalized = records.map((record) => buildProvenanceRecord(record));
  return {
    contract_version: SOURCE_LEDGER_CONTRACT_VERSION,
    counts: countBy(normalized, 'provenance_state'),
    production_visible: normalized.filter((record) => record.production_visible).length,
    actionable: normalized.filter((record) => record.actionable).length,
    blocked: normalized.filter((record) => record.provenance_state === 'blocked').map((record) => ({ entity_type: record.entity_type, entity_id: record.entity_id, next_action: record.next_action, blocker_classes: record.blocker_classes })),
    missing: normalized.filter((record) => record.provenance_state === 'missing').map((record) => ({ entity_type: record.entity_type, entity_id: record.entity_id, next_action: record.next_action })),
  };
}

export function buildMigrationPlan() {
  return {
    contract_version: SOURCE_LEDGER_CONTRACT_VERSION,
    additive_only: true,
    shared_columns: ['provenance_state', 'source_ref', 'artifact_refs_json', 'latest_source_run_id', 'source_age_hours', 'suppression_status', 'consent_state', 'gate_status', 'next_action', 'missing_data_json', 'blocker_classes_json', 'production_visible', 'no_raw_pii_asserted', 'no_raw_secret_asserted'],
    tables: {
      opportunities: { required: ['provenance_state', 'source_ref', 'artifact_refs_json', 'latest_source_run_id', 'suppression_status'], default_state: 'missing until source/artifact proof is linked' },
      spg_offers: { required: ['provenance_state', 'source_ref', 'artifact_refs_json', 'latest_source_run_id', 'disclosure_ref', 'production_visible'], default_state: 'simulated for fixtures; pending for candidates; verified only after account/source/disclosure proof' },
      jobs: { required: ['provenance_state', 'source_ref', 'artifact_refs_json', 'run_delta_json', 'safe_log_preview_ref'], default_state: 'pending/running, verified on ok run, blocked on failed gate' },
      campaign_prerequisites: { required: ['provenance_state', 'source_ref', 'artifact_refs_json', 'suppression_status', 'consent_state', 'gate_status'], default_state: 'blocked unless suppression and consent proof are verified' },
    },
    production_filter: "provenance_state = 'verified' and production_visible = true and suppression_status in ('not_applicable','verified_clear')",
    simulated_filter: "provenance_state <> 'simulated'",
    destructive_statements_allowed: false,
  };
}

export function assertSafePayload(payload, context = 'payload') {
  const serialized = JSON.stringify(payload || {});
  if (SECRET_PATTERN.test(serialized)) throw new Error(`${context} contains secret-like material; use env:key-name refs only`);
  if (RAW_PII_PATTERN.test(serialized)) throw new Error(`${context} contains raw PII-like material; store count-only, masked, or hashed references only`);
  return true;
}

function hasSourceProof(record) {
  return Boolean(record.source_ref && record.artifact_refs.length && record.source_artifacts.every((artifact) => artifact.no_raw_pii_asserted && artifact.no_raw_secret_asserted));
}

function sourceAgeHours(value, now) {
  if (!value) return null;
  const observed = new Date(value).getTime();
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(observed) || !Number.isFinite(current)) return null;
  return Math.max(0, Number(((current - observed) / 36e5).toFixed(2)));
}

function freshnessState(ageHours, slaHours) {
  if (ageHours == null || slaHours == null) return 'unknown';
  return ageHours <= slaHours ? 'fresh' : 'stale';
}

function minSourceAge(artifacts) {
  const ages = artifacts.map((artifact) => artifact.source_age_hours).filter((age) => Number.isFinite(age));
  return ages.length ? Math.min(...ages) : null;
}

function normalizeRefs(values) {
  return [...new Set((Array.isArray(values) ? values : [values]).map((value) => cleanText(value)).filter(Boolean))];
}

function cleanText(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  if (SECRET_PATTERN.test(text) || RAW_PII_PATTERN.test(text)) return null;
  return text;
}

function cleanCredentialRef(value) {
  if (!value) return null;
  const text = cleanText(value);
  if (!text) return null;
  if (!/^env:[A-Z0-9_]+$/.test(text) && !/^cloudflare_secret:[A-Z0-9_]+$/.test(text) && !/^vault:[A-Z0-9_/-]+$/.test(text)) return null;
  return text;
}

function cleanHash(value) {
  const text = cleanText(value);
  if (!text) return null;
  return /^[a-f0-9]{32,128}$/i.test(text) || /^sha256:[a-f0-9]{64}$/i.test(text) ? text : null;
}

function enumValue(value, allowed, fallback) {
  const text = cleanText(value);
  if (text && allowed.includes(text)) return text;
  return fallback;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function defaultConfidence(state) {
  return { verified: 85, pending: 55, simulated: 30, blocked: 50, missing: 0 }[state] ?? 0;
}

function countBy(records, key) {
  return records.reduce((acc, record) => {
    const value = record[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}
