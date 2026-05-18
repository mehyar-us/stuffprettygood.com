import fs from 'fs';
import path from 'path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const AMAZON_TAG = process.env.SPG_AMAZON_ASSOCIATES_TAG || process.env.AMAZON_ASSOCIATES_TAG || 'mehyarmedia-20';

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(path.join(dist, 'assets/products'), { recursive: true });
fs.mkdirSync(path.join(dist, 'assets/site'), { recursive: true });

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
const searchTerm = (p) => {
  const url = new URL(p.affiliate_url);
  return url.searchParams.get('k') || p.title;
};
const amazonNativeAd = (p, compact = false) => `<div class="amazon-native ${compact ? 'compact' : ''}" aria-label="Live Amazon product preview for ${esc(p.title)}"><div class="native-fallback"><img src="${p.image_url}" alt="${esc(p.title)} illustrated fallback"><span>Loading Amazon product images…</span></div><script>amzn_assoc_placement="adunit0";amzn_assoc_search_bar="false";amzn_assoc_tracking_id="${AMAZON_TAG}";amzn_assoc_ad_mode="search";amzn_assoc_ad_type="smart";amzn_assoc_marketplace="amazon";amzn_assoc_region="US";amzn_assoc_title="Shop related picks";amzn_assoc_default_search_phrase=${JSON.stringify(searchTerm(p))};amzn_assoc_default_category="All";</script><script src="https://z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US"></script></div>`;

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
  <text x="320" y="286" text-anchor="middle" font-family="Inter,Arial" font-size="18" font-weight="700" fill="#64748b">useful shopping pick</text>
  <path d="M94 350 C182 326 258 376 346 342 S512 326 562 362" fill="none" stroke="#fb923c" stroke-width="12" stroke-linecap="round" opacity=".75"/>
</svg>`;
}

for (const p of products) fs.writeFileSync(path.join(dist, p.image_url), productSvg(p));


const siteArtSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 360" role="img" aria-label="Stuff Pretty Good shopping guide visual">
  <defs><linearGradient id="spg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111827"/><stop offset=".42" stop-color="#0f766e"/><stop offset="1" stop-color="#fb923c"/></linearGradient><filter id="glow"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#0f172a" flood-opacity=".22"/></filter></defs>
  <rect width="960" height="360" rx="44" fill="url(#spg)"/>
  <circle cx="112" cy="92" r="58" fill="#fff7ed" opacity=".22"/><circle cx="828" cy="76" r="82" fill="#bfdbfe" opacity=".2"/>
  <g filter="url(#glow)"><rect x="105" y="86" width="190" height="190" rx="34" fill="#ffffff"/><rect x="332" y="58" width="250" height="244" rx="38" fill="#ffffff"/><rect x="620" y="86" width="230" height="190" rx="34" fill="#ffffff"/></g>
  <text x="200" y="190" text-anchor="middle" font-size="86">🎁</text><text x="457" y="180" text-anchor="middle" font-size="98">🛒</text><text x="735" y="190" text-anchor="middle" font-size="86">⚡</text>
  <text x="480" y="330" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="900" fill="#fff7ed">useful finds · smarter gifts · practical upgrades</text>
</svg>`;
fs.writeFileSync(path.join(dist, 'assets/site/spg-shopping-guide.svg'), siteArtSvg);

function newTabLinks(html) {
  return String(html).replace(/<a\b(?![^>]*\btarget=)/g, '<a target="_blank"');
}
function layout(title, body, description = 'AI-assisted shopping guide for useful gifts, starter kits, and practical products.') {
  return newTabLinks(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="fo-verify" content="da9ff319-a228-4e53-905f-5cde75aaf50b"><title>${esc(title)} | Stuff Pretty Good</title><meta name="description" content="${esc(description)}"><link rel="stylesheet" href="/styles.css"></head><body><div class="site-shell"><nav class="nav"><a class="logo" href="/"><span class="logo-mark">SPG</span><span>Stuff Pretty Good</span></a><div class="nav-links"><a href="/gift-finder/">Gift Finder</a><a href="/starter-kits/">Starter Kits</a><a href="/under-50/">Under $50</a><a href="/signup/">Sign up</a></div></nav><div class="page-art"><img src="/assets/site/spg-shopping-guide.svg" alt="Stuff Pretty Good shopping guide visual"></div>${body}${assistantWidget()}<footer class="footer"><div><strong>Stuff Pretty Good</strong><p>Useful finds, starter kits, and gifts picked to help you buy faster and waste less.</p></div><div class="footer-links"><a href="/affiliate-disclosure/">Affiliate Disclosure</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/contact/">Contact</a><a href="/signup/">Sign up</a><a href="/unsubscribe/">Unsubscribe</a><a href="/preferences/">Preferences</a></div></footer></div></body></html>`);
}

function card(p, i = 0) {
  return `<article class="card" style="--delay:${i % 6}"><a class="thumb" href="/products/${p.id}/"><img src="${p.image_url}" alt="${esc(p.title)} illustrated fallback"></a><div class="real-photo-note">Open the pick for photos and details.</div><div class="card-meta"><span>${esc(p.price_band.replace('-', ' $'))}</span><span>${esc(p.category.replace('-', ' '))}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.why_useful)}</p><p class="best"><strong>Best for:</strong> ${esc(p.best_for)}</p><a class="btn small" href="/products/${p.id}/">Get</a></article>`;
}


function assistantWidget() {
  const knowledge = products.map((p) => ({ id: p.id, title: p.title, category: p.category, price_band: p.price_band, image_url: p.image_url, why_useful: p.why_useful, best_for: p.best_for, avoid_if: p.avoid_if })).slice(0, 180);
  const siteFacts = {
    brand: 'Stuff Pretty Good helps shoppers find useful gifts, starter kits, travel gear, kitchen helpers, pet fixes, home-office upgrades, and budget finds.',
    rules: 'The assistant recommends products already on the site and sends shoppers to internal pick pages first.',
    shipping: 'Purchases, pricing, shipping, returns, warranties, and availability are handled by the merchant. Confirm details before buying.',
    signup: 'You can sign up with email only; first name, last name, zip, and phone are optional.',
    bestQuestions: ['gift for dad under $50', 'travel kit for a long flight', 'desk setup under $100', 'pet cleanup products', 'small apartment essentials']
  };
  return `<div class="ai-bubble" data-ai-bubble><button class="ai-launch" type="button" aria-label="Open SPG AI helper"><span>AI</span><strong>Ask SPG</strong></button><section class="ai-panel" hidden><header><div><p class="eyebrow">SPG AI Helper</p><h2>Ask about gifts, kits, budgets, or any pick.</h2></div><button type="button" class="ai-close" aria-label="Close">×</button></header><div class="ai-messages" data-ai-messages></div><form class="ai-form" data-ai-form><input name="q" autocomplete="off" placeholder="Ask: gift for dad under $50" required><button type="submit">Ask</button></form><div class="ai-suggestions"><button type="button">gift under $25</button><button type="button">travel kit</button><button type="button">desk setup</button><button type="button">pet problem</button></div></section></div><script type="application/json" id="spg-ai-catalog">${JSON.stringify({ products: knowledge, siteFacts }).replace(/</g, '\\u003c')}</script><script>
(function(){
  const root = document.querySelector('[data-ai-bubble]');
  const dataEl = document.getElementById('spg-ai-catalog');
  if (!root || !dataEl) return;
  const data = JSON.parse(dataEl.textContent);
  const products = data.products || [];
  const facts = data.siteFacts || {};
  const launch = root.querySelector('.ai-launch');
  const panel = root.querySelector('.ai-panel');
  const close = root.querySelector('.ai-close');
  const form = root.querySelector('[data-ai-form]');
  const messages = root.querySelector('[data-ai-messages]');
  const suggestions = root.querySelectorAll('.ai-suggestions button');
  const sessionKey = 'spg_ai_session_v1';
  const esc = (v) => String(v || '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const history = JSON.parse(sessionStorage.getItem(sessionKey) || '[]');
  function save(){ sessionStorage.setItem(sessionKey, JSON.stringify(history.slice(-12))); }
  function add(role, html){
    const item = document.createElement('div');
    item.className = 'ai-msg ' + role;
    item.innerHTML = html;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }
  function renderHistory(){ messages.innerHTML=''; if (!history.length) add('bot', '<strong>Tell me what you need.</strong><br>I can help with gifts, starter kits, budget finds, categories, product tradeoffs, signup, and site questions.'); history.forEach(m => add(m.role, m.html)); }
  function budgetMatch(p, q){
    if (/under\s*25|\$25|cheap/i.test(q)) return p.price_band === 'under-25';
    if (/under\s*50|\$50/i.test(q)) return p.price_band === 'under-50' || p.price_band === 'under-25';
    if (/under\s*100|\$100/i.test(q)) return ['under-100','under-50','under-25'].includes(p.price_band);
    return true;
  }
  const aliases = {gift:['gift','present','birthday','holiday','dad','mom','coworker','friend'],travel:['travel','flight','trip','hotel','carry'],kitchen:['kitchen','cook','meal','coffee'],pets:['pet','dog','cat','fur'],tech:['tech','charger','usb','phone','cable'],car:['car','drive','road'],home:['home','apartment','room'],organization:['organize','storage','clutter'],wellness:['sleep','wellness','shower','self care'],'home-office':['desk','office','work','laptop','productivity']};
  function score(p, q){
    const text = (p.title+' '+p.category+' '+p.why_useful+' '+p.best_for+' '+p.avoid_if).toLowerCase();
    let s = budgetMatch(p,q) ? 2 : -10;
    q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).forEach(t => { if (text.includes(t)) s += 4; });
    Object.entries(aliases).forEach(([cat, words]) => { if (words.some(w => q.toLowerCase().includes(w))) s += p.category === cat ? 8 : 1; });
    return s;
  }
  function recommend(q, n=4){ return products.map(p => ({...p, score: score(p,q)})).filter(p => p.score > -5).sort((a,b)=>b.score-a.score).slice(0,n); }
  function answer(q){
    const low = q.toLowerCase();
    if (/privacy|unsubscribe|preferences|sign ?up|email|phone|zip/.test(low)) return 'You can <a target="_blank" href="/signup/">sign up here</a>, <a target="_blank" href="/preferences/">set preferences here</a>, or <a target="_blank" href="/unsubscribe/">unsubscribe here</a>. Email is required; first name, last name, zip, and phone are optional.';
    if (/return|shipping|warranty|price|availability/.test(low)) return esc(facts.shipping);
    if (/what is this|about|how does/.test(low)) return esc(facts.brand) + ' Ask me for a budget, person, problem, or setup and I will point you to useful picks.';
    const picks = recommend(q, 5);
    if (!picks.length) return 'I did not find a tight match yet. Try a clearer need like “travel gift under $50,” “desk setup,” “kitchen time saver,” or “pet cleanup.”';
    return '<strong>Good shortlist:</strong>' + picks.map(p => '<a target="_blank" class="ai-pick" href="/products/'+esc(p.id)+'/"><img src="'+esc(p.image_url)+'" alt="'+esc(p.title)+'"><span><b>'+esc(p.title)+'</b><em>'+esc(p.why_useful)+'</em><small>Best for: '+esc(p.best_for)+'</small><strong>Get</strong></span></a>').join('') + '<p class="micro">Tip: ask “what should I avoid?” or “show cheaper picks” to narrow it.</p>';
  }
  launch.addEventListener('click', function(){ panel.hidden = false; root.classList.add('open'); renderHistory(); });
  close.addEventListener('click', function(){ panel.hidden = true; root.classList.remove('open'); });
  suggestions.forEach(btn => btn.addEventListener('click', function(){ panel.hidden=false; root.classList.add('open'); form.q.value = btn.textContent; form.dispatchEvent(new Event('submit', {cancelable:true})); }));
  form.addEventListener('submit', function(e){
    e.preventDefault();
    const q = new FormData(form).get('q').trim(); if (!q) return;
    const user = { role:'user', html: esc(q) };
    const bot = { role:'bot', html: answer(q) };
    history.push(user, bot); save(); renderHistory(); form.reset();
  });
})();
</script>`;
}

function mkdirPage(route, html) {
  const dir = path.join(dist, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), newTabLinks(html));
}

const categories = ['gift-finder', 'starter-kits', 'under-25', 'under-50', 'travel', 'home-office', 'kitchen', 'pets', 'tech', 'useful-finds'];
const featured = products.slice(0, 12);

const home = `<section class="hero"><div class="hero-copy"><div class="eyebrow">Practical shopping guide</div><h1>Useful stuff worth buying. Less noise, better picks.</h1><p class="sub">Find gifts, starter kits, travel gear, kitchen helpers, home-office upgrades, and budget-friendly everyday fixes. Each pick is curated for a real use case, with a simple path to shop when it fits.</p><div class="actions"><a class="btn" href="/gift-finder/">Find a Gift</a><a class="btn ghost" href="/starter-kits/">Build a Starter Kit</a><a class="btn ghost" href="/under-50/">Find Stuff Under $50</a></div></div><div class="hero-card commerce-card"><div class="mini-label">Buy smarter today</div><h2>Fast picks for gifts, setups, travel, pets, kitchens, and the tiny upgrades that make life easier.</h2><div class="hero-stack"><span>🎁 Gift-ready</span><span>🖥️ Desk upgrades</span><span>✈️ Travel helpers</span><span>🍳 Kitchen fixes</span><span>🐾 Pet problem-solvers</span></div><p class="micro trust-line">Curated first. Shoppable when it makes sense.</p></div></section>
<section class="section split sales-strip"><div><p class="eyebrow">How it works</p><h2>Tell us the job. We show the stuff worth considering.</h2></div><p class="sub">Stuff Pretty Good is built around useful outcomes: better gifts, cleaner desks, smarter travel, faster kitchens, calmer pet care, and budget-friendly upgrades. No endless marketplace scrolling — just practical shortlists with clear why-to-buy and avoid-if notes.</p></section>
<section class="section"><div class="section-head"><div><p class="eyebrow">Featured finds</p><h2>Small upgrades with high everyday payoff</h2></div><a class="pill" href="/useful-finds/">Browse all</a></div><div class="grid">${featured.map(card).join('')}</div></section>
<section class="section"><div class="section-head"><div><p class="eyebrow">Fresh daily picks</p><h2>New useful finds from the live catalog</h2></div><a class="pill" href="/useful-finds/">See more</a></div><div class="grid" data-live-picks><p class="micro">Loading today’s fresh picks…</p></div></section>${liveDailyPicksScript()}
<section class="section lanes"><a href="/under-25/"><strong>Under $25</strong><span>cheap useful wins</span></a><a href="/under-50/"><strong>Under $50</strong><span>gift-safe picks</span></a><a href="/travel/"><strong>Travel</strong><span>stuff people actually use</span></a><a href="/home-office/"><strong>Home office</strong><span>cleaner desk setups</span></a></section>
<section class="section panel"><div class="section-head"><div><p class="eyebrow">Buying guides</p><h2>Start with the problem. Leave with a shortlist.</h2></div></div><div class="guide-list">${posts.map((p) => `<a href="/guides/${p.slug}/">${esc(p.title)}<span>Get guide →</span></a>`).join('')}</div></section>
<section class="signup-band"><div><p class="eyebrow">Email list</p><h2>Get useful finds without doom-scrolling.</h2><p>Join for useful finds, gift ideas, and starter kits. Email is required; everything else is optional.</p></div>${signupForm('homepage')}</section>`;
mkdirPage('', layout('AI-assisted shopping guide', home));

function filtered(route) {
  if (route === 'under-25' || route === 'under-50') return products.filter((p) => p.price_band === route);
  if (route === 'tech') return products.filter((p) => p.category === 'tech');
  if (route === 'useful-finds') return products;
  return products.filter((p) => p.category === route).concat(products.slice(0, 4));
}

for (const route of categories.filter((r) => !['gift-finder', 'starter-kits', 'useful-finds'].includes(r))) {
  const picks = filtered(route).slice(0, 12);
  mkdirPage(route, layout(titleCase(route), `<section class="section"><p class="eyebrow">Useful picks</p><h1>${titleCase(route)}</h1><p class="sub">Practical Amazon picks organized by budget, job, and real-life usefulness.</p><div class="grid">${picks.map(card).join('')}</div></section>`));
}

for (const p of products) {
  mkdirPage(`products/${p.id}`, layout(p.title, `<article class="post product-detail"><div class="detail-grid"><div>${amazonNativeAd(p)}<p class="micro">Preview the pick, then confirm current details with the merchant before buying.</p></div><div><div class="card-meta"><span>${esc(p.category.replace('-', ' '))}</span><span>${esc(p.price_band.replace('-', ' $'))}</span></div><h1>${esc(p.title)}</h1><p class="sub">${esc(p.why_useful)}</p><p><strong>Best for:</strong> ${esc(p.best_for)}</p><p><strong>Avoid if:</strong> ${esc(p.avoid_if)}</p><a class="btn" href="/go/${p.id}/" rel="nofollow sponsored">Get</a></div></div></article>`));
  mkdirPage(`go/${p.id}`, `<!doctype html><meta charset="utf-8"><title>Redirecting</title><meta name="robots" content="noindex"><link rel="canonical" href="${p.affiliate_url}"><img src="${p.image_url}" alt="${esc(p.title)}" style="max-width:420px;width:100%;border-radius:20px"><p>Opening the pick…</p><script>location.replace(${JSON.stringify(p.affiliate_url)})</script><p><a href="${p.affiliate_url}" rel="nofollow sponsored noopener">Continue</a></p>`);
}

for (const post of posts) {
  const picks = products.filter((p) => p.category === post.category || p.price_band === post.category).concat(products).slice(0, 8);
  mkdirPage(`guides/${post.slug}`, layout(post.title, `<article class="post"><p class="eyebrow">Buying guide</p><h1>${esc(post.title)}</h1><p class="sub">${esc(post.intro)}</p><ol class="pick-list">${picks.map((p) => `<li><strong>${esc(p.title)}</strong><br>Why useful: ${esc(p.why_useful)}<br>Best for: ${esc(p.best_for)}<br>Avoid if: ${esc(p.avoid_if)}<br><a href="/products/${p.id}/">Get details</a></li>`).join('')}</ol></article>`));
}

function toolScript(seedProducts) {
  const safeProducts = seedProducts.map((p) => ({ id: p.id, title: p.title, category: p.category, price_band: p.price_band, image_url: p.image_url, why_useful: p.why_useful, best_for: p.best_for, avoid_if: p.avoid_if }));
  return `<script type="application/json" id="spg-catalog">${JSON.stringify(safeProducts).replace(/</g, '\\u003c')}</script><script>
(function(){
  const catalog = JSON.parse(document.getElementById('spg-catalog').textContent);
  const form = document.querySelector('[data-finder-form]');
  const results = document.querySelector('[data-finder-results]');
  if (!form || !results) return;
  const keywords = {
    gift:['gift','birthday','mom','dad','friend','partner','holiday','present','safe'],
    travel:['travel','trip','flight','hotel','carry','luggage','vacation'],
    'home-office':['office','desk','work','computer','setup','productivity'],
    kitchen:['kitchen','cook','meal','food','coffee'],
    pets:['pet','dog','cat','puppy','kitten'],
    tech:['tech','phone','charger','usb','gadget','computer'],
    car:['car','auto','drive','vehicle'],
    home:['home','apartment','room','organize','clean']
  };
  function score(p, q, budget){
    const text = (p.title+' '+p.category+' '+p.why_useful+' '+p.best_for+' '+p.avoid_if).toLowerCase();
    let score = 0;
    for (const token of q.split(/[^a-z0-9]+/).filter(Boolean)) if (text.includes(token)) score += 3;
    for (const [cat, words] of Object.entries(keywords)) if ((p.category === cat || words.some(w => q.includes(w)))) score += p.category === cat ? 5 : 1;
    if (budget && p.price_band === budget) score += 6;
    if (budget === 'under-50' && p.price_band === 'under-25') score += 3;
    return score;
  }
  function htmlEscape(value){ return String(value).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
  function render(items){
    results.innerHTML = items.map(function(p, idx){
      return '<article class="recommendation"><img src="'+htmlEscape(p.image_url)+'" alt="'+htmlEscape(p.title)+'"><div><span class="rank">Pick '+(idx+1)+'</span><h3>'+htmlEscape(p.title)+'</h3><p>'+htmlEscape(p.why_useful)+'</p><p><strong>Best for:</strong> '+htmlEscape(p.best_for)+'</p><p><strong>Skip if:</strong> '+htmlEscape(p.avoid_if)+'</p><a class="btn small" href="/products/'+htmlEscape(p.id)+'/">Get</a></div></article>';
    }).join('');
  }
  form.addEventListener('submit', function(e){
    e.preventDefault();
    const q = new FormData(form).get('intent').toLowerCase()+' '+new FormData(form).get('interests').toLowerCase();
    const budget = new FormData(form).get('budget');
    const ranked = catalog.map(p => ({...p, score: score(p, q, budget)})).sort((a,b) => b.score - a.score).slice(0,8);
    render(ranked);
    results.scrollIntoView({behavior:'smooth', block:'start'});
  });
  render(catalog.slice(0,6));
})();
</script>`;
}

function toolPage(name, desc, mode = 'gift') {
  const seed = products.slice(mode === 'kit' ? 8 : 0, mode === 'kit' ? 24 : 24);
  const examples = mode === 'kit'
    ? ['home office under $250', 'travel kit under $150', 'first apartment essentials']
    : ['gift for dad under $50', 'practical gift for coworker', 'pet owner gift'];
  return layout(name, `<section class="section tool upgraded-tool"><div><p class="eyebrow">AI shopping assistant</p><h1>${esc(name)}</h1><p class="sub">${esc(desc)} Ask naturally. Answers are grounded in useful picks and guides already on Stuff Pretty Good.</p><form class="finder" data-finder-form><label>What are you shopping for?<input class="input" name="intent" placeholder="${esc(examples[0])}" required></label><label>Budget<select class="input" name="budget"><option value="">Any budget</option><option value="under-25">Under $25</option><option value="under-50">Under $50</option><option value="under-100">Under $100</option></select></label><label>Interests / situation<input class="input" name="interests" placeholder="${esc(examples.slice(1).join(' · '))}"></label><button class="btn" type="submit">Find my shortlist</button></form><p class="notice">Tip: try “travel gift under $50,” “desk setup,” “pet problem,” or “kitchen time saver.”</p></div><div class="tool-preview"><h2>What you get</h2><ul><li>5–8 practical picks</li><li>why it helps</li><li>who it fits</li><li>when to skip it</li></ul></div></section><section class="section results-section"><div class="section-head"><div><p class="eyebrow">AI shortlist</p><h2>Useful picks for this session</h2></div></div><div class="recommendation-list" data-finder-results></div></section>${toolScript(seed)}`);
}
mkdirPage('gift-finder', toolPage('AI Gift Finder', 'Answer a few prompts and get gift ideas from the approved-offer catalog only.'));
mkdirPage('starter-kits', toolPage('AI Starter Kit Builder', 'Build useful setups from approved affiliate products only.', 'kit'));
mkdirPage('useful-finds', layout('Useful Finds', `<section class="section"><p class="eyebrow">Useful picks</p><h1>Useful Finds</h1><p class="sub">Browse useful upgrades for gifts, home, kitchen, travel, tech, pets, and everyday problems.</p><div class="section-head"><div><p class="eyebrow">Fresh daily picks</p><h2>Newest from the live catalog</h2></div></div><div class="grid" data-live-picks><p class="micro">Loading daily picks…</p></div>${liveDailyPicksScript()}<h2>Full launch catalog</h2><div class="grid">${products.map(card).join('')}</div></section>`));

function signupForm(source = 'site') {
  return `<form class="signup-form" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/subscribe"><input type="hidden" name="source" value="${esc(source)}"><div class="form-grid"><label>First name<input name="first_name" autocomplete="given-name"></label><label>Last name<input name="last_name" autocomplete="family-name"></label><label>Email required<input name="email" type="email" autocomplete="email" required></label><label>Zip<input name="zip" inputmode="numeric" autocomplete="postal-code"></label><label>Phone optional<input name="phone" type="tel" autocomplete="tel"></label></div><button class="btn" type="submit">Sign up</button><p class="micro">Get practical finds, gift ideas, and useful under-budget picks. Unsubscribe anytime.</p></form>`;
}


function liveDailyPicksScript() {
  return `<script>
(function(){
  const mount = document.querySelector('[data-live-picks]');
  if (!mount) return;
  function esc(value){ return String(value || '').replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
  fetch('https://stuffprettygood-api.mehyar.workers.dev/api/catalog?limit=12')
    .then(function(r){ return r.json(); })
    .then(function(data){
      const products = (data.products || []).slice(0, 12);
      if (!products.length) return;
      mount.innerHTML = products.map(function(p){
        return '<article class="card"><a class="thumb" href="https://stuffprettygood-api.mehyar.workers.dev/products/'+encodeURIComponent(p.id)+'"><img src="'+esc(p.image_url)+'" alt="'+esc(p.title)+'"></a><div class="card-meta"><span>'+esc(String(p.price_band).replace('-', ' $'))+'</span><span>'+esc(String(p.category).replace('-', ' '))+'</span></div><h3>'+esc(p.title)+'</h3><p>'+esc(p.why_useful)+'</p><p class="best"><strong>Best for:</strong> '+esc(p.best_for)+'</p><a class="btn small" href="https://stuffprettygood-api.mehyar.workers.dev/products/'+encodeURIComponent(p.id)+'">Get</a></article>';
      }).join('');
    })
    .catch(function(){ mount.innerHTML = '<p class="micro">Daily picks are refreshing. Try the static catalog below.</p>'; });
})();
</script>`;
}

const policyPages = {
  about: `<h1>About Stuff Pretty Good</h1><p class="sub">Stuff Pretty Good is an AI-assisted shopping guide by MehyarSoft LLC for useful products, gifts, starter kits, and budget finds.</p><p>We help shoppers move from vague need to practical shortlist: what it helps with, who it fits, and when to skip it.</p>`,
  advertise: `<h1>Advertise / Partner</h1><p class="sub">Reach shoppers looking for practical gifts, starter kits, useful home upgrades, travel helpers, and budget-friendly finds.</p><p>We are building a clean commerce publication around helpful recommendations, clear categories, and opt-in email.</p><p>Contact: hello@mehyar.us</p>`,
  'affiliate-disclosure': `<h1>Affiliate Disclosure</h1><p class="sub">Stuff Pretty Good partners with shopping programs so the guide can stay free for readers.</p><p>Stuff Pretty Good may receive credit from qualifying purchases through shopping links on the site.</p><p>Our goal is simple: explain why a pick is useful, who it fits, and when to skip it.</p>`,
  privacy: `<h1>Privacy Policy</h1><p class="sub">We collect only what is needed to operate the site, recommendations, preferences, subscriptions, analytics, and compliance.</p><p>Signup fields may include first name, last name, email, zip, and phone. Email is required; the rest are optional unless clearly stated otherwise.</p><p>We may record product clicks to understand which categories are most useful. Purchases happen with the merchant, not on this site.</p><p>Contact privacy questions at hello@mehyar.us.</p>`,
  terms: `<h1>Terms of Service</h1><p class="sub">Use Stuff Pretty Good lawfully. Product availability, pricing, shipping, returns, warranties, and merchant terms are controlled by the merchant.</p><p>Our recommendations are informational. Always confirm product details, merchant terms, shipping, returns, warranties, and current pricing before buying.</p><p>Do not abuse forms, scrape the site aggressively, or interfere with the service.</p>`,
  contact: `<h1>Contact</h1><p class="sub">Questions, corrections, product suggestions, affiliate partnerships, or takedown requests: hello@mehyar.us</p><p>Company: MehyarSoft LLC. Company site: <a href="https://mehyar.us">mehyar.us</a></p>`,
  signup: `<h1>Sign up for Pretty Good Finds</h1><p class="sub">Join for useful finds, gift ideas, and starter kits. Email is required; everything else is optional.</p>${signupForm('signup-page')}`,
  unsubscribe: `<h1>Unsubscribe</h1><p class="sub">Enter your email to opt out of Stuff Pretty Good emails.</p><form class="signup-form" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/unsubscribe"><label>Email required<input name="email" type="email" required></label><button class="btn" type="submit">Unsubscribe</button></form>`,
  preferences: `<h1>Preferences</h1><p class="sub">Choose what you care about so future emails stay useful.</p><form class="signup-form" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/preferences"><label>Email required<input name="email" type="email" required></label><div class="checks"><label><input type="checkbox" name="interests" value="gifts"> Gifts</label><label><input type="checkbox" name="interests" value="home"> Home</label><label><input type="checkbox" name="interests" value="tech"> Tech</label><label><input type="checkbox" name="interests" value="travel"> Travel</label><label><input type="checkbox" name="interests" value="pets"> Pets</label><label><input type="checkbox" name="interests" value="kitchen"> Kitchen</label><label><input type="checkbox" name="interests" value="under-50"> Useful deals under $50</label></div><button class="btn" type="submit">Save preferences</button></form>`
};
for (const [slug, html] of Object.entries(policyPages)) mkdirPage(slug, layout(titleCase(slug), `<section class="section post">${html}</section>`));

fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://stuffprettygood.com/sitemap.xml\n');
const urls = ['', 'gift-finder', 'starter-kits', 'under-25', 'under-50', 'useful-finds', 'signup', 'about', 'advertise', 'affiliate-disclosure', 'privacy', 'terms', 'contact', 'unsubscribe', 'preferences', ...posts.map((p) => 'guides/' + p.slug), ...products.map((p) => 'products/' + p.id)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>https://stuffprettygood.com${slugUrl(u)}</loc></url>`).join('')}</urlset>`);

console.log(`built ${products.length} approved products, ${posts.length} guides`);
