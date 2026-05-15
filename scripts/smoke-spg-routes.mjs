import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const publicDir = new URL('../public', import.meta.url).pathname;
const args = process.argv.slice(2);
const baseUrlArg = args.find((arg) => arg.startsWith('--base-url='))?.split('=').slice(1).join('=');
const baseUrl = normalizeBaseUrl(baseUrlArg || process.env.SPG_LIVE_BASE_URL || '');

const failures = [];
const evidence = [];
const read = (file) => readFileSync(join(publicDir, file.replace(/^\//, '')), 'utf8');
const exists = (file) => existsSync(join(publicDir, file.replace(/^\//, '')));

function localSmoke() {
  assertLocal('/index.html', /href="\/offers\//, 'homepage contains offer landing links');
  assertLocal('/index.html', /sign\s*up|signup|email|preference/i, 'homepage renders signup/preference capture');
  assertLocal('/preferences.html', /preference|topic|consent/i, 'preferences page renders preference controls/copy');
  assertLocal('/unsubscribe.html', /unsubscribe|never resubscribe|opt out/i, 'unsubscribe page renders unsubscribe controls/copy');
  assertLocal('/privacy.html', /privacy|personal information|data/i, 'privacy page renders compliance copy');
  assertLocal('/terms.html', /terms|acceptable use|agreement/i, 'terms page renders compliance copy');
  assertLocal('/affiliate-disclosure.html', /affiliate disclosure|commission|may earn/i, 'affiliate disclosure page renders monetization disclosure');
  assertLocal('/robots.txt', /Sitemap: https:\/\/stuffprettygood\.com\/sitemap\.xml/i, 'robots.txt points to sitemap');
  assertLocal('/sitemap.xml', /<loc>https:\/\/stuffprettygood\.com\/offers\//i, 'sitemap includes approved offer landing pages');

  const slugs = chooseOfferSlugs();
  for (const slug of slugs) {
    assertLocal(`/offers/${slug}.html`, new RegExp(`href="/go/${escapeRegExp(slug)}\\.html"`), `offer landing ${slug} links to paired /go route`);
    assertLocal(`/offers/${slug}.html`, /Before you click|Affiliate disclosure|may earn/i, `offer landing ${slug} includes disclosure`);
    assertLocal(`/offers/${slug}.html`, /sign\s*up|signup|email|preference/i, `offer landing ${slug} includes signup/preference capture`);
    assertLocal(`/offers/${slug}.html`, /href="\/preferences\.html"[\s\S]*href="\/unsubscribe\.html"|href="\/unsubscribe\.html"[\s\S]*href="\/preferences\.html"/i, `offer landing ${slug} includes preferences and unsubscribe links`);
    assertLocal(`/go/${slug}.html`, /Disclosure bridge|href="https?:\/\//i, `paired /go/${slug} route renders redirect bridge`);
  }
  return slugs;
}

async function liveSmoke(slugs) {
  if (!baseUrl) {
    evidence.push({ mode: 'local_static_smoke_only', note: 'Set SPG_LIVE_BASE_URL or pass --base-url=https://domain to run live smoke.' });
    return;
  }

  await assertFetch('/', { status: [200], includes: [/href="\/offers\//i, /sign\s*up|signup|email|preference/i], label: 'live homepage contains offer landing links and signup capture' });
  for (const slug of slugs) {
    await assertFetch(`/offers/${slug}.html`, { status: [200], includes: [new RegExp(`href="/go/${escapeRegExp(slug)}\\.html"`), /Before you click|Affiliate disclosure|may earn/i, /sign\s*up|signup|email|preference/i], label: `live offer landing ${slug}` });
    await assertFetch(`/go/${slug}.html`, { status: [200, 301, 302, 303, 307, 308], includes: [/Disclosure bridge|href="https?:\/\//i], label: `live /go/${slug} redirect/bridge`, allowRedirectStatus: true });
  }
  await assertFetch('/preferences.html', { status: [200], includes: [/preference|topic|consent/i], label: 'live preferences page' });
  await assertFetch('/unsubscribe.html', { status: [200], includes: [/unsubscribe|opt out|never resubscribe/i], label: 'live unsubscribe page' });
  await assertFetch('/privacy.html', { status: [200], includes: [/privacy|personal information|data/i], label: 'live privacy page' });
  await assertFetch('/terms.html', { status: [200], includes: [/terms|acceptable use|agreement/i], label: 'live terms page' });
  await assertFetch('/affiliate-disclosure.html', { status: [200], includes: [/affiliate disclosure|commission|may earn/i], label: 'live affiliate disclosure page' });
  await assertFetch('/robots.txt', { status: [200], includes: [/Sitemap:/i], label: 'live robots.txt' });
  await assertFetch('/sitemap.xml', { status: [200], includes: [/<urlset/i, /\/offers\//i], label: 'live sitemap.xml' });
}

function chooseOfferSlugs() {
  const offersDir = join(publicDir, 'offers');
  if (!existsSync(offersDir)) throw new Error('public/offers directory is missing');
  const slugs = readdirSync(offersDir).filter((name) => name.endsWith('.html')).map((name) => name.replace(/\.html$/, '')).sort();
  const amazonSlug = slugs.find((candidate) => candidate.startsWith('amazon-') && exists(`/go/${candidate}.html`));
  const nonAmazonSlug = slugs.find((candidate) => !candidate.startsWith('amazon-') && exists(`/go/${candidate}.html`));
  const sampled = [...new Set([amazonSlug, nonAmazonSlug].filter(Boolean))];
  if (sampled.length === 0) throw new Error('no offer landing has a paired /go route');
  return sampled;
}

function assertLocal(file, pattern, label) {
  if (!exists(file)) {
    failures.push(`${file}: missing local file for ${label}`);
    return;
  }
  const body = read(file);
  if (!pattern.test(body)) failures.push(`${file}: failed local smoke - ${label}`);
  else evidence.push({ route: file, mode: 'local_static', label });
}

async function assertFetch(route, { status, includes = [], label, allowRedirectStatus = false }) {
  const url = new URL(route, baseUrl).toString();
  let response;
  let body = '';
  try {
    response = await fetch(url, { redirect: allowRedirectStatus ? 'manual' : 'follow' });
    body = await response.text().catch(() => '');
  } catch (error) {
    failures.push(`${route}: live fetch failed for ${label}: ${error.message}`);
    return;
  }
  if (!status.includes(response.status)) failures.push(`${route}: expected live status ${status.join('/')} for ${label}, got ${response.status}`);
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location') || '';
    if (!location) failures.push(`${route}: redirect status missing Location header`);
    evidence.push({ route, mode: 'live', status: response.status, label, location_host: safeHost(location) });
    return;
  }
  for (const pattern of includes) if (!pattern.test(body)) failures.push(`${route}: live body failed smoke - ${label}`);
  evidence.push({ route, mode: 'live', status: response.status, label });
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function safeHost(value) {
  try { return new URL(value, baseUrl || 'https://stuffprettygood.com').hostname; } catch { return '(unparseable)'; }
}

const sampledSlugs = localSmoke();
await liveSmoke(sampledSlugs);

if (failures.length) {
  console.error(`SPG smoke failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'spg_smoke_passed',
  sampled_slugs: sampledSlugs,
  live_base_url: baseUrl || null,
  checks: evidence.length,
  evidence,
}, null, 2));
