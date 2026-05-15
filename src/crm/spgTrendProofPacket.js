const REDACTED = '[redacted]';

export const TREND_PROOF_EVENTS = Object.freeze([
  'trend_page_view',
  'trend_lane_view',
  'signup_started',
  'topic_preference_saved',
  'go_click',
  'disclosure_seen',
]);

export const OFFER_SOURCES = Object.freeze([
  'amazon_manual',
  'direct_merchant',
  'saas_referral',
  'sponsor_slot',
  'mehyarsoft_in_house',
  'public_feed_allowed',
  'template_or_lead_magnet',
]);

export const TREND_PROOF_PACKET_SCHEMA = Object.freeze({
  packetId: 'string',
  brand: 'StuffPrettyGood',
  periodStart: 'timestamp',
  periodEnd: 'timestamp',
  trendUpdatedAt: 'timestamp',
  trendSnapshotId: 'string',
  aggregateOnly: true,
  rawPiiIncluded: false,
  metrics: {
    pageViews: 'integer >= 0',
    laneViews: 'integer >= 0',
    signupStarts: 'integer >= 0',
    topicPreferences: 'integer >= 0',
    goClicks: 'integer >= 0',
    disclosureSeen: 'integer >= 0',
    disclosureSeenRate: '0..1',
    signupStartRate: '0..1',
    goClickRate: '0..1',
  },
  dimensions: {
    laneSlug: 'string|null',
    laneTitle: 'string|null',
    topicCategory: 'string|null',
    offerSource: OFFER_SOURCES,
    surface: ['trend_hub', 'trend_lane', 'go_bridge', 'signup_hook'],
    deviceClass: ['desktop', 'tablet', 'mobile', 'unknown'],
    sourceMedium: 'utm/source bucket, no raw referrer querystrings',
  },
  networkReadiness: {
    status: ['NO-GO', 'WATCH', 'READY_FOR_APPLICATION'],
    score: '0..100',
    contentPagesLive: 'integer >= 0',
    trendLanesLive: 'integer >= 0',
    sevenDayPageViews: 'integer >= 0',
    sevenDayGoClicks: 'integer >= 0',
    sevenDaySignupStarts: 'integer >= 0',
    preferenceCategoriesObserved: 'integer >= 0',
    disclosureSeenRate: '0..1',
    compliancePagesLive: 'boolean',
    amazonManualOnly: 'boolean',
    noCopiedMerchantContent: 'boolean',
    noEmailSmsActivation: 'boolean',
    missingData: 'string[]',
    blockers: 'string[]',
    confidence: '0..1',
  },
});

export const NETWORK_READINESS_WEIGHTS = Object.freeze({
  contentPagesLive: 15,
  trendLanesLive: 10,
  sevenDayPageViews: 20,
  sevenDayGoClicks: 15,
  sevenDaySignupStarts: 15,
  preferenceCategoriesObserved: 10,
  disclosureSeenRate: 10,
  compliancePagesLive: 5,
});

export function buildTrendProofPacket(input = {}) {
  const periodStart = required(input.periodStart || input.period_start, 'periodStart');
  const periodEnd = required(input.periodEnd || input.period_end, 'periodEnd');
  const trendUpdatedAt = required(input.trendUpdatedAt || input.trend_updated_at, 'trendUpdatedAt');
  const events = Array.isArray(input.events) ? input.events : [];
  const lanes = Array.isArray(input.lanes) ? input.lanes : [];
  const offerSources = Array.isArray(input.offerSources || input.offer_sources) ? input.offerSources || input.offer_sources : [];

  const eventCounts = countEvents(events);
  const laneBreakdown = buildLaneBreakdown(events, lanes);
  const topicBreakdown = countBy(events.filter((event) => event.eventType === 'topic_preference_saved'), 'topicCategory');
  const offerSourceBreakdown = countOfferSources(events, offerSources);
  const metrics = buildMetrics(eventCounts);
  const networkReadiness = evaluateNetworkReadiness({
    ...input.networkReadiness,
    contentPagesLive: input.contentPagesLive ?? input.content_pages_live,
    trendLanesLive: input.trendLanesLive ?? input.trend_lanes_live ?? lanes.length,
    sevenDayPageViews: input.sevenDayPageViews ?? input.seven_day_page_views ?? metrics.pageViews,
    sevenDayGoClicks: input.sevenDayGoClicks ?? input.seven_day_go_clicks ?? metrics.goClicks,
    sevenDaySignupStarts: input.sevenDaySignupStarts ?? input.seven_day_signup_starts ?? metrics.signupStarts,
    preferenceCategoriesObserved: input.preferenceCategoriesObserved ?? input.preference_categories_observed ?? Object.keys(topicBreakdown).length,
    disclosureSeenRate: metrics.disclosureSeenRate,
  });

  return {
    packetId: input.packetId || input.packet_id || null,
    brand: 'StuffPrettyGood',
    periodStart,
    periodEnd,
    trendUpdatedAt,
    trendSnapshotId: input.trendSnapshotId || input.trend_snapshot_id || null,
    sourceAgeHours: hoursBetween(trendUpdatedAt, periodEnd),
    aggregateOnly: true,
    rawPiiIncluded: false,
    piiHandling: 'hashed_or_session-level collection upstream; proof packet stores aggregate buckets only',
    metrics,
    laneBreakdown,
    topicPreferenceBreakdown: topicBreakdown,
    offerSourceBreakdown,
    requiredEventContract: TREND_PROOF_EVENTS,
    networkReadiness,
    confidence: networkReadiness.confidence,
    missingData: networkReadiness.missingData,
    falsePositiveRisk: [
      'Bot or duplicate sessions can inflate page/lane views unless analytics deduplication is enabled.',
      'Signup starts are intent signals, not verified subscribers until opt-in/verification completes.',
      '/go clicks prove outbound interest, not conversion or merchant approval.',
      'Google Trends is demand signal only; it is not product quality, availability, or price evidence.',
    ],
    refreshCadence: input.refreshCadence || input.refresh_cadence || 'daily after Google Trends snapshot rebuild; network readiness rolls 7-day and 30-day windows',
    guardrails: [
      'No email/SMS activation from this packet.',
      'No Amazon scraping, PA-API assumptions, copied prices, images, reviews, ratings, or availability.',
      'Amazon manual links must keep disclosure visible and use approved tag label mehyarmedia-20 only where manually reviewed.',
      'No raw PII, secrets, full IPs, or raw user agents in packet outputs.',
    ],
  };
}

export function evaluateNetworkReadiness(input = {}) {
  const values = {
    contentPagesLive: integerOrZero(input.contentPagesLive ?? input.content_pages_live),
    trendLanesLive: integerOrZero(input.trendLanesLive ?? input.trend_lanes_live),
    sevenDayPageViews: integerOrZero(input.sevenDayPageViews ?? input.seven_day_page_views),
    sevenDayGoClicks: integerOrZero(input.sevenDayGoClicks ?? input.seven_day_go_clicks),
    sevenDaySignupStarts: integerOrZero(input.sevenDaySignupStarts ?? input.seven_day_signup_starts),
    preferenceCategoriesObserved: integerOrZero(input.preferenceCategoriesObserved ?? input.preference_categories_observed),
    disclosureSeenRate: clamp01(input.disclosureSeenRate ?? input.disclosure_seen_rate),
    compliancePagesLive: Boolean(input.compliancePagesLive ?? input.compliance_pages_live),
    amazonManualOnly: input.amazonManualOnly ?? input.amazon_manual_only ?? true,
    noCopiedMerchantContent: input.noCopiedMerchantContent ?? input.no_copied_merchant_content ?? true,
    noEmailSmsActivation: input.noEmailSmsActivation ?? input.no_email_sms_activation ?? true,
  };

  const targets = {
    contentPagesLive: 20,
    trendLanesLive: 10,
    sevenDayPageViews: 1000,
    sevenDayGoClicks: 100,
    sevenDaySignupStarts: 50,
    preferenceCategoriesObserved: 5,
    disclosureSeenRate: 0.95,
  };

  const score = round2(
    ratio(values.contentPagesLive, targets.contentPagesLive) * NETWORK_READINESS_WEIGHTS.contentPagesLive +
    ratio(values.trendLanesLive, targets.trendLanesLive) * NETWORK_READINESS_WEIGHTS.trendLanesLive +
    ratio(values.sevenDayPageViews, targets.sevenDayPageViews) * NETWORK_READINESS_WEIGHTS.sevenDayPageViews +
    ratio(values.sevenDayGoClicks, targets.sevenDayGoClicks) * NETWORK_READINESS_WEIGHTS.sevenDayGoClicks +
    ratio(values.sevenDaySignupStarts, targets.sevenDaySignupStarts) * NETWORK_READINESS_WEIGHTS.sevenDaySignupStarts +
    ratio(values.preferenceCategoriesObserved, targets.preferenceCategoriesObserved) * NETWORK_READINESS_WEIGHTS.preferenceCategoriesObserved +
    ratio(values.disclosureSeenRate, targets.disclosureSeenRate) * NETWORK_READINESS_WEIGHTS.disclosureSeenRate +
    (values.compliancePagesLive ? NETWORK_READINESS_WEIGHTS.compliancePagesLive : 0)
  );

  const missingData = [];
  if (values.contentPagesLive === 0) missingData.push('content_pages_live');
  if (values.trendLanesLive === 0) missingData.push('trend_lanes_live');
  if (values.sevenDayPageViews === 0) missingData.push('seven_day_page_views');
  if (values.sevenDayGoClicks === 0) missingData.push('seven_day_go_clicks');
  if (values.sevenDaySignupStarts === 0) missingData.push('seven_day_signup_starts');
  if (values.preferenceCategoriesObserved === 0) missingData.push('preference_categories_observed');

  const blockers = [];
  if (!values.compliancePagesLive) blockers.push('blocked_compliance_pages_missing');
  if (!values.amazonManualOnly) blockers.push('blocked_amazon_paapi_or_scrape');
  if (!values.noCopiedMerchantContent) blockers.push('blocked_copied_merchant_content');
  if (!values.noEmailSmsActivation) blockers.push('blocked_unapproved_email_sms_activation');
  if (values.disclosureSeenRate < 0.95) blockers.push('blocked_low_disclosure_seen_rate');

  const status = blockers.length > 0 ? 'NO-GO' : score >= 75 ? 'READY_FOR_APPLICATION' : 'WATCH';
  const confidence = round2(clamp01((8 - missingData.length - blockers.length) / 8));

  return {
    ...values,
    targets,
    weights: NETWORK_READINESS_WEIGHTS,
    score,
    status,
    missingData,
    blockers,
    confidence,
    sourceAge: input.sourceAge || input.source_age || 'daily trend snapshot; rollup windows must identify max event timestamp',
    privacyHandling: 'aggregate metrics only; raw PII and raw click identifiers excluded',
    refreshCadence: 'daily trend packet, weekly network-readiness review before applications',
  };
}

function countEvents(events) {
  const counts = Object.fromEntries(TREND_PROOF_EVENTS.map((name) => [name, 0]));
  for (const event of events) {
    const type = event.eventType || event.event_type;
    if (type in counts) counts[type] += integerOrZero(event.count ?? 1);
  }
  return counts;
}

function buildMetrics(counts) {
  const pageViews = counts.trend_page_view;
  const laneViews = counts.trend_lane_view;
  const signupStarts = counts.signup_started;
  const topicPreferences = counts.topic_preference_saved;
  const goClicks = counts.go_click;
  const disclosureSeen = counts.disclosure_seen;
  return {
    pageViews,
    laneViews,
    signupStarts,
    topicPreferences,
    goClicks,
    disclosureSeen,
    disclosureSeenRate: pageViews + laneViews + goClicks > 0 ? round4(disclosureSeen / (pageViews + laneViews + goClicks)) : 0,
    signupStartRate: pageViews + laneViews > 0 ? round4(signupStarts / (pageViews + laneViews)) : 0,
    goClickRate: pageViews + laneViews > 0 ? round4(goClicks / (pageViews + laneViews)) : 0,
  };
}

function buildLaneBreakdown(events, lanes) {
  const laneMap = new Map(lanes.map((lane) => [lane.slug, { laneSlug: lane.slug, laneTitle: lane.title || lane.seed || lane.slug, pageViews: 0, laneViews: 0, signupStarts: 0, goClicks: 0, disclosureSeen: 0 }]));
  for (const event of events) {
    const laneSlug = event.laneSlug || event.lane_slug;
    if (!laneSlug) continue;
    if (!laneMap.has(laneSlug)) laneMap.set(laneSlug, { laneSlug, laneTitle: laneSlug, pageViews: 0, laneViews: 0, signupStarts: 0, goClicks: 0, disclosureSeen: 0 });
    const row = laneMap.get(laneSlug);
    const count = integerOrZero(event.count ?? 1);
    if (event.eventType === 'trend_page_view' || event.event_type === 'trend_page_view') row.pageViews += count;
    if (event.eventType === 'trend_lane_view' || event.event_type === 'trend_lane_view') row.laneViews += count;
    if (event.eventType === 'signup_started' || event.event_type === 'signup_started') row.signupStarts += count;
    if (event.eventType === 'go_click' || event.event_type === 'go_click') row.goClicks += count;
    if (event.eventType === 'disclosure_seen' || event.event_type === 'disclosure_seen') row.disclosureSeen += count;
  }
  return [...laneMap.values()].map((row) => ({ ...row, rawPiiIncluded: false }));
}

function countOfferSources(events, configuredSources) {
  const allowed = new Set([...OFFER_SOURCES, ...configuredSources]);
  const counts = {};
  for (const event of events.filter((row) => (row.eventType || row.event_type) === 'go_click')) {
    const source = event.offerSource || event.offer_source || 'unknown';
    const key = allowed.has(source) ? source : 'unknown';
    counts[key] = (counts[key] || 0) + integerOrZero(event.count ?? 1);
  }
  return counts;
}

function countBy(events, key) {
  const counts = {};
  for (const event of events) {
    const value = event[key] || event[toSnake(key)] || 'unknown';
    counts[value] = (counts[value] || 0) + integerOrZero(event.count ?? 1);
  }
  return counts;
}

function required(value, field) {
  if (!value) throw new Error(`${field} is required for aggregate trend proof packet`);
  return value;
}

function toSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function hoursBetween(start, end) {
  const delta = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(delta) ? round2(delta / 36e5) : null;
}

function ratio(value, target) {
  const number = Number(value);
  return target > 0 && Number.isFinite(number) ? Math.min(1, Math.max(0, number) / target) : 0;
}

function integerOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

export function redactTrendProofPayload(payload = {}) {
  const forbidden = /(email|phone|name|password|secret|token|ip|user_agent|address|payment)/i;
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, forbidden.test(key) ? REDACTED : value]));
}
