#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PRODUCT_PATH = path.join(ROOT, 'data', 'products.json');
const INBOX_PATH = path.join(ROOT, 'data', 'sitestripe-inbox.json');
const TAG = process.env.SPG_AMAZON_ASSOCIATES_TAG || process.env.AMAZON_ASSOCIATES_TAG || 'mehyarmedia-20';

function fail(message) {
  console.error(`sitestripe import failed: ${message}`);
  process.exit(1);
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeEntries(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.entries)) return raw.entries;
  return [raw];
}

function extractAsin(value = '') {
  const text = String(value);
  const patterns = [/\/dp\/([A-Z0-9]{10})/i, /\/gp\/product\/([A-Z0-9]{10})/i, /[?&]ASIN=([A-Z0-9]{10})/i, /[?&]asin=([A-Z0-9]{10})/i];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

function assertAffiliateLink(url, id) {
  if (!url || typeof url !== 'string') fail(`${id}: missing SiteStripe text link`);
  let parsed;
  try { parsed = new URL(url); } catch { fail(`${id}: invalid URL`); }
  if (!parsed.hostname.includes('amazon.') && parsed.hostname !== 'amzn.to') {
    fail(`${id}: SiteStripe link must be amazon/amzn.to, got ${parsed.hostname}`);
  }
  if (!url.includes(`tag=${TAG}`)) fail(`${id}: link missing tag=${TAG}`);
  if (!url.includes('linkCode=') && !url.includes('/dp/')) fail(`${id}: link does not look like SiteStripe or product URL`);
  return url;
}

function cleanEmbed(html, id) {
  if (!html) return '';
  const text = String(html).trim();
  if (!text) return '';
  if (!text.includes(`tag=${TAG}`)) fail(`${id}: embed missing tag=${TAG}`);
  if (!/amazon\.|amzn\.to|ir-na\.amazon-adsystem\.com/i.test(text)) {
    fail(`${id}: embed does not look Amazon-provided`);
  }
  if (/<script\b/i.test(text)) fail(`${id}: SiteStripe embed with script is blocked for safety; use iframe/img/a embed only`);
  if (/onerror=|onload=|javascript:/i.test(text)) fail(`${id}: unsafe HTML in embed`);
  return text;
}

const catalog = readJson(PRODUCT_PATH);
if (!catalog?.products) fail('data/products.json missing products array');

const entries = normalizeEntries(readJson(INBOX_PATH));
if (!entries.length) fail('no entries found in data/sitestripe-inbox.json');

const byId = new Map(catalog.products.map((product) => [product.id, product]));
let updated = 0;

for (const entry of entries) {
  const id = entry.product_id || entry.id;
  if (!id) fail('entry missing product_id');
  const product = byId.get(id);
  if (!product) fail(`${id}: product not found in catalog`);

  const link = assertAffiliateLink(entry.sitestripe_text_link || entry.affiliate_url, id);
  const embed = cleanEmbed(entry.sitestripe_embed_html || entry.sitestripe_image_html || '', id);
  const asin = (entry.asin || extractAsin(link) || extractAsin(embed) || '').toUpperCase();

  product.affiliate_url = link;
  product.asin = asin || product.asin || null;
  product.link_source = 'amazon_sitestripe';
  product.link_checked_at = new Date().toISOString();

  if (embed) {
    product.sitestripe_embed_html = embed;
    product.image_status = 'approved_affiliate_embed';
    product.image_source = 'amazon_sitestripe';
    product.image_checked_at = new Date().toISOString();
  }

  updated += 1;
}

fs.writeFileSync(PRODUCT_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Imported ${updated} SiteStripe entr${updated === 1 ? 'y' : 'ies'} into data/products.json`);
