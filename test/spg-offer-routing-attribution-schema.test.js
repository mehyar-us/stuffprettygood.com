import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync(new URL('../db/004_spg_offer_routing_attribution_schema.sql', import.meta.url), 'utf8');
const contract = readFileSync(new URL('../docs/spg-offer-routing-attribution-data-contract.md', import.meta.url), 'utf8');

test('SPG offer routing migration adds canonical offer, landing, redirect, SEO, health, and attribution fields', () => {
  for (const field of [
    'canonical_slug',
    'offer_id',
    'public_landing_path',
    'public_redirect_path',
    'destination_url_secret_ref',
    'destination_url_sanitized',
    'destination_url_mode',
    'network',
    'account_ref',
    'monetization_status',
    'approval_status',
    'disclosure_text',
    'image_rights_status',
    'seo_title',
    'seo_description',
    'schema_org_json',
    'click_count',
    'signup_count',
    'last_verified_at',
    'redirect_health',
    'source_attribution',
  ]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
    assert.match(contract, new RegExp(`\\b${field}\\b`));
  }
});

test('SPG offer routing migration enforces card to landing to tracked redirect route pattern', () => {
  assert.match(migration, /public_approved_offer_route_feed/);
  assert.match(migration, /public_landing_path = '\/offers\/' \|\| canonical_slug/);
  assert.match(migration, /public_redirect_path = '\/go\/' \|\| canonical_slug/);
  assert.match(migration, /public_landing_url/);
  assert.match(migration, /redirect_url/);
  assert.match(contract, /card -> `\/offers\/<slug>` landing -> `\/go\/<slug>` tracked redirect/);
  assert.match(contract, /Public cards must link only to `public_landing_url`/);
  assert.match(contract, /Landing pages .* link only to `redirect_url`/);
});

test('SPG offer routing migration includes no-PII click and signup attribution tables plus aggregate rollup', () => {
  for (const table of ['offer_click_events', 'offer_signup_attribution_events', 'offer_performance_daily']) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`));
  }

  assert.match(migration, /raw_pii_present = false and raw_ip_stored = false and raw_user_agent_stored = false/);
  assert.match(migration, /raw_pii_present = false and provider_push_enabled = false and live_send_enabled = false/);
  assert.match(migration, /create or replace view offer_performance_rollup/);
  assert.match(contract, /No raw PII is required for offer routing or attribution/);
});

test('SPG offer routing artifacts define daily ingestion approval-before-generation rule and Amazon audit migration', () => {
  assert.match(contract, /Daily pipeline order/);
  assert.match(contract, /Ingest candidates into DB first/);
  assert.match(contract, /WebDev generates landing\/redirect pages only from `public_approved_offer_route_feed`/);
  assert.match(contract, /Existing Amazon link migration\/audit approach/);
  assert.match(contract, /amazon_rows_missing_routes/);
  assert.match(migration, /amazon_rows_missing_routes/);
});

test('SPG offer routing artifacts are additive and secret safe', () => {
  assert.doesNotMatch(migration, /drop table|truncate table|delete from/i);
  assert.doesNotMatch(`${migration}\n${contract}`, /reader@example\.com|AKIA[0-9A-Z]{16}|sk_live_[A-Za-z0-9]+|pk_live_[A-Za-z0-9]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/i);
  assert.match(migration, /add column if not exists/);
  assert.match(migration, /destination_url_secret_ref/);
  assert.match(migration, /destination_url_sanitized/);
  assert.match(contract, /Destination secrets are represented as refs, not values/);
});
