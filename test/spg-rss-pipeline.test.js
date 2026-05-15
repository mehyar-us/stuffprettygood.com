import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseFeed } from '../scripts/fetch-spg-rss.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('SPG RSS source registry is reviewed, enabled-safe, and avoids Amazon scraping', () => {
  const registry = readJson('data/spg-rss-source-registry.json');
  assert.ok(registry.sources.length >= 6);
  assert.ok(registry.guardrails.some((rule) => /no_amazon_scraping/i.test(rule)));
  for (const source of registry.sources.filter((item) => item.enabled)) {
    assert.match(source.feed_url, /^https:\/\//);
    assert.ok(source.terms_url);
    assert.ok(source.reviewed_at);
    assert.ok(source.owner);
    assert.notEqual(source.risk, 'blocked');
    assert.doesNotMatch(source.feed_url, /amazon\.com/i);
    assert.ok(['metadata_only', 'short_excerpt', 'original_summary_only'].includes(source.allowed_use));
  }
});

test('RSS parser normalizes RSS and Atom feeds without copying full content', () => {
  const source = { id: 'fixture', name: 'Fixture Feed', category: 'tools', allowed_use: 'metadata_only', homepage_url: 'https://example.com' };
  const rssItems = parseFeed('<rss><channel><item><title>Useful AI tool launch</title><link>https://example.com/a</link><description>Long body should not copy</description><pubDate>Fri, 15 May 2026 12:00:00 GMT</pubDate></item></channel></rss>', source);
  assert.equal(rssItems.length, 1);
  assert.equal(rssItems[0].title, 'Useful AI tool launch');
  assert.equal(rssItems[0].summary_excerpt, '');
  const atomItems = parseFeed('<feed><entry><title>Compact travel gear</title><link href="https://example.com/b"/><updated>2026-05-15</updated></entry></feed>', source);
  assert.equal(atomItems.length, 1);
  assert.equal(atomItems[0].url, 'https://example.com/b');
});

test('SPG RSS candidates and generated daily page preserve safe attribution/disclosure', () => {
  const candidates = readJson('data/spg-rss-candidates.json');
  assert.ok(candidates.candidates.length >= 1);
  for (const item of candidates.candidates) {
    assert.ok(item.source_name);
    assert.ok(item.original_note);
    assert.doesNotMatch(JSON.stringify(item), /password=|token=|email=/i);
    assert.doesNotMatch(item.safe_title, /\$\d[\d,.]*|\d+% off/i);
  }
  assert.ok(existsSync(new URL('../public/daily.html', import.meta.url)));
  const daily = readText('public/daily.html');
  assert.match(daily, /Daily public source signals/i);
  assert.match(daily, /Affiliate disclosure/i);
  assert.match(daily, /Privacy/i);
  assert.match(daily, /Unsubscribe/i);
  assert.doesNotMatch(daily, /copied merchant prices|copied Amazon/i);
});

test('SEO files exist for StuffPrettyGood public brand', () => {
  assert.ok(existsSync(new URL('../public/robots.txt', import.meta.url)));
  assert.ok(existsSync(new URL('../public/sitemap.xml', import.meta.url)));
  const sitemap = readText('public/sitemap.xml');
  for (const route of ['/index.html', '/today.html', '/trends.html', '/daily.html']) {
    assert.match(sitemap, new RegExp(`https://stuffprettygood\\.com${route.replace('.', '\\.')}`));
  }
});
