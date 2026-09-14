#!/usr/bin/env node
// Sync real product images from the live SPG API catalog into the static
// data/products.json. A static product is upgraded only when the live catalog
// has the SAME product id with a real, approved image (never a generated
// fallback). Safe to run at build time: never fails the build, never invents
// images, never touches affiliate URLs.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PRODUCT_PATH = path.join(ROOT, 'data', 'products.json');
const API = process.env.SPG_API_BASE || 'https://stuffprettygood-api.mehyar.workers.dev';
const REAL_STATUSES = new Set(['sitestripe', 'approved_real', 'merchant_feed', 'paapi', 'licensed', 'site_verified', 'approved_affiliate_or_licensed']);

function isRealImageUrl(u) {
  return typeof u === 'string' && /^https:\/\//.test(u) && !u.includes('/api/images/');
}

async function main() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(PRODUCT_PATH, 'utf8'));
  } catch (e) {
    console.log('sync-live-images: products.json unreadable, skipping');
    return;
  }
  const products = data.products || [];
  let live;
  try {
    const res = await fetch(`${API}/api/catalog?limit=300`);
    if (!res.ok) throw new Error(`http ${res.status}`);
    live = await res.json();
  } catch (e) {
    console.log(`sync-live-images: live catalog unreachable (${e.message}), keeping static images`);
    return;
  }
  const byId = new Map((live.products || []).map((p) => [p.id, p]));
  let upgraded = 0;
  for (const p of products) {
    const row = byId.get(p.id);
    if (!row) continue;
    if (REAL_STATUSES.has(row.image_status) && isRealImageUrl(row.image_url)) {
      if (p.image_url !== row.image_url) {
        p.image_url = row.image_url;
        p.image_status = row.image_status;
        p.image_source = row.image_source || p.image_source;
        upgraded++;
      }
    }
  }
  if (upgraded) {
    fs.writeFileSync(PRODUCT_PATH, JSON.stringify(data, null, 2) + '\n');
    console.log(`sync-live-images: upgraded ${upgraded} product images from the live catalog`);
  } else {
    console.log('sync-live-images: no upgrades available (live catalog has no new real images for static ids)');
  }
}

main();
