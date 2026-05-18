import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { trendOfferLanes } from '../src/spg/trending-offers.js';
import { trendOfferTargets } from '../src/spg/trend-components.js';

const ROOT = new URL('../', import.meta.url).pathname;
const OUT = process.env.SPG_DAILY_OFFER_FEED_PATH || 'data/spg-daily-offer-feed.json';
const AMAZON_TAG = process.env.SPG_AMAZON_ASSOCIATES_TAG || process.env.CRM_AMAZON_ASSOCIATES_TAG || process.env.AMAZON_ASSOCIATES_TAG || 'mehyarmedia-20';
const MAX_AMAZON = Number.parseInt(process.env.SPG_DAILY_AMAZON_OFFER_LIMIT || '120', 10) || 120;
const MAX_SKIMLINKS = Number.parseInt(process.env.SPG_DAILY_SKIMLINKS_OFFER_LIMIT || '0', 10) || 0;
const AMAZON_FIRST_ONLY = process.env.SPG_AFFILIATE_ONLY_AMAZON_FIRST !== '0';
const MAX_STAY22 = AMAZON_FIRST_ONLY ? 0 : (Number.parseInt(process.env.SPG_DAILY_STAY22_OFFER_LIMIT || '24', 10) || 24);
const STAY22_ENDPOINT = process.env.SPG_STAY22_API_ENDPOINT || 'https://api.stay22.com/v1/accommodations';
const SECRETISH = /(api[_-]?key|access[_-]?token|secret|password|bearer|authorization|sk_live_|pk_live_|stay22_[a-f0-9-]{32,})/i;
const CLAIMISH = /(\$\d|\d+%\s*off|\bstars?\b|rating|reviews?|in stock|out of stock|prime|free shipping)/i;

loadEnv('/home/mehya/.hermes/.env');
loadEnv('/home/mehya/.hermes/projects/stuffprettygood-com/.env');

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=').replace(/^['"]|['"]$/g, '');
  }
}

function slugify(value) {
  return String(value || 'offer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96) || 'offer';
}
function safeText(value, fallback = '') {
  return String(value || fallback).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 420);
}
function amazonSearchUrl(query) {
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  url.searchParams.set('tag', AMAZON_TAG);
  return url.toString();
}
function placeholder(slug, title, idx) {
  const palettes = ['7c3aed', '06b6d4', 'f97316', '16a34a', 'db2777', '2563eb'];
  return {
    url: `https://placehold.co/1200x800/${palettes[idx % palettes.length]}/ffffff?text=${encodeURIComponent(`SPG ${title}`.slice(0, 48))}`,
    source: 'generated_placeholder',
    license: 'owned/generated placeholder',
    rights_status: 'approved',
    alt: `Original StuffPrettyGood illustration placeholder for ${title || slug}`,
  };
}
function amazonOfferRow({ lane, slug, title, query, note, sourceFamily, priority }, idx) {
  return {
    source_key: 'amazon-manual-links',
    account_key: 'amazon-associates-manual',
    slug: slugify(slug),
    title: safeText(title, slug),
    summary: safeText(note, `Original SPG daily offer bridge for ${title}. Compare current merchant details, total cost, warranty, fit, and return terms before buying.`),
    category: lane.slug || lane,
    trend_lane: lane.slug || lane,
    destination_url: amazonSearchUrl(query || title),
    monetized: true,
    payout_model: 'commission',
    approval_status: 'approved',
    publish_decision: 'publish_monetized',
    image_rights_status: 'approved',
    image: placeholder(slug, title, idx),
    disclosure_text: 'StuffPrettyGood may earn from qualifying Amazon purchases.',
    metadata: {
      source_family: sourceFamily,
      query: query || title,
      store_id_ref: 'env:SPG_AMAZON_ASSOCIATES_TAG',
      trend_lane: lane.slug || lane,
      trend_momentum_pct: lane.momentumPct ?? null,
      trend_latest: lane.latest ?? null,
      trend_updated_at: lane.trendUpdatedAt ?? null,
      priority,
    },
  };
}
function trendQueryOffers() {
  return trendOfferLanes
    .filter((lane) => Array.isArray(lane.queries) && lane.queries.length)
    .sort((a, b) => ((b.momentumPct || 0) * 2 + (b.latest || 0)) - ((a.momentumPct || 0) * 2 + (a.latest || 0)))
    .flatMap((lane) => lane.queries
      .filter((query) => query && !CLAIMISH.test(query) && !SECRETISH.test(query))
      .slice(0, 8)
      .map((query, index) => ({
        lane,
        slug: `amazon-trending-${lane.slug}-${slugify(query)}`,
        title: `${safeText(query)} on Amazon`,
        query,
        note: `Trending search signal in ${lane.title}. SPG routes this as an Amazon Associates search bridge; check current merchant details before buying.`,
        sourceFamily: 'amazon_associates_google_trends_query',
        priority: index + 1,
      })));
}
function configuredTargetOffers() {
  return Object.entries(trendOfferTargets).flatMap(([laneSlug, targets]) => {
    const lane = trendOfferLanes.find((item) => item.slug === laneSlug) || { slug: laneSlug, title: laneSlug };
    return targets
      .filter((target) => target.type === 'amazon_search')
      .map((target, index) => ({
        lane,
        slug: target.slug,
        title: target.label,
        query: target.query || target.label,
        note: target.note,
        sourceFamily: 'amazon_associates_editorial_seed',
        priority: index + 1,
      }));
  });
}
function normalizeAmazonOffers() {
  const rows = [];
  const seen = new Set();
  for (const offer of [...trendQueryOffers(), ...configuredTargetOffers()]) {
    const key = slugify(offer.slug);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(amazonOfferRow(offer, rows.length));
    if (rows.length >= MAX_AMAZON) return rows;
  }
  return rows;
}
async function fetchJson(url, label, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'StuffPrettyGoodDailyOffers/1.0', ...headers }, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`${label} returned HTTP ${res.status}: ${text.slice(0, 160)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}
function skimlinksAuthParams() {
  const apiKey = process.env.SPG_SKIMLINKS_API_KEY || process.env.SKIMLINKS_API_KEY;
  const publisherId = process.env.SPG_SKIMLINKS_PUBLISHER_ID || process.env.SKIMLINKS_PUBLISHER_ID || process.env.SPG_SKIMLINKS_ACCOUNT_ID || process.env.SKIMLINKS_ACCOUNT_ID;
  const accountType = process.env.SPG_SKIMLINKS_ACCOUNT_TYPE || process.env.SKIMLINKS_ACCOUNT_TYPE || 'publisher_admin';
  if (!apiKey || !publisherId) return null;
  return { apiKey, publisherId, accountType };
}
function normalizeSkimlinksOffer(raw, idx) {
  const merchant = raw.merchant_details || raw.merchant || {};
  const title = safeText(raw.title || raw.product_name || `${merchant.name || merchant.merchant_name || 'Merchant'} offer`, 'Skimlinks offer');
  if (!title || CLAIMISH.test(title)) return null;
  const rawUrl = raw.url || raw.product_url || raw.link || merchant.domain || merchant.url;
  if (!rawUrl || SECRETISH.test(rawUrl)) return null;
  const slug = slugify(`skimlinks-${merchant.merchant_id || merchant.id || raw.id || idx}-${title}`);
  const imageUrl = raw.product_image_url || raw.image_url || merchant.logo;
  return {
    source_key: 'skimlinks-api-feed',
    account_key: 'skimlinks',
    slug,
    title,
    summary: safeText(raw.description || raw.terms, `Skimlinks network offer from ${merchant.merchant_name || merchant.name || 'merchant'}; check current merchant details before purchase.`),
    category: safeText(raw.offer_type || raw.vertical_name || 'network-offers', 'network-offers'),
    destination_url: rawUrl,
    monetized: true,
    payout_model: 'commission',
    approval_status: 'approved',
    publish_decision: 'publish_monetized',
    image_rights_status: imageUrl ? 'approved' : 'approved',
    image: imageUrl && !SECRETISH.test(imageUrl) ? { url: imageUrl, source: 'skimlinks_provider_feed', license: 'provider feed subject to Skimlinks account terms', rights_status: 'approved', alt: `Provider image/logo for ${title}` } : placeholder(slug, title, idx),
    disclosure_text: 'StuffPrettyGood may earn a commission if you use approved links.',
    metadata: { source_family: 'skimlinks_api', merchant_id: merchant.merchant_id || merchant.id || null, offer_id: raw.id || null, offer_type: raw.offer_type || null },
  };
}
async function skimlinksOffers() {
  if (AMAZON_FIRST_ONLY || MAX_SKIMLINKS <= 0) return { offers: [], status: 'disabled_amazon_first' };
  const auth = skimlinksAuthParams();
  if (!auth) return { offers: [], status: 'skipped_missing_publisher_id_or_api_key' };
  const url = new URL(`https://merchants.skimapis.com/v3/offers`);
  url.searchParams.set('apikey', auth.apiKey);
  url.searchParams.set('account_type', auth.accountType);
  url.searchParams.set('account_id', auth.publisherId);
  url.searchParams.set('country', 'US');
  url.searchParams.set('period', 'current');
  url.searchParams.set('limit', String(Math.min(MAX_SKIMLINKS, 100)));
  url.searchParams.set('sort_by', 'offer_starts');
  url.searchParams.set('sort_dir', 'desc');
  try {
    const json = await fetchJson(url, 'Skimlinks offers');
    const rows = (json.offers || json.results || []).map(normalizeSkimlinksOffer).filter(Boolean).slice(0, MAX_SKIMLINKS);
    return { offers: rows, status: 'ok', count: rows.length };
  } catch (error) {
    return { offers: [], status: 'error', error_class: error.name || 'Error', error_message: String(error.message || error).replace(auth.apiKey, '[redacted]') };
  }
}
function daysFromNow(days) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}
function stay22AuthParams() {
  const aid = process.env.SPG_STAY22_AID || process.env.STAY22_AID || process.env.SPG_STAY22_PARTNER_ID || process.env.STAY22_PARTNER_ID || process.env.SPG_STAY22_ACCOUNT_REF || process.env.STAY22_ACCOUNT_REF;
  const apiKey = process.env.SPG_STAY22_API_KEY || process.env.STAY22_API_KEY;
  if (!aid) return null;
  return { aid, apiKey };
}
const stay22Searches = [
  { lane: 'travel', address: 'Times Square New York', campaign: 'spg-nyc-weekend', title: 'New York weekend hotels', checkinOffset: 30 },
  { lane: 'travel', address: 'Miami Beach Florida', campaign: 'spg-miami-beach', title: 'Miami Beach getaway stays', checkinOffset: 35 },
  { lane: 'travel', address: 'Las Vegas Strip Nevada', campaign: 'spg-vegas-weekend', title: 'Las Vegas Strip hotels', checkinOffset: 40 },
  { lane: 'events', address: 'Madison Square Garden New York', campaign: 'spg-msg-events', title: 'Hotels near Madison Square Garden', checkinOffset: 45 },
  { lane: 'events', address: 'SoFi Stadium Inglewood California', campaign: 'spg-sofi-events', title: 'Hotels near SoFi Stadium', checkinOffset: 50 },
  { lane: 'travel', address: 'Orlando Florida', campaign: 'spg-orlando-family', title: 'Orlando family trip hotels', checkinOffset: 55 },
];
function normalizeStay22Offer(raw, search, idx) {
  const title = safeText(raw.name || `${search.title} via Stay22`, search.title);
  if (!title || SECRETISH.test(title)) return null;
  const destinationUrl = raw.url || raw.links?.url || raw.links?.booking || Object.values(raw.links || {})[0] || Object.values(raw.suppliers || {}).map((supplier) => supplier?.link).find(Boolean);
  if (!destinationUrl || SECRETISH.test(destinationUrl)) return null;
  const slug = slugify(`stay22-${search.campaign}-${raw.id || idx}-${title}`);
  const address = raw.location?.address || search.address;
  const thumb = raw.media?.thumbnail || Object.values(raw.suppliers || {}).map((supplier) => supplier?.media?.logoSquare).find(Boolean);
  const providerNames = raw.provider || Object.keys(raw.suppliers || {}).join(', ') || 'Stay22 travel network';
  return {
    source_key: 'stay22-api-feed',
    account_key: 'stay22-publisher',
    slug,
    title,
    summary: safeText(`${title} around ${address}. SPG routes this through Stay22 for travel booking options; compare current dates, fees, cancellation terms, and room fit before booking.`),
    category: search.lane,
    trend_lane: search.lane,
    destination_url: destinationUrl,
    monetized: true,
    payout_model: 'commission',
    approval_status: 'approved',
    publish_decision: 'publish_monetized',
    image_rights_status: thumb ? 'approved' : 'approved',
    image: thumb && !SECRETISH.test(thumb) ? { url: thumb, source: 'stay22_provider_feed', license: 'provider feed subject to Stay22 account terms', rights_status: 'approved', alt: `Stay22 provider image for ${title}` } : placeholder(slug, title, idx),
    disclosure_text: 'StuffPrettyGood may earn a commission from Stay22 travel booking links.',
    metadata: {
      source_family: 'stay22_direct_travel_api',
      endpoint_ref: 'env:SPG_STAY22_API_ENDPOINT',
      aid_ref: 'env:SPG_STAY22_AID',
      provider: providerNames,
      stay22_id: raw.id || null,
      address,
      campaign: search.campaign,
      checkin: search.checkin,
      checkout: search.checkout,
    },
  };
}
async function stay22Offers() {
  if (AMAZON_FIRST_ONLY || MAX_STAY22 <= 0) return { offers: [], status: 'disabled_amazon_first' };
  const auth = stay22AuthParams();
  if (!auth) return { offers: [], status: 'skipped_missing_aid', contract: 'GET https://api.stay22.com/v1/accommodations?provider&address&checkin&checkout&aid&campaign' };
  const rows = [];
  const errors = [];
  for (const search of stay22Searches) {
    const query = { ...search, checkin: daysFromNow(search.checkinOffset), checkout: daysFromNow(search.checkinOffset + 2) };
    const url = new URL(STAY22_ENDPOINT);
    url.searchParams.set('provider', 'booking');
    url.searchParams.set('address', query.address);
    url.searchParams.set('checkin', query.checkin);
    url.searchParams.set('checkout', query.checkout);
    url.searchParams.set('adults', '2');
    url.searchParams.set('currency', 'USD');
    url.searchParams.set('limit', String(Math.min(6, Math.max(1, MAX_STAY22 - rows.length))));
    url.searchParams.set('aid', auth.aid);
    url.searchParams.set('campaign', query.campaign);
    try {
      let json;
      try {
        json = await fetchJson(url, 'Stay22 accommodations', auth.apiKey ? { 'X-API-KEY': auth.apiKey } : {});
      } catch (firstError) {
        if (!auth.apiKey || !/HTTP 401/.test(String(firstError.message || firstError))) throw firstError;
        errors.push('api_key_rejected_fell_back_to_public_contract');
        json = await fetchJson(url, 'Stay22 accommodations');
      }
      for (const offer of (json.results || []).map((raw, index) => normalizeStay22Offer(raw, query, rows.length + index)).filter(Boolean)) {
        rows.push(offer);
        if (rows.length >= MAX_STAY22) break;
      }
    } catch (error) {
      errors.push(String(error.message || error).replace(auth.apiKey || '', '[redacted]').replace(auth.aid || '', '[redacted]'));
    }
    if (rows.length >= MAX_STAY22) break;
  }
  return { offers: rows, status: rows.length ? 'ok' : 'empty', count: rows.length, ...(errors.length ? { warnings: [...new Set(errors)].slice(0, 3) } : {}) };
}

const amazon = normalizeAmazonOffers();
const skim = await skimlinksOffers();
const stay22 = await stay22Offers();
const feed = {
  generated_at: new Date().toISOString(),
  contract: 'spg-daily-monetized-offer-ingestion-v2',
  safety: { no_raw_pii: true, no_raw_secret_values: true, env_key_names_only: true, frontend_direct_external_urls_allowed: false },
  source_status: {
    amazon_associates: { status: 'ok', count: amazon.length, store_id_ref: 'env:SPG_AMAZON_ASSOCIATES_TAG' },
    skimlinks: { status: skim.status, count: skim.offers.length, credential_ref: 'env:SPG_SKIMLINKS_API_KEY', ...(skim.error_class ? { error_class: skim.error_class, error_message: skim.error_message } : {}) },
    stay22: { status: stay22.status, count: stay22.offers.length, credential_ref: 'env:SPG_STAY22_API_KEY', aid_ref: 'env:SPG_STAY22_AID', endpoint_ref: 'env:SPG_STAY22_API_ENDPOINT', ...(stay22.contract ? { contract: stay22.contract } : {}), ...(stay22.warnings ? { warnings: stay22.warnings } : {}) },
  },
  offers: AMAZON_FIRST_ONLY ? amazon : [...amazon, ...skim.offers, ...stay22.offers],
};

const outPath = OUT.startsWith('/') ? OUT : new URL(`../${OUT}`, import.meta.url).pathname;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(feed, null, 2) + '\n');
console.log(JSON.stringify({ status: 'daily_offer_feed_written', path: OUT, amazon_offers: amazon.length, skimlinks_status: skim.status, skimlinks_offers: skim.offers.length, stay22_status: stay22.status, stay22_offers: stay22.offers.length, total_offers: feed.offers.length }, null, 2));
