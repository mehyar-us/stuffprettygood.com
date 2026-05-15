import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { trendOfferLanes } from '../src/spg/trending-offers.js';
import { amazonSearchUrl, AMAZON_ASSOCIATES_TAG, getLaneTargets, laneSeo, riskCopy } from '../src/spg/trend-components.js';

const outDir = new URL('../public', import.meta.url).pathname;
const write = (file, html) => { mkdirSync(dirname(join(outDir, file)), { recursive: true }); writeFileSync(join(outDir, file), html, 'utf8'); };
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const absolute = (path) => `https://stuffprettygood.com${path}`;
const today = new Date().toISOString().slice(0, 10);

function loadRssCandidates() {
  const file = new URL('../data/spg-rss-candidates.json', import.meta.url).pathname;
  if (!existsSync(file)) return { generated_at: null, candidates: [] };
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return { generated_at: null, candidates: [] }; }
}
const rss = loadRssCandidates();

const nav = `<nav class="nav" aria-label="Primary">
  <a class="brand" href="/index.html">Stuff<span>Pretty</span>Good</a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links">Menu</button>
  <div id="nav-links" class="nav-links">
    <a href="/today.html">Today</a>
    <a href="/trends.html">Guides</a>
    <a href="/deals.html">Deals</a>
    <a href="/ai-tool-stack-quiz.html">Tools</a>
    <a href="/daily.html">Daily Signals</a>
    <button class="theme-toggle" type="button" data-theme-toggle>Theme</button>
    <a class="nav-cta" href="#weekly-picks">Weekly Picks</a>
  </div>
</nav>`;

const footer = `<footer class="footer">
  <div class="footer-inner">
    <section class="disclosure" data-crm-event="disclosure_seen">
      <strong>Affiliate disclosure:</strong> StuffPrettyGood may earn a commission or referral credit when you use some links. We use original editorial notes, clear disclosures, and practical usefulness signals. Amazon links may use StoreID ${AMAZON_ASSOCIATES_TAG}.
    </section>
    <section class="foot-grid" aria-label="Site links">
      <a href="/affiliate-disclosure.html">Affiliate disclosure</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/preferences.html">Preferences</a><a href="/unsubscribe.html">Unsubscribe</a>
    </section>
    <p class="fineprint">Trend/RSS signals are editorial discovery inputs, not proof of quality, price, availability, or results. No Amazon prices, images, ratings, reviews, or availability are copied. This public site does not send email/SMS, export audiences, or push providers.</p>
  </div>
</footer>`;

function metaTags({ title, description, path, type = 'website' }) {
  return `  <title>${esc(title)} | StuffPrettyGood</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${absolute(path)}">
  <meta name="color-scheme" content="light dark">
  <meta property="og:title" content="${esc(title)} | StuffPrettyGood">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${absolute(path)}">
  <meta property="og:type" content="${type}">
  <meta name="twitter:card" content="summary_large_image">`;
}
function basePage({ title, description, path, body, jsonLd, type }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
${metaTags({ title, description, path, type })}
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

function weeklyForm(id = 'weekly-picks', title = 'Get the weekly Pretty Good Picks') {
  return `<form id="${id}" class="intent-form" data-form="weekly-picks-optin">
    <p class="eyebrow">Weekly Picks</p><h2>${esc(title)}</h2>
    <label for="weekly_email_${id}">Email</label><input id="weekly_email_${id}" name="weekly_email" type="email" autocomplete="email"><input id="trend_email" name="trend_email_alias" type="hidden" value="weekly-picks"><input id="trend_lane_email" name="trend_lane_email_alias" type="hidden" value="topic-picks">
    <label for="weekly_topic_${id}">What should we watch for you?</label><select id="weekly_topic_${id}" name="weekly_topic"><option>Tech and AI tools</option><option>Home upgrades</option><option>Travel and everyday carry</option><option>Wellness and routines</option><option>Budget finds under $50</option></select>
    <label class="check"><input type="checkbox" required> I want StuffPrettyGood updates and understand I can unsubscribe anytime.</label>
    <button type="submit">Save my picks</button><p class="hint">Preview mode: signup persistence must be handled by Mehyar Media CRM before any send.</p>
  </form>`;
}

function signalCard(lane) {
  return `<article class="card" data-trend-seed="${esc(lane.seed)}"><p class="eyebrow">Trending now</p><h3>${esc(lane.title)}</h3><p>${esc(lane.offer)}</p><div class="tag-row"><span class="status watch">${esc(lane.momentumPct ?? 'watch')}% momentum</span><span class="pill">${esc(lane.risk)} risk</span></div><a class="go-link" href="/trends/${esc(lane.slug)}.html">Read guide</a></article>`;
}
function offerCard(target, lane) {
  const href = target.type === 'amazon_search' ? `/go/${target.slug}.html` : target.url;
  const label = target.type === 'amazon_search' ? 'Check current options' : 'Open option';
  const typeLabel = target.type === 'amazon_search' ? 'Amazon Associates' : target.type === 'service' ? 'Setup help' : 'Direct / referral';
  return `<article class="card offer-card" data-offer-type="${esc(target.type)}" data-trend-lane="${esc(lane.slug)}">
    <p class="eyebrow">${typeLabel}</p><h3>${esc(target.label)}</h3>
    <p>${esc(target.note || 'A practical starting point. Check current merchant details before buying or signing up.')}</p>
    <a class="go-link" href="${esc(href)}" data-crm-event="trend_offer_clicked" data-go-slug="${esc(target.slug)}">${label}</a>
  </article>`;
}
function rssMiniFeed(max = 5) {
  const items = (rss.candidates || []).slice(0, max);
  if (!items.length) return `<article class="card"><p class="eyebrow">Daily Signals</p><h3>Source watchlist warming up</h3><p>RSS discovery is configured to surface public, attributed ideas after the next daily run.</p><a class="go-link" href="/daily.html">Open daily signals</a></article>`;
  return `<div class="mini-feed">${items.map((item) => `<article class="card"><p class="eyebrow">${esc(item.category || 'signal')} · ${esc(item.source_name)}</p><h3>${esc(item.safe_title)}</h3><p>${esc(item.original_note)}</p><a class="source-link" href="${esc(item.url)}" rel="nofollow noopener">Source signal</a></article>`).join('')}</div>`;
}

function homePage() {
  const description = 'StuffPrettyGood finds useful tools, products, guides, and practical upgrades across the web with clear affiliate disclosure and daily source signals.';
  const body = `<section class="hero split surface" data-surface="home" data-crm-events="homepage_viewed,weekly_optin_started,trend_offer_clicked,disclosure_seen">
    <div><p class="eyebrow">Useful finds, updated daily</p><h1>Find useful stuff before everyone is yelling about it.</h1><p class="lede">Daily practical picks across tools, gear, home, travel, wellness, and work — curated from trend signals, public sources, and common-sense usefulness.</p><div class="cta-row"><a class="button primary" href="/today.html">See today's picks</a><a class="button ghost" href="#weekly-picks">Get weekly picks</a></div><p class="trust-note">No fake reviews. Clear affiliate disclosure. No sensitive data required.</p></div>
    <aside class="card"><p class="eyebrow">What this is</p><h2>A broad offer and guide brand.</h2><p>Amazon finds, direct programs, tools, articles, checklists, RSS signals, and trend-guided guides — built to prove audience before bigger offer-network applications.</p><div class="tag-row"><span class="pill">Dark/light</span><span class="pill">SEO-first</span><span class="pill">Daily feeds</span></div></aside>
  </section>
  <section class="section"><div class="section-header"><div><p class="eyebrow">Today's signal strip</p><h2>Momentum worth watching</h2></div><a href="/trends.html">Browse all guides</a></div><div class="signal-strip">${trendOfferLanes.slice(0,4).map(signalCard).join('')}</div></section>
  <section class="section"><div class="section-header"><div><p class="eyebrow">Browse by intent</p><h2>Start with what you need</h2></div></div><div class="cards three"><a class="card" href="/ai-tool-stack-quiz.html"><h3>Work smarter</h3><p>AI tools, workflow software, and stack quizzes.</p></a><a class="card" href="/trends/robot-vacuums-smart-home.html"><h3>Upgrade home</h3><p>Home gear, air quality, automation, and practical daily upgrades.</p></a><a class="card" href="/trends/travel-tech-esim.html"><h3>Travel lighter</h3><p>Travel tech, eSIMs, bags, chargers, and road-ready kits.</p></a><a class="card" href="/savings-finder.html"><h3>Save money</h3><p>Cheaper alternatives, starter kits, and useful deal checks.</p></a><a class="card" href="/trends/home-wellness-gadgets.html"><h3>Wellness routines</h3><p>Claim-safe wellness gadgets and routine helpers.</p></a><a class="card" href="/trends/weekend-hobby-kits.html"><h3>Weekend projects</h3><p>Hobby kits, gifts, and low-friction things to try.</p></a></div></section>
  <section class="section"><div class="section-header"><div><p class="eyebrow">Featured guides</p><h2>Useful, not noisy</h2></div></div><div class="cards three"><article class="card guide-card large"><p class="eyebrow">Guide · updated ${today}</p><h2>How to tell if a deal is actually pretty good.</h2><p>Start with use case, total cost, durability, privacy, return policy, and whether you would still want it without the hype.</p><a class="go-link" href="/deals.html">Open deal hub</a></article>${trendOfferLanes.slice(4,8).map(signalCard).join('')}</div></section>
  <section class="section"><div class="section-header"><div><p class="eyebrow">Daily public sources</p><h2>RSS and trend signals</h2></div><a href="/daily.html">Open daily signals</a></div>${rssMiniFeed(3)}</section>
  ${weeklyForm()}`;
  const jsonLd = { '@context':'https://schema.org', '@type':'WebSite', name:'StuffPrettyGood', url:absolute('/'), potentialAction:{ '@type':'SearchAction', target:absolute('/trends.html?q={search_term_string}'), 'query-input':'required name=search_term_string' } };
  write('index.html', basePage({ title:'Useful finds, guides, and offers', description, path:'/index.html', body, jsonLd }));
}

function hubPage() {
  const path = '/trends.html';
  const description = 'SEO guides and offer lanes for useful tools, products, deals, and practical upgrades from StuffPrettyGood.';
  const jsonLd = { '@context':'https://schema.org', '@type':'ItemList', name:'StuffPrettyGood useful guide lanes', itemListElement: trendOfferLanes.map((lane, index) => ({ '@type':'ListItem', position:index+1, url:absolute(`/trends/${lane.slug}.html`), name:lane.title })) };
  const body = `<section class="hero compact surface" data-surface="guides" data-crm-events="trend_page_viewed,trend_offer_clicked,weekly_optin_started,topic_preference,disclosure_seen">
    <p class="eyebrow">Guides and offer lanes</p><h1>Useful things to compare, try, or save for later.</h1><p class="lede">Trend-informed guides across AI, home, travel, wellness, food, pets, and everyday upgrades. Powered by daily trend/source discovery, written for humans.</p><div class="cta-row"><a class="button primary" href="#weekly-picks">Get weekly picks</a><a class="button" href="/daily.html">See daily signals</a></div><p class="screen-reader-note">Google Trends powered offer map</p>
  </section>
  <section class="cards three">${trendOfferLanes.map(signalCard).join('')}</section>${weeklyForm()}`;
  write('trends.html', basePage({ title:'Guides and useful offer lanes', description, path, body, jsonLd }));
}

function todayPage() {
  const body = `<section class="hero compact surface"><p class="eyebrow">Today</p><h1>Today's Pretty Good Finds.</h1><p class="lede">A daily snapshot of useful lanes, public source signals, and safe offer starting points. Check merchant details before buying.</p><div class="cta-row"><a class="button primary" href="#weekly-picks">Get weekly picks</a><a class="button" href="/daily.html">Source signals</a></div></section>
  <section class="cards three">${trendOfferLanes.slice(0,9).map(signalCard).join('')}</section>${weeklyForm()}`;
  write('today.html', basePage({ title:"Today's useful finds", description:'Daily StuffPrettyGood picks and offer lanes.', path:'/today.html', body, jsonLd:{'@context':'https://schema.org','@type':'CollectionPage',name:"Today's Pretty Good Finds",url:absolute('/today.html')}}));
}

function dailyPage() {
  const items = rss.candidates || [];
  const body = `<section class="hero compact surface"><p class="eyebrow">Daily Signals</p><h1>Public source signals we are watching.</h1><p class="lede">RSS and public-feed items are used for discovery and original editorial planning only. Source links are attributed; we do not copy merchant content.</p><div class="cta-row"><a class="button primary" href="/today.html">Today's picks</a><a class="button" href="/trends.html">Guides</a></div></section>
  <section class="cards two">${items.length ? items.slice(0,18).map((item)=>`<article class="card"><p class="eyebrow">${esc(item.category)} · ${esc(item.source_name)}</p><h2>${esc(item.safe_title)}</h2><p>${esc(item.original_note)}</p><div class="tag-row">${(item.matched_lanes||[]).slice(0,3).map((lane)=>`<span class="pill">${esc(lane)}</span>`).join('')}</div><a class="go-link" href="${esc(item.url)}" rel="nofollow noopener">Read source signal</a></article>`).join('') : '<article class="card"><h2>No source snapshot yet.</h2><p>Run npm run spg:rss:fetch && npm run spg:rss:update to populate daily source signals.</p></article>'}</section>${weeklyForm()}`;
  write('daily.html', basePage({ title:'Daily public source signals', description:'Daily RSS and public-source discovery signals for StuffPrettyGood guides and offers.', path:'/daily.html', body, jsonLd:{'@context':'https://schema.org','@type':'CollectionPage',name:'Daily public source signals',url:absolute('/daily.html')}}));
}

function lanePage(lane) {
  const seo = laneSeo(lane); const targets = getLaneTargets(lane); const path = `/trends/${lane.slug}.html`;
  const laneItems = (rss.candidates || []).filter((item) => (item.matched_lanes || []).includes(lane.slug)).slice(0,4);
  const jsonLd = { '@context':'https://schema.org', '@type':'Article', headline: seo.h1, description: seo.description, url:absolute(path), datePublished: lane.trendUpdatedAt || today, dateModified: new Date().toISOString(), about: lane.queries.slice(0,6).map((query)=>({'@type':'Thing',name:query})) };
  const body = `<section class="hero compact surface" data-surface="trend-lane" data-trend-seed="${esc(lane.seed)}" data-crm-events="trend_lane_viewed,trend_offer_clicked,weekly_optin_started,topic_preference,disclosure_seen">
    <p class="eyebrow">Trending now · ${esc(lane.seed)}</p><h1>${esc(seo.h1)}</h1><p class="lede">${esc(lane.offer)}. Practical starting points, clear caveats, and original notes — not fake rankings or copied merchant content.</p><div class="cta-row"><a class="button primary" href="#weekly-picks">Save this preference</a><a class="button" href="/today.html">Today's picks</a></div>
  </section>
  <section class="cards three"><article class="card"><p class="eyebrow">Momentum</p><h2>${esc(lane.momentumPct ?? 'watch')}%</h2><p>Search interest is directional and changes fast. It does not prove product quality.</p></article><article class="card"><p class="eyebrow">Who it helps</p><h2>${esc(lane.audience)}</h2><p>${esc(riskCopy(lane.risk))}</p></article><article class="card"><p class="eyebrow">Offer routes</p><h2>${esc(lane.monetize)}</h2><p>Start with manual Amazon links, direct programs, sponsor slots, and opt-in proof before major networks.</p></article></section>
  <section class="article-layout"><article class="article-card prose"><p class="eyebrow">Buying guide</p><h2>How to choose without falling for hype</h2><p>Start with the actual job you need done, then compare setup friction, return policy, recurring costs, privacy, support, and whether the product still makes sense if the trend fades.</p><h2>What to check before buying</h2><ol><li>Confirm current details at the merchant because price and availability change.</li><li>Look for warranty, return window, compatibility, and total cost.</li><li>Ignore fake urgency and claims that sound too absolute.</li><li>Use the topic form if you want us to keep watching this lane.</li></ol><h2>Related searches</h2><ul class="pill-list">${lane.queries.map((query)=>`<li class="pill">${esc(query)}</li>`).join('')}</ul></article><aside class="aside-card"><h2>Source notes</h2><p>Trend and RSS data guide what we cover; StuffPrettyGood writes original summaries and routes commercial clicks through disclosed bridges.</p></aside></section>
  <section class="section"><div class="section-header"><div><p class="eyebrow">Offer starting points</p><h2>Places to compare current options</h2></div></div><div class="cards two">${targets.map((target)=>offerCard(target,lane)).join('')}</div></section>
  ${laneItems.length ? `<section class="section"><div class="section-header"><div><p class="eyebrow">Public source signals</p><h2>What we are watching</h2></div></div><div class="cards two">${laneItems.map((item)=>`<article class="card"><h3>${esc(item.safe_title)}</h3><p>${esc(item.original_note)}</p><a class="source-link" href="${esc(item.url)}" rel="nofollow noopener">Source signal: ${esc(item.source_name)}</a></article>`).join('')}</div></section>` : ''}
  ${weeklyForm('weekly-picks', `Get ${lane.title} picks`)}`;
  write(`trends/${lane.slug}.html`, basePage({ title: seo.title, description: seo.description, path, body, jsonLd, type:'article' }));
}

function goPages() {
  for (const lane of trendOfferLanes) for (const target of getLaneTargets(lane)) {
    if (target.type !== 'amazon_search') continue;
    const url = amazonSearchUrl(target.query || lane.seed); const path = `/go/${target.slug}.html`;
    const body = `<section class="hero compact surface" data-surface="go-link" data-source-category="go_bridge" data-offer-type="amazon" data-go-slug="${esc(target.slug)}" data-crm-events="disclosure_seen,trend_offer_clicked,offer_slug,referring_surface"><p class="eyebrow">Disclosure bridge</p><h1>${esc(target.label)}</h1><p class="lede">StuffPrettyGood may earn from qualifying purchases. This is a manual Amazon Associates bridge using StoreID ${AMAZON_ASSOCIATES_TAG}.</p><p>No Amazon prices, ratings, reviews, images, or availability are copied here. Check current details on Amazon.</p><a class="button primary" rel="sponsored nofollow noopener" href="${esc(url)}" data-crm-event="trend_offer_clicked" data-offer-type="amazon" data-source-category="go_bridge">Check current options on Amazon</a></section>`;
    write(`go/${target.slug}.html`, basePage({ title:`${target.label} options`, description:`Disclosure-visible Amazon Associates bridge for ${target.label}.`, path, body }));
  }
}
function seoFiles() {
  const pages = ['/index.html','/today.html','/trends.html','/daily.html','/deals.html','/ai-tool-stack-quiz.html','/preferences.html','/unsubscribe.html',...trendOfferLanes.map(l=>`/trends/${l.slug}.html`),...trendOfferLanes.flatMap(l=>getLaneTargets(l).filter(t=>t.type==='amazon_search').map(t=>`/go/${t.slug}.html`))];
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: https://stuffprettygood.com/sitemap.xml\n`);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((p)=>`\n  <url><loc>${absolute(p)}</loc><lastmod>${today}</lastmod></url>`).join('')}\n</urlset>\n`);
}

homePage(); todayPage(); hubPage(); dailyPage(); for (const lane of trendOfferLanes) lanePage(lane); goPages(); seoFiles();
console.log(JSON.stringify({ status:'built', lanes:trendOfferLanes.length, rssCandidates:(rss.candidates||[]).length, amazonTag:AMAZON_ASSOCIATES_TAG }, null, 2));
