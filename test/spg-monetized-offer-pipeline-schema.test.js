import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trendOfferTargets } from '../src/spg/trend-components.js';

const migration = readFileSync(new URL('../db/003_spg_monetized_offer_pipeline_schema.sql', import.meta.url), 'utf8');
const contract = readFileSync(new URL('../docs/spg-monetized-offer-pipeline-data-contract.md', import.meta.url), 'utf8');
const crmOfferSeed = JSON.parse(readFileSync(new URL('../data/spg-crm-offer-model-seed.json', import.meta.url), 'utf8'));
const accountTargets = JSON.parse(readFileSync(new URL('../data/spg-affiliate-account-targets.json', import.meta.url), 'utf8'));

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

test('SPG CRM offer seed maps account targets into durable account status fields', () => {
  const sourcePrograms = new Set([
    ...accountTargets.active_accounts.map((account) => account.program),
    ...accountTargets.signup_targets_now.map((account) => account.program),
  ]);
  const seededPrograms = new Set(crmOfferSeed.offer_accounts.map((account) => account.merchant_or_network));

  assert.equal(crmOfferSeed.offer_accounts.length, sourcePrograms.size);
  for (const program of sourcePrograms) assert.ok(seededPrograms.has(program), program);

  const amazon = crmOfferSeed.offer_accounts.find((account) => account.account_key === 'amazon-associates-manual');
  assert.equal(amazon.monetization_status, 'approved_monetized');
  assert.equal(amazon.account_status, 'active');
  assert.equal(amazon.tracking_id_label, 'mehyarmedia-20');
  assert.equal(amazon.credential_ref, 'env:SPG_AMAZON_ASSOCIATES_TAG');

  for (const account of crmOfferSeed.offer_accounts) {
    assert.ok(account.monetization_status);
    assert.ok(account.account_status);
    assert.doesNotMatch(JSON.stringify(account), /(password|api[_-]?key|secret=|token=|sk_live_|pk_live_)/i);
  }
});

test('SPG CRM offer seed maps every Amazon manual card into approved tracking and publish states', () => {
  const expectedAmazonCards = Object.values(trendOfferTargets)
    .flat()
    .filter((target) => target.type === 'amazon_search');

  assert.equal(crmOfferSeed.amazon_manual_offer_cards.length, expectedAmazonCards.length);

  for (const card of crmOfferSeed.amazon_manual_offer_cards) {
    assert.equal(card.account_key, 'amazon-associates-manual');
    assert.equal(card.monetization_status, 'approved_monetized');
    assert.equal(card.payout_model, 'commission');
    assert.equal(card.account_status, 'active');
    assert.equal(card.approval_status, 'approved');
    assert.equal(card.image_rights_status, 'approved');
    assert.equal(card.publish_decision, 'publish_monetized');
    assert.equal(card.tracking_status, 'active');
    assert.equal(card.disclosure_version, 'spg-affiliate-disclosure-v1');
    assert.equal(card.tracking_id_label, 'mehyarmedia-20');
    assert.match(card.destination_url, /^https:\/\/www\.amazon\.com\/s\?/);
    assert.match(card.destination_url, /[?&]tag=mehyarmedia-20/);
    assert.match(card.go_slug, /^amazon-/);
    assert.doesNotMatch(JSON.stringify(card), /(price|rating|review|availability|password|api[_-]?key|secret=|token=|sk_live_|pk_live_)/i);
  }

  assert.match(migration, /with amazon_manual_offer_cards/i);
  assert.match(migration, /insert into affiliate_tracking/i);
  assert.match(migration, /insert into publish_decisions/i);
  assert.match(contract, /62 Amazon manual cards/);
});
