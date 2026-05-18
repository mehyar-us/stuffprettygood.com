import fs from 'fs';
import path from 'path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const AMAZON_TAG = process.env.SPG_AMAZON_ASSOCIATES_TAG || process.env.AMAZON_ASSOCIATES_TAG || 'mehyarmedia-20';

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(path.join(dist, 'assets/products'), { recursive: true });

const data = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
const posts = JSON.parse(fs.readFileSync('data/posts.json', 'utf8')).posts;
const products = data.products.filter((p) =>
  p.affiliate_status === 'approved' &&
  p.approval_status === 'approved' &&
  p.affiliate_url &&
  p.affiliate_url.includes(`tag=${AMAZON_TAG}`)
);

fs.copyFileSync('src/styles.css', path.join(dist, 'styles.css'));

const esc = (s = '') => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const titleCase = (s) => esc(String(s).replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
const slugUrl = (route = '') => `/${route}${route && !route.endsWith('/') ? '/' : ''}`;
const categoryEmoji = {
  tech: '⚡', kitchen: '🍳', 'home-office': '🖥️', travel: '✈️', pets: '🐾', car: '🚗', home: '🏠', wellness: '🌿', organization: '📦'
};

function productSvg(p) {
  const emoji = categoryEmoji[p.category] || '✨';
  const label = p.title.split(' ').slice(0, 3).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img" aria-label="${esc(p.title)} illustration">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff7ed"/><stop offset="0.55" stop-color="#eefdf4"/><stop offset="1" stop-color="#eaf2ff"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#111827" flood-opacity=".16"/></filter>
  </defs>
  <rect width="640" height="420" rx="38" fill="url(#bg)"/>
  <circle cx="96" cy="86" r="56" fill="#ffedd5"/>
  <circle cx="538" cy="80" r="82" fill="#dbeafe" opacity=".75"/>
  <rect x="116" y="96" width="408" height="220" rx="34" fill="#ffffff" filter="url(#shadow)"/>
  <text x="320" y="196" text-anchor="middle" font-size="76">${emoji}</text>
  <text x="320" y="250" text-anchor="middle" font-family="Inter,Arial" font-size="28" font-weight="900" fill="#111827">${esc(label)}</text>
  <text x="320" y="286" text-anchor="middle" font-family="Inter,Arial" font-size="18" font-weight="700" fill="#64748b">approved Amazon find</text>
  <path d="M94 350 C182 326 258 376 346 342 S512 326 562 362" fill="none" stroke="#fb923c" stroke-width="12" stroke-linecap="round" opacity=".75"/>
</svg>`;
}

for (const p of products) fs.writeFileSync(path.join(dist, p.image_url), productSvg(p));

function layout(title, body, description = 'AI-assisted shopping guide using affiliate-approved products only.') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Stuff Pretty Good</title><meta name="description" content="${esc(description)}"><link rel="stylesheet" href="/styles.css"></head><body><div class="site-shell"><nav class="nav"><a class="logo" href="/"><span class="logo-mark">SPG</span><span>Stuff Pretty Good</span></a><div class="nav-links"><a href="/gift-finder/">Gift Finder</a><a href="/starter-kits/">Starter Kits</a><a href="/under-50/">Under $50</a><a href="/signup/">Sign up</a></div></nav>${body}<footer class="footer"><div><strong>Stuff Pretty Good</strong><p>Useful finds, starter kits, and gifts — only through approved affiliate links.</p></div><div class="footer-links"><a href="/affiliate-disclosure/">Affiliate Disclosure</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/contact/">Contact</a><a href="/signup/">Sign up</a><a href="/unsubscribe/">Unsubscribe</a><a href="/preferences/">Preferences</a></div></footer></div></body></html>`;
}

function card(p, i = 0) {
  return `<article class="card" style="--delay:${i % 6}"><a class="thumb" href="/products/${p.id}/"><img src="${p.image_url}" alt="${esc(p.title)} illustrated card"></a><div class="card-meta"><span>${esc(p.price_band.replace('-', ' $'))}</span><span>${esc(p.category.replace('-', ' '))}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.why_useful)}</p><p class="best"><strong>Best for:</strong> ${esc(p.best_for)}</p><a class="btn small" href="/products/${p.id}/">See the pick</a></article>`;
}

function mkdirPage(route, html) {
  const dir = path.join(dist, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

const categories = ['gift-finder', 'starter-kits', 'under-25', 'under-50', 'travel', 'home-office', 'kitchen', 'pets', 'tech', 'useful-finds'];
const featured = products.slice(0, 12);

const home = `<section class="hero"><div class="hero-copy"><div class="eyebrow">AI-assisted shopping guide · Amazon-first</div><h1>Useful stuff worth buying. Less noise, better picks.</h1><p class="sub">Find gifts, starter kits, travel gear, kitchen helpers, home-office upgrades, and budget-friendly everyday fixes. Every product button routes through an approved affiliate link.</p><div class="actions"><a class="btn" href="/gift-finder/">Find a Gift</a><a class="btn ghost" href="/starter-kits/">Build a Starter Kit</a><a class="btn ghost" href="/under-50/">Find Stuff Under $50</a></div></div><div class="hero-card"><div class="mini-label">Today’s angle</div><h2>Practical picks by use case, not hype.</h2><div class="hero-stack"><span>🎁 Gifts</span><span>🖥️ Work setups</span><span>✈️ Travel kits</span><span>🍳 Kitchen wins</span><span>🐾 Pet fixes</span></div><p class="micro">Disclosure: paid links may earn us a commission at no extra cost to you.</p></div></section>
<section class="section split"><div><p class="eyebrow">How it works</p><h2>Approved links only, explained plainly.</h2></div><p class="sub">We keep a curated catalog of monetized products. If a product does not have an approved affiliate route, it does not get a buy button. That protects the business and keeps the site from becoming a random link dump.</p></section>
<section class="section"><div class="section-head"><div><p class="eyebrow">Featured finds</p><h2>Useful picks people can act on now</h2></div><a class="pill" href="/useful-finds/">Browse all</a></div><div class="grid">${featured.map(card).join('')}</div></section>
<section class="section lanes"><a href="/under-25/"><strong>Under $25</strong><span>cheap useful wins</span></a><a href="/under-50/"><strong>Under $50</strong><span>gift-safe picks</span></a><a href="/travel/"><strong>Travel</strong><span>stuff people actually use</span></a><a href="/home-office/"><strong>Home office</strong><span>cleaner desk setups</span></a></section>
<section class="section panel"><div class="section-head"><div><p class="eyebrow">Original guides</p><h2>Built for approvals and buyer intent</h2></div></div><div class="guide-list">${posts.map((p) => `<a href="/guides/${p.slug}/">${esc(p.title)}<span>Read guide →</span></a>`).join('')}</div></section>
<section class="signup-band"><div><p class="eyebrow">Email list</p><h2>Get useful finds without doom-scrolling.</h2><p>Email is required. First name, last name, zip, and phone are optional.</p><p class="notice">As an Amazon Associate, Stuff Pretty Good earns from qualifying purchases.</p></div>${signupForm('homepage')}</section>`;
mkdirPage('', layout('AI-assisted shopping guide', home));

function filtered(route) {
  if (route === 'under-25' || route === 'under-50') return products.filter((p) => p.price_band === route);
  if (route === 'tech') return products.filter((p) => p.category === 'tech');
  if (route === 'useful-finds') return products;
  return products.filter((p) => p.category === route).concat(products.slice(0, 4));
}

for (const route of categories.filter((r) => !['gift-finder', 'starter-kits', 'useful-finds'].includes(r))) {
  const picks = filtered(route).slice(0, 12);
  mkdirPage(route, layout(titleCase(route), `<section class="section"><p class="eyebrow">Approved catalog</p><h1>${titleCase(route)}</h1><p class="sub">Affiliate-approved Amazon finds only. No unmonetized outbound product links.</p><div class="grid">${picks.map(card).join('')}</div></section>`));
}

for (const p of products) {
  mkdirPage(`products/${p.id}`, layout(p.title, `<article class="post product-detail"><div class="detail-grid"><img class="detail-img" src="${p.image_url}" alt="${esc(p.title)} illustrated card"><div><div class="card-meta"><span>${esc(p.category.replace('-', ' '))}</span><span>${esc(p.price_band.replace('-', ' $'))}</span></div><h1>${esc(p.title)}</h1><p class="sub">${esc(p.why_useful)}</p><p><strong>Best for:</strong> ${esc(p.best_for)}</p><p><strong>Avoid if:</strong> ${esc(p.avoid_if)}</p><a class="btn" href="/go/${p.id}/" rel="nofollow sponsored">View approved Amazon link</a><p class="notice">As an Amazon Associate, Stuff Pretty Good earns from qualifying purchases.</p></div></div></article>`));
  mkdirPage(`go/${p.id}`, `<!doctype html><meta charset="utf-8"><title>Redirecting</title><meta name="robots" content="noindex"><link rel="canonical" href="${p.affiliate_url}"><p>Redirecting to approved merchant…</p><script>location.replace(${JSON.stringify(p.affiliate_url)})</script><p><a href="${p.affiliate_url}" rel="nofollow sponsored">Continue</a></p>`);
}

for (const post of posts) {
  const picks = products.filter((p) => p.category === post.category || p.price_band === post.category).concat(products).slice(0, 8);
  mkdirPage(`guides/${post.slug}`, layout(post.title, `<article class="post"><p class="eyebrow">Buying guide</p><h1>${esc(post.title)}</h1><p class="sub">${esc(post.intro)}</p><ol class="pick-list">${picks.map((p) => `<li><strong>${esc(p.title)}</strong><br>Why useful: ${esc(p.why_useful)}<br>Best for: ${esc(p.best_for)}<br>Avoid if: ${esc(p.avoid_if)}<br><a href="/products/${p.id}/">Read the pick</a></li>`).join('')}</ol><p class="notice">Disclosure: Some links are paid links. As an Amazon Associate, Stuff Pretty Good earns from qualifying purchases.</p></article>`));
}

function toolPage(name, desc, mode = 'gift') {
  return layout(name, `<section class="section tool"><div><p class="eyebrow">v0.1 catalog-safe tool</p><h1>${esc(name)}</h1><p class="sub">${esc(desc)}</p><form class="finder"><input class="input" name="intent" placeholder="Who / what for?"><input class="input" name="budget" placeholder="Budget"><input class="input" name="interests" placeholder="Interests"><button class="btn" type="button">Search approved catalog</button></form><p class="notice">v0.1 uses approved catalog records only; AI must not invent products.</p></div><div class="tool-preview"><h2>Starter output</h2><p>We classify the intent, search approved catalog records, then explain why each item fits.</p></div></section><section class="section"><h2>Starter picks</h2><div class="grid">${products.slice(mode === 'kit' ? 8 : 0, mode === 'kit' ? 16 : 8).map(card).join('')}</div></section>`);
}
mkdirPage('gift-finder', toolPage('AI Gift Finder', 'Answer a few prompts and get gift ideas from the approved-offer catalog only.'));
mkdirPage('starter-kits', toolPage('AI Starter Kit Builder', 'Build useful setups from approved affiliate products only.', 'kit'));
mkdirPage('useful-finds', layout('Useful Finds', `<section class="section"><p class="eyebrow">Approved catalog</p><h1>Useful Finds</h1><p class="sub">Practical picks that solve daily annoyances.</p><div class="grid">${products.map(card).join('')}</div></section>`));

function signupForm(source = 'site') {
  return `<form class="signup-form" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/subscribe"><input type="hidden" name="source" value="${esc(source)}"><div class="form-grid"><label>First name<input name="first_name" autocomplete="given-name"></label><label>Last name<input name="last_name" autocomplete="family-name"></label><label>Email required<input name="email" type="email" autocomplete="email" required></label><label>Zip<input name="zip" inputmode="numeric" autocomplete="postal-code"></label><label>Phone optional<input name="phone" type="tel" autocomplete="tel"></label></div><button class="btn" type="submit">Sign up</button><p class="micro">By signing up, you agree to receive Stuff Pretty Good emails. Unsubscribe anytime.</p></form>`;
}

const policyPages = {
  about: `<h1>About Stuff Pretty Good</h1><p class="sub">Stuff Pretty Good is an AI-assisted shopping guide by MehyarSoft LLC for useful products, gifts, starter kits, and budget finds.</p><p>We are not trying to list everything. We curate practical products and only publish outbound product buttons when the merchant link is monetized through an approved affiliate relationship.</p>`,
  advertise: `<h1>Advertise / Partner</h1><p class="sub">Stuff Pretty Good works with compliant affiliate programs, approved paid placements, and useful merchant partnerships.</p><p>We do not accept misleading pricing claims, fake scarcity, incentivized clicks, trademark abuse, or unapproved outbound product links.</p><p>Contact: hello@mehyar.us</p>`,
  'affiliate-disclosure': `<h1>Affiliate Disclosure</h1><p class="sub">Disclosure: Some links are paid links. If you buy through them, Stuff Pretty Good may earn a commission at no extra cost to you.</p><p>As an Amazon Associate, Stuff Pretty Good earns from qualifying purchases.</p><p>We aim to explain why a product may be useful, who it is best for, and when to avoid it.</p>`,
  privacy: `<h1>Privacy Policy</h1><p class="sub">We collect only what is needed to operate the site, recommendations, preferences, subscriptions, analytics, and compliance.</p><p>Signup fields may include first name, last name, email, zip, and phone. Email is required; the rest are optional unless clearly stated otherwise.</p><p>We use affiliate links and may record clicks to understand which categories are useful. We do not sell a product directly on this site.</p><p>Contact privacy questions at hello@mehyar.us.</p>`,
  terms: `<h1>Terms of Service</h1><p class="sub">Use Stuff Pretty Good lawfully. Product availability, pricing, shipping, returns, warranties, and merchant terms are controlled by the merchant.</p><p>Our recommendations are informational and may include paid affiliate links. We do not guarantee that any product will fit your use case.</p><p>Do not abuse forms, scrape the site aggressively, or interfere with the service.</p>`,
  contact: `<h1>Contact</h1><p class="sub">Questions, corrections, affiliate partnerships, or takedown requests: hello@mehyar.us</p><p>Company: MehyarSoft LLC. Company site: <a href="https://mehyar.us">mehyar.us</a></p>`,
  signup: `<h1>Sign up for Pretty Good Finds</h1><p class="sub">Email is required. First name, last name, zip, and phone are optional.</p>${signupForm('signup-page')}`,
  unsubscribe: `<h1>Unsubscribe</h1><p class="sub">Enter your email to opt out of Stuff Pretty Good emails.</p><form class="signup-form" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/unsubscribe"><label>Email required<input name="email" type="email" required></label><button class="btn" type="submit">Unsubscribe</button></form>`,
  preferences: `<h1>Preferences</h1><p class="sub">Choose what you care about so future emails stay useful.</p><form class="signup-form" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/preferences"><label>Email required<input name="email" type="email" required></label><div class="checks"><label><input type="checkbox" name="interests" value="gifts"> Gifts</label><label><input type="checkbox" name="interests" value="home"> Home</label><label><input type="checkbox" name="interests" value="tech"> Tech</label><label><input type="checkbox" name="interests" value="travel"> Travel</label><label><input type="checkbox" name="interests" value="pets"> Pets</label><label><input type="checkbox" name="interests" value="kitchen"> Kitchen</label><label><input type="checkbox" name="interests" value="under-50"> Useful deals under $50</label></div><button class="btn" type="submit">Save preferences</button></form>`
};
for (const [slug, html] of Object.entries(policyPages)) mkdirPage(slug, layout(titleCase(slug), `<section class="section post">${html}</section>`));

fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://stuffprettygood.com/sitemap.xml\n');
const urls = ['', 'gift-finder', 'starter-kits', 'under-25', 'under-50', 'useful-finds', 'signup', 'about', 'advertise', 'affiliate-disclosure', 'privacy', 'terms', 'contact', 'unsubscribe', 'preferences', ...posts.map((p) => 'guides/' + p.slug), ...products.map((p) => 'products/' + p.id)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>https://stuffprettygood.com${slugUrl(u)}</loc></url>`).join('')}</urlset>`);

console.log(`built ${products.length} approved products, ${posts.length} guides`);
