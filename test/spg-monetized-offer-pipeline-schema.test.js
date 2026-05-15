import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync(new URL('../db/003_spg_monetized_offer_pipeline_schema.sql', import.meta.url), 'utf8');
const contract = readFileSync(new URL('../docs/spg-monetized-offer-pipeline-data-contract.md', import.meta.url), 'utf8');

test('SPG monetized offer pipeline migration contains required entities', () => {
  for (const table of [
    'offer_accounts',
    'offer_sources',
    'offer_candidates',
    'offer_images',
    'offer_approvals',
    'affiliate_tracking',
    'account_credentials_refs',
    'daily_ingest_runs',
    'publish_decisions',
    'signup_intent_events',
  ]) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`));
  }
});

test('SPG monetized offer pipeline migration includes required fields and public feed gate', () => {
  for (const field of [
    'monetization_status',
    'payout_model',
    'account_status',
    'credential_ref',
    'approval_status',
    'image_rights_status',
    'disclosure_required',
    'source_url',
    'risk_tier',
    'publish_decision',
  ]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }

  assert.match(migration, /create or replace view public_approved_offer_feed/i);
  assert.match(migration, /pd\.publish_decision in \('publish_monetized','publish_lead_magnet'\)/);
  assert.match(migration, /c\.monetization_status = 'approved_monetized'/);
  assert.match(migration, /c\.monetization_status = 'approved_lead_magnet'/);
});

test('SPG monetized offer pipeline artifacts are secret/PII safe and include seeds plus acceptance queries', () => {
  assert.doesNotMatch(migration, /drop table|truncate table|delete from/i);
  assert.doesNotMatch(`${migration}\n${contract}`, /reader@example\.com|AKIA[0-9A-Z]{16}/i);
  assert.doesNotMatch(migration, /values[\s\S]*(pk_live_[A-Za-z0-9]+|sk_live_[A-Za-z0-9]+|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i);
  assert.match(migration, /insert into account_credentials_refs/i);
  assert.match(migration, /insert into offer_accounts/i);
  assert.match(migration, /Acceptance queries/i);
  assert.match(contract, /expect 0/i);
});
