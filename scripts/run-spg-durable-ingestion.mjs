import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { SpgDurableStore } from '../src/spg/durable-store.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run') || process.env.SPG_INGEST_DRY_RUN === '1';
const maxItemsPerSource = Number.parseInt(process.env.SPG_MAX_ITEMS_PER_SOURCE || '20', 10) || 20;
const storePath = process.env.SPG_DURABLE_STORE_PATH || 'data/spg-durable-store.json';
const feedPath = process.env.SPG_DAILY_OFFER_FEED_PATH || 'data/spg-monetized-offer-sample-feed.json';

loadEnvFile('/home/mehya/.hermes/.env');
loadEnvFile('/home/mehya/.hermes/projects/stuffprettygood-com/.env');

const store = new SpgDurableStore({ path: storePath });
const before = {
  sourceItems: store.state.source_items.length,
  candidates: store.state.offer_candidates.length,
  offers: store.state.offers.length,
  placements: store.state.page_placements.length,
};

const result = store.runIngestion(
  { dry_run: dryRun, max_items_per_source: maxItemsPerSource, feed_path: feedPath },
  { actorId: 'spg-daily-ingestion-job' }
);

const after = {
  sourceItems: store.state.source_items.length,
  candidates: store.state.offer_candidates.length,
  offers: store.state.offers.length,
  placements: store.state.page_placements.length,
};

if (!dryRun && !existsSync(resolve(process.cwd(), storePath))) {
  throw new Error(`durable store was not written at ${storePath}`);
}

const publicRoutePairs = result.offers.slice(0, 8).map((offer) => ({
  slug: offer.offer_key,
  landing: offer.public_landing_url,
  redirect: offer.redirect_url,
}));

const storeBytes = !dryRun && existsSync(resolve(process.cwd(), storePath)) ? statSync(resolve(process.cwd(), storePath)).size : 0;

console.log(JSON.stringify({
  status: dryRun ? 'dry_run_complete' : 'durable_ingestion_complete',
  store_path: storePath,
  feed_path: feedPath,
  store_bytes: storeBytes,
  max_items_per_source: maxItemsPerSource,
  before,
  after,
  delta: {
    sourceItems: after.sourceItems - before.sourceItems,
    candidates: after.candidates - before.candidates,
    offers: after.offers - before.offers,
    placements: after.placements - before.placements,
  },
  source_count: result.source_count,
  source_item_count: result.source_item_count,
  candidate_count: result.candidate_count,
  offer_record_count: result.offer_record_count,
  public_rows_published: result.public_rows_published,
  quarantined_count: result.quarantined_count,
  source_keys: result.source_keys,
  blocked_side_effects: result.blocked_side_effects,
  public_route_pairs: publicRoutePairs,
}, null, 2));

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] === undefined) process.env[key] = rest.join('=').replace(/^['\"]|['\"]$/g, '');
  }
}
