import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PROVENANCE_STATE_DEFINITIONS,
  SOURCE_LEDGER_CONTRACT_VERSION,
  SOURCE_LEDGER_ENTITY_TYPES,
  assertSafePayload,
  buildLedgerSummary,
  buildMigrationPlan,
  buildProductionProvenanceView,
  buildProvenanceRecord,
  buildRunDelta,
  buildSourceArtifact,
} from '../src/core/source-ledger.js';

const NOW = new Date('2026-05-15T16:00:00.000Z');

function artifact(overrides = {}) {
  return {
    artifact_ref: 'artifact:opportunities:run-001',
    source_id: 'sam_gov_public_opportunities',
    source_name: 'SAM.gov public opportunities',
    source_class: 'government',
    artifact_type: 'json_snapshot',
    artifact_uri: 'data/opportunity-desk/opportunities.json',
    artifact_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    produced_by_run_id: 'run-001',
    observed_at: '2026-05-15T15:00:00.000Z',
    freshness_sla_hours: 24,
    credential_ref_env: 'env:SAM_GOV_API_KEY',
    no_raw_pii_asserted: true,
    no_raw_secret_asserted: true,
    ...overrides,
  };
}

test('source-ledger contract defines canonical provenance states and entity coverage', () => {
  assert.equal(SOURCE_LEDGER_CONTRACT_VERSION, 'source-ledger-provenance-v1');
  assert.deepEqual(Object.keys(PROVENANCE_STATE_DEFINITIONS), ['verified', 'pending', 'simulated', 'blocked', 'missing']);
  assert.deepEqual(SOURCE_LEDGER_ENTITY_TYPES, ['opportunity', 'spg_offer', 'job', 'campaign_prerequisite']);
});

test('source artifacts expose proof refs, freshness, env-only credential refs, and no raw secret values', () => {
  const sourceArtifact = buildSourceArtifact({ ...artifact(), now: NOW });
  assert.equal(sourceArtifact.artifact_state, 'present');
  assert.equal(sourceArtifact.freshness_state, 'fresh');
  assert.equal(sourceArtifact.source_age_hours, 1);
  assert.equal(sourceArtifact.credential_ref_env, 'env:SAM_GOV_API_KEY');

  const unsafeCredential = buildSourceArtifact({ ...artifact(), credential_ref_env: 'not-a-safe-ref', now: NOW });
  assert.equal(unsafeCredential.credential_ref_env, null);
});

test('run deltas expose added/updated/rejected counts and state without raw logs', () => {
  const delta = buildRunDelta({
    run_id: 'run-001',
    source_id: 'sam_gov_public_opportunities',
    status: 'warning',
    records_seen: 10,
    records_added: 3,
    records_updated: 4,
    records_rejected: 2,
    records_blocked: 1,
    artifacts_written: ['artifact:opportunities:run-001'],
    top_errors: ['2 unsafe rows rejected by no-PII/no-secret guard'],
  });

  assert.equal(delta.records_seen, 10);
  assert.equal(delta.records_added, 3);
  assert.equal(delta.records_updated, 4);
  assert.equal(delta.records_rejected, 2);
  assert.equal(delta.rejection_rate, 0.2);
  assert.equal(delta.delta_state, 'pending');
});

test('verified records become production visible only with source proof and suppression clearance', () => {
  const verified = buildProvenanceRecord({
    entity_type: 'opportunity',
    entity_id: 'opp-001',
    title: 'Claims-safe public sector modernization opportunity',
    provenance_state: 'verified',
    source_artifacts: [artifact()],
    suppression_status: 'not_applicable',
    now: NOW,
  });

  assert.equal(verified.provenance_state, 'verified');
  assert.equal(verified.production_visible, true);
  assert.equal(verified.actionable, true);
  assert.equal(verified.source_ref, 'sam_gov_public_opportunities');
  assert.deepEqual(verified.artifact_refs, ['artifact:opportunities:run-001']);

  const noProof = buildProvenanceRecord({ entity_type: 'opportunity', entity_id: 'opp-002', provenance_state: 'verified' });
  assert.equal(noProof.production_visible, false);
  assert.equal(noProof.actionable, false);
});

test('production provenance view excludes simulated, pending, blocked, missing, and suppression-unknown records', () => {
  const records = [
    { entity_type: 'opportunity', entity_id: 'opp-verified', provenance_state: 'verified', source_artifacts: [artifact()], suppression_status: 'not_applicable', now: NOW },
    { entity_type: 'spg_offer', entity_id: 'offer-sim', provenance_state: 'simulated', source_artifacts: [artifact({ artifact_ref: 'artifact:spg:simulated' })], suppression_status: 'not_applicable', now: NOW },
    { entity_type: 'job', entity_id: 'job-pending', provenance_state: 'pending', source_artifacts: [artifact({ artifact_ref: 'artifact:jobs:pending' })], suppression_status: 'not_applicable', now: NOW },
    { entity_type: 'campaign_prerequisite', entity_id: 'segment-blocked', provenance_state: 'verified', source_artifacts: [artifact({ artifact_ref: 'artifact:campaign:segment' })], suppression_status: 'unknown', now: NOW },
    { entity_type: 'campaign_prerequisite', entity_id: 'segment-missing', provenance_state: 'missing', next_action: 'Load suppression proof before eligibility counts.', now: NOW },
  ];

  const production = buildProductionProvenanceView(records);
  assert.deepEqual(production.map((record) => record.entity_id), ['opp-verified']);
  assert.equal(JSON.stringify(production).includes('offer-sim'), false);
});

test('missing and blocked records carry honest next-action/blocker metadata instead of fake rows', () => {
  const summary = buildLedgerSummary([
    { entity_type: 'opportunity', entity_id: 'opp-missing', provenance_state: 'missing' },
    { entity_type: 'campaign_prerequisite', entity_id: 'legacy-audience', provenance_state: 'blocked', suppression_status: 'blocked', next_action: 'Attach verified consent and suppression proof before eligibility counts.' },
  ]);

  assert.equal(summary.counts.missing, 1);
  assert.equal(summary.counts.blocked, 1);
  assert.match(summary.missing[0].next_action, /Add source artifact/);
  assert.deepEqual(summary.blocked[0].blocker_classes, ['gate_or_source_blocked']);
});

test('no-PII/no-secret guard rejects unsafe payloads without storing raw values in contract output', () => {
  const unsafeEmail = `person${'@'}example.test`;
  assert.throws(() => assertSafePayload({ title: `Unsafe ${unsafeEmail}` }, 'test_payload'), /raw PII-like/);
  assert.throws(() => assertSafePayload({ credential: `sk_${'live'}_unsafe_value` }, 'test_payload'), /secret-like/);
});

test('migration plan covers opportunity, SPG offer, job, and campaign prerequisite schemas', () => {
  const plan = buildMigrationPlan();
  assert.equal(plan.additive_only, true);
  assert.equal(plan.destructive_statements_allowed, false);
  for (const table of ['opportunities', 'spg_offers', 'jobs', 'campaign_prerequisites']) {
    assert.ok(plan.tables[table], `${table} migration path missing`);
    assert.ok(plan.tables[table].required.includes('provenance_state'));
  }
  assert.match(plan.production_filter, /provenance_state = 'verified'/);
});

test('SQL migration draft is additive and encodes source ledger production/simulated filters', () => {
  const migration = readFileSync(new URL('../db/006_source_ledger_provenance_schema.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(migration, /drop table|truncate table|delete from/i);
  for (const table of ['source_ledger_artifacts', 'source_ledger_runs', 'source_ledger_records']) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`));
  }
  assert.match(migration, /verified','pending','simulated','blocked','missing/);
  assert.match(migration, /production_provenance_records/);
  assert.match(migration, /provenance_state = 'verified'/);
  assert.match(migration, /provenance_state <> 'simulated'/);
});
