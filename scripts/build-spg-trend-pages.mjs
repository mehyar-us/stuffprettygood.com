import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { trendOfferLanes } from '../src/spg/trending-offers.js';
import { amazonSearchUrl, AMAZON_ASSOCIATES_TAG, getLaneTargets, laneSeo, riskCopy } from '../src/spg/trend-components.js';
import { SpgDurableStore } from '../src/spg/durable-store.js';

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
const spgStore = new SpgDurableStore();

const nav = `<nav class="nav" aria-label="Primary">
  <a class="brand" href="/index.html" aria-label="StuffPrettyGood home"><span class="brand-mark">✦</span> Stuff<span>Pretty</span>Good</a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links">Menu</button>
  <div id="nav-links" class="nav-links">
    <a href="/today.html">Today</a>
    <a href="/deals.html">Deals</a>
    <a href="/trends.html">Guides</a>
    <a href="/ai-tool-stack-quiz.html">AI + Work</a>
    <a href="/trends/robot-vacuums-smart-home.html">Home + Desk</a>
    <a href="/daily.html">Signals</a>
    <a href="/preferences.html">Preferences</a>
    <a href="/unsubscribe.html">Unsubscribe</a>
    <button class="theme-toggle" type="button" data-theme-toggle>Theme</button>
    <a class="nav-cta" href="#weekly-picks">Sign up</a>
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

const categoryIntents = [
  ['Work smarter', '/ai-tool-stack-quiz.html', 'AI tools, workflow software, stack quizzes, and practical operator shortcuts.', 'AI + Work', 'desk gremlin'],
  ['Upgrade home', '/trends/robot-vacuums-smart-home.html', 'Robot vacuums, air quality, compact home office, and small daily upgrades.', 'Home + Desk', 'home goblin'],
  ['Travel lighter', '/trends/travel-tech-esim.html', 'eSIMs, chargers, bags, adapters, and road-ready kits worth checking.', 'Travel', 'tiny suitcase'],
  ['Spend less badly', '/savings-finder.html', 'Savings checks, software bloat, low-regret swaps, and useful budget finds.', 'Budget', 'coin wizard'],
  ['Routine helpers', '/trends/home-wellness-gadgets.html', 'Claim-safe wellness gadgets and household routine helpers without miracle claims.', 'Wellness', 'sleepy star'],
  ['Weekend projects', '/trends/weekend-hobby-kits.html', 'Hobby kits, gifts, starter packs, and low-friction things to try.', 'Gifts + Hobbies', 'paint blob'],
];

function artTile(label, seed = 'pretty good') {
  const text = esc(label || seed);
  return `<div class="art-tile" role="img" aria-label="Original StuffPrettyGood illustration for ${text}"><span class="art-orb"></span><span class="art-squiggle">${text.slice(0, 16)}</span><span class="art-face">•ᴗ•</span></div>`;
}

function safeAssetName(value) {
  return String(value || 'offer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96);
}
function svgProductArt(label, lane, index = 0) {
  const palette = [
    ['#ffd166', '#ef476f', '#118ab2'], ['#a7f3d0', '#60a5fa', '#7c3aed'], ['#fca5a5', '#fde68a', '#34d399'],
    ['#f9a8d4', '#93c5fd', '#fb923c'], ['#bef264', '#67e8f9', '#c084fc']
  ][index % 5];
  const title = esc(label).replaceAll('&quot;', '');
  const face = ['•ᴗ•','^ᴗ^','ಠᴗಠ','◕‿◕','ᵔᴥᵔ'][index % 5];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-label="Original StuffPrettyGood cartoon image for ${title}"><rect width="1200" height="800" rx="54" fill="${palette[0]}"/><circle cx="930" cy="150" r="190" fill="${palette[1]}" opacity=".88"/><circle cx="250" cy="610" r="210" fill="${palette[2]}" opacity=".82"/><path d="M180 470 Q380 260 610 420 T1040 370" fill="none" stroke="#16120d" stroke-width="22" stroke-linecap="round"/><rect x="250" y="170" width="700" height="350" rx="44" fill="#fff8df" stroke="#16120d" stroke-width="18"/><text x="600" y="322" text-anchor="middle" font-size="82" font-family="Arial, sans-serif" font-weight="900" fill="#16120d">SPG</text><text x="600" y="430" text-anchor="middle" font-size="88" font-family="Arial, sans-serif" font-weight="900" fill="#16120d">${face}</text><rect x="210" y="575" width="780" height="96" rx="48" fill="#ffffff" stroke="#16120d" stroke-width="12"/><text x="600" y="637" text-anchor="middle" font-size="42" font-family="Arial, sans-serif" font-weight="900" fill="#16120d">${title.slice(0, 34)}</text></svg>`;
}
function ensureOfferImage(target, lane, index = 0) {
  const name = safeAssetName(target.slug || target.label || lane.slug);
  const file = `assets/offers/${name}.svg`;
  write(file, svgProductArt(target.label || lane.title, lane, index));
  return `/${file}`;
}
function homepageOfferWall(limit = 48) {
  return spgStore.listOfferWall({ surface: 'home', limit }, { publicOnly: true });
}
function ensureOfferWallImage(offer, index = 0) {
  const name = safeAssetName(offer.offer_key || offer.title);
  const file = `assets/offers/${name}.svg`;
  write(file, svgProductArt(offer.title || offer.offer_key, { slug: offer.category || 'home' }, index));
  return `/${file}`;
}
function offerLandingHref(offer) {
  return `/offers/${offer.offer_key}.html`;
}
function offerGoHref(offer) {
  return `${offer.go_link || `/go/${offer.offer_key}`}.html`.replace(/\.html\.html$/, '.html');
}
function homepageOfferCard(offer, index) {
  const image = ensureOfferWallImage(offer, index);
  const href = offerLandingHref(offer);
  const badge = offer.monetization_status === 'approved_lead_magnet' ? 'Approved lead magnet' : 'Approved monetized';
  return `<article class="card offer-card product-card" data-filter-card data-offer-key="${esc(offer.offer_key)}" data-offer-type="${esc(offer.payout_model)}" data-filter-text="${esc(`${offer.title} ${offer.category} ${offer.vendor_name} ${offer.summary}`)}"><a class="product-image-link" href="${esc(href)}" aria-label="Open ${esc(offer.title)} offer page"><img class="product-image" src="${esc(image)}" alt="${esc(offer.image?.alt || `Original StuffPrettyGood cartoon image for ${offer.title}`)}" loading="lazy"></a><div class="tag-row"><span class="sticker">${badge}</span><span class="pill">${esc(offer.category)}</span></div><h3>${esc(offer.title)}</h3><p>${esc(offer.summary || 'Compare current merchant details before buying. We may earn from qualifying purchases.')}</p><a class="go-link" href="${esc(href)}" data-crm-event="offer_landing_clicked" data-offer-slug="${esc(offer.offer_key)}">See offer page →</a></article>`;
}
function signupBand() {
  return `<section class="section signup-band" aria-label="StuffPrettyGood signup"><div><p class="eyebrow">Sign up</p><h2>Get the money links after we find them.</h2><p>Pick topics now. Mehyar Media records interest safely; no live sends happen until CRM gates approve.</p></div><div class="cta-row"><a class="button primary" href="#weekly-picks">Sign up for picks</a><a class="button ghost" href="/preferences.html">Preferences</a><a class="button ghost" href="/unsubscribe.html">Unsubscribe</a></div></section>`;
}
function amazonQuickRail(limit = 6) {
  const offers = homepageOfferWall(48).filter((offer) => String(offer.offer_key || '').startsWith('amazon-')).slice(0, limit);
  if (!offers.length) return '';
  return `<section class="section amazon-quick-rail" aria-label="Amazon quick links"><div><p class="eyebrow">Amazon-first</p><h2>Start with disclosed Amazon bridges.</h2><p>Offer landing pages sit near the top before the full 48-card wall; outbound clicks still go through /go only.</p></div><div class="quick-offers">${offers.map((offer, index) => {
    const href = offerLandingHref(offer);
    const image = ensureOfferWallImage(offer, index);
    return `<a class="quick-offer" href="${esc(href)}" data-crm-event="offer_landing_clicked" data-offer-slug="${esc(offer.offer_key)}"><img src="${esc(image)}" alt="${esc(offer.image?.alt || `Original StuffPrettyGood cartoon image for ${offer.title}`)}" loading="eager"><span><strong>${esc(offer.title)}</strong><em>Amazon Associates bridge</em></span></a>`;
  }).join('')}</div></section>`;
}
function heroAmazonLinks(limit = 3) {
  const offers = homepageOfferWall(48).filter((offer) => String(offer.offer_key || '').startsWith('amazon-')).slice(0, limit);
  if (!offers.length) return '';
  return `<div class="hero-amazon-links" aria-label="Top Amazon offer bridges"><span>Amazon-first:</span>${offers.map((offer) => {
    const href = offerLandingHref(offer);
    return `<a href="${esc(href)}" data-crm-event="offer_landing_clicked" data-offer-slug="${esc(offer.offer_key)}">${esc(offer.title)}</a>`;
  }).join('')}</div>`;
}

function categoryCard([title, href, copy, label, art], index) {
  return `<a class="card category-card" href="${href}" data-filter-card data-filter-text="${esc(`${title} ${copy} ${label}`)}"><div class="card-media mini">${artTile(art, title)}</div><p class="eyebrow">${esc(label)}</p><h3>${esc(title)}</h3><p>${esc(copy)}</p><span class="go-link">Open lane →</span></a>`;
}

function editorPickCard(lane, index) {
  const stickers = ['Pretty Good', 'Low-Regret', 'Weirdly Useful', 'No-Hype Pick', 'Starter Kit'];
  return `<article class="card offer-card visual-card" data-filter-card data-filter-text="${esc(`${lane.title} ${lane.seed} ${lane.audience} ${lane.offer}`)}"><div class="card-media">${artTile(lane.seed, lane.title)}</div><div class="tag-row"><span class="sticker">${stickers[index % stickers.length]}</span> <span class="pill">${esc(lane.risk)} risk</span></div><p class="eyebrow">Editor pick · source checked</p><h3>${esc(lane.title)}</h3><p>${esc(lane.offer)} for ${esc(lane.audience)}.</p><a class="go-link" href="/trends/${esc(lane.slug)}.html">Read guide</a></article>`;
}

function weeklyForm(id = 'weekly-picks', title = 'Get the weekly Pretty Good Picks') {
  return `<form id="${id}" class="intent-form" data-form="weekly-picks-optin">
    <p class="eyebrow">Weekly Picks</p><h2>${esc(title)}</h2>
    <label for="weekly_email_${id}">Email</label><input id="weekly_email_${id}" name="weekly_email" type="email" autocomplete="email"><input id="trend_email" name="trend_email_alias" type="hidden" value="weekly-picks"><input id="trend_lane_email" name="trend_lane_email_alias" type="hidden" value="topic-picks">
    <label for="weekly_topic_${id}">What should we watch for you?</label><select id="weekly_topic_${id}" name="weekly_topic"><option>Tech and AI tools</option><option>Home upgrades</option><option>Travel and everyday carry</option><option>Wellness and routines</option><option>Budget finds under $50</option></select>
    <label class="check"><input type="checkbox" required> I want StuffPrettyGood updates and understand I can unsubscribe anytime.</label>
    <button type="submit">Save my picks</button><p class="hint">Preview mode: Mehyar Media records interest before any send. <a href="/unsubscribe.html">Unsubscribe anytime</a>.</p>
  </form>`;
}

function signalCard(lane) {
  return `<article class="card signal-card" data-trend-seed="${esc(lane.seed)}" data-filter-card data-filter-text="${esc(`${lane.title} ${lane.seed} ${lane.audience} ${lane.offer}`)}"><div class="card-media mini">${artTile(lane.seed, lane.title)}</div><p class="eyebrow">Trending now</p><h3>${esc(lane.title)}</h3><p>${esc(lane.offer)}</p><div class="tag-row"><span class="status watch">${esc(lane.momentumPct ?? 'watch')}% momentum</span> <span class="pill">${esc(lane.risk)} risk</span></div><a class="go-link" href="/trends/${esc(lane.slug)}.html">Read guide</a></article>`;
}
function offerCard(target, lane) {
  const href = target.type === 'amazon_search' ? `/go/${target.slug}.html` : target.url;
  const label = target.type === 'amazon_search' ? 'Check current options' : 'Open option';
  const typeLabel = target.type === 'amazon_search' ? 'Amazon Associates' : target.type === 'service' ? 'Setup help' : 'Direct / referral';
  const image = target.type === 'amazon_search' ? ensureOfferImage(target, lane, String(target.slug || '').length) : null;
  return `<article class="card offer-card" data-offer-type="${esc(target.type)}" data-trend-lane="${esc(lane.slug)}">
    ${image ? `<a class="product-image-link" href="${esc(href)}"><img class="product-image" src="${esc(image)}" alt="Original StuffPrettyGood cartoon image for ${esc(target.label)}" loading="lazy"></a>` : ''}
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
  const description = 'StuffPrettyGood is a dense, image-led public offers and buyer-guide brand for useful tools, products, deals, and practical upgrades with clear affiliate disclosure.';
  const body = `<section class="hero commerce-hero surface" data-surface="home" data-crm-events="homepage_viewed,weekly_optin_started,trend_offer_clicked,disclosure_seen">
    <div class="hero-copy"><p class="eyebrow">Useful finds, updated daily</p><h1>Useful stuff worth checking before the feeds get loud.</h1><p class="lede">Daily practical picks across AI tools, home upgrades, travel gear, wellness routines, desk helpers, gifts, and budget finds — with original notes, clear disclosure, and no fake proof.</p><div class="cta-row"><a class="button primary" href="/today.html">See today's picks</a><a class="button ghost" href="#weekly-picks">Get weekly picks</a><a class="button ghost" href="/preferences.html">Set preferences</a></div><p class="trust-note">No copied Amazon prices/images/reviews/ratings. No sensitive data required. No email/SMS sends from this public site.</p>${heroAmazonLinks(3)}</div>
    <aside class="hero-shop-wall" aria-label="Featured useful find collage">${trendOfferLanes.slice(0,6).map((lane, index)=>`<a class="shop-chip chip-${index}" href="/trends/${esc(lane.slug)}.html"><span>${artTile(lane.seed, lane.title)}</span><strong>${esc(lane.title.split(':')[0])}</strong><em>${esc(lane.momentumPct ?? 'watch')}% signal</em></a>`).join('')}<div class="mascot-card"><span class="mascot">ʕ•ᴥ•ʔ</span><strong>Pretty Good Finder</strong><small>original SPG art only</small></div></aside>
  </section>
  ${amazonQuickRail(6)}
  <section class="section search-band" aria-label="Search StuffPrettyGood"><div><p class="eyebrow">Find your lane</p><h2>Search/filter the homepage</h2><p>Filter visible rails by topic, use case, category, or trend seed.</p></div><label class="search-box" for="spg-home-filter"><span>Search</span><input id="spg-home-filter" type="search" placeholder="Try: air purifier, AI, travel, gifts, desk…" data-home-filter></label></section>
  ${signupBand()}
  <section class="section offer-wall"><div class="section-header"><div><p class="eyebrow">Monetized offer wall</p><h2>Amazon-first useful products to compare now</h2><p>Image-led cards use original StuffPrettyGood cartoon art and disclosed Amazon Associates bridges with StoreID ${AMAZON_ASSOCIATES_TAG}.</p></div><a href="/affiliate-disclosure.html">Affiliate disclosure</a></div><div class="cards four offer-grid">${homepageOfferWall(48).map(homepageOfferCard).join('')}</div></section>
  <section class="section"><div class="section-header"><div><p class="eyebrow">Trending now</p><h2>Dense daily finds with safe source signals</h2><p>High-momentum lanes route to original guides and disclosed /go bridges only where approved.</p></div><a href="/trends.html">Browse all guides</a></div><div class="signal-strip">${trendOfferLanes.slice(0,6).map(signalCard).join('')}</div></section>
  <section class="section"><div class="section-header"><div><p class="eyebrow">Category rails</p><h2>Start with what you need</h2></div><a href="/preferences.html">Tune preferences</a></div><div class="cards three category-grid">${categoryIntents.map(categoryCard).join('')}</div></section>
  <section class="section"><div class="section-header"><div><p class="eyebrow">Editor picks</p><h2>Pretty good, not noisy</h2><p>Playful commerce cards with original illustrations, not scraped merchant assets.</p></div><a href="/today.html">Today</a></div><div class="cards three">${trendOfferLanes.slice(4,13).map(editorPickCard).join('')}</div></section>
  <section class="section guide-rail"><div class="section-header"><div><p class="eyebrow">Buyer guides</p><h2>Useful checks before clicking buy</h2></div><a href="/deals.html">Open deal hub</a></div><div class="cards three"><article class="card guide-card large" data-filter-card data-filter-text="deal checklist total cost return policy privacy warranty"><div class="card-media wide">${artTile('deal checklist', 'pretty good deal')}</div><p class="eyebrow">Guide · updated ${today}</p><h2>How to tell if a deal is actually pretty good.</h2><p>Start with use case, total cost, durability, privacy, return policy, compatibility, and whether you would still want it without the hype.</p><a class="go-link" href="/deals.html">Open deal hub</a></article>${trendOfferLanes.slice(8,11).map(signalCard).join('')}</div></section>
  <section class="section"><div class="section-header"><div><p class="eyebrow">Daily public sources</p><h2>RSS and trend inputs</h2><p>Discovery inputs become original editorial candidates — not copied claims.</p></div><a href="/daily.html">Open daily signals</a></div>${rssMiniFeed(6)}</section>
  <section class="section trust-strip" aria-label="Trust and compliance"><article><strong>Affiliate disclosure visible.</strong> <span>Some links may earn commission/referral credit after approval.</span></article><article><strong>Preference control.</strong> <span><a href="/preferences.html">Preferences</a> and <a href="/unsubscribe.html">unsubscribe</a> stay prominent.</span></article><article><strong>No fake proof.</strong> <span>No copied reviews, ratings, prices, screenshots, or scarcity claims.</span></article></section>
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


function relatedOfferCards(currentOffer, limit = 3) {
  return homepageOfferWall(96)
    .filter((offer) => offer.offer_key !== currentOffer.offer_key && offer.category === currentOffer.category)
    .slice(0, limit)
    .map((offer, index) => `<a class="card related-offer-card" href="${esc(offerLandingHref(offer))}"><span class="eyebrow">Related</span><strong>${esc(offer.title)}</strong><span>${esc(offer.category)}</span></a>`)
    .join('');
}
function offerLandingComponent(offer, index = 0) {
  const image = ensureOfferWallImage(offer, index);
  const goHref = offerGoHref(offer);
  const related = relatedOfferCards(offer);
  return `<section class="hero compact offer-landing surface" data-surface="offer-landing" data-offer-slug="${esc(offer.offer_key)}" data-crm-events="offer_landing_viewed,weekly_optin_started,disclosure_seen,trend_offer_clicked">
    <div class="offer-landing-grid"><div><p class="eyebrow">${esc(offer.vendor_name)} · ${esc(offer.category)}</p><h1>${esc(offer.title)}</h1><p class="lede">${esc(offer.summary || 'Compare current merchant details before buying. We may earn from qualifying purchases.')}</p><div class="tag-row"><span class="sticker">${offer.monetization_status === 'approved_lead_magnet' ? 'Approved lead magnet' : 'Approved monetized'}</span><span class="pill">No copied prices/reviews</span><span class="pill">Original SPG art</span></div><div class="cta-row"><a class="button primary" href="${esc(goHref)}" rel="sponsored nofollow" data-crm-event="trend_offer_clicked" data-go-slug="${esc(offer.offer_key)}">${esc(offer.cta || 'Check current options')} →</a><a class="button ghost" href="#weekly-picks">Save this lane</a></div><p class="trust-note">${esc(offer.disclosure)} Amazon/manual links may use StoreID ${AMAZON_ASSOCIATES_TAG}. Check current details with the merchant.</p></div><img class="offer-hero-image" src="${esc(image)}" alt="${esc(offer.image?.alt || `Original StuffPrettyGood cartoon image for ${offer.title}`)}"></div>
  </section>
  <section class="section article-layout"><article class="article-card prose"><p class="eyebrow">Why this page exists</p><h2>One landing page before every outbound click.</h2><p>StuffPrettyGood routes offer cards here first so the visitor sees the disclosure, original notes, category context, and preference options before any merchant redirect.</p><h2>What to check before clicking out</h2><ol><li>Confirm current price, availability, warranty, and return policy on the merchant site.</li><li>Ignore hype, fake urgency, and claims that are not shown by the merchant.</li><li>Use preferences if you want us to watch this type of offer.</li></ol></article><aside class="aside-card"><h2>Offer facts</h2><ul class="fact-list"><li><strong>Network:</strong> ${esc(offer.vendor_name)}</li><li><strong>Monetization:</strong> ${esc(offer.payout_model)}</li><li><strong>Tracking:</strong> ${esc(offer.tracking_status)}</li><li><strong>Image rights:</strong> ${esc(offer.image?.license || 'owned/generated')}</li></ul></aside></section>
  <section class="section signup-band"><div><p class="eyebrow">Want more like this?</p><h2>Save this category before we send anything.</h2><p>Preferences are recorded as web interest only. Live email/SMS stays gated in Mehyar Media.</p></div><div class="cta-row"><a class="button primary" href="/preferences.html">Set preferences</a><a class="button ghost" href="/unsubscribe.html">Unsubscribe</a></div></section>
  ${related ? `<section class="section"><div class="section-header"><div><p class="eyebrow">Related offers</p><h2>More in ${esc(offer.category)}</h2></div></div><div class="cards three">${related}</div></section>` : ''}
  ${weeklyForm('weekly-picks', `Get ${offer.category} picks`)}`;
}
function offerPages() {
  const offers = homepageOfferWall(96);
  for (const [index, offer] of offers.entries()) {
    const path = `/offers/${offer.offer_key}.html`;
    const jsonLd = { '@context':'https://schema.org', '@type':'Product', name: offer.title, description: offer.summary, image: absolute(ensureOfferWallImage(offer, index)), brand: { '@type':'Brand', name:'StuffPrettyGood' }, url: absolute(path) };
    write(`offers/${offer.offer_key}.html`, basePage({ title: offer.seo?.title || offer.title, description: offer.seo?.description || offer.summary, path, body: offerLandingComponent(offer, index), jsonLd, type:'product' }));
  }
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
  const offerLandingPages = homepageOfferWall(96).map((offer)=>`/offers/${offer.offer_key}.html`);
  const pages = ['/index.html','/today.html','/trends.html','/daily.html','/deals.html','/ai-tool-stack-quiz.html','/preferences.html','/unsubscribe.html',...trendOfferLanes.map(l=>`/trends/${l.slug}.html`),...offerLandingPages,...trendOfferLanes.flatMap(l=>getLaneTargets(l).filter(t=>t.type==='amazon_search').map(t=>`/go/${t.slug}.html`))];
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: https://stuffprettygood.com/sitemap.xml\n`);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((p)=>`\n  <url><loc>${absolute(p)}</loc><lastmod>${today}</lastmod></url>`).join('')}\n</urlset>\n`);
}

homePage(); todayPage(); hubPage(); dailyPage(); for (const lane of trendOfferLanes) lanePage(lane); offerPages(); goPages(); seoFiles();
console.log(JSON.stringify({ status:'built', lanes:trendOfferLanes.length, rssCandidates:(rss.candidates||[]).length, homepageOfferWall:homepageOfferWall(48).length, amazonTag:AMAZON_ASSOCIATES_TAG }, null, 2));
