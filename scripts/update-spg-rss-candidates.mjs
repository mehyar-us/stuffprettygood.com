import { readFileSync, writeFileSync } from 'node:fs';
import { trendOfferLanes } from '../src/spg/trending-offers.js';

const blockedPatterns = [/guaranteed/i, /#1/i, /miracle/i, /cure/i, /get rich/i, /casino/i, /cannabis/i, /debt relief/i, /loan approval/i, /password=/i, /token=/i, /email=/i];
const commerceRisk = /\$\d|\d+% off|lowest price|best price|price drop|free shipping/i;
function slugify(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); }
function dedupeKey(item) { try { const u = new URL(item.url); return `${u.hostname}${u.pathname}`.toLowerCase(); } catch { return `${item.source_id}:${item.title}`.toLowerCase(); } }
function matchLanes(item) {
  const hay = `${item.title} ${item.summary_excerpt || ''}`.toLowerCase();
  return trendOfferLanes.filter((lane) => [lane.seed, lane.title, ...(lane.queries || [])].some((q)=> hay.includes(String(q).toLowerCase().split(' ').slice(0,3).join(' ')))).map((lane)=>lane.slug).slice(0,4);
}
function originalNote(item, matched) {
  const laneText = matched.length ? ` It may connect to ${matched.join(', ')} coverage.` : ' It may become a future guide or daily-picks item if it fits the audience.';
  return `Source signal from ${item.source_name}: worth reviewing for StuffPrettyGood coverage.${laneText} Check the original source; this is not a price, ranking, or endorsement claim.`;
}
function score(item, matched) {
  let n = 20 + matched.length * 20;
  if (/deal|save|discount|offer|launch|new|best|guide|gift|tool|ai|home|travel/i.test(item.title)) n += 20;
  if (item.category === 'safety') n += 8;
  if (item.category === 'deals') n += 12;
  return Math.min(n, 100);
}
const inputPath = process.argv[2] || 'data/spg-rss-snapshot.json';
const outputPath = process.argv[3] || 'data/spg-rss-candidates.json';
const snapshot = JSON.parse(readFileSync(inputPath, 'utf8'));
const seen = new Set();
const candidates = [];
const quarantined = [];
for (const item of snapshot.items || []) {
  const key = dedupeKey(item);
  if (seen.has(key)) continue;
  seen.add(key);
  const flags = blockedPatterns.filter((re)=>re.test(`${item.title} ${item.url}`)).map((re)=>`blocked_pattern:${re.source}`);
  if (commerceRisk.test(item.title)) flags.push('commerce_claim_rewrite_required');
  const matched = matchLanes(item);
  const candidate = { id: slugify(`${item.source_id}-${item.title}`), source_id: item.source_id, source_name: item.source_name, category: item.category, safe_title: item.title.replace(/\$\d[\d,.]*/g, 'current offer').replace(/\d+% off/ig, 'discounted'), url: item.url, published_at: item.published_at, matched_lanes: matched, score: score(item, matched), risk_flags: flags, original_note: originalNote(item, matched), generated_at: new Date().toISOString() };
  if (flags.some((f)=>f.startsWith('blocked_pattern'))) quarantined.push(candidate); else candidates.push(candidate);
}
candidates.sort((a,b)=>b.score-a.score);
const output = { generated_at: new Date().toISOString(), guardrails: snapshot.guardrails || [], candidates: candidates.slice(0, 40), quarantined: quarantined.slice(0, 40) };
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ status: 'rss_candidates_updated', candidates: output.candidates.length, quarantined: output.quarantined.length }, null, 2));
