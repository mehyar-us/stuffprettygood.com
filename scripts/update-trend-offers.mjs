import { readFileSync, writeFileSync } from 'node:fs';
import { trendOfferLanes as currentLanes } from '../src/spg/trending-offers.js';

const snapshotPath = process.argv[2] || 'data/google-trends-snapshot.json';
const outPath = process.argv[3] || 'src/spg/trending-offers.js';
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const bySeed = new Map((snapshot.seeds || []).map((entry) => [entry.seed, entry]));

const nextLanes = currentLanes.map((lane) => {
  const fresh = bySeed.get(lane.seed);
  if (!fresh) return lane;
  return {
    ...lane,
    momentumPct: fresh.momentum?.momentumPct ?? lane.momentumPct ?? null,
    latest: fresh.momentum?.latest ?? lane.latest ?? null,
    trendUpdatedAt: snapshot.generatedAt,
    queries: (fresh.related || [])
      .map((row) => row.query)
      .filter(Boolean)
      .filter((query, index, arr) => arr.indexOf(query) === index)
      .slice(0, 8),
  };
});

writeFileSync(outPath, `export const trendOfferLanes = ${JSON.stringify(nextLanes, null, 2)};\n`, 'utf8');
console.log(JSON.stringify({ status: 'updated', outPath, lanes: nextLanes.length, snapshot: snapshot.generatedAt }, null, 2));
