import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const publicDir = new URL('../public', import.meta.url).pathname;
const amazonFirstOnly = process.env.SPG_AFFILIATE_ONLY_AMAZON_FIRST !== '0';

const fail = (message) => {
  throw new Error(message);
};

const read = (path) => readFileSync(path, 'utf8');

const walkHtml = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(path));
    if (entry.isFile() && entry.name.endsWith('.html')) out.push(path);
  }
  return out;
};

const normalizeRoute = (filePath) => `/${relative(publicDir, filePath).replaceAll('\\\\', '/')}`;

const externalOfferHosts = [
  'amazon.com',
  'amzn.to',
  'skimlinks.com',
  'go.skimresources.com',
  'stay22.com',
  'sovrn.com',
  'viglink.com',
  'sharesale.com',
  'shareasale.com',
  'impact.com',
  'impactradius.com',
  'flexoffers.com',
  'ebay.com',
  'walmart.com',
  'target.com',
  'etsy.com',
  'aliexpress.com',
];

const cardPattern = /<article\b[^>]*class="[^"]*\bcard\b[^"]*"[\s\S]*?<\/article>/g;
const hrefPattern = /href="([^"]+)"/g;

const allHtmlFiles = walkHtml(publicDir);
const failures = [];
let checkedCards = 0;
let checkedOfferPages = 0;

for (const file of allHtmlFiles) {
  const page = read(file);
  const route = normalizeRoute(file);
  if (route.startsWith('/go/')) continue;

  const cardBlocks = [...page.matchAll(cardPattern)].map((match) => match[0]);

  for (const block of cardBlocks) {
    checkedCards += 1;
    const key = block.match(/data-offer-key="([^"]+)"/)?.[1] || block.match(/href="\/offers\/([^"/]+)\.html"/)?.[1];
    const hrefs = [...block.matchAll(hrefPattern)].map((match) => match[1]);
    const offerLinks = hrefs.filter((href) => href.startsWith('/offers/'));
    const requiresOfferLanding = /\b(?:offer-card|product-card)\b/.test(block) || hrefs.some((href) => href.startsWith('/offers/') || href.startsWith('/go/'));

    if (requiresOfferLanding && offerLinks.length === 0) {
      failures.push(`${route}: offer card ${key || '(unknown)'} has no /offers/<slug>.html link`);
    }

    for (const href of hrefs) {
      if (href.startsWith('/go/')) failures.push(`${route}: offer card ${key || '(unknown)'} links directly to ${href}`);
      if (/^https?:\/\//i.test(href)) {
        const host = new URL(href).hostname.replace(/^www\./, '');
        if (externalOfferHosts.some((blockedHost) => host === blockedHost || host.endsWith(`.${blockedHost}`))) {
          failures.push(`${route}: offer card ${key || '(unknown)'} links directly to external monetized host ${href}`);
        }
      }
    }
  }
}

const offersDir = join(publicDir, 'offers');
if (!existsSync(offersDir)) fail('public/offers directory is missing');

const offerPages = walkHtml(offersDir);
if (offerPages.length === 0) fail('no /offers pages generated');

for (const file of offerPages) {
  checkedOfferPages += 1;
  const route = normalizeRoute(file);
  const slug = route.match(/^\/offers\/(.+)\.html$/)?.[1];
  const page = read(file);
  const goRoute = `/go/${slug}.html`;
  const goFile = join(publicDir, 'go', `${slug}.html`);

  if (!slug) failures.push(`${route}: could not infer slug`);
  if (amazonFirstOnly && slug && !slug.startsWith('amazon-')) failures.push(`${route}: non-Amazon offer page generated during Amazon-first mode`);
  if (!existsSync(goFile)) failures.push(`${route}: missing paired ${goRoute}`);
  if (!page.includes(goRoute)) failures.push(`${route}: missing outbound CTA to ${goRoute}`);
  if (!/Affiliate disclosure|may earn|sponsored|commission/i.test(page)) failures.push(`${route}: missing affiliate/sponsor disclosure copy`);
  if (!/Before you click|disclosure/i.test(page)) failures.push(`${route}: missing before-click disclosure block`);
  if (!/href="\/preferences\.html"/.test(page)) failures.push(`${route}: missing preferences link`);
  if (!/href="\/unsubscribe\.html"/.test(page)) failures.push(`${route}: missing unsubscribe link`);
  if (!/href="\/privacy\.html"/.test(page)) failures.push(`${route}: missing privacy link`);
  if (!/href="\/terms\.html"/.test(page)) failures.push(`${route}: missing terms link`);
  if (!/<title>[^<]+<\/title>/i.test(page)) failures.push(`${route}: missing title tag`);
  if (!/<meta\s+name="description"\s+content="[^"]+"/i.test(page)) failures.push(`${route}: missing meta description`);
  if (!/<link\s+rel="canonical"\s+href="[^"]+\/offers\//i.test(page)) failures.push(`${route}: missing canonical /offers URL`);
  if (!/application\/ld\+json/i.test(page)) failures.push(`${route}: missing JSON-LD schema`);

  const goLinks = [...page.matchAll(hrefPattern)].map((match) => match[1]).filter((href) => href.startsWith('/go/'));
  const badGoLinks = goLinks.filter((href) => href !== goRoute);
  if (badGoLinks.length) failures.push(`${route}: has /go links for another slug: ${badGoLinks.join(', ')}`);
}

if (failures.length) {
  console.error(`SPG offer QA failed with ${failures.length} issue(s):`);
  for (const issue of failures) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`SPG offer QA passed: ${checkedCards} offer cards and ${checkedOfferPages} offer landing pages verified.`);
