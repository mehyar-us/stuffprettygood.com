import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { trendOfferLanes } from '../src/spg/trending-offers.js';
import { amazonSearchUrl, AMAZON_ASSOCIATES_TAG, getLaneTargets, laneSeo, riskCopy } from '../src/spg/trend-components.js';

const outDir = new URL('../public', import.meta.url).pathname;
const write = (file, html) => {
  mkdirSync(dirname(join(outDir, file)), { recursive: true });
  writeFileSync(join(outDir, file), html, 'utf8');
};
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const absolute = (path) => `https://stuffprettygood.com${path}`;

const nav = `<nav class="nav" aria-label="Primary">
  <a class="brand" href="/index.html">StuffPrettyGood</a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links">Menu</button>
  <div id="nav-links" class="nav-links">
    <a href="/trends.html">Trending Offers</a>
    <a href="/ai-tool-stack-quiz.html">Quiz</a>
    <a href="/tools-by-job/index.html">Tools by Job</a>
    <a href="/starter-kits/solopreneur-automation.html">Starter Kit</a>
    <a href="/deals.html">Deals</a>
    <a href="/preferences.html">Preferences</a>
    <a class="nav-cta" href="/trends.html">See trends</a>
  </div>
</nav>`;

const footer = `<footer class="footer">
  <section class="disclosure" data-crm-event="disclosure_seen">
    <strong>Affiliate disclosure:</strong> StuffPrettyGood may earn a commission or referral credit if you use some links. Recommendations are practical starting points, not guarantees, rankings, or professional advice. Amazon links may use StoreID ${AMAZON_ASSOCIATES_TAG}.
  </section>
  <section class="foot-grid" aria-label="Compliance links">
    <a href="/affiliate-disclosure.html">Affiliate disclosure</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/preferences.html">Preferences</a><a href="/unsubscribe.html">Unsubscribe</a>
  </section>
  <p class="fineprint">Google Trends signals are used for editorial planning and offer discovery, not as proof of quality or results. Amazon links use manual Associates search/deep-link patterns only; no Amazon prices, images, ratings, reviews, or availability are copied. No mass activation, no provider push, no export, and no send are available from this public MVP.</p>
</footer>`;

function basePage({ title, description, path, body, jsonLd }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | StuffPrettyGood</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${absolute(path)}">
  <meta property="og:title" content="${esc(title)} | StuffPrettyGood">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${absolute(path)}">
  <meta property="og:type" content="website">
  <link rel="stylesheet" href="/styles.css">
  <script type="module" src="/app.js"></script>
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  ${nav}
  <main id="main">${body}</main>
  ${footer}
</body>
</html>`;
}

function offerCard(target, lane) {
  const href = target.type === 'amazon_search' ? `/go/${target.slug}.html` : target.url;
  const label = target.type === 'amazon_search' ? 'Check current options' : 'Open option';
  return `<article class="card offer-card" data-offer-type="${esc(target.type)}" data-trend-lane="${esc(lane.slug)}">
    <p class="eyebrow">${target.type === 'amazon_search' ? 'Amazon manual link' : 'Signup / direct lane'}</p>
    <h3>${esc(target.label)}</h3>
    <p>${esc(target.note || 'Tracked through StuffPrettyGood for aggregate proof metrics and preference learning.')}</p>
    <a class="go-link" href="${esc(href)}" data-crm-event="trend_offer_clicked" data-go-slug="${esc(target.slug)}">${label}</a>
  </article>`;
}

function signupForm(lane) {
  return `<form id="signup" class="intent-form" data-form="trend-lane-optin" data-trend-lane="${esc(lane.slug)}">
    <h2>Save this preference</h2>
    <input type="hidden" name="trend_lane" value="${esc(lane.slug)}">
    <label for="trend_lane_email">Email for explicit opt-in</label><input id="trend_lane_email" name="trend_lane_email" type="email" autocomplete="email">
    <label for="trend_lane_interest">What do you want?</label><select id="trend_lane_interest" name="trend_lane_interest"><option>${esc(lane.title)} picks</option><option>Weekly Pretty Good Picks</option><option>Only major drops</option><option>No messages; save preference only</option></select>
    <label class="check"><input type="checkbox" required> I want StuffPrettyGood updates for this topic and understand I can unsubscribe anytime.</label>
    <button type="submit">Save this preference</button>
    <p class="hint">Frontend redacts raw email in browser events. Production must write preference/audit server-side before any send gate can pass.</p>
  </form>`;
}

function lanePage(lane) {
  const seo = laneSeo(lane);
  const targets = getLaneTargets(lane);
  const path = `/trends/${lane.slug}.html`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: seo.title,
    description: seo.description,
    url: absolute(path),
    about: lane.queries.slice(0, 6).map((query) => ({ '@type': 'Thing', name: query })),
  };
  const body = `<section class="hero compact surface" data-surface="trend-lane" data-trend-seed="${esc(lane.seed)}" data-crm-events="trend_lane_viewed,trend_offer_clicked,weekly_optin_started,topic_preference,disclosure_seen">
    <p class="eyebrow">Google Trends signal: ${esc(lane.seed)}</p>
    <h1>${esc(seo.h1)}</h1>
    <p class="lede">${esc(lane.offer)}. This page turns demand signals into signup intent, safe /go clicks, and future audience-proof metrics.</p>
    <div class="cta-row"><a class="button primary" href="#signup">Save this preference</a><a class="button" href="/trends.html">Back to trend hub</a></div>
  </section>
  <section class="cards three">
    <article class="card"><p class="eyebrow">Momentum</p><h2>${esc(lane.momentumPct ?? 'watch')}%</h2><p>Latest index: ${esc(lane.latest ?? 'n/a')}. Trends are directional; they do not prove product quality.</p></article>
    <article class="card"><p class="eyebrow">Audience</p><h2>${esc(lane.audience)}</h2><p>${esc(riskCopy(lane.risk))}</p></article>
    <article class="card"><p class="eyebrow">Monetization</p><h2>${esc(lane.monetize)}</h2><p>Start with Amazon/manual links, direct programs, sponsor slots, and opt-in proof before major networks.</p></article>
  </section>
  <section class="panel"><h2>Rising related searches</h2><ul class="pill-list">${lane.queries.map((query) => `<li>${esc(query)}</li>`).join('')}</ul></section>
  <section class="cards two" aria-label="Offer cards">${targets.map((target) => offerCard(target, lane)).join('')}</section>
  <section class="article-layout"><article class="article-card"><h2>How to choose</h2><ol><li>Start with the use case, not the trend hype.</li><li>Check current details at the merchant because prices and availability change.</li><li>Avoid entering passwords, payment data, health details, or private records into this page.</li><li>Use the preference form if you want future picks for this lane.</li></ol><h2>SEO note</h2><p>This lane targets ${esc(lane.seed)} plus related searches like ${esc(lane.queries.slice(0, 3).join(', '))}. Copy stays claim-safe and disclosure-visible.</p></article><aside class="aside-card"><h2>CRM proof events</h2><ul><li>trend_lane_viewed</li><li>trend_offer_clicked</li><li>topic_preference</li><li>weekly_optin_started</li><li>disclosure_seen</li></ul></aside></section>
  ${signupForm(lane)}`;
  write(`trends/${lane.slug}.html`, basePage({ title: seo.title, description: seo.description, path, body, jsonLd }));
}

function hubPage() {
  const path = '/trends.html';
  const description = 'Daily Google Trends powered StuffPrettyGood offer lanes, Amazon manual links, signup hooks, and SEO-safe trend pages.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'StuffPrettyGood trending offer lanes',
    itemListElement: trendOfferLanes.map((lane, index) => ({ '@type': 'ListItem', position: index + 1, url: absolute(`/trends/${lane.slug}.html`), name: lane.title })),
  };
  const body = `<section class="hero compact surface" data-surface="trending-offers" data-crm-events="trend_page_viewed,trend_offer_clicked,weekly_optin_started,topic_preference,disclosure_seen">
    <p class="eyebrow">Google Trends powered offer map</p>
    <h1>Daily trending offer lanes to populate StuffPrettyGood.</h1>
    <p class="lede">These lanes come from U.S. Google Trends checks via SerpAPI plus compliance-safe monetization rules. Use them to capture fresh opt-ins before network applications.</p>
    <div class="cta-row"><a class="button primary" href="#trend-optin">Get weekly picks</a><a class="button" href="/ai-tool-stack-quiz.html">Take the quiz</a></div>
  </section>
  <section class="cards three">${trendOfferLanes.map((lane) => `<article class="card" data-trend-seed="${esc(lane.seed)}"><p class="eyebrow">Google Trends signal: ${esc(lane.seed)}</p><h2>${esc(lane.title)}</h2><p>${esc(lane.offer)}</p><p class="hint">Audience: ${esc(lane.audience)}</p><p class="hint">Rising queries: ${esc(lane.queries.slice(0, 4).join(', '))}</p><span class="status watch">${esc(lane.risk)} risk</span> <span class="status watch">momentum ${esc(lane.momentumPct ?? 'watch')}%</span><a class="go-link" href="/trends/${esc(lane.slug)}.html" data-crm-event="trend_offer_clicked">Open lane</a></article>`).join('')}</section>
  <form id="trend-optin" class="intent-form" data-form="trend-weekly-optin"><h2>Get the weekly Pretty Good Picks</h2><label for="trend_email">Email for explicit opt-in</label><input id="trend_email" name="trend_email" type="email" autocomplete="email"><label for="trend_topic">Pick your first lane</label><select id="trend_topic" name="trend_topic">${trendOfferLanes.map((lane) => `<option>${esc(lane.title)}</option>`).join('')}</select><label class="check"><input type="checkbox" required> I want StuffPrettyGood trend picks and understand I can unsubscribe anytime.</label><button type="submit">Save trend preference</button><p class="hint">Frontend redacts raw email in browser events. Real sends remain blocked until Mehyar Media gates approve.</p></form>`;
  write('trends.html', basePage({ title: 'Trending offers', description, path, body, jsonLd }));
}

function goPages() {
  for (const lane of trendOfferLanes) {
    for (const target of getLaneTargets(lane)) {
      if (target.type !== 'amazon_search') continue;
      const url = amazonSearchUrl(target.query || lane.seed);
      const path = `/go/${target.slug}.html`;
      const body = `<section class="hero compact surface" data-surface="go-link" data-source-category="go_bridge" data-offer-type="amazon" data-go-slug="${esc(target.slug)}" data-crm-events="disclosure_seen,trend_offer_clicked,offer_slug,referring_surface">
        <p class="eyebrow">Amazon Associates manual link</p>
        <h1>${esc(target.label)}</h1>
        <p>Production redirect must record disclosure_seen and trend_offer_clicked before redirect. This page is a disclosure-visible manual Associates bridge using StoreID ${AMAZON_ASSOCIATES_TAG}.</p>
        <p>No Amazon prices, ratings, reviews, images, or availability are copied here. Check current details on Amazon.</p>
        <a class="button primary" rel="sponsored nofollow noopener" href="${esc(url)}" data-crm-event="trend_offer_clicked" data-offer-type="amazon" data-source-category="go_bridge">Check current options on Amazon</a>
      </section>`;
      write(`go/${target.slug}.html`, basePage({ title: `/go/${target.slug}`, description: `Disclosure-visible Amazon Associates bridge for ${target.label}.`, path, body }));
    }
  }
}

hubPage();
for (const lane of trendOfferLanes) lanePage(lane);
goPages();
console.log(JSON.stringify({ status: 'built', lanes: trendOfferLanes.length, amazonTag: AMAZON_ASSOCIATES_TAG }, null, 2));
