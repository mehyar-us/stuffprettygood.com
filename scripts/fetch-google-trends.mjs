#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const apiKey = process.env.SERP_API_KEY || process.env.SERPAPI_API_KEY;
const seeds = [
  'AI note taker',
  'portable power station',
  'red light therapy',
  'air purifier',
  'walking pad',
  'meal prep containers',
  'dog GPS tracker',
  'robot vacuum',
  'eSIM travel',
  'sleep bonnet',
  'indoor garden kit',
];
const outPath = process.argv[2] || 'data/google-trends-snapshot.json';

async function serp(params) {
  if (!apiKey) throw new Error('Missing SERP_API_KEY / SERPAPI_API_KEY');
  const url = new URL('https://serpapi.com/search.json');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('api_key', apiKey);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || `SerpAPI HTTP ${res.status}`);
  return json;
}

function summarizeRelated(json) {
  const ranked = [];
  const related = json.related_queries || {};
  for (const bucket of ['rising', 'top']) {
    const rows = related[bucket] || [];
    for (const row of rows.slice(0, 8)) {
      ranked.push({ bucket, query: row.query, value: row.value || row.extracted_value || row.link || null });
    }
  }
  return ranked.slice(0, 12);
}

function summarizeTimeline(json) {
  const timeline = json.interest_over_time?.timeline_data || [];
  const values = timeline.map((row) => Number(row.values?.[0]?.extracted_value ?? row.values?.[0]?.value ?? 0)).filter(Number.isFinite);
  if (!values.length) return { points: 0, latest: null, first4Avg: null, last4Avg: null, momentumPct: null };
  const first = values.slice(0, 4);
  const last = values.slice(-4);
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const first4Avg = avg(first);
  const last4Avg = avg(last);
  const momentumPct = first4Avg ? Math.round(((last4Avg - first4Avg) / first4Avg) * 100) : null;
  return { points: values.length, latest: values.at(-1), first4Avg: Math.round(first4Avg), last4Avg: Math.round(last4Avg), momentumPct };
}

const snapshot = {
  source: 'SerpAPI Google Trends',
  geo: 'US',
  date: 'today 12-m',
  generatedAt: new Date().toISOString(),
  seeds: [],
  guardrails: [
    'Use trends as editorial/offer discovery signals, not as proof of product quality.',
    'Do not scrape Amazon prices/images/reviews; use manual Associates links only until PA-API access exists.',
    'Outbound email/SMS remains blocked until compliance gates approve explicit cohorts.',
  ],
};

for (const seed of seeds) {
  const [related, timeseries] = await Promise.all([
    serp({ engine: 'google_trends', q: seed, geo: 'US', date: 'today 12-m', data_type: 'RELATED_QUERIES' }),
    serp({ engine: 'google_trends', q: seed, geo: 'US', date: 'today 12-m', data_type: 'TIMESERIES' }),
  ]);
  snapshot.seeds.push({ seed, related: summarizeRelated(related), momentum: summarizeTimeline(timeseries) });
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({ status: 'wrote', outPath, seeds: snapshot.seeds.length, generatedAt: snapshot.generatedAt }, null, 2));
