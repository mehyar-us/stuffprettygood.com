#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const baseUrl = (args.find((arg) => arg.startsWith('--base-url='))?.split('=')[1] || process.env.SPG_LIVE_BASE_URL || 'https://stuffprettygood.com').replace(/\/$/, '');
const feedPath = resolve(process.cwd(), 'data/spg-daily-offer-feed.json');
const failures = [];
const evidence = [];

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function pickOffer(offers, source) {
  return offers.find((offer) => String(offer.source || offer.provider || '').toLowerCase().includes(source) && offer.slug);
}

function safeSnippet(text) {
  return String(text || '').replace(/\s+/g, ' ').slice(0, 160);
}

async function fetchRoute(route, opts = {}) {
  const url = `${baseUrl}${route}`;
  const response = await fetch(url, { redirect: opts.redirect || 'manual' });
  const body = await response.text();
  evidence.push({ route, status: response.status, bytes: body.length, location_host: response.headers.get('location') ? new URL(response.headers.get('location'), baseUrl).host : null });
  return { response, body, url };
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const feed = readJson(feedPath, {});
const offers = Array.isArray(feed.offers) ? feed.offers : Array.isArray(feed.items) ? feed.items : [];
const amazon = pickOffer(offers, 'amazon') || offers.find((offer) => String(offer.slug || '').startsWith('amazon-'));

const home = await fetchRoute('/');
assert(home.response.status === 200, `homepage expected 200 got ${home.response.status}`);
assert(/data-surface="amazon-trend-wall"|Amazon Trend Wall/i.test(home.body), 'homepage missing Amazon Trend Wall marker');
assert(/href="\/offers\//i.test(home.body), 'homepage missing offer links');
const wall = home.body.match(/<section[^>]+amazon-trend-wall[\s\S]*?<\/section>/i)?.[0] || '';
assert(wall && !/href="\/go\//i.test(wall), 'Amazon Trend Wall should link to offer pages, not direct /go routes');

for (const [label, offer] of [['amazon', amazon]]) {
  if (!offer?.slug) {
    failures.push(`missing local ${label} offer slug in daily feed`);
    continue;
  }
  const offerRoute = `/offers/${offer.slug}.html`;
  const goRoute = `/go/${offer.slug}.html`;
  const offerPage = await fetchRoute(offerRoute);
  assert(offerPage.response.status === 200, `${label} offer page ${offerRoute} expected 200 got ${offerPage.response.status}`);
  assert(offerPage.body.includes(`/go/${offer.slug}.html`), `${label} offer page ${offerRoute} missing matching /go link; snippet=${safeSnippet(offerPage.body)}`);
  assert(!/<title>\s*StuffPrettyGood\s*<\/title>|canonical" href="https?:\/\/[^/]+\/index\.html/i.test(offerPage.body), `${label} offer page ${offerRoute} looks like homepage fallback`);
  assert(/Affiliate disclosure|Before you click|may earn/i.test(offerPage.body), `${label} offer page ${offerRoute} missing disclosure copy`);

  const goPage = await fetchRoute(goRoute);
  assert([200, 301, 302, 303, 307, 308].includes(goPage.response.status), `${label} go route ${goRoute} bad status ${goPage.response.status}`);
  if (goPage.response.status === 200) {
    assert(/Disclosure bridge|href="https?:\/\//i.test(goPage.body), `${label} go route ${goRoute} missing disclosure/outbound link; snippet=${safeSnippet(goPage.body)}`);
    assert(!/<title>\s*StuffPrettyGood\s*<\/title>|canonical" href="https?:\/\/[^/]+\/index\.html/i.test(goPage.body), `${label} go route ${goRoute} looks like homepage fallback`);
  }
}

for (const route of ['/affiliate-disclosure.html', '/preferences.html', '/sitemap.xml', '/robots.txt']) {
  const page = await fetchRoute(route);
  assert(page.response.status === 200, `${route} expected 200 got ${page.response.status}`);
}

if (failures.length) {
  console.error(JSON.stringify({ status: 'strict_spg_live_smoke_failed', base_url: baseUrl, evidence, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'strict_spg_live_smoke_passed', base_url: baseUrl, evidence }, null, 2));
