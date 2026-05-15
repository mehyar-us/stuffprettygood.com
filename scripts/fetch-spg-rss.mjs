import { readFileSync, writeFileSync } from 'node:fs';

export function stripTags(value = '') { return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
export function decodeEntities(value = '') { return String(value).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
function first(block, names) { for (const name of names) { const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'); const m = block.match(re); if (m) return decodeEntities(stripTags(m[1])); } return ''; }
function attrLink(block) { const m = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i); return m ? decodeEntities(m[1]) : ''; }
function validUrl(url) { try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol); } catch { return false; } }
export function parseFeed(xml, source) {
  const text = String(xml || '');
  const blocks = [...text.matchAll(/<item[\s\S]*?<\/item>/gi)].map((m)=>m[0]);
  const atomBlocks = blocks.length ? [] : [...text.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((m)=>m[0]);
  const raw = blocks.length ? blocks : atomBlocks;
  return raw.slice(0, 30).map((block) => {
    const title = first(block, ['title']);
    const url = first(block, ['link']) || attrLink(block) || first(block, ['guid', 'id']);
    const published = first(block, ['pubDate','published','updated','dc:date']);
    const summary = source.allowed_use === 'short_excerpt' ? first(block, ['description','summary','content:encoded']).slice(0, 240) : '';
    return { source_id: source.id, source_name: source.name, category: source.category, title, url: validUrl(url) ? url : source.homepage_url, published_at: published || null, summary_excerpt: summary, terms_allowed_use: source.allowed_use, matched_lanes: [], risk_flags: [], fetched_at: new Date().toISOString() };
  }).filter((item)=>item.title && item.url);
}

async function main() {
  const registryPath = process.argv[2] || 'data/spg-rss-source-registry.json';
  const outputPath = process.argv[3] || 'data/spg-rss-snapshot.json';
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const items = [];
  const errors = [];
  for (const source of registry.sources.filter((s)=>s.enabled && s.risk !== 'blocked')) {
    try {
      const res = await fetch(source.feed_url, { headers: { 'user-agent': 'StuffPrettyGoodBot/1.0 (+https://stuffprettygood.com)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      items.push(...parseFeed(xml, source));
    } catch (error) { errors.push({ source_id: source.id, message: error.message }); }
  }
  const snapshot = { generated_at: new Date().toISOString(), source_count: registry.sources.length, item_count: items.length, guardrails: registry.guardrails, items, errors };
  writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'rss_fetched', item_count: items.length, error_count: errors.length }, null, 2));
}
if (import.meta.url === `file://${process.argv[1]}`) main();
