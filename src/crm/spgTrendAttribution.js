const REDACTED = '[redacted]';

export const SPG_TREND_EVENT_TYPES = Object.freeze([
  'trend_page_viewed',
  'trend_lane_viewed',
  'trend_offer_clicked',
  'topic_preference',
  'disclosure_seen',
]);

export const SPG_SOURCE_CATEGORIES = Object.freeze([
  'google_trends',
  'trend_lane',
  'seo_page',
  'signup_hook',
  'go_bridge',
  'manual_source',
  'sponsor_source',
  'direct_navigation',
  'unknown',
]);

export const SPG_OFFER_TYPES = Object.freeze([
  'amazon',
  'manual',
  'direct',
  'sponsor',
  'service',
  'referral',
  'none',
]);

const RAW_PII_KEYS = Object.freeze([
  'email',
  'rawEmail',
  'raw_email',
  'phone',
  'rawPhone',
  'raw_phone',
  'name',
  'fullName',
  'full_name',
  'address',
]);

const UTM_KEYS = Object.freeze(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']);
const AMAZON_ASSOCIATES_TAG_LABEL = 'mehyarmedia-20';

export function createTrendAttributionEvent(input = {}) {
  const eventType = input.eventType || input.event_type || null;
  const rawPiiFields = detectRawPiiFields(input);
  const blockerClasses = [];

  if (!SPG_TREND_EVENT_TYPES.includes(eventType)) blockerClasses.push('invalid_trend_event_type');
  if (rawPiiFields.length > 0) blockerClasses.push('blocked_raw_pii_exposure');

  const sourceCategory = enumOrDefault(input.sourceCategory || input.source_category, SPG_SOURCE_CATEGORIES, 'unknown');
  const offerType = enumOrDefault(input.offerType || input.offer_type, SPG_OFFER_TYPES, 'none');
  const disclosureSeen = Boolean(input.disclosureSeen ?? input.disclosure_seen ?? eventType === 'disclosure_seen');
  const trendLane = slugOrNull(input.trendLane || input.trend_lane || input.laneSlug || input.lane_slug);
  const goSlug = slugOrNull(input.goSlug || input.go_slug || input.offerSlug || input.offer_slug);
  const topic = slugOrNull(input.topic || input.topicPreference || input.topic_preference || trendLane);

  if (eventType === 'trend_lane_viewed' && !trendLane) blockerClasses.push('missing_trend_lane');
  if (eventType === 'trend_offer_clicked') {
    if (!goSlug) blockerClasses.push('missing_go_slug');
    if (offerType === 'none') blockerClasses.push('missing_offer_type');
    if (!disclosureSeen) blockerClasses.push('missing_disclosure_seen_before_click');
  }
  if (eventType === 'topic_preference' && !topic) blockerClasses.push('missing_topic_preference');
  if (offerType === 'amazon' && !String(goSlug || '').startsWith('amazon-')) blockerClasses.push('amazon_manual_go_slug_required');

  const status = blockerClasses.length > 0 ? 'blocked' : 'accepted';

  return {
    eventType,
    status,
    occurredAt: input.occurredAt || input.occurred_at || new Date().toISOString(),
    brand: 'StuffPrettyGood',
    sourceCategory,
    sourceRoute: safePath(input.sourceRoute || input.source_route || input.path),
    referrerHost: safeHost(input.referrer || input.referrer_url),
    utm: sanitizeUtm(input.utm || input.query || {}),
    visitorSessionId: input.visitorSessionId || input.visitor_session_id || null,
    profileHash: input.profileHash || input.profile_hash || input.identifierHash || input.identifier_hash || null,
    trendLane,
    trendSeed: safeText(input.trendSeed || input.trend_seed, 120),
    topicPreference: topic,
    offerType,
    goSlug,
    offerId: input.offerId || input.offer_id || null,
    affiliateTagLabel: offerType === 'amazon' ? AMAZON_ASSOCIATES_TAG_LABEL : null,
    destinationKind: offerType === 'amazon' ? 'amazon_manual_search_or_sitestripe_link' : offerType,
    disclosureSeen,
    signupHook: safeText(input.signupHook || input.signup_hook, 80),
    rawPiiPresent: false,
    rawPiiFieldsBlocked: rawPiiFields,
    blockedPayloadStored: false,
    copiedMerchantContent: false,
    liveSendEnabled: false,
    providerPushEnabled: false,
    blockerClasses: unique(blockerClasses),
    auditEvent: {
      type: 'spg_trend_attribution_event_received',
      decision: status,
      eventType,
      sourceCategory,
      offerType,
      goSlug,
      trendLane,
      rawPiiPresent: false,
      blockerClasses: unique(blockerClasses),
    },
  };
}

export function createTopicPreferenceRecord(input = {}) {
  const rawPiiFields = detectRawPiiFields(input);
  const topics = unique(arrayOf(input.topics || input.topicPreferences || input.topic_preferences || input.topic || input.topicPreference || input.topic_preference).map(slugOrNull));
  const sourceCategory = enumOrDefault(input.sourceCategory || input.source_category, SPG_SOURCE_CATEGORIES, 'signup_hook');
  const consentState = input.consentState || input.consent_state || (input.optedIn || input.opted_in ? 'opted_in' : 'preference_only');
  const blockerClasses = [];

  if (topics.length === 0) blockerClasses.push('missing_topic_preference');
  if (rawPiiFields.length > 0 && !(input.identifierHash || input.identifier_hash || input.profileHash || input.profile_hash)) blockerClasses.push('blocked_raw_pii_exposure');

  return {
    preferenceId: input.preferenceId || input.preference_id || null,
    brand: 'StuffPrettyGood',
    profileHash: input.profileHash || input.profile_hash || input.identifierHash || input.identifier_hash || null,
    visitorSessionId: input.visitorSessionId || input.visitor_session_id || null,
    sourceCategory,
    sourceRoute: safePath(input.sourceRoute || input.source_route || input.path),
    trendLane: slugOrNull(input.trendLane || input.trend_lane),
    topicPreferences: topics,
    frequency: safeText(input.frequency, 40) || 'unknown',
    consentState,
    consentBasis: consentState === 'opted_in' ? 'explicit_signup_hook_checkbox' : 'onsite_preference_capture',
    disclosureSeen: Boolean(input.disclosureSeen ?? input.disclosure_seen),
    suppressionState: input.suppressionState || input.suppression_state || 'clear',
    rawPiiRendered: false,
    rawPiiStoredInLog: false,
    rawPiiFieldsBlocked: rawPiiFields,
    status: blockerClasses.length > 0 ? 'blocked' : 'accepted',
    blockerClasses: unique(blockerClasses),
    auditEvent: {
      type: 'spg_topic_preference_recorded',
      decision: blockerClasses.length > 0 ? 'blocked' : 'accepted',
      topicCount: topics.length,
      sourceCategory,
      rawPiiPresent: false,
    },
  };
}

export function validateGoOfferBridge(input = {}) {
  const offerType = enumOrDefault(input.offerType || input.offer_type, SPG_OFFER_TYPES, 'none');
  const goSlug = slugOrNull(input.goSlug || input.go_slug || input.slug);
  const blockerClasses = [];

  if (!goSlug) blockerClasses.push('missing_go_slug');
  if (!SPG_OFFER_TYPES.includes(offerType) || offerType === 'none') blockerClasses.push('missing_offer_type');
  if (!input.disclosureVisible && !input.disclosure_visible) blockerClasses.push('missing_visible_disclosure');
  if (input.copiesAmazonPrice || input.copies_amazon_price || input.copiesAmazonImages || input.copies_amazon_images || input.copiesAmazonReviews || input.copies_amazon_reviews || input.copiesAmazonRatings || input.copies_amazon_ratings || input.copiesAmazonAvailability || input.copies_amazon_availability) blockerClasses.push('blocked_amazon_copied_content');
  if (input.scrapesAmazon || input.scrapes_amazon) blockerClasses.push('blocked_amazon_paapi_or_scrape');
  if (offerType === 'amazon' && !String(goSlug || '').startsWith('amazon-')) blockerClasses.push('amazon_manual_go_slug_required');

  return {
    goSlug,
    offerType,
    redirectAllowed: blockerClasses.length === 0,
    status: blockerClasses.length === 0 ? 'ready_for_manual_redirect' : 'blocked',
    affiliateTagLabel: offerType === 'amazon' ? AMAZON_ASSOCIATES_TAG_LABEL : null,
    requiredClickEvent: 'trend_offer_clicked',
    requiredDisclosureEvent: 'disclosure_seen',
    destinationUrlLogged: false,
    rawPiiLogged: false,
    blockerClasses: unique(blockerClasses),
  };
}

export function buildSpgTrendAttributionApiContract() {
  return {
    namespace: 'spg_trend_attribution',
    version: '2026-05-15',
    endpoints: [
      {
        method: 'POST',
        path: '/api/spg/attribution/events',
        auth: 'public_write_rate_limited_no_admin_session_required',
        body: ['eventType', 'sourceCategory', 'sourceRoute', 'trendLane', 'offerType', 'goSlug', 'topicPreference', 'disclosureSeen', 'utm', 'visitorSessionId', 'profileHash'],
        acceptedEventTypes: SPG_TREND_EVENT_TYPES,
        response: { status: 'accepted|blocked', eventId: 'server_generated', rawPiiPresent: false, blockerClasses: [] },
      },
      {
        method: 'POST',
        path: '/api/spg/preferences/topic',
        auth: 'public_write_rate_limited_no_send_side_effect',
        body: ['topicPreferences', 'sourceCategory', 'trendLane', 'frequency', 'consentState', 'disclosureSeen', 'identifierHash'],
        response: { status: 'accepted|blocked', preferenceId: 'server_generated', liveSendEnabled: false, rawPiiRendered: false },
      },
      {
        method: 'GET',
        path: '/go/:slug',
        auth: 'public_read_tracked_redirect',
        behavior: 'write trend_offer_clicked after disclosure_seen check then redirect only for approved manual/direct/sponsor offers',
        response: { redirectAllowed: true, destinationUrlLogged: false, rawPiiLogged: false },
      },
    ],
    invariants: [
      'No raw email/phone/name/address is accepted into attribution logs.',
      'Amazon offer type is manual/SiteStripe/search-link only with visible disclosure and tag label mehyarmedia-20.',
      'No Amazon prices, images, reviews, ratings, availability, PA-API scrape, or copied merchant content fields are part of this contract.',
      'Preference capture has no email/SMS provider push or live-send side effect.',
    ],
  };
}

function detectRawPiiFields(input) {
  return RAW_PII_KEYS.filter((key) => input[key] != null && String(input[key]).trim() !== '');
}

function sanitizeUtm(input) {
  const output = {};
  for (const key of UTM_KEYS) {
    const value = input[key];
    if (value == null) continue;
    const text = safeText(value, 120);
    if (/[@]|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/i.test(text)) continue;
    output[key] = text;
  }
  return output;
}

function safePath(value) {
  if (!value) return null;
  try {
    const parsed = String(value).startsWith('http') ? new URL(value) : null;
    return parsed ? parsed.pathname : String(value).split('?')[0].slice(0, 160);
  } catch {
    return String(value).split('?')[0].slice(0, 160);
  }
}

function safeHost(value) {
  if (!value) return null;
  try {
    return new URL(value).hostname.slice(0, 120);
  } catch {
    return null;
  }
}

function safeText(value, max = 120) {
  if (value == null) return null;
  return String(value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) || null;
}

function slugOrNull(value) {
  const text = safeText(value, 100);
  if (!text) return null;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || null;
}

function enumOrDefault(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function arrayOf(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value) return [value];
  return [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
