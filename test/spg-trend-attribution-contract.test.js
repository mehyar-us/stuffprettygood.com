import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SPG_TREND_EVENT_TYPES,
  SPG_SOURCE_CATEGORIES,
  SPG_OFFER_TYPES,
  createTrendAttributionEvent,
  createTopicPreferenceRecord,
  validateGoOfferBridge,
  buildSpgTrendAttributionApiContract,
} from '../src/crm/spgTrendAttribution.js';

test('SPG trend attribution contract exposes required event/source/offer enums', () => {
  for (const eventType of ['trend_page_viewed', 'trend_lane_viewed', 'trend_offer_clicked', 'topic_preference', 'disclosure_seen']) {
    assert.ok(SPG_TREND_EVENT_TYPES.includes(eventType), `${eventType} missing`);
  }
  for (const sourceCategory of ['google_trends', 'trend_lane', 'seo_page', 'signup_hook', 'go_bridge']) {
    assert.ok(SPG_SOURCE_CATEGORIES.includes(sourceCategory), `${sourceCategory} missing`);
  }
  for (const offerType of ['amazon', 'manual', 'direct', 'sponsor']) {
    assert.ok(SPG_OFFER_TYPES.includes(offerType), `${offerType} missing`);
  }
});

test('trend page/lane events normalize source category and never log raw PII', () => {
  const page = createTrendAttributionEvent({
    eventType: 'trend_page_viewed',
    sourceCategory: 'seo_page',
    sourceRoute: '/trends.html?email=raw-email-present',
    referrer: 'https://google.com/search?q=portable+power',
    utm: { utm_source: 'google', utm_campaign: 'trend-hub' },
    visitorSessionId: 'anon-session-1',
  });

  assert.equal(page.status, 'accepted');
  assert.equal(page.sourceRoute, '/trends.html');
  assert.equal(page.referrerHost, 'google.com');
  assert.equal(page.rawPiiPresent, false);
  assert.equal(page.auditEvent.rawPiiPresent, false);

  const lane = createTrendAttributionEvent({
    eventType: 'trend_lane_viewed',
    sourceCategory: 'trend_lane',
    trendLane: 'portable-power-stations',
    trendSeed: 'portable power station',
  });

  assert.equal(lane.status, 'accepted');
  assert.equal(lane.trendLane, 'portable-power-stations');
  assert.equal(lane.copiedMerchantContent, false);
});

test('trend offer clicked requires /go slug, offer type, and disclosure before Amazon/manual/direct/sponsor attribution', () => {
  const clicked = createTrendAttributionEvent({
    eventType: 'trend_offer_clicked',
    sourceCategory: 'go_bridge',
    trendLane: 'air-purifiers',
    offerType: 'amazon',
    goSlug: 'amazon-air-purifiers',
    disclosureSeen: true,
  });

  assert.equal(clicked.status, 'accepted');
  assert.equal(clicked.offerType, 'amazon');
  assert.equal(clicked.affiliateTagLabel, 'mehyarmedia-20');
  assert.equal(clicked.destinationKind, 'amazon_manual_search_or_sitestripe_link');
  assert.equal(clicked.rawPiiPresent, false);

  const blocked = createTrendAttributionEvent({
    eventType: 'trend_offer_clicked',
    sourceCategory: 'go_bridge',
    offerType: 'amazon',
    goSlug: 'air-purifiers',
    disclosureSeen: false,
  });

  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.blockerClasses.includes('missing_disclosure_seen_before_click'));
  assert.ok(blocked.blockerClasses.includes('amazon_manual_go_slug_required'));
});

test('topic preference records accept hashed/profile refs only and block raw PII without storing payload', () => {
  const accepted = createTopicPreferenceRecord({
    identifierHash: 'hash-only',
    topicPreferences: ['AI note takers', 'Portable power stations'],
    sourceCategory: 'signup_hook',
    trendLane: 'ai-note-takers',
    consentState: 'opted_in',
    disclosureSeen: true,
  });

  assert.equal(accepted.status, 'accepted');
  assert.deepEqual(accepted.topicPreferences, ['ai-note-takers', 'portable-power-stations']);
  assert.equal(accepted.rawPiiRendered, false);
  assert.equal(accepted.rawPiiStoredInLog, false);
  assert.equal(accepted.consentBasis, 'explicit_signup_hook_checkbox');

  const blocked = createTopicPreferenceRecord({
    email: 'raw-email-present',
    topicPreference: 'robot vacuums',
  });

  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.blockerClasses.includes('blocked_raw_pii_exposure'));
  assert.equal(blocked.rawPiiStoredInLog, false);
});

test('/go offer bridge validation enforces visible disclosure and Amazon no-scrape/no-copied-content boundaries', () => {
  const ready = validateGoOfferBridge({
    goSlug: 'amazon-walking-pads',
    offerType: 'amazon',
    disclosureVisible: true,
  });

  assert.equal(ready.redirectAllowed, true);
  assert.equal(ready.status, 'ready_for_manual_redirect');
  assert.equal(ready.requiredClickEvent, 'trend_offer_clicked');
  assert.equal(ready.requiredDisclosureEvent, 'disclosure_seen');
  assert.equal(ready.destinationUrlLogged, false);
  assert.equal(ready.rawPiiLogged, false);

  const blocked = validateGoOfferBridge({
    goSlug: 'amazon-walking-pads',
    offerType: 'amazon',
    disclosureVisible: false,
    copiesAmazonPrice: true,
    scrapesAmazon: true,
  });

  assert.equal(blocked.redirectAllowed, false);
  assert.ok(blocked.blockerClasses.includes('missing_visible_disclosure'));
  assert.ok(blocked.blockerClasses.includes('blocked_amazon_copied_content'));
  assert.ok(blocked.blockerClasses.includes('blocked_amazon_paapi_or_scrape'));
});

test('API contract maps public attribution, topic preference, and /go bridge endpoints with no send side effect', () => {
  const contract = buildSpgTrendAttributionApiContract();
  assert.equal(contract.namespace, 'spg_trend_attribution');
  assert.equal(contract.endpoints.length, 3);
  assert.ok(contract.endpoints.some((endpoint) => endpoint.path === '/api/spg/attribution/events'));
  assert.ok(contract.endpoints.some((endpoint) => endpoint.path === '/api/spg/preferences/topic'));
  assert.ok(contract.endpoints.some((endpoint) => endpoint.path === '/go/:slug'));
  assert.ok(contract.invariants.some((item) => /No raw email\/phone\/name\/address/.test(item)));
  assert.ok(contract.invariants.some((item) => /no email\/SMS provider push|no email\/sms provider push/i.test(item)));
});
