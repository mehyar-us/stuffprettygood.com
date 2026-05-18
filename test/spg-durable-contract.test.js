import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AuditLog } from '../src/core/audit.js';
import { AuthStore, seedAdmin } from '../src/core/auth.js';
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
      assert.equal(offer.public_landing_url, `/offers/${offer.canonical_slug}`);
      assert.equal(offer.redirect_url, `/go/${offer.canonical_slug}`);
      assert.match(offer.landing_url, /^\/offers\//);
      assert.match(offer.go_link, /^\/go\//);
      assert.equal(offer.landing_url, offer.public_landing_url);
      assert.equal(offer.go_link, offer.redirect_url);
      assert.equal(Object.hasOwn(offer, 'destination_url'), false);
      assert.ok(offer.landing_approved_at);
      assert.ok(offer.redirect_approved_at);
      assert.equal(offer.redirect_health, 'ok');
      assert.ok(offer.source_attribution_text);
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
  seedAdmin(auth);
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
    assert.ok(sources.body.sources.some((source) => source.source_key === 'skimlinks-api-feed' && source.api_endpoint_label === 'env:SPG_SKIMLINKS_API_ENDPOINT'));
    assert.ok(sources.body.sources.some((source) => source.source_key === 'stay22-api-feed' && source.api_endpoint_label === 'env:SPG_STAY22_API_ENDPOINT'));
    assert.ok(sources.body.sources.every((source) => source.source_type !== 'manual_amazon' || source.feed_url === null));

    const accounts = await requestJson(`${baseUrl}/api/spg/offer-accounts`, { headers });
    assert.equal(accounts.status, 200);
    assert.ok(accounts.body.accounts.some((account) => account.account_key === 'amazon-associates-manual' && account.credential_ref === 'env:SPG_AMAZON_ASSOCIATES_TAG'));
    assert.ok(accounts.body.accounts.some((account) => account.account_key === 'skimlinks' && account.api_key_ref === 'env:SPG_SKIMLINKS_API_KEY'));
    assert.ok(accounts.body.accounts.some((account) => account.account_key === 'stay22-publisher' && account.api_key_ref === 'env:SPG_STAY22_API_KEY'));
    assert.doesNotMatch(JSON.stringify(accounts.body), /(sk_live_|pk_live_|-----BEGIN|password=|api[_-]?key=|secret=|token=)/i);

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
    assert.ok(ingest.body.blocked_side_effects.includes('frontend_direct_external_urls'));
    assert.ok(ingest.body.source_keys.includes('amazon-manual-links'));
    assert.ok(ingest.body.source_keys.includes('skimlinks-api-feed'));
    assert.ok(ingest.body.source_keys.includes('stay22-api-feed'));
    assert.ok(ingest.body.source_item_count >= 1);
    assert.ok(ingest.body.candidate_count >= 0);
    assert.ok(ingest.body.offer_record_count >= 0);
    assert.ok(ingest.body.offers.some((offer) => offer.offer_key === 'amazon-daily-standing-desk-cable-kit'));
    assert.equal(ingest.body.offers.some((offer) => offer.offer_key.startsWith('skimlinks-') || offer.offer_key.startsWith('stay22-')), false);

    const sourceItems = await requestJson(`${baseUrl}/api/spg/source-items`, { headers });
    assert.equal(sourceItems.status, 200);
    assert.equal(sourceItems.body.source_items.some((item) => item.source_id === 'skimlinks-api-feed' || item.source_id === 'stay22-api-feed'), false);

    const candidates = await requestJson(`${baseUrl}/api/spg/offer-candidates`, { headers });
    assert.equal(candidates.status, 200);
    assert.equal(candidates.body.offer_candidates.some((candidate) => candidate.account_key === 'skimlinks' || candidate.account_key === 'stay22-publisher'), false);

    const publicOffers = await requestJson(`${baseUrl}/api/spg/offers/public`);
    assert.equal(publicOffers.status, 200);
    assert.ok(publicOffers.body.offers.some((offer) => offer.offer_key === 'amazon-daily-standing-desk-cable-kit'));
    assert.equal(publicOffers.body.offers.some((offer) => offer.offer_key.startsWith('skimlinks-') || offer.offer_key.startsWith('stay22-')), false);
    assert.ok(publicOffers.body.offers.every((offer) => offer.public_landing_url?.startsWith('/offers/')));
    assert.ok(publicOffers.body.offers.every((offer) => offer.redirect_url?.startsWith('/go/')));
    assert.equal(publicOffers.body.offers.some((offer) => Object.hasOwn(offer, 'destination_url')), false);

    const readiness = await requestJson(`${baseUrl}/api/spg/proof/network-readiness`, { headers });
    assert.equal(readiness.status, 200);
    for (const field of ['inputs', 'weights', 'score', 'confidence', 'missing_data', 'source_age', 'privacy_pii_handling', 'false_positive_risks', 'refresh_cadence', 'hard_blockers', 'readiness_status']) {
      assert.ok(Object.hasOwn(readiness.body, field), `${field} missing`);
    }
  } finally {
    await close(server);
  }
});

test('SPG /offers and /go routes expose publishable-only contracts and record no-PII click audit', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  const spgStore = tempStore(auditLog);
  const approved = spgStore.state.offers.find((offer) => offer.approval_status === 'approved' && offer.publish_state === 'published');
  assert.ok(approved, 'seed must include at least one approved published offer');
  spgStore.state.offers.push({
    ...approved,
    id: 'off_free_unpaid_public_test',
    offer_key: 'free-unpaid-public-test',
    canonical_slug: 'free-unpaid-public-test',
    public_landing_path: '/offers/free-unpaid-public-test',
    public_redirect_path: '/go/free-unpaid-public-test',
    monetization_status: 'free_unpaid',
    payout_model: 'none',
    account_status: 'inactive',
    tracking_status: 'none',
    landing_approved_at: approved.landing_approved_at,
    redirect_approved_at: approved.redirect_approved_at,
    blocked_reason: 'free_unpaid',
  });
  spgStore.state.page_placements.push({ id: 'plc_free_unpaid_public_test', surface: 'home', entity_type: 'offer', entity_key: 'free-unpaid-public-test', approval_status: 'approved', publish_state: 'published', display_order: 1 });
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, spgStore }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const offers = await requestJson(`${baseUrl}/offers`);
    assert.equal(offers.status, 200);
    assert.equal(offers.body.route_contract, 'card -> /offers/<slug> -> /go/<slug>');
    assert.ok(offers.body.offers.length >= 1);
    assert.equal(offers.body.offers.some((offer) => offer.offer_key === 'free-unpaid-public-test'), false);
    assert.ok(offers.body.offers.every((offer) => offer.public_landing_url === `/offers/${offer.canonical_slug}`));
    assert.ok(offers.body.offers.every((offer) => offer.redirect_url === `/go/${offer.canonical_slug}`));
    assert.doesNotMatch(JSON.stringify(offers.body), /"destination_url"\s*:/);

    const landing = await requestJson(`${baseUrl}/offers/${approved.offer_key}`);
    assert.equal(landing.status, 200);
    assert.equal(landing.body.offer.offer_key, approved.offer_key);
    assert.equal(landing.body.offer.public_landing_url, `/offers/${approved.offer_key}`);
    assert.equal(landing.body.offer.redirect_url, `/go/${approved.offer_key}`);
    assert.ok(landing.body.offer.disclosure);
    assert.doesNotMatch(JSON.stringify(landing.body), /"destination_url"\s*:/);

    const blockedLanding = await requestJson(`${baseUrl}/offers/free-unpaid-public-test`);
    assert.equal(blockedLanding.status, 404);

    const redirect = await requestRaw(`${baseUrl}/go/${approved.offer_key}?utm_source=test&email=reader@example.com`, { redirect: 'manual' });
    assert.equal(redirect.status, 422);
    assert.equal(redirect.body.status, 'blocked');
    assert.ok(redirect.body.blocker_classes.includes('raw_pii_or_secret_like_payload'));

    const safeRedirect = await requestRaw(`${baseUrl}/go/${approved.offer_key}?utm_source=test`, { redirect: 'manual' });
    assert.equal(safeRedirect.status, 302);
    assert.ok(safeRedirect.headers.get('location'));
    assert.equal(spgStore.state.public_events.some((event) => event.event_type === 'go_click' && event.canonical_slug === approved.offer_key), true);
    assert.equal(spgStore.state.public_events.some((event) => event.raw_ip_stored || event.raw_user_agent_stored || event.raw_pii_present), false);
    assert.equal(auditLog.list({ limit: 20 }).some((event) => event.action === 'spg.go.redirect.resolved' && event.resourceId === approved.offer_key), true);
  } finally {
    await close(server);
  }
});

test('SPG public signup/preferences/events are functional but no-send and PII-safe', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
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

    const acceptedEvent = await requestJson(`${baseUrl}/api/spg/events`, { method: 'POST', body: { event_type: 'go_click', route_path: '/go/amazon-monitor-arms.html?utm_source=test', attribution_ref: 'opaque-click-ref' } });
    assert.equal(acceptedEvent.status, 202);
    assert.equal(acceptedEvent.body.status, 'accepted');
    assert.equal(acceptedEvent.body.canonical_slug, 'amazon-monitor-arms');
    assert.equal(acceptedEvent.body.landing_path, '/offers/amazon-monitor-arms');
    assert.equal(acceptedEvent.body.redirect_path, '/go/amazon-monitor-arms');
    assert.equal(acceptedEvent.body.attribution_contract_version, 'spg-route-attribution-v1');
    assert.equal(acceptedEvent.body.raw_ip_stored, false);
    assert.equal(acceptedEvent.body.raw_user_agent_stored, false);

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

async function requestRaw(url, { method = 'GET', headers = {}, body = null, redirect = 'follow' } = {}) {
  const response = await fetch(url, {
    method,
    redirect,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get('content-type') || '';
  const parsedBody = contentType.includes('application/json') ? await response.json() : await response.text();
  return { status: response.status, headers: response.headers, body: parsedBody };
}
