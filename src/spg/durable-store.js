import crypto from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { approvedOffers, claimSafeCopy } from './public-surfaces.js';
import { trendOfferLanes } from './trending-offers.js';
import { getLaneTargets } from './trend-components.js';

const DEFAULT_STORE_PATH = 'data/spg-durable-store.json';
const SECRET_OR_PII = /(?:password|passwd|api[_-]?key|secret|token|bearer|authorization|email=|phone=|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i;
const AMAZON_COPY_CLAIMS = /(?:amazon.*(?:price|rating|review|stars|availability|prime|free shipping)|\$\d[\d,.]*|\d+%\s*off|copied amazon|customer reviews?|in stock|out of stock)/i;
const SAFE_TOPICS = new Set(['ai-tools', 'home', 'travel', 'wellness', 'pets', 'smart-home', 'software', 'deals', 'templates', 'unsubscribe-all']);

export class SpgDurableStore {
  constructor({ path = DEFAULT_STORE_PATH, auditLog = null, now = () => new Date() } = {}) {
    this.path = resolve(process.cwd(), path);
    this.auditLog = auditLog;
    this.now = now;
    this.state = existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) : seedState(now());
  }

  listSources(filters = {}) {
    return filterRecords(this.state.sources, filters, ['source_type', 'enabled', 'approval_status', 'risk_tier', 'category_hint']);
  }

  createSource(input, { actorId = 'system' } = {}) {
    const source = validateSource({ ...input, source_key: input.source_key || slugify(input.name) }, this.now());
    if (this.state.sources.some((item) => item.source_key === source.source_key)) throw statusError(409, 'source_key already exists');
    this.state.sources.push(source);
    this.recordAudit(actorId, 'spg.source.created', 'spg_source', source.source_key, { approval_status: source.approval_status, enabled: source.enabled });
    this.persist();
    return source;
  }

  updateSource(sourceKey, input, { actorId = 'system' } = {}) {
    const index = this.state.sources.findIndex((item) => item.source_key === sourceKey || item.id === sourceKey);
    if (index < 0) throw statusError(404, 'source not found');
    const source = validateSource({ ...this.state.sources[index], ...input, updated_at: this.now().toISOString() }, this.now());
    this.state.sources[index] = source;
    this.recordAudit(actorId, 'spg.source.updated', 'spg_source', source.source_key, { approval_status: source.approval_status, enabled: source.enabled });
    this.persist();
    return source;
  }

  runIngestion({ source_keys = null, dry_run = false, max_items_per_source = 20 } = {}, { actorId = 'scheduled-job' } = {}) {
    const startedAt = this.now().toISOString();
    const sourceSet = Array.isArray(source_keys) && source_keys.length ? new Set(source_keys) : null;
    const approvedSources = this.state.sources.filter((source) => source.enabled && source.approval_status === 'approved' && source.risk_tier !== 'blocked' && (!sourceSet || sourceSet.has(source.source_key)));
    const items = this.readJsonIfExists('data/spg-rss-candidates.json')?.candidates || [];
    const sourceItems = [];
    const candidates = [];
    const quarantined = [];
    const countsBySource = new Map();

    for (const raw of items) {
      const source = approvedSources.find((item) => item.source_key === raw.source_id || item.name === raw.source_name);
      if (!source) continue;
      const seenCount = countsBySource.get(source.source_key) || 0;
      if (seenCount >= max_items_per_source) continue;
      countsBySource.set(source.source_key, seenCount + 1);
      const normalized = normalizeSourceItem(raw, source, this.now());
      const existing = this.state.source_items.find((item) => item.dedupe_hash === normalized.dedupe_hash);
      if (existing) {
        existing.last_seen_at = startedAt;
        existing.ingest_status = 'deduped';
        sourceItems.push(existing);
        continue;
      }
      if (normalized.risk_flags.some((flag) => flag.startsWith('blocked'))) {
        normalized.ingest_status = 'quarantined';
        normalized.review_status = 'needs_review';
        normalized.quarantine_reason = normalized.risk_flags.join(', ');
        quarantined.push(normalized);
      } else {
        normalized.ingest_status = 'candidate_created';
        normalized.review_status = 'approved_for_candidate';
        sourceItems.push(normalized);
        candidates.push(candidateFromSourceItem(normalized, this.now()));
      }
    }

    const metric = {
      id: id('ing'),
      started_at: startedAt,
      completed_at: this.now().toISOString(),
      source_count: approvedSources.length,
      source_item_count: sourceItems.length,
      candidate_count: candidates.length,
      quarantined_count: quarantined.length,
      dry_run: Boolean(dry_run),
      blocked_side_effects: ['email', 'sms', 'provider_push', 'public_publish_without_approval'],
    };

    if (!dry_run) {
      this.state.source_items.push(...sourceItems.filter((item) => !this.state.source_items.some((existing) => existing.dedupe_hash === item.dedupe_hash)));
      this.state.source_items.push(...quarantined.filter((item) => !this.state.source_items.some((existing) => existing.dedupe_hash === item.dedupe_hash)));
      this.state.offer_candidates.push(...candidates.filter((item) => !this.state.offer_candidates.some((existing) => existing.candidate_key === item.candidate_key)));
      this.state.ingestion_runs.push(metric);
      for (const source of approvedSources) source.last_fetched_at = metric.completed_at;
      this.recordAudit(actorId, 'spg.ingest.completed', 'spg_ingestion_run', metric.id, { source_item_count: metric.source_item_count, candidate_count: metric.candidate_count, dry_run: metric.dry_run });
      this.persist();
    }
    return { ...metric, source_items: sourceItems, offer_candidates: candidates, quarantined };
  }

  listSourceItems(filters = {}) {
    return filterRecords(this.state.source_items, filters, ['source_id', 'ingest_status', 'review_status', 'risk_tier', 'category_key']);
  }

  reviewSourceItem(idOrKey, input, { actorId = 'system' } = {}) {
    const item = this.state.source_items.find((entry) => entry.id === idOrKey || entry.source_item_key === idOrKey);
    if (!item) throw statusError(404, 'source item not found');
    const allowed = new Set(['unreviewed', 'needs_review', 'approved_for_candidate', 'rejected']);
    if (input.review_status && !allowed.has(input.review_status)) throw statusError(422, 'invalid review_status');
    Object.assign(item, {
      review_status: input.review_status || item.review_status,
      risk_tier: input.risk_tier || item.risk_tier,
      quarantine_reason: input.quarantine_reason || item.quarantine_reason || null,
      reviewed_by: actorId,
      reviewed_at: this.now().toISOString(),
    });
    this.recordAudit(actorId, 'spg.source_item.reviewed', 'spg_source_item', item.id, { review_status: item.review_status, risk_tier: item.risk_tier });
    this.persist();
    return item;
  }

  listOfferCandidates(filters = {}) {
    return filterRecords(this.state.offer_candidates, filters, ['candidate_type', 'approval_status', 'risk_tier', 'category_id', 'trend_lane']);
  }

  promoteOfferCandidate(idOrKey, { actorId = 'system' } = {}) {
    const candidate = this.state.offer_candidates.find((entry) => entry.id === idOrKey || entry.candidate_key === idOrKey);
    if (!candidate) throw statusError(404, 'offer candidate not found');
    if (candidate.approval_status !== 'approved') throw statusError(422, 'candidate approval_status must be approved before promotion');
    if (!candidate.required_disclosure || candidate.risk_tier === 'blocked') throw statusError(422, 'candidate missing required disclosure or risk-approved state');
    const offer = offerFromCandidate(candidate, this.now());
    this.state.offers.push(offer);
    this.recordAudit(actorId, 'spg.offer_candidate.promoted', 'spg_offer_candidate', candidate.candidate_key, { offer_key: offer.offer_key });
    this.persist();
    return { offer_id: offer.id, offer_key: offer.offer_key, go_link_id: null, publish_state: offer.publish_state };
  }

  listOffers(filters = {}, { publicOnly = false } = {}) {
    const visible = publicOnly ? this.state.offers.filter(isPublicOffer) : this.state.offers;
    return filterRecords(visible.map(publicOfferContract), filters, ['approval_status', 'publish_state', 'category_id', 'risk_tier', 'monetization_status', 'payout_model', 'account_status']);
  }

  listOfferWall(filters = {}, { publicOnly = false } = {}) {
    const { surface = 'home', limit = 48, ...recordFilters } = filters;
    const limitValue = Math.max(1, Math.min(Number.parseInt(limit, 10) || 48, 96));
    const publicOffers = new Map(this.listOffers(recordFilters, { publicOnly }).map((offer) => [offer.offer_key, offer]));
    const placements = this.listPagePlacements({ surface }, { publicOnly })
      .filter((placement) => placement.entity_type === 'offer' && publicOffers.has(placement.entity_key))
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    return placements.slice(0, limitValue).map((placement) => ({ ...publicOffers.get(placement.entity_key), placement: publicPlacementContract(placement) }));
  }

  createOffer(input, { actorId = 'system' } = {}) {
    const offer = validateOffer({ ...input, offer_key: input.offer_key || slugify(input.offer_title || input.vendor_name) }, this.now());
    if (this.state.offers.some((item) => item.offer_key === offer.offer_key)) throw statusError(409, 'offer_key already exists');
    this.state.offers.push(offer);
    this.recordAudit(actorId, 'spg.offer.created', 'spg_offer', offer.offer_key, { approval_status: offer.approval_status, publish_state: offer.publish_state });
    this.persist();
    return offer;
  }

  updateOffer(offerKey, input, { actorId = 'system' } = {}) {
    const index = this.state.offers.findIndex((item) => item.offer_key === offerKey || item.id === offerKey);
    if (index < 0) throw statusError(404, 'offer not found');
    const offer = validateOffer({ ...this.state.offers[index], ...input, updated_at: this.now().toISOString() }, this.now());
    this.state.offers[index] = offer;
    this.recordAudit(actorId, 'spg.offer.updated', 'spg_offer', offer.offer_key, { approval_status: offer.approval_status, publish_state: offer.publish_state });
    this.persist();
    return offer;
  }

  listPagePlacements(filters = {}, { publicOnly = false } = {}) {
    const placements = publicOnly ? this.state.page_placements.filter((p) => p.approval_status === 'approved' && p.publish_state === 'published') : this.state.page_placements;
    return filterRecords(placements, filters, ['surface', 'approval_status', 'publish_state', 'category_id']);
  }

  recordPublicEvent(input, { actorId = 'public' } = {}) {
    const payload = JSON.stringify(input || {});
    const blockers = [];
    if (SECRET_OR_PII.test(payload)) blockers.push('raw_pii_or_secret_like_payload');
    const eventType = input.event_type || input.eventType;
    const accepted = new Set(['page_view', 'offer_impression', 'disclosure_seen', 'go_click', 'signup_started', 'preference_saved', 'unsubscribe_requested']);
    if (!accepted.has(eventType)) blockers.push('unsupported_event_type');
    const event = {
      id: id('evt'),
      event_type: eventType || 'unknown',
      brand: 'stuffprettygood',
      event_date: this.now().toISOString().slice(0, 10),
      event_at: this.now().toISOString(),
      route_path: stripQuery(input.route_path || input.path || '/'),
      raw_pii_present: blockers.includes('raw_pii_or_secret_like_payload'),
      blocked_payload_stored: false,
      blocker_classes: blockers,
    };
    if (!blockers.length) {
      this.state.public_events.push(event);
      this.recordAudit(actorId, 'spg.public_event.accepted', 'spg_public_event', event.id, { event_type: event.event_type });
      this.persist();
    }
    return { status: blockers.length ? 'blocked' : 'accepted', raw_pii_present: event.raw_pii_present, blocked_payload_stored: false, blocker_classes: blockers };
  }

  recordSignup(input, { actorId = 'public-signup' } = {}) {
    const payload = JSON.stringify(input || {});
    const blockers = [];
    if (SECRET_OR_PII.test(payload.replace(/"email"\s*:\s*"[^"]+"/i, '"email":"[hashed]"'))) blockers.push('secret_like_payload');
    const consentCopyVersion = String(input.consent_copy_version || input.consentCopyVersion || '').trim();
    if (!consentCopyVersion) blockers.push('consent_copy_version_required');
    const emailHash = input.email ? hash(String(input.email).trim().toLowerCase()) : null;
    const topicList = normalizeTopics(input.topics || []);
    const record = {
      id: id('sgn'),
      profile_ref_hash: emailHash ? `sha256:${emailHash}` : null,
      topics: topicList,
      consent_state: input.consent_state || 'explicit_web_interest_only',
      consent_copy_version: consentCopyVersion || null,
      live_send_enabled: false,
      provider_push_enabled: false,
      created_at: this.now().toISOString(),
    };
    if (!blockers.length) {
      this.state.signup_intents.push(record);
      this.recordAudit(actorId, 'spg.signup.no_send_recorded', 'spg_signup_intent', record.id, { topic_count: record.topics.length, live_send_enabled: false, provider_push_enabled: false });
      this.persist();
    }
    return { status: blockers.length ? 'blocked' : 'accepted', live_send_enabled: false, provider_push_enabled: false, raw_pii_stored: false, profile_ref_hash: record.profile_ref_hash, blocker_classes: blockers };
  }

  recordPreferences(input, { actorId = 'public-preferences' } = {}) {
    const topics = normalizeTopics(input.topics || []);
    const blockers = topics.length ? [] : ['topic_allowlist_required'];
    if ((input.topics || []).some((topic) => !SAFE_TOPICS.has(String(topic)))) blockers.push('unknown_topic');
    const event = {
      id: id('pref'),
      topics,
      consent_state: input.consent_state || 'web_preference_only',
      live_send_enabled: false,
      provider_push_enabled: false,
      created_at: this.now().toISOString(),
    };
    if (!blockers.length) {
      this.state.preference_events.push(event);
      this.recordAudit(actorId, 'spg.preferences.no_send_saved', 'spg_preference', event.id, { topic_count: topics.length });
      this.persist();
    }
    return { status: blockers.length ? 'blocked' : 'accepted', live_send_enabled: false, provider_push_enabled: false, topics, blocker_classes: blockers };
  }

  recordUnsubscribe(input, { actorId = 'public-unsubscribe' } = {}) {
    const record = { id: id('unsub'), scope: input.scope || 'brand_and_global', never_resubscribe: true, live_send_enabled: false, provider_push_enabled: false, created_at: this.now().toISOString() };
    this.state.unsubscribe_events.push(record);
    this.recordAudit(actorId, 'spg.unsubscribe.recorded', 'spg_unsubscribe', record.id, { scope: record.scope, never_resubscribe: true });
    this.persist();
    return { status: 'accepted', never_resubscribe: true, live_send_enabled: false, provider_push_enabled: false };
  }

  networkReadiness() {
    const inputs = {
      content_pages_live: this.state.articles.filter((item) => item.publish_state === 'published').length,
      approved_offers_live: this.state.offers.filter(isPublicOffer).length,
      active_go_links: this.state.go_links.filter((item) => item.approval_status === 'approved' && item.redirect_status === 'active').length,
      approved_sources: this.state.sources.filter((item) => item.enabled && item.approval_status === 'approved').length,
      public_events_7d: this.state.public_events.length,
      signup_starts_7d: this.state.signup_intents.length,
      preference_categories_7d: new Set(this.state.preference_events.flatMap((item) => item.topics)).size,
      compliance_pages_live: true,
    };
    const weights = { content_pages_live_target_20: 10, approved_offers_live_target_50: 15, active_go_links_target_25: 10, approved_sources_target_10: 10, public_events_7d_target_1000: 10, signup_starts_7d_target_50: 10, preference_categories_7d_target_5: 5, compliance_pages_live_true: 5 };
    const score = Math.round(
      Math.min(inputs.content_pages_live / 20, 1) * 10 +
      Math.min(inputs.approved_offers_live / 50, 1) * 15 +
      Math.min(inputs.active_go_links / 25, 1) * 10 +
      Math.min(inputs.approved_sources / 10, 1) * 10 +
      Math.min(inputs.public_events_7d / 1000, 1) * 10 +
      Math.min(inputs.signup_starts_7d / 50, 1) * 10 +
      Math.min(inputs.preference_categories_7d / 5, 1) * 5 +
      (inputs.compliance_pages_live ? 5 : 0)
    );
    const hard_blockers = [];
    if (inputs.approved_offers_live < 10) hard_blockers.push('approved_offer_inventory_below_network_application_threshold');
    if (inputs.active_go_links < 5) hard_blockers.push('active_go_links_below_threshold');
    return {
      inputs,
      weights,
      score,
      confidence: hard_blockers.length ? 0.2 : 0.65,
      missing_data: ['merchant conversion confirmation', 'bot-filtered analytics', 'affiliate network EPC/approval data'],
      source_age: latestAge(this.state.ingestion_runs),
      privacy_pii_handling: 'No raw PII in public payloads; identifiers are hashed or rejected before storage; no exports/provider push.',
      false_positive_risks: ['bot traffic inflating page views or clicks', 'RSS/trend interest not matching purchase intent', 'manual affiliate link drift after review', 'image/license terms changing after approval'],
      refresh_cadence: 'daily ingestion and event rollup; weekly network-application review',
      hard_blockers,
      readiness_status: hard_blockers.length ? 'NO_GO' : score >= 70 ? 'READY_FOR_APPLICATION' : 'WATCH',
    };
  }

  readJsonIfExists(relativePath) {
    const full = resolve(process.cwd(), relativePath);
    return existsSync(full) ? JSON.parse(readFileSync(full, 'utf8')) : null;
  }

  recordAudit(actorId, action, resourceType, resourceId, metadata = {}) {
    this.auditLog?.record({ actorId, action, resourceType, resourceId, metadata });
  }

  persist() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.state, null, 2) + '\n');
  }
}

function seedState(now) {
  const nowIso = now.toISOString();
  const sources = [
    { source_key: 'google-trends-public', name: 'Google Trends daily public signals', source_type: 'google_trends', homepage_url: 'https://trends.google.com/', feed_url: null, terms_url: 'https://policies.google.com/terms', robots_or_terms_notes: 'Public trend metadata only; no scraping private/user data.', allowed_use: 'metadata_only', license_name: 'public trend metadata', category_hint: 'trends', risk_tier: 'low', enabled: true, approval_status: 'approved' },
    { source_key: 'spg-rss-registry', name: 'StuffPrettyGood reviewed RSS registry', source_type: 'rss', homepage_url: 'https://stuffprettygood.com/daily.html', feed_url: null, terms_url: 'https://stuffprettygood.com/terms.html', robots_or_terms_notes: 'Only reviewed source metadata/short excerpts according to registry allowed_use.', allowed_use: 'metadata_only', license_name: 'source terms vary; original SPG summaries only', category_hint: 'daily', risk_tier: 'low', enabled: true, approval_status: 'approved' },
    { source_key: 'amazon-manual-links', name: 'Amazon Associates manual link lane', source_type: 'manual_amazon', homepage_url: 'https://www.amazon.com/', feed_url: null, terms_url: 'https://affiliate-program.amazon.com/help/operating/policies', robots_or_terms_notes: 'Manual deep/search links only; no scraping, copied images, prices, ratings, reviews, or availability.', allowed_use: 'metadata_only', license_name: 'manual link only', category_hint: 'manual_amazon', risk_tier: 'medium', enabled: true, approval_status: 'approved' },
  ].map((source) => ({ id: id('src'), source_quality_score: 70, reviewed_by: 'complyops-gate', last_reviewed_at: nowIso, created_at: nowIso, updated_at: nowIso, ...source }));
  const accountTargetOffers = approvedOffers.map((offer, index) => validateOffer({
    offer_key: offer.slug,
    vendor_name: offer.name,
    offer_title: offer.name,
    offer_description: `Original StuffPrettyGood account target placeholder for ${offer.name}; not public until monetization/tracking approval.`,
    category_id: offer.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    program_type: offer.slug.startsWith('amazon-') ? 'amazon_associates_manual' : 'direct_referral',
    monetization_status: 'pending',
    payout_model: 'none',
    account_status: 'pending',
    tracking_status: 'pending',
    required_disclosure: offer.disclosure || claimSafeCopy.affiliateDisclosure,
    approval_status: 'paused',
    publish_state: 'draft',
    risk_tier: offer.riskTier,
    owner: 'leadfs',
    destination_url: `/go/${offer.slug}.html`,
    image: placeholderImage(offer.category, index),
    seo: { title: `${offer.name} — StuffPrettyGood`, description: `Practical ${offer.category} pick from StuffPrettyGood with visible affiliate disclosure.` },
  }, now));
  const monetizedAmazonOffers = trendOfferLanes.flatMap((lane, laneIndex) => getLaneTargets(lane)
    .filter((target) => target.type === 'amazon_search')
    .map((target, targetIndex) => validateOffer({
      offer_key: target.slug,
      vendor_name: 'Amazon Associates',
      offer_title: target.label,
      offer_description: target.note || `Original StuffPrettyGood note for ${target.query || lane.seed}. Compare current merchant details before buying.`,
      category_id: lane.slug,
      program_type: 'amazon_associates_manual',
      monetization_status: 'approved_monetized',
      payout_model: 'affiliate_cpa',
      account_status: 'active',
      tracking_status: 'active',
      required_disclosure: claimSafeCopy.affiliateDisclosure,
      approval_status: 'approved',
      publish_state: 'published',
      risk_tier: lane.risk === 'high' ? 'medium' : lane.risk,
      owner: 'leadfs',
      destination_url: `/go/${target.slug}.html`,
      image: placeholderImage(lane.seed, laneIndex + targetIndex),
      cta: 'Check current options',
      seo: { title: `${target.label} — StuffPrettyGood`, description: `Disclosure-visible Amazon Associates bridge for ${target.label}.` },
    }, now)));
  const offers = [...monetizedAmazonOffers, ...accountTargetOffers];
  return {
    schema_version: 1,
    sources,
    source_items: [],
    offer_candidates: [],
    offers,
    articles: trendOfferLanes.slice(0, 8).map((lane, index) => ({ id: id('art'), article_key: lane.slug, title: lane.title, summary: lane.offer, category_id: lane.slug, approval_status: 'approved', publish_state: 'published', seo: { title: `${lane.title} — StuffPrettyGood`, description: lane.offer }, display_order: index + 1 })),
    go_links: offers.filter(isPublicOffer).map((offer) => ({ id: id('go'), go_slug: offer.offer_key, destination_url: offer.destination_url, destination_domain: 'stuffprettygood.com', link_type: offer.program_type === 'amazon_associates_manual' ? 'amazon_manual' : 'resource', approval_status: 'approved', redirect_status: 'active', disclosure_required: true, health_status: 'unknown' })),
    page_placements: offers.filter(isPublicOffer).map((offer, index) => ({ id: id('plc'), surface: 'home', entity_type: 'offer', entity_key: offer.offer_key, approval_status: 'approved', publish_state: 'published', display_order: index + 1 })),
    public_events: [],
    signup_intents: [],
    preference_events: [],
    unsubscribe_events: [],
    ingestion_runs: [],
  };
}

function validateSource(input, now) {
  const source = {
    id: input.id || id('src'),
    source_key: slugify(input.source_key),
    name: String(input.name || '').trim(),
    source_type: input.source_type || 'other',
    homepage_url: input.homepage_url || null,
    feed_url: input.feed_url || null,
    api_endpoint_label: input.api_endpoint_label || null,
    terms_url: input.terms_url || null,
    robots_or_terms_notes: input.robots_or_terms_notes || null,
    allowed_use: input.allowed_use || 'metadata_only',
    license_name: input.license_name || null,
    category_hint: input.category_hint || null,
    risk_tier: input.risk_tier || 'medium',
    source_quality_score: input.source_quality_score ?? 50,
    enabled: Boolean(input.enabled),
    approval_status: input.approval_status || 'pending',
    approval_notes: input.approval_notes || null,
    reviewed_by: input.reviewed_by || null,
    last_reviewed_at: input.last_reviewed_at || null,
    last_fetched_at: input.last_fetched_at || null,
    created_at: input.created_at || now.toISOString(),
    updated_at: input.updated_at || now.toISOString(),
  };
  if (!source.source_key || !source.name) throw statusError(422, 'source_key and name are required');
  if (source.source_type === 'manual_amazon' && source.feed_url) throw statusError(422, 'manual_amazon source cannot have feed_url');
  if (source.approval_status === 'approved' && (!source.terms_url || source.allowed_use === 'blocked' || source.risk_tier === 'blocked')) throw statusError(422, 'approved source requires terms_url and non-blocked allowed_use/risk_tier');
  if (source.enabled && (source.allowed_use === 'blocked' || source.approval_status !== 'approved')) throw statusError(422, 'enabled source must be approved and non-blocked');
  return source;
}

function validateOffer(input, now) {
  const payload = JSON.stringify(input || {});
  if (SECRET_OR_PII.test(payload)) throw statusError(422, 'offer payload contains secret or raw PII-like value');
  if (AMAZON_COPY_CLAIMS.test(`${input.offer_title || ''} ${input.offer_description || ''} ${input.price || ''} ${input.rating || ''} ${input.review || ''} ${input.availability || ''}`)) throw statusError(422, 'copied price/rating/review/availability claims are not allowed');
  const offer = {
    id: input.id || id('off'),
    offer_key: slugify(input.offer_key),
    vendor_name: String(input.vendor_name || '').trim(),
    offer_title: String(input.offer_title || '').trim(),
    offer_description: String(input.offer_description || '').trim(),
    summary: input.summary || input.offer_description || '',
    category_id: input.category_id || 'general',
    program_type: input.program_type || 'unknown',
    monetization_status: input.monetization_status || 'pending',
    payout_model: input.payout_model || 'none',
    account_status: input.account_status || 'pending',
    tracking_status: input.tracking_status || 'pending',
    required_disclosure: input.required_disclosure || claimSafeCopy.affiliateDisclosure,
    approval_status: input.approval_status || 'paused',
    publish_state: input.publish_state || 'draft',
    risk_tier: input.risk_tier || 'medium',
    owner: input.owner || 'leadfs',
    destination_url: input.destination_url || null,
    allowed_surfaces: input.allowed_surfaces || ['home', 'category'],
    price_claim_allowed: false,
    availability_claim_allowed: false,
    rating_review_claim_allowed: false,
    image: input.image || placeholderImage(input.category_id || 'general', 0),
    seo: input.seo || { title: input.offer_title || input.vendor_name, description: input.offer_description || '' },
    cta: input.cta || 'See details',
    last_reviewed_at: input.last_reviewed_at || now.toISOString(),
    created_at: input.created_at || now.toISOString(),
    updated_at: input.updated_at || now.toISOString(),
  };
  if (!offer.offer_key || !offer.vendor_name || !offer.offer_title || !offer.required_disclosure) throw statusError(422, 'offer_key, vendor_name, offer_title, and disclosure are required');
  if (offer.approval_status === 'approved' && offer.publish_state === 'published' && !offer.destination_url) throw statusError(422, 'published approved offer requires destination_url');
  if (offer.approval_status === 'approved' && ['published', 'scheduled'].includes(offer.publish_state)) {
    const monetized = offer.monetization_status === 'approved_monetized' && offer.payout_model !== 'none' && offer.account_status === 'active' && offer.tracking_status === 'active';
    const leadMagnet = offer.monetization_status === 'approved_lead_magnet' && offer.payout_model === 'lead_magnet';
    if (!monetized && !leadMagnet) throw statusError(422, 'public offer requires approved monetization or approved lead magnet status');
  }
  return offer;
}

function normalizeSourceItem(raw, source, now) {
  const canonicalUrl = stripQuery(raw.url || source.homepage_url || 'https://stuffprettygood.com/');
  const title = sanitizeTitle(raw.safe_title || raw.title || 'Untitled source signal');
  const riskFlags = [...(raw.risk_flags || [])];
  if (SECRET_OR_PII.test(JSON.stringify(raw))) riskFlags.push('blocked_secret_or_pii_like_payload');
  if (AMAZON_COPY_CLAIMS.test(title)) riskFlags.push('commerce_claim_rewrite_required');
  const lane = raw.matched_lanes?.[0] || null;
  return {
    id: id('sit'),
    source_id: source.source_key,
    source_item_key: slugify(`${source.source_key}-${title}`),
    canonical_url: canonicalUrl,
    canonical_domain: domainOf(canonicalUrl),
    url_hash: hash(canonicalUrl),
    dedupe_hash: hash(`${domainOf(canonicalUrl)}:${canonicalUrl}`),
    title,
    summary_excerpt: raw.summary_excerpt || '',
    published_at: raw.published_at || null,
    fetched_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    first_seen_at: now.toISOString(),
    raw_category: raw.category || source.category_hint || null,
    category_key: lane || raw.category || source.category_hint || 'daily',
    matched_trend_lane: lane,
    matched_keywords: raw.matched_lanes || [],
    allowed_use: source.allowed_use,
    license_name: source.license_name,
    risk_tier: source.risk_tier,
    risk_flags: [...new Set(riskFlags)],
    quarantine_reason: null,
    ingest_status: 'new',
    review_status: 'unreviewed',
    original_note: raw.original_note || 'Original SPG summary required before publishing.',
  };
}

function candidateFromSourceItem(item, now) {
  return {
    id: id('cand'),
    candidate_key: slugify(`candidate-${item.source_item_key}`),
    candidate_type: item.matched_trend_lane ? 'editorial_recommendation' : 'network_application_target',
    vendor_name: item.canonical_domain,
    program_type: 'unknown',
    title: item.title,
    summary: item.original_note,
    category_id: item.category_key,
    trend_lane: item.matched_trend_lane,
    risk_tier: item.risk_tier,
    approval_status: 'pending',
    required_disclosure: claimSafeCopy.affiliateDisclosure,
    candidate_score: 50,
    candidate_confidence: 0.45,
    missing_data: ['merchant approval', 'rights-cleared image', 'destination health check'],
    false_positive_risks: ['trend/RSS signal may not indicate buyer intent'],
    first_seen_at: now.toISOString(),
    last_seen_at: now.toISOString(),
  };
}

function offerFromCandidate(candidate, now) {
  return validateOffer({
    offer_key: candidate.candidate_key.replace(/^candidate-/, ''),
    vendor_name: candidate.vendor_name,
    offer_title: candidate.title,
    offer_description: candidate.summary,
    category_id: candidate.category_id,
    program_type: candidate.program_type,
    required_disclosure: candidate.required_disclosure,
    approval_status: 'approved',
    publish_state: 'draft',
    risk_tier: candidate.risk_tier,
    owner: 'leadfs',
  }, now);
}

function publicOfferContract(offer) {
  return {
    id: offer.id,
    offer_key: offer.offer_key,
    category: offer.category_id,
    monetization_status: offer.monetization_status,
    payout_model: offer.payout_model,
    account_status: offer.account_status,
    tracking_status: offer.tracking_status,
    title: offer.offer_title,
    vendor_name: offer.vendor_name,
    summary: offer.summary || offer.offer_description,
    cta: offer.cta,
    disclosure: offer.required_disclosure,
    approval_state: offer.approval_status,
    publish_state: offer.publish_state,
    landing_url: isPublicOffer(offer) ? `/offers/${offer.offer_key}` : null,
    go_link: isPublicOffer(offer) ? `/go/${offer.offer_key}` : null,
    destination_url: isPublicOffer(offer) ? offer.destination_url : null,
    image: offer.image,
    seo: offer.seo,
    claim_rules: { price_claim_allowed: false, availability_claim_allowed: false, rating_review_claim_allowed: false },
  };
}

function isPublicOffer(offer) {
  const monetized = offer.monetization_status === 'approved_monetized' && offer.payout_model !== 'none' && offer.account_status === 'active' && offer.tracking_status === 'active';
  const leadMagnet = offer.monetization_status === 'approved_lead_magnet' && offer.payout_model === 'lead_magnet';
  return offer.approval_status === 'approved' && ['published', 'scheduled'].includes(offer.publish_state) && offer.risk_tier !== 'blocked' && (monetized || leadMagnet);
}

function publicPlacementContract(placement) {
  return { id: placement.id, surface: placement.surface, entity_type: placement.entity_type, entity_key: placement.entity_key, display_order: placement.display_order };
}

function filterRecords(records, filters, allowedKeys) {
  return records.filter((record) => allowedKeys.every((key) => filters[key] == null || String(record[key]) === String(filters[key])));
}

function normalizeTopics(topics) {
  return [...new Set((Array.isArray(topics) ? topics : [topics]).map((topic) => String(topic).trim()).filter((topic) => SAFE_TOPICS.has(topic)))];
}

function placeholderImage(category, index) {
  const palette = ['7c3aed', '06b6d4', 'f97316', '22c55e', 'ec4899'];
  const color = palette[index % palette.length];
  return { url: `https://placehold.co/1200x800/${color}/ffffff?text=${encodeURIComponent(String(category || 'SPG'))}`, source: 'generated_placeholder', license: 'owned/generated placeholder', rights_status: 'approved', alt: `Cartoon-style StuffPrettyGood ${category || 'offer'} card` };
}

function stripQuery(value) {
  try { const url = new URL(value, 'https://stuffprettygood.com'); url.search = ''; url.hash = ''; return url.toString(); } catch { return '/'; }
}
function domainOf(value) { try { return new URL(value).hostname; } catch { return 'stuffprettygood.com'; } }
function sanitizeTitle(value) { return String(value || '').replace(/\$\d[\d,.]*/g, 'current offer').replace(/\d+%\s*off/ig, 'discounted').slice(0, 180); }
function slugify(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96); }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function latestAge(runs) { if (!runs.length) return { latest_completed_at: null, age_hours: null }; const latest = runs.at(-1).completed_at; return { latest_completed_at: latest, age_hours: Math.round((Date.now() - Date.parse(latest)) / 36_000) / 10 }; }
function statusError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error; }
