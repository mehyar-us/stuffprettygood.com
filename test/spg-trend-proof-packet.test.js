import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OFFER_SOURCES,
  TREND_PROOF_EVENTS,
  TREND_PROOF_PACKET_SCHEMA,
  buildTrendProofPacket,
  evaluateNetworkReadiness,
  redactTrendProofPayload,
} from '../src/crm/spgTrendProofPacket.js';

test('trend proof packet schema covers required aggregate metrics and privacy guardrails', () => {
  assert.equal(TREND_PROOF_PACKET_SCHEMA.brand, 'StuffPrettyGood');
  assert.equal(TREND_PROOF_PACKET_SCHEMA.aggregateOnly, true);
  assert.equal(TREND_PROOF_PACKET_SCHEMA.rawPiiIncluded, false);
  for (const eventName of ['trend_page_view', 'trend_lane_view', 'signup_started', 'topic_preference_saved', 'go_click', 'disclosure_seen']) {
    assert.ok(TREND_PROOF_EVENTS.includes(eventName));
  }
  assert.ok(OFFER_SOURCES.includes('amazon_manual'));
  assert.ok(TREND_PROOF_PACKET_SCHEMA.networkReadiness.missingData);
});

test('buildTrendProofPacket rolls up trends, signup starts, preferences, disclosure, and /go clicks without raw PII', () => {
  const packet = buildTrendProofPacket({
    packetId: 'packet-2026-05-15',
    periodStart: '2026-05-15T00:00:00.000Z',
    periodEnd: '2026-05-15T23:59:59.000Z',
    trendUpdatedAt: '2026-05-15T06:00:00.000Z',
    trendSnapshotId: 'google-trends-2026-05-15',
    contentPagesLive: 24,
    compliancePagesLive: true,
    lanes: [
      { slug: 'ai-note-takers', title: 'AI note takers' },
      { slug: 'portable-power-stations', title: 'Portable power stations' },
    ],
    events: [
      { eventType: 'trend_page_view', laneSlug: 'ai-note-takers', count: 800 },
      { eventType: 'trend_lane_view', laneSlug: 'ai-note-takers', count: 500 },
      { eventType: 'signup_started', laneSlug: 'ai-note-takers', count: 42 },
      { eventType: 'topic_preference_saved', laneSlug: 'ai-note-takers', topicCategory: 'ai_tools', count: 31 },
      { eventType: 'go_click', laneSlug: 'ai-note-takers', offerSource: 'saas_referral', count: 64 },
      { eventType: 'go_click', laneSlug: 'portable-power-stations', offerSource: 'amazon_manual', count: 55 },
      { eventType: 'disclosure_seen', laneSlug: 'ai-note-takers', count: 1400 },
    ],
  });

  assert.equal(packet.aggregateOnly, true);
  assert.equal(packet.rawPiiIncluded, false);
  assert.equal(packet.metrics.pageViews, 800);
  assert.equal(packet.metrics.laneViews, 500);
  assert.equal(packet.metrics.signupStarts, 42);
  assert.equal(packet.metrics.topicPreferences, 31);
  assert.equal(packet.metrics.goClicks, 119);
  assert.equal(packet.offerSourceBreakdown.amazon_manual, 55);
  assert.equal(packet.offerSourceBreakdown.saas_referral, 64);
  assert.equal(packet.topicPreferenceBreakdown.ai_tools, 31);
  assert.ok(packet.laneBreakdown.every((lane) => lane.rawPiiIncluded === false));
  assert.match(packet.piiHandling, /aggregate buckets only/i);
  assert.ok(packet.guardrails.some((rule) => /No email\/SMS activation/i.test(rule)));
});

test('network readiness exposes score, weights, confidence, missing data, blockers, and refresh cadence', () => {
  const ready = evaluateNetworkReadiness({
    contentPagesLive: 25,
    trendLanesLive: 11,
    sevenDayPageViews: 1500,
    sevenDayGoClicks: 125,
    sevenDaySignupStarts: 60,
    preferenceCategoriesObserved: 7,
    disclosureSeenRate: 0.98,
    compliancePagesLive: true,
    amazonManualOnly: true,
    noCopiedMerchantContent: true,
    noEmailSmsActivation: true,
  });

  assert.equal(ready.status, 'READY_FOR_APPLICATION');
  assert.equal(ready.score, 100);
  assert.equal(ready.confidence, 1);
  assert.deepEqual(ready.missingData, []);
  assert.deepEqual(ready.blockers, []);
  assert.ok(ready.weights.sevenDayPageViews > 0);
  assert.match(ready.refreshCadence, /daily trend packet/i);

  const blocked = evaluateNetworkReadiness({
    sevenDayPageViews: 10,
    disclosureSeenRate: 0.2,
    compliancePagesLive: false,
    amazonManualOnly: false,
    noCopiedMerchantContent: false,
    noEmailSmsActivation: false,
  });
  assert.equal(blocked.status, 'NO-GO');
  assert.ok(blocked.blockers.includes('blocked_amazon_paapi_or_scrape'));
  assert.ok(blocked.blockers.includes('blocked_unapproved_email_sms_activation'));
  assert.ok(blocked.missingData.includes('seven_day_go_clicks'));
  assert.ok(blocked.confidence < 1);
});

test('redaction helper removes raw PII-like analytics keys before packet logging', () => {
  const redacted = redactTrendProofPayload({
    email: 'person@example.test',
    phone: '+15555555555',
    visitorToken: 'secret-token',
    laneSlug: 'ai-note-takers',
    eventType: 'go_click',
  });
  assert.equal(redacted.email, '[redacted]');
  assert.equal(redacted.phone, '[redacted]');
  assert.equal(redacted.visitorToken, '[redacted]');
  assert.equal(redacted.laneSlug, 'ai-note-takers');
});
