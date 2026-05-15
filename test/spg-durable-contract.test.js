import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AuditLog } from '../src/core/audit.js';
import { AuthStore } from '../src/core/auth.js';
import { createApp } from '../src/server.js';
import { SpgDurableStore } from '../src/spg/durable-store.js';

function tempStore(auditLog) {
  const dir = mkdtempSync(join(tmpdir(), 'spg-store-'));
  return new SpgDurableStore({ path: join(dir, 'spg-durable-store.json'), auditLog });
}

test('SPG public offer JSON contract exposes approved safe offers only', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  auth.createUser({ email: 'viewer@mehyarmedia.local', password: 'safe-local-password', role: 'viewer' });
  const spgStore = tempStore(auditLog);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, spgStore }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await requestJson(`${baseUrl}/api/spg/offers/public`);
    assert.equal(response.status, 200);
    assert.equal(response.body.brand, 'stuffprettygood');
    assert.equal(response.body.massSendingEnabled, false);
    assert.ok(response.body.offers.length >= 4);
    for (const offer of response.body.offers) {
      assert.equal(offer.approval_state, 'approved');
      assert.equal(offer.monetization_status, 'approved_monetized');
      assert.notEqual(offer.payout_model, 'none');
      assert.equal(offer.account_status, 'active');
      assert.equal(offer.tracking_status, 'active');
      assert.match(offer.landing_url, /^\/offers\//);
      assert.match(offer.go_link, /^\/go\//);
      assert.ok(offer.image.url);
      assert.ok(offer.image.license);
      assert.equal(offer.image.rights_status, 'approved');
      assert.ok(offer.category);
      assert.ok(offer.title);
      assert.ok(offer.summary);
      assert.ok(offer.cta);
      assert.ok(offer.disclosure);
      assert.ok(offer.seo.title);
      assert.equal(offer.claim_rules.price_claim_allowed, false);
      assert.equal(offer.claim_rules.availability_claim_allowed, false);
      assert.equal(offer.claim_rules.rating_review_claim_allowed, false);
      assert.doesNotMatch(JSON.stringify(offer), /password|secret|token|email=/i);
      assert.doesNotMatch(JSON.stringify(offer), /\$\d[\d,.]*|\d+%\s*off|customer reviews?|in stock/i);
    }

    const viewerLogin = await requestJson(`${baseUrl}/api/auth/login`, { method: 'POST', body: { email: 'viewer@mehyarmedia.local', password: 'safe-local-password' } });
    const viewerOffers = await requestJson(`${baseUrl}/api/spg/offers`, { headers: { authorization: `Bearer ${viewerLogin.body.session.id}` } });
    assert.equal(viewerOffers.status, 200);
    assert.ok(viewerOffers.body.offers.length >= 4);
    assert.ok(viewerOffers.body.offers.every((offer) => offer.approval_state === 'approved'));
    assert.ok(viewerOffers.body.offers.every((offer) => offer.landing_url));
    assert.ok(viewerOffers.body.offers.every((offer) => offer.go_link));
    assert.equal(viewerOffers.body.offers.some((offer) => offer.approval_state === 'paused'), false);

    spgStore.state.page_placements.push({ id: 'plc_private_test', surface: 'admin_only', entity_type: 'offer', entity_key: 'hubspot', approval_status: 'pending', publish_state: 'draft', display_order: 999 });
    const viewerPlacements = await requestJson(`${baseUrl}/api/spg/page-placements`, { headers: { authorization: `Bearer ${viewerLogin.body.session.id}` } });
    assert.equal(viewerPlacements.status, 200);
    assert.equal(viewerPlacements.body.placements.some((placement) => placement.id === 'plc_private_test'), false);

    spgStore.state.offers.push({ ...spgStore.state.offers[0], id: 'off_private_test', offer_key: 'private-unapproved-test', approval_status: 'paused', publish_state: 'draft', monetization_status: 'pending', payout_model: 'none' });
    spgStore.state.page_placements.push({ id: 'plc_private_offer_wall', surface: 'home', entity_type: 'offer', entity_key: 'private-unapproved-test', approval_status: 'approved', publish_state: 'published', display_order: 1 });
    const offerWall = await requestJson(`${baseUrl}/api/spg/offer-wall/public?surface=home&limit=8`);
    assert.equal(offerWall.status, 200);
    assert.equal(offerWall.body.massSendingEnabled, false);
    assert.equal(offerWall.body.providerPushEnabled, false);
    assert.equal(offerWall.body.offers.length, 8);
    assert.equal(offerWall.body.offers.some((offer) => offer.offer_key === 'private-unapproved-test'), false);
    assert.ok(offerWall.body.offers.every((offer) => offer.placement.surface === 'home'));
    assert.ok(offerWall.body.offers.every((offer) => offer.monetization_status === 'approved_monetized' && offer.payout_model !== 'none'));
  } finally {
    await close(server);
  }
});

test('SPG admin source and ingestion endpoints enforce auth and no-send side effects', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  const spgStore = tempStore(auditLog);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, spgStore }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const denied = await requestJson(`${baseUrl}/api/spg/sources`);
    assert.equal(denied.status, 401);

    const login = await requestJson(`${baseUrl}/api/auth/login`, { method: 'POST', body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' } });
    const headers = { authorization: `Bearer ${login.body.session.id}` };

    const sources = await requestJson(`${baseUrl}/api/spg/sources`, { headers });
    assert.equal(sources.status, 200);
    assert.ok(sources.body.sources.some((source) => source.source_key === 'spg-rss-registry'));
    assert.ok(sources.body.sources.every((source) => source.source_type !== 'manual_amazon' || source.feed_url === null));

    const blockedAmazonFeed = await requestJson(`${baseUrl}/api/spg/sources`, {
      method: 'POST',
      headers,
      body: { source_key: 'bad-amazon-feed', name: 'Bad Amazon Feed', source_type: 'manual_amazon', feed_url: 'https://amazon.com/rss', terms_url: 'https://amazon.com', allowed_use: 'metadata_only', approval_status: 'approved', enabled: true, risk_tier: 'medium' },
    });
    assert.equal(blockedAmazonFeed.status, 422);
    assert.match(blockedAmazonFeed.body.error, /manual_amazon source cannot have feed_url/);

    const ingest = await requestJson(`${baseUrl}/api/spg/ingest/run`, { method: 'POST', headers, body: { dry_run: false, max_items_per_source: 5 } });
    assert.equal(ingest.status, 202);
    assert.equal(ingest.body.massSendingEnabled, false);
    assert.equal(ingest.body.providerPushEnabled, false);
    assert.ok(ingest.body.blocked_side_effects.includes('email'));
    assert.ok(ingest.body.blocked_side_effects.includes('provider_push'));

    const readiness = await requestJson(`${baseUrl}/api/spg/proof/network-readiness`, { headers });
    assert.equal(readiness.status, 200);
    for (const field of ['inputs', 'weights', 'score', 'confidence', 'missing_data', 'source_age', 'privacy_pii_handling', 'false_positive_risks', 'refresh_cadence', 'hard_blockers', 'readiness_status']) {
      assert.ok(Object.hasOwn(readiness.body, field), `${field} missing`);
    }
  } finally {
    await close(server);
  }
});

test('SPG public signup/preferences/events are functional but no-send and PII-safe', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  const spgStore = tempStore(auditLog);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, spgStore }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const signup = await requestJson(`${baseUrl}/api/spg/signup`, {
      method: 'POST',
      body: { email: 'reader@example.com', topics: ['ai-tools', 'travel'], consent_copy_version: 'spg-no-send-v1', consent_state: 'explicit_web_interest_only' },
    });
    assert.equal(signup.status, 202);
    assert.equal(signup.body.status, 'accepted');
    assert.equal(signup.body.live_send_enabled, false);
    assert.equal(signup.body.provider_push_enabled, false);
    assert.equal(signup.body.raw_pii_stored, false);
    assert.match(signup.body.profile_ref_hash, /^sha256:/);
    assert.doesNotMatch(JSON.stringify(signup.body), /reader@example\.com/);

    const prefs = await requestJson(`${baseUrl}/api/spg/preferences`, { method: 'POST', body: { topics: ['smart-home', 'deals'], consent_state: 'web_preference_only' } });
    assert.equal(prefs.status, 202);
    assert.equal(prefs.body.live_send_enabled, false);
    assert.deepEqual(prefs.body.topics.sort(), ['deals', 'smart-home']);

    const blockedEvent = await requestJson(`${baseUrl}/api/spg/events`, { method: 'POST', body: { event_type: 'go_click', route_path: '/go/chatgpt?email=reader@example.com' } });
    assert.equal(blockedEvent.status, 422);
    assert.equal(blockedEvent.body.status, 'blocked');
    assert.equal(blockedEvent.body.blocked_payload_stored, false);
    assert.ok(blockedEvent.body.blocker_classes.includes('raw_pii_or_secret_like_payload'));

    const unsubscribe = await requestJson(`${baseUrl}/api/spg/unsubscribe`, { method: 'POST', body: { scope: 'brand_and_global' } });
    assert.equal(unsubscribe.status, 202);
    assert.equal(unsubscribe.body.never_resubscribe, true);
    assert.equal(unsubscribe.body.provider_push_enabled, false);
  } finally {
    await close(server);
  }
});

test('SPG migration draft is additive and contains source/offer/go-link tables', () => {
  const migration = readFileSync(new URL('../db/002_spg_offer_source_article_schema.sql', import.meta.url), 'utf8');
  for (const table of ['spg_sources', 'spg_source_items', 'spg_offer_candidates', 'spg_offers', 'spg_go_links']) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`));
  }
  assert.doesNotMatch(migration, /drop table|truncate table|delete from/i);
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
