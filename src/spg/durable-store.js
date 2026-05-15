import crypto from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { approvedOffers, claimSafeCopy } from './public-surfaces.js';
import { trendOfferLanes } from './trending-offers.js';
import { getLaneTargets } from './trend-components.js';

const DEFAULT_STORE_PATH = 'data/spg-durable-store.json';
const DEFAULT_DAILY_OFFER_FEED_PATH = 'data/spg-monetized-offer-sample-feed.json';
const SECRET_OR_PII = /(?:password|passwd|api[_-]?key|secret|token|bearer|authorization|email=|phone=|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i;
const AMAZON_COPY_CLAIMS = /(?:amazon.*(?:price|rating|review|stars|availability|prime|free shipping)|\$\d[\d,.]*|\d+%\s*off|copied amazon|customer reviews?|in stock|out of stock)/i;
const SAFE_TOPICS = new Set(['ai-tools', 'home', 'travel', 'wellness', 'pets', 'smart-home', 'software', 'deals', 'templates', 'unsubscribe-all']);

export class SpgDurableStore {
  constructor({ path = DEFAULT_STORE_PATH, auditLog = null, now = () => new Date() } = {}) {
    this.path = resolve(process.cwd(), path);
    this.auditLog = auditLog;
    this.now = now;
    this.state = existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) : seedState(now());
    if (truthyEnv('SPG_ENABLE_RUNTIME_CREDENTIAL_STATE')) applyRuntimeCredentialState(this.state);
  }

  listSources(filters = {}) {
    return filterRecords(this.state.sources, filters, ['source_type', 'enabled', 'approval_status', 'risk_tier', 'category_hint', 'source_key']);
  }

  listOfferAccounts(filters = {}) {
    return filterRecords(this.state.offer_accounts || [], filters, ['account_key', 'account_type', 'monetization_status', 'account_status', 'risk_tier']);
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

  runIngestion({ source_keys = null, dry_run = false, max_items_per_source = 20, feed_path = DEFAULT_DAILY_OFFER_FEED_PATH } = {}, { actorId = 'scheduled-job' } = {}) {
    const startedAt = this.now().toISOString();
    const sourceSet = Array.isArray(source_keys) && source_keys.length ? new Set(source_keys) : null;
    const approvedSources = this.state.sources.filter((source) => source.enabled && source.approval_status === 'approved' && source.risk_tier !== 'blocked' && (!sourceSet || sourceSet.has(source.source_key)));
    const rssItems = this.readJsonIfExists('data/spg-rss-candidates.json')?.candidates || [];
    const offerFeed = this.readJsonIfExists(feed_path) || {};
    const items = [...rssItems, ...(offerFeed.offers || offerFeed.items || [])];
    const sourceItems = [];
    const candidates = [];
    const quarantined = [];
    const publishableOffers = [];
    const countsBySource = new Map();

    for (const raw of items) {
      const source = approvedSources.find((item) => item.source_key === raw.source_key || item.source_key === raw.source_id || item.name === raw.source_name);
      if (!source) continue;
      const seenCount = countsBySource.get(source.source_key) || 0;
      if (seenCount >= max_items_per_source) continue;
      countsBySource.set(source.source_key, seenCount + 1);
      const account = (this.state.offer_accounts || []).find((item) => item.account_key === raw.account_key) || null;
      const normalized = normalizeSourceItem(raw, source, this.now(), account);
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
        const candidate = candidateFromSourceItem(normalized, this.now(), account);
        candidates.push(candidate);
        if (isPublishableCandidate(candidate, source, account)) publishableOffers.push(offerFromPublishableCandidate(candidate, this.now()));
      }
    }

    const metric = {
      id: id('ing'),
      started_at: startedAt,
      completed_at: this.now().toISOString(),
      source_count: approvedSources.length,
      source_item_count: sourceItems.length,
      candidate_count: candidates.length,
      offer_record_count: publishableOffers.length,
      public_rows_published: publishableOffers.length,
      quarantined_count: quarantined.length,
      dry_run: Boolean(dry_run),
      source_keys: approvedSources.map((source) => source.source_key),
      blocked_side_effects: ['email', 'sms', 'provider_push', 'frontend_direct_external_urls', 'public_publish_without_approval'],
    };

    if (!dry_run) {
      this.state.source_items.push(...sourceItems.filter((item) => !this.state.source_items.some((existing) => existing.dedupe_hash === item.dedupe_hash)));
      this.state.source_items.push(...quarantined.filter((item) => !this.state.source_items.some((existing) => existing.dedupe_hash === item.dedupe_hash)));
      this.state.offer_candidates.push(...candidates.filter((item) => !this.state.offer_candidates.some((existing) => existing.candidate_key === item.candidate_key)));
      this.state.offers.push(...publishableOffers.filter((item) => !this.state.offers.some((existing) => existing.offer_key === item.offer_key)));
      this.state.page_placements.push(...publishableOffers.filter((item) => !this.state.page_placements.some((existing) => existing.entity_key === item.offer_key)).map((offer, index) => ({ id: id('plc'), surface: 'home', entity_type: 'offer', entity_key: offer.offer_key, approval_status: 'approved', publish_state: 'published', display_order: this.state.page_placements.length + index + 1 })));
      this.state.ingestion_runs.push(metric);
      for (const source of approvedSources) source.last_fetched_at = metric.completed_at;
      this.recordAudit(actorId, 'spg.ingest.completed', 'spg_ingestion_run', metric.id, { source_item_count: metric.source_item_count, candidate_count: metric.candidate_count, offer_record_count: metric.offer_record_count, dry_run: metric.dry_run });
      this.persist();
    }
    return { ...metric, source_items: sourceItems, offer_candidates: candidates, offers: publishableOffers.map(publicOfferContract), quarantined };
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

  getPublicOffer(slug) {
    const canonicalSlug = String(slug || '').replace(/\.html$/, '');
    const offer = this.state.offers.find((item) => item.offer_key === canonicalSlug || item.canonical_slug === canonicalSlug);
    return offer && isPublicOffer(offer) ? publicOfferContract(offer) : null;
  }

  resolveGoRedirect(slug, input = {}, { actorId = 'public-go' } = {}) {
    const canonicalSlug = String(slug || '').replace(/\.html$/, '');
    const offer = this.state.offers.find((item) => item.offer_key === canonicalSlug || item.canonical_slug === canonicalSlug);
    if (!offer || !isPublicOffer(offer)) {
      this.recordAudit(actorId, 'spg.go.redirect.blocked', 'spg_offer', canonicalSlug || 'unknown', { reason: offer ? 'not_publishable' : 'offer_not_found' });
      throw statusError(404, 'offer redirect not found');
    }
    const event = this.recordPublicEvent({
      event_type: 'go_click',
      route_path: input.route_path || `/go/${canonicalSlug}`,
      offer_slug: canonicalSlug,
      surface: input.surface || 'go_route',
      source_channel: input.source_channel || null,
      attribution_ref: input.attribution_ref || null,
      session_ref: input.session_ref || null,
    }, { actorId });
    if (event.status !== 'accepted') return event;
    offer.click_count = (offer.click_count || 0) + 1;
    this.recordAudit(actorId, 'spg.go.redirect.resolved', 'spg_offer', canonicalSlug, {
      redirect_path: `/go/${canonicalSlug}`,
      destination_mode: offer.destination_url_mode || 'sanitized',
      raw_ip_stored: false,
      raw_user_agent_stored: false,
    });
    this.persist();
    return { status: 'redirect', destination_url: offer.destination_url, offer: publicOfferContract(offer) };
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
    const routePath = stripQuery(input.route_path || input.path || '/');
    const canonicalSlug = String(input.offer_slug || input.offerSlug || routePath.match(/^https?:\/\/stuffprettygood\.com\/go\/([^/?#]+)/)?.[1] || routePath.match(/^\/go\/([^/?#]+)/)?.[1] || '').replace(/\.html$/, '');
    const event = {
      id: id('evt'),
      event_type: eventType || 'unknown',
      brand: 'stuffprettygood',
      event_date: this.now().toISOString().slice(0, 10),
      event_at: this.now().toISOString(),
      route_path: routePath,
      canonical_slug: canonicalSlug || null,
      attribution_contract_version: 'spg-route-attribution-v1',
      landing_path: canonicalSlug ? `/offers/${canonicalSlug}` : null,
      redirect_path: canonicalSlug ? `/go/${canonicalSlug}` : null,
      surface: input.surface || input.referring_surface || input.source_channel || 'unknown',
      attribution_ref_hash: input.attribution_ref ? `sha256:${hash(input.attribution_ref)}` : null,
      session_ref_hash: input.session_ref ? `sha256:${hash(input.session_ref)}` : null,
      raw_pii_present: blockers.includes('raw_pii_or_secret_like_payload'),
      raw_ip_stored: false,
      raw_user_agent_stored: false,
      blocked_payload_stored: false,
      blocker_classes: blockers,
    };
    if (!blockers.length) {
      this.state.public_events.push(event);
      this.recordAudit(actorId, 'spg.public_event.accepted', 'spg_public_event', event.id, { event_type: event.event_type });
      this.persist();
    }
    return { status: blockers.length ? 'blocked' : 'accepted', raw_pii_present: event.raw_pii_present, raw_ip_stored: false, raw_user_agent_stored: false, blocked_payload_stored: false, canonical_slug: event.canonical_slug, landing_path: event.landing_path, redirect_path: event.redirect_path, attribution_contract_version: event.attribution_contract_version, blocker_classes: blockers };
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
    const canonicalSlug = String(input.offer_slug || input.offerSlug || '').replace(/\.html$/, '') || null;
    const event = {
      id: id('pref'),
      topics,
      consent_state: input.consent_state || 'web_preference_only',
      canonical_slug: canonicalSlug,
      landing_path: canonicalSlug ? `/offers/${canonicalSlug}` : null,
      redirect_path: canonicalSlug ? `/go/${canonicalSlug}` : null,
      attribution_ref_hash: input.attribution_ref ? `sha256:${hash(input.attribution_ref)}` : null,
      raw_pii_present: false,
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
    { source_key: 'skimlinks-api-feed', name: 'Skimlinks API/feed lane', source_type: 'skimlinks_feed', homepage_url: 'https://www.skimlinks.com/', feed_url: null, api_endpoint_label: 'env:SPG_SKIMLINKS_API_ENDPOINT', terms_url: 'https://www.skimlinks.com/terms/', robots_or_terms_notes: 'Server-side API/feed only after approved account; environment labels only, never raw keys.', allowed_use: 'merchant_creative_allowed', license_name: 'provider feed subject to account terms', category_hint: 'network_offers', risk_tier: 'medium', enabled: true, approval_status: 'approved' },
    { source_key: 'stay22-api-feed', name: 'Stay22 API/feed lane', source_type: 'stay22_feed', homepage_url: 'https://www.stay22.com/', feed_url: null, api_endpoint_label: 'env:SPG_STAY22_API_ENDPOINT', terms_url: 'https://www.stay22.com/privacy', robots_or_terms_notes: 'Server-side API/feed only after approved account; environment labels only, never raw keys.', allowed_use: 'merchant_creative_allowed', license_name: 'provider feed subject to account terms', category_hint: 'travel', risk_tier: 'medium', enabled: true, approval_status: 'approved' },
  ].map((source) => ({ id: id('src'), source_quality_score: 70, reviewed_by: 'complyops-gate', last_reviewed_at: nowIso, created_at: nowIso, updated_at: nowIso, ...source }));
  const offerAccounts = [
    { account_key: 'amazon-associates-manual', account_name: 'Amazon Associates manual bridge account', merchant_or_network: 'Amazon Associates', account_type: 'amazon_associates', monetization_status: 'approved_monetized', payout_model: 'commission', account_status: 'active', credential_ref: 'env:SPG_AMAZON_ASSOCIATES_TAG', tracking_id_label: 'mehyarmedia-20', disclosure_required: true, risk_tier: 'medium', owner_role: 'Arman' },
    { account_key: 'skimlinks', account_name: 'Skimlinks publisher', merchant_or_network: 'Skimlinks', account_type: 'affiliate_network', monetization_status: 'pending_application', payout_model: 'commission', account_status: 'application_ready', credential_ref: 'env:SPG_SKIMLINKS_ACCOUNT_REF', api_key_ref: 'env:SPG_SKIMLINKS_API_KEY', disclosure_required: true, risk_tier: 'medium', owner_role: 'Arman' },
    { account_key: 'stay22-publisher', account_name: 'Stay22 publisher / creator account', merchant_or_network: 'Stay22', account_type: 'affiliate_network', monetization_status: 'pending_application', payout_model: 'commission', account_status: 'application_ready', credential_ref: 'env:SPG_STAY22_ACCOUNT_REF', api_key_ref: 'env:SPG_STAY22_API_KEY', disclosure_required: true, risk_tier: 'medium', owner_role: 'Arman' },
  ].map((account) => ({ id: id('acct'), created_at: nowIso, updated_at: nowIso, ...account }));
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
      landing_approved_at: nowIso,
      redirect_approved_at: nowIso,
      redirect_health: 'ok',
      risk_tier: lane.risk === 'high' ? 'medium' : lane.risk,
      owner: 'leadfs',
      destination_url: `/go/${target.slug}.html`,
      destination_host: 'stuffprettygood.com',
      source_attribution_text: 'Amazon Associates manual search seed; original SPG copy and generated/owned art only.',
      image: placeholderImage(lane.seed, laneIndex + targetIndex),
      cta: 'Check current options',
      seo: { title: `${target.label} — StuffPrettyGood`, description: `Disclosure-visible Amazon Associates bridge for ${target.label}.` },
    }, now)));
  const offers = [...monetizedAmazonOffers, ...accountTargetOffers];
  return {
    schema_version: 1,
    sources,
    offer_accounts: offerAccounts,
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

function truthyEnv(name) {
  return ['1', 'true', 'yes', 'verified', 'active'].includes(String(process.env[name] || '').trim().toLowerCase());
}

function applyRuntimeCredentialState(state) {
  const accounts = state.offer_accounts || [];
  const amazon = accounts.find((account) => account.account_key === 'amazon-associates-manual');
  if (amazon && (process.env.SPG_AMAZON_ASSOCIATES_TAG || process.env.CRM_AMAZON_ASSOCIATES_TAG || process.env.AMAZON_ASSOCIATES_TAG)) {
    amazon.monetization_status = 'approved_monetized';
    amazon.account_status = 'active';
    amazon.credential_ref = 'env:SPG_AMAZON_ASSOCIATES_TAG';
    amazon.tracking_id_label = 'mehyarmedia-20';
  }
  const skimlinks = accounts.find((account) => account.account_key === 'skimlinks');
  if (skimlinks && (process.env.SPG_SKIMLINKS_API_KEY || process.env.SKIMLINKS_API_KEY || truthyEnv('SPG_SKIMLINKS_API_KEY_VERIFIED'))) {
    skimlinks.monetization_status = 'approved_monetized';
    skimlinks.account_status = 'active';
    skimlinks.credential_ref = 'env:SPG_SKIMLINKS_API_KEY';
    skimlinks.api_key_ref = 'env:SPG_SKIMLINKS_API_KEY';
  }
  const stay22 = accounts.find((account) => account.account_key === 'stay22-publisher');
  if (stay22 && (process.env.SPG_STAY22_AID || process.env.STAY22_AID || process.env.SPG_STAY22_PARTNER_ID || process.env.STAY22_PARTNER_ID || truthyEnv('SPG_STAY22_AID_VERIFIED'))) {
    stay22.monetization_status = 'approved_monetized';
    stay22.account_status = 'active';
    stay22.credential_ref = 'env:SPG_STAY22_AID';
    stay22.api_key_ref = 'env:SPG_STAY22_API_KEY';
  }
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
    canonical_slug: slugify(input.canonical_slug || input.offer_key),
    public_landing_path: input.public_landing_path || `/offers/${slugify(input.canonical_slug || input.offer_key)}`,
    public_redirect_path: input.public_redirect_path || `/go/${slugify(input.canonical_slug || input.offer_key)}`,
    landing_approved_at: input.landing_approved_at || null,
    redirect_approved_at: input.redirect_approved_at || null,
    redirect_health: input.redirect_health || 'unknown',
    destination_url_mode: input.destination_url_mode || 'sanitized',
    destination_url: input.destination_url || null,
    destination_host: input.destination_host || (input.destination_url ? domainOf(input.destination_url) : null),
    source_attribution: input.source_attribution || { source: 'manual_spg_seed', allowed_use: 'metadata_only' },
    source_attribution_text: input.source_attribution_text || 'Manual StuffPrettyGood seed; original SPG copy and generated/owned art only.',
    click_count: Number.isFinite(input.click_count) ? input.click_count : 0,
    signup_count: Number.isFinite(input.signup_count) ? input.signup_count : 0,
    allowed_surfaces: input.allowed_surfaces || ['home', 'category'],
    blocked_reason: input.blocked_reason || null,
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
  if (!/^[a-z0-9][a-z0-9-]{2,120}$/.test(offer.canonical_slug)) throw statusError(422, 'canonical_slug must be a stable lowercase public slug');
  if (offer.public_landing_path !== `/offers/${offer.canonical_slug}`) throw statusError(422, 'public_landing_path must equal /offers/<canonical_slug>');
  if (offer.public_redirect_path !== `/go/${offer.canonical_slug}`) throw statusError(422, 'public_redirect_path must equal /go/<canonical_slug>');
  if (offer.destination_url_mode === 'secret_ref' && offer.destination_url) throw statusError(422, 'secret_ref destination mode must not expose a raw destination_url');
  if (offer.approval_status === 'approved' && offer.publish_state === 'published' && !offer.destination_url && offer.destination_url_mode !== 'secret_ref') throw statusError(422, 'published approved offer requires sanitized destination or server-side secret ref');
  if (offer.approval_status === 'approved' && ['published', 'scheduled'].includes(offer.publish_state)) {
    const monetized = offer.monetization_status === 'approved_monetized' && offer.payout_model !== 'none' && offer.account_status === 'active' && offer.tracking_status === 'active';
    if (!offer.landing_approved_at || !offer.redirect_approved_at) throw statusError(422, 'public offer requires approved landing and redirect routes');
    if (['broken', 'blocked'].includes(offer.redirect_health)) throw statusError(422, 'public offer requires healthy redirect status');
    if (offer.blocked_reason) throw statusError(422, 'public offer cannot have blocked_reason');
    if (!monetized) throw statusError(422, 'public offer requires approved monetized status');
  }
  return offer;
}

function normalizeSourceItem(raw, source, now, account = null) {
  const canonicalUrl = stripQuery(raw.url || raw.destination_url || source.homepage_url || 'https://stuffprettygood.com/');
  const title = sanitizeTitle(raw.safe_title || raw.title || raw.offer_title || 'Untitled source signal');
  const riskFlags = [...(raw.risk_flags || [])];
  if (SECRET_OR_PII.test(JSON.stringify(raw))) riskFlags.push('blocked_secret_or_pii_like_payload');
  if (AMAZON_COPY_CLAIMS.test(title)) riskFlags.push('commerce_claim_rewrite_required');
  if (!account) riskFlags.push('blocked_missing_approved_account_record');
  const lane = raw.matched_lanes?.[0] || raw.trend_lane || null;
  const slug = slugify(raw.slug || raw.go_slug || `${source.source_key}-${title}`);
  return {
    id: id('sit'),
    source_id: source.source_key,
    source_item_key: slugify(`${source.source_key}-${slug}`),
    account_key: raw.account_key || account?.account_key || null,
    canonical_url: canonicalUrl,
    canonical_domain: domainOf(raw.destination_url || canonicalUrl),
    url_hash: hash(canonicalUrl),
    dedupe_hash: hash(`${source.source_key}:${raw.account_key || 'no-account'}:${slug}:${canonicalUrl}`),
    title,
    summary_excerpt: raw.summary_excerpt || raw.summary || '',
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
    original_note: raw.original_note || raw.summary || 'Original SPG summary required before publishing.',
    destination_url: raw.destination_url || null,
    canonical_slug: slug,
    public_landing_path: `/offers/${slug}`,
    public_redirect_path: `/go/${slug}`,
    image_rights_status: raw.image_rights_status || 'pending',
    image: raw.image || null,
    publish_decision: raw.publish_decision || 'hold_for_review',
    approval_status: raw.approval_status || 'pending',
    monetized: Boolean(raw.monetized),
    payout_model: raw.payout_model || account?.payout_model || 'none',
    disclosure_text: raw.disclosure_text || account?.default_disclosure_text || claimSafeCopy.affiliateDisclosure,
  };
}

function candidateFromSourceItem(item, now, account = null) {
  return {
    id: id('cand'),
    candidate_key: slugify(`candidate-${item.source_item_key}`),
    candidate_type: item.matched_trend_lane ? 'editorial_recommendation' : 'network_application_target',
    account_key: item.account_key,
    vendor_name: account?.merchant_or_network || item.canonical_domain,
    program_type: account?.account_type || 'unknown',
    title: item.title,
    summary: item.original_note,
    category_id: item.category_key,
    trend_lane: item.matched_trend_lane,
    risk_tier: item.risk_tier,
    approval_status: item.approval_status,
    image_rights_status: item.image_rights_status,
    publish_decision: item.publish_decision,
    monetized: item.monetized,
    monetization_status: account?.monetization_status || 'not_monetized',
    payout_model: item.payout_model,
    account_status: account?.account_status || 'missing',
    tracking_status: account?.account_status === 'active' ? 'active' : 'pending',
    required_disclosure: item.disclosure_text,
    destination_url: item.destination_url,
    canonical_slug: item.canonical_slug,
    public_landing_path: item.public_landing_path,
    public_redirect_path: item.public_redirect_path,
    image: item.image || placeholderImage(item.category_key, 0),
    source_attribution_text: `${item.source_id} server-side/manual ingest; public output uses SPG landing and /go redirect only.`,
    candidate_score: account?.account_status === 'active' ? 80 : 45,
    candidate_confidence: account?.account_status === 'active' ? 0.78 : 0.42,
    missing_data: account?.account_status === 'active' ? [] : ['approved active account', 'credential health check'],
    false_positive_risks: ['provider terms/feed rights can change', 'merchant availability/details must stay off public cards unless licensed'],
    first_seen_at: now.toISOString(),
    last_seen_at: now.toISOString(),
  };
}

function isPublishableCandidate(candidate, source, account) {
  return Boolean(
    candidate.monetized === true &&
    candidate.publish_decision === 'publish_monetized' &&
    candidate.approval_status === 'approved' &&
    candidate.image_rights_status === 'approved' &&
    candidate.required_disclosure &&
    candidate.destination_url &&
    candidate.public_landing_path === `/offers/${candidate.canonical_slug}` &&
    candidate.public_redirect_path === `/go/${candidate.canonical_slug}` &&
    source?.approval_status === 'approved' &&
    source?.risk_tier !== 'blocked' &&
    account?.monetization_status === 'approved_monetized' &&
    account?.account_status === 'active' &&
    account?.risk_tier !== 'blocked' &&
    account?.credential_ref
  );
}

function offerFromPublishableCandidate(candidate, now) {
  return validateOffer({
    offer_key: candidate.canonical_slug,
    canonical_slug: candidate.canonical_slug,
    public_landing_path: candidate.public_landing_path,
    public_redirect_path: candidate.public_redirect_path,
    vendor_name: candidate.vendor_name,
    offer_title: candidate.title,
    offer_description: candidate.summary,
    category_id: candidate.category_id,
    program_type: candidate.program_type,
    monetization_status: candidate.monetization_status,
    payout_model: candidate.payout_model,
    account_status: candidate.account_status,
    tracking_status: 'active',
    required_disclosure: candidate.required_disclosure,
    approval_status: 'approved',
    publish_state: 'published',
    landing_approved_at: now.toISOString(),
    redirect_approved_at: now.toISOString(),
    redirect_health: 'ok',
    risk_tier: candidate.risk_tier,
    owner: 'leadfs',
    destination_url_mode: 'server_side_redirect_only',
    destination_url: candidate.destination_url,
    destination_host: domainOf(candidate.destination_url),
    source_attribution_text: candidate.source_attribution_text,
    image_rights_status: candidate.image_rights_status,
    image: candidate.image,
    cta: 'See the SPG breakdown',
    seo: { title: `${candidate.title} — StuffPrettyGood`, description: candidate.summary },
  }, now);
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
  const publicReady = isPublicOffer(offer);
  const publicLandingUrl = `/offers/${offer.offer_key}`;
  const redirectUrl = `/go/${offer.offer_key}`;
  return {
    id: offer.id,
    offer_key: offer.offer_key,
    canonical_slug: offer.canonical_slug || offer.offer_key,
    category: offer.category_id,
    monetization_status: offer.monetization_status,
    payout_model: offer.payout_model,
    account_status: offer.account_status,
    tracking_status: offer.tracking_status,
    redirect_health: offer.redirect_health,
    title: offer.offer_title,
    vendor_name: offer.vendor_name,
    summary: offer.summary || offer.offer_description,
    cta: offer.cta,
    disclosure: offer.required_disclosure,
    approval_state: offer.approval_status,
    publish_state: offer.publish_state,
    landing_approved_at: offer.landing_approved_at || null,
    redirect_approved_at: offer.redirect_approved_at || null,
    public_landing_url: publicReady ? publicLandingUrl : null,
    redirect_url: publicReady ? redirectUrl : null,
    // Back-compat aliases for older WebDev surfaces. Both remain internal SPG routes only.
    landing_url: publicReady ? publicLandingUrl : null,
    go_link: publicReady ? redirectUrl : null,
    destination_url_mode: offer.destination_url_mode,
    destination_host: offer.destination_host,
    source_attribution_text: offer.source_attribution_text,
    blocked_reason: publicReady ? null : (offer.blocked_reason || null),
    click_count: offer.click_count || 0,
    signup_count: offer.signup_count || 0,
    image: offer.image,
    seo: offer.seo,
    claim_rules: { price_claim_allowed: false, availability_claim_allowed: false, rating_review_claim_allowed: false },
  };
}

function isPublicOffer(offer) {
  const slug = offer.canonical_slug || offer.offer_key;
  const landingPath = offer.public_landing_path || `/offers/${slug}`;
  const redirectPath = offer.public_redirect_path || `/go/${slug}`;
  const routeApproved = landingPath === `/offers/${slug}` && redirectPath === `/go/${slug}` && Boolean(offer.landing_approved_at) && Boolean(offer.redirect_approved_at);
  const healthOk = !['broken', 'blocked'].includes(offer.redirect_health || 'ok');
  const sourceAttributed = Boolean(offer.source_attribution_text || offer.source_attribution?.source);
  const imageRights = String(offer.image_rights_status || offer.image?.rights_status || offer.image?.license || 'owned/generated').toLowerCase();
  const imageApproved = imageRights.includes('approved') || imageRights.includes('owned') || imageRights.includes('licensed');
  const monetized = offer.monetization_status === 'approved_monetized' && offer.payout_model !== 'none' && offer.account_status === 'active' && offer.tracking_status === 'active';
  return offer.approval_status === 'approved' && ['published', 'scheduled'].includes(offer.publish_state) && !offer.blocked_reason && offer.risk_tier !== 'blocked' && routeApproved && healthOk && sourceAttributed && imageApproved && monetized;
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
  try { const url = new URL(value, 'https://stuffprettygood.com'); return `${url.pathname}`.replace(/\.html$/, ''); } catch { return '/'; }
}
function domainOf(value) { try { return new URL(value).hostname; } catch { return 'stuffprettygood.com'; } }
function sanitizeTitle(value) { return String(value || '').replace(/\$\d[\d,.]*/g, 'current offer').replace(/\d+%\s*off/ig, 'discounted').slice(0, 180); }
function slugify(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96); }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function latestAge(runs) { if (!runs.length) return { latest_completed_at: null, age_hours: null }; const latest = runs.at(-1).completed_at; return { latest_completed_at: latest, age_hours: Math.round((Date.now() - Date.parse(latest)) / 36_000) / 10 }; }
function statusError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error; }
