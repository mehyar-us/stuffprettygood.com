import fs from 'fs';
import path from 'path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const AMAZON_TAG = process.env.SPG_AMAZON_ASSOCIATES_TAG || process.env.AMAZON_ASSOCIATES_TAG || 'mehyarmedia-20';

// Brand + operator constants used throughout the policy pages and the signup form.
// Declared at the top so the signup form (which renders before the rest of the file) can reference them.
const SPG_BRAND = 'Stuff Pretty Good';
const SPG_OPERATOR = 'MehyarSoft LLC';
const SPG_CONTACT_EMAIL = 'hello@mehyar.us';
const SPG_CONTACT_PHONE = '+1 (555) 555-0100';
const SPG_DOMAIN = 'stuffprettygood.com';
const SPG_EFFECTIVE_DATE = 'July 1, 2026';
const SPG_SMS_CONSENT_VERSION = '2026-07-01-v2';

// dist cleanup skipped — OneDrive holds file handles; build relies on individual file overwrites
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(path.join(dist, 'assets/products'), { recursive: true });
fs.mkdirSync(path.join(dist, 'assets/site'), { recursive: true });
// Lane C #8 tick 62→63: extracted IIFE → scripts/templates/ai-bubble.js;
// directory must exist before the first assistantWidget() call in layout().
fs.mkdirSync(path.join(dist, 'scripts', 'templates'), { recursive: true });

const data = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
const posts = JSON.parse(fs.readFileSync('data/posts.json', 'utf8')).posts;
let RATE_LIMIT_CONFIG;
try {
  RATE_LIMIT_CONFIG = JSON.parse(fs.readFileSync('data/rate-limit-config.json', 'utf8'));
  // Strip the optional _comment field so it doesn't end up inlined into pages.
  delete RATE_LIMIT_CONFIG._comment;
} catch (e) {
  console.warn('[spg-build] data/rate-limit-config.json missing or invalid, using defaults');
  RATE_LIMIT_CONFIG = {
    perMinute: 3, perHour: 20, perDay: 50, maxQueryLength: 1000,
    cookieName: 'spg_rl_id', cookieTtlSeconds: 3600, storageKey: 'spg_rl_state_v1'
  };
}
const products = data.products.filter((p) =>
  p.affiliate_status === 'approved' &&
  p.approval_status === 'approved' &&
  p.affiliate_url &&
  p.affiliate_url.includes(`tag=${AMAZON_TAG}`)
);

fs.copyFileSync('src/styles.css', path.join(dist, 'styles.css'));

// Progressive Web App: copy the service worker source verbatim into dist/.
// Registered from every generated page; serves a network-first HTML strategy
// with cache-first same-origin static assets and an /offline.html fallback.
fs.copyFileSync('src/sw.js', path.join(dist, 'sw.js'));

// Offline fallback page is regenerated on every build (it's a static asset the
// SW serves when a navigation fails on a cold cache).
fs.copyFileSync('dist/offline.html', path.join(dist, 'offline.html'));

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
const amazonNativeAd = (p, compact = false) => {
  if (p.sitestripe_embed_html) {
    return `<div class="amazon-native sitestripe ${compact ? 'compact' : ''}" aria-label="Amazon SiteStripe preview for ${esc(p.title)}">${p.sitestripe_embed_html}<div class="native-fallback"><img src="${p.image_url}" alt="${esc(p.title)} illustrated fallback"><span>Amazon preview may be blocked by privacy tools.</span></div></div>`;
  }
  return `<div class="amazon-native ${compact ? 'compact' : ''}" aria-label="Live Amazon product preview for ${esc(p.title)}"><div class="native-fallback"><img src="${p.image_url}" alt="${esc(p.title)} illustrated fallback"><span>Loading Amazon product images…</span></div><script>amzn_assoc_placement="adunit0";amzn_assoc_search_bar="false";amzn_assoc_tracking_id="${AMAZON_TAG}";amzn_assoc_ad_mode="search";amzn_assoc_ad_type="smart";amzn_assoc_marketplace="amazon";amzn_assoc_region="US";amzn_assoc_title="Shop related picks";amzn_assoc_default_search_phrase=${JSON.stringify(searchTerm(p))};amzn_assoc_default_category="All";</script><script src="https://z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US"></script></div>`;
};

function productSvg(p) {
  const themeMap = {
    tech: { emoji: '⚡', a: '#0f172a', b: '#2563eb', c: '#67e8f9', shape: 'device' },
    kitchen: { emoji: '🍳', a: '#7c2d12', b: '#f97316', c: '#fde68a', shape: 'kitchen' },
    'home-office': { emoji: '🖥️', a: '#111827', b: '#0f766e', c: '#ccfbf1', shape: 'desk' },
    travel: { emoji: '✈️', a: '#1e3a8a', b: '#38bdf8', c: '#dbeafe', shape: 'travel' },
    pets: { emoji: '🐾', a: '#78350f', b: '#f59e0b', c: '#fef3c7', shape: 'pet' },
    car: { emoji: '🚗', a: '#374151', b: '#ef4444', c: '#fee2e2', shape: 'car' },
    home: { emoji: '🏠', a: '#064e3b', b: '#22c55e', c: '#dcfce7', shape: 'home' },
    wellness: { emoji: '🌿', a: '#14532d', b: '#84cc16', c: '#ecfccb', shape: 'wellness' },
    organization: { emoji: '📦', a: '#4338ca', b: '#a855f7', c: '#f3e8ff', shape: 'organize' },
    gift: { emoji: '🎁', a: '#9f1239', b: '#f43f5e', c: '#ffe4e6', shape: 'gift' }
  };
  const theme = themeMap[p.category] || themeMap.gift;
  const words = p.title.split(' ').filter(Boolean);
  const headline = words.slice(0, 4).join(' ');
  const sub = p.category.replace('-', ' ');
  const shape = {
    device: '<rect x="222" y="122" width="196" height="150" rx="22" fill="#ffffff"/><rect x="242" y="146" width="156" height="86" rx="14" fill="#dbeafe"/><rect x="276" y="292" width="88" height="16" rx="8" fill="#ffffff"/><path d="M420 210h72M420 238h48M182 208h-64M182 236h-42" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>',
    kitchen: '<rect x="214" y="152" width="230" height="132" rx="34" fill="#ffffff"/><circle cx="290" cy="218" r="48" fill="#fde68a"/><circle cx="290" cy="218" r="24" fill="#f97316"/><path d="M448 182h90M448 222h70" stroke="#ffffff" stroke-width="18" stroke-linecap="round"/><rect x="154" y="284" width="332" height="28" rx="14" fill="#ffffff"/>',
    desk: '<rect x="182" y="136" width="276" height="152" rx="24" fill="#ffffff"/><rect x="212" y="164" width="216" height="86" rx="14" fill="#ccfbf1"/><path d="M132 310h376M220 310v58M420 310v58" stroke="#ffffff" stroke-width="18" stroke-linecap="round"/>',
    travel: '<rect x="230" y="126" width="190" height="210" rx="34" fill="#ffffff"/><path d="M282 126v-30h86v30" stroke="#ffffff" stroke-width="18" stroke-linecap="round"/><path d="M178 226l310-84-128 214-42-92-92 4z" fill="#dbeafe" opacity=".95"/>',
    pet: '<circle cx="284" cy="218" r="52" fill="#ffffff"/><circle cx="216" cy="170" r="26" fill="#ffffff"/><circle cx="352" cy="170" r="26" fill="#ffffff"/><circle cx="222" cy="278" r="26" fill="#ffffff"/><circle cx="346" cy="278" r="26" fill="#ffffff"/><path d="M436 182c60 30 66 110 0 140" stroke="#ffffff" stroke-width="20" fill="none" stroke-linecap="round"/>',
    car: '<path d="M154 260l48-88h236l60 88v62H154z" fill="#ffffff"/><circle cx="224" cy="328" r="30" fill="#111827"/><circle cx="432" cy="328" r="30" fill="#111827"/><rect x="236" y="194" width="82" height="46" rx="10" fill="#fee2e2"/><rect x="334" y="194" width="76" height="46" rx="10" fill="#fee2e2"/>',
    home: '<path d="M152 236l168-132 168 132" fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/><rect x="202" y="226" width="236" height="138" rx="28" fill="#ffffff"/><rect x="292" y="280" width="58" height="84" rx="14" fill="#dcfce7"/>',
    wellness: '<path d="M320 346c-70-84-52-174 8-242 72 86 54 166-8 242z" fill="#ffffff"/><path d="M250 304c-86-28-112-98-90-170 88 28 112 102 90 170zM390 304c86-28 112-98 90-170-88 28-112 102-90 170z" fill="#ecfccb"/>',
    organize: '<rect x="166" y="150" width="126" height="126" rx="26" fill="#ffffff"/><rect x="322" y="150" width="126" height="126" rx="26" fill="#ffffff"/><rect x="244" y="296" width="126" height="86" rx="22" fill="#ffffff"/><path d="M194 212h70M350 212h70M272 340h70" stroke="#a855f7" stroke-width="14" stroke-linecap="round"/>',
    gift: '<rect x="190" y="190" width="260" height="170" rx="28" fill="#ffffff"/><rect x="302" y="190" width="36" height="170" fill="#fecdd3"/><rect x="168" y="156" width="304" height="62" rx="22" fill="#ffffff"/><path d="M320 154c-52-70-122-44-86 12 28 44 86-12 86-12zm0 0c52-70 122-44 86 12-28 44-86-12-86-12z" fill="none" stroke="#ffffff" stroke-width="18" stroke-linecap="round"/>'
  }[theme.shape];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img" aria-label="${esc(p.title)} original shopping illustration">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${theme.a}"/><stop offset="0.54" stop-color="${theme.b}"/><stop offset="1" stop-color="${theme.c}"/></linearGradient>
    <radialGradient id="spot" cx="50%" cy="45%" r="70%"><stop stop-color="#ffffff" stop-opacity=".38"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="26" flood-color="#020617" flood-opacity=".24"/></filter>
  </defs>
  <rect width="640" height="420" rx="40" fill="url(#bg)"/>
  <rect width="640" height="420" rx="40" fill="url(#spot)"/>
  <circle cx="92" cy="74" r="58" fill="#fff" opacity=".18"/>
  <circle cx="560" cy="66" r="94" fill="#fff" opacity=".16"/>
  <g filter="url(#shadow)">${shape}</g>
  <rect x="38" y="320" width="564" height="66" rx="26" fill="#fff" opacity=".94"/>
  <text x="64" y="350" font-family="Inter,Arial,sans-serif" font-size="23" font-weight="950" fill="#111827">${esc(headline)}</text>
  <text x="64" y="374" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="850" fill="#64748b">${esc(sub)} · useful find</text>
  <text x="572" y="362" text-anchor="end" font-size="34">${theme.emoji}</text>
</svg>`;
}
for (const p of products) fs.writeFileSync(path.join(dist, p.image_url), productSvg(p));


const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Stuff Pretty Good logo">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111827"/><stop offset=".48" stop-color="#0f766e"/><stop offset="1" stop-color="#f97316"/></linearGradient>
    <filter id="s"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#0f172a" flood-opacity=".24"/></filter>
  </defs>
  <rect width="512" height="512" rx="116" fill="url(#g)"/>
  <circle cx="96" cy="92" r="54" fill="#fff7ed" opacity=".18"/>
  <circle cx="430" cy="88" r="74" fill="#bfdbfe" opacity=".18"/>
  <g filter="url(#s)">
    <path d="M132 182h248l-26 146H168l-36-146Z" fill="#fffdf8"/>
    <path d="M174 182c8-58 38-88 82-88s74 30 82 88" fill="none" stroke="#fffdf8" stroke-width="28" stroke-linecap="round"/>
    <circle cx="198" cy="256" r="18" fill="#0f766e"/><circle cx="314" cy="256" r="18" fill="#f97316"/>
  </g>
  <text x="256" y="398" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="88" font-weight="950" letter-spacing="-8" fill="#fff7ed">SPG</text>
</svg>`;
fs.writeFileSync(path.join(dist, 'assets/site/spg-logo.svg'), logoSvg);
fs.writeFileSync(path.join(dist, 'favicon.svg'), logoSvg);
fs.writeFileSync(path.join(dist, 'site.webmanifest'), JSON.stringify({ id: 'stuffprettygood', name: 'Stuff Pretty Good', short_name: 'SPG', description: 'AI shortlists, gift finder, starter kits, and useful product picks under $50. Buy faster, waste less.', lang: 'en-US', dir: 'ltr', start_url: '/', scope: '/', display: 'standalone', orientation: 'any', prefer_related_applications: false, background_color: '#f6f1e8', theme_color: '#111827', categories: ['shopping', 'lifestyle', 'productivity', 'product-catalog'], display_override: ['standalone', 'minimal-ui'], launch_handler: { client_mode: 'auto' }, edge_side_panel: { preferred_width: 480 }, handle_links: 'preferred', protocol_handlers: [{ protocol: 'web+spg', url: '/open?u=%s' }], icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }], screenshots: [{ src: '/assets/site/spg-shopping-guide.svg', sizes: '960x360', type: 'image/svg+xml', form_factor: 'wide', label: 'Stuff Pretty Good home — AI shopping guide, gift finder, and starter kits' }, { src: '/assets/site/spg-shopping-guide-narrow.svg', sizes: '540x960', type: 'image/svg+xml', form_factor: 'narrow', label: 'Stuff Pretty Good home — mobile install preview' }], shortcuts: [{ name: 'Gift Finder', short_name: 'Gift Finder', url: '/gift-finder/', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }, { name: 'Starter Kits', short_name: 'Starter Kits', url: '/starter-kits/', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }, { name: 'Under $50', short_name: 'Under $50', url: '/under-50/', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }, { name: 'Sign up', short_name: 'Sign up', url: '/signup/', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }
    ],
    share_target: {
      action: '/open/?u=https%3A%2F%2Fstuffprettygood.com',
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: { title: 'title', text: 'text', url: 'url' }
    },
    file_handlers: [
      {
        name: 'Pretty Good Verdict',
        action: '/open/?file=%s',
        accept: {
          'text/plain': ['.txt'],
          'text/markdown': ['.md'],
          'text/csv': ['.csv'],
          'application/json': ['.json']
        }
      }
    ]
  }, null, 2));

const siteArtSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 360" role="img" aria-label="Stuff Pretty Good AI shopping guide visual">
  <defs><linearGradient id="spg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#080f1f"/><stop offset=".38" stop-color="#0f766e"/><stop offset=".72" stop-color="#f97316"/><stop offset="1" stop-color="#fde68a"/></linearGradient><filter id="glow"><feDropShadow dx="0" dy="26" stdDeviation="26" flood-color="#020617" flood-opacity=".28"/></filter></defs>
  <rect width="960" height="360" rx="44" fill="url(#spg)"/>
  <circle cx="106" cy="92" r="58" fill="#fff7ed" opacity=".22"/><circle cx="848" cy="78" r="92" fill="#bfdbfe" opacity=".18"/><path d="M64 292C190 242 278 330 402 278s192-74 320 8 184 8 216-22" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity=".22"/>
  <g filter="url(#glow)"><rect x="92" y="78" width="188" height="202" rx="34" fill="#fff"/><rect x="334" y="54" width="292" height="248" rx="40" fill="#fff"/><rect x="682" y="78" width="190" height="202" rx="34" fill="#fff"/></g>
  <image href="/assets/site/spg-logo.svg" x="400" y="82" width="160" height="160"/>
  <text x="186" y="178" text-anchor="middle" font-size="84">🎁</text><text x="186" y="238" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="20" font-weight="900" fill="#111827">gift ideas</text>
  <text x="777" y="178" text-anchor="middle" font-size="84">⚡</text><text x="777" y="238" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="20" font-weight="900" fill="#111827">useful upgrades</text>
  <text x="480" y="328" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="31" font-weight="950" fill="#fff7ed">AI shortlists · better gifts · practical products</text>
</svg>`
fs.writeFileSync(path.join(dist, 'assets/site/spg-shopping-guide.svg'), siteArtSvg);

const siteArtSvgNarrow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 960" role="img" aria-label="Stuff Pretty Good AI shopping guide — mobile install surface">
  <defs><linearGradient id="spgn" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#080f1f"/><stop offset=".38" stop-color="#0f766e"/><stop offset=".72" stop-color="#f97316"/><stop offset="1" stop-color="#fde68a"/></linearGradient><filter id="glown"><feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#020617" flood-opacity=".3"/></filter></defs>
  <rect width="540" height="960" rx="56" fill="url(#spgn)"/>
  <circle cx="86" cy="120" r="62" fill="#fff7ed" opacity=".22"/><circle cx="468" cy="100" r="98" fill="#bfdbfe" opacity=".18"/><circle cx="270" cy="840" r="120" fill="#fde68a" opacity=".16"/>
  <path d="M40 720C150 660 260 760 380 700s140-60 200-10" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" opacity=".22"/>
  <g filter="url(#glown)">
    <rect x="70" y="200" width="400" height="160" rx="36" fill="#fff"/>
    <rect x="70" y="386" width="400" height="160" rx="36" fill="#fff"/>
    <rect x="70" y="572" width="400" height="160" rx="36" fill="#fff"/>
  </g>
  <image href="/assets/site/spg-logo.svg" x="220" y="234" width="100" height="100"/>
  <text x="350" y="270" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="900" fill="#0f766e">SPG</text>
  <text x="120" y="320" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="800" fill="#111827">AI shortlists</text>
  <text x="120" y="348" font-family="Inter,Arial,sans-serif" font-size="16" fill="#475569">gift finder + starter kits</text>
  <text x="120" y="430" font-size="56">⚡</text>
  <text x="120" y="510" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="800" fill="#111827">Useful upgrades</text>
  <text x="120" y="538" font-family="Inter,Arial,sans-serif" font-size="16" fill="#475569">under $50 picks that last</text>
  <text x="120" y="610" font-size="56">🎁</text>
  <text x="120" y="690" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="800" fill="#111827">Gift ideas</text>
  <text x="120" y="718" font-family="Inter,Arial,sans-serif" font-size="16" fill="#475569">for people who have everything</text>
  <text x="270" y="888" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="950" fill="#fff7ed">buy faster · waste less</text>
</svg>`;
fs.writeFileSync(path.join(dist, 'assets/site/spg-shopping-guide-narrow.svg'), siteArtSvgNarrow);

function isExternalHref(href) {
  if (/^(?:https?:\/\/(?:www\.)?stuffprettygood\.com)?\/go\//i.test(href) || /^https?:\/\/stuffprettygood-api\.mehyar\.workers\.dev\/go\//i.test(href)) return true;
  return /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?stuffprettygood\.com\b/i.test(href) && !/^https?:\/\/stuffprettygood-api\.mehyar\.workers\.dev\b/i.test(href);
}

function normalizeLinks(html) {
  return String(html).replace(/<a\b([^>]*)>/g, (tag, attrs) => {
    const hrefMatch = attrs.match(/\shref=(['"])(.*?)\1/i);
    if (!hrefMatch) return tag;
    const href = hrefMatch[2];
    const external = isExternalHref(href);
    let next = attrs.replace(/\s+target=(['"]).*?\1/ig, '').replace(/\s+rel=(['"])(.*?)\1/ig, (_m, q, rel) => {
      const safeRel = rel.split(/\s+/).filter((item) => item && item !== 'noopener' && item !== 'noreferrer').join(' ');
      return safeRel ? ` rel=${q}${safeRel}${q}` : '';
    });
    if (!external) return `<a${next}>`;
    if (/\srel=(['"])(.*?)\1/i.test(next)) {
      next = next.replace(/\srel=(['"])(.*?)\1/i, (_m, q, rel) => ` rel=${q}${Array.from(new Set(`${rel} noopener noreferrer`.split(/\s+/).filter(Boolean))).join(' ')}${q}`);
    } else {
      next += ' rel="noopener noreferrer"';
    }
    return `<a target="_blank"${next}>`;
  });
}

function backToTop() {
  return '<a class="back-top" href="#top" aria-label="Back to top"><span>↑</span><strong>Top</strong></a><script>(function(){function internalHost(host){return host===location.host||host==="stuffprettygood.com"||host==="www.stuffprettygood.com"||host==="stuffprettygood-api.mehyar.workers.dev";}function tuneLinks(root){(root||document).querySelectorAll("a[href]").forEach(function(a){var raw=a.getAttribute("href")||"";if(!raw||raw.startsWith("#")||raw.startsWith("mailto:")||raw.startsWith("tel:")){a.removeAttribute("target");return;}try{var u=new URL(raw,location.href);if((u.pathname.startsWith("/go/")&&internalHost(u.host))||(/^https?:$/.test(u.protocol)&&!internalHost(u.host))){a.target="_blank";var rel=(a.getAttribute("rel")||"").trim().split(" ").filter(Boolean);["noopener","noreferrer"].forEach(function(v){if(!rel.includes(v))rel.push(v);});a.setAttribute("rel",rel.join(" "));a.setAttribute("data-affiliate-click","");a.addEventListener("click",function(){try{var p=new URL(a.href,location.href).pathname.split("/")[2]||"";window.dispatchEvent(new CustomEvent("spg-affiliate-click",{detail:{id:p,source:a.getAttribute("data-affiliate-source")||"inline",ts:Date.now()}}));}catch(e){}},{capture:true});}else{a.removeAttribute("target");}}catch(e){a.removeAttribute("target");}})}tuneLinks(document);new MutationObserver(function(){tuneLinks(document);}).observe(document.documentElement,{childList:true,subtree:true});})();</script><script>(function(){window.addEventListener("spg-affiliate-click",function(e){var d=e.detail||{};if(!d.id)return;navigator.sendBeacon&&navigator.sendBeacon("/api/track-click",JSON.stringify({id:d.id,source:d.source||"inline",ts:d.ts||Date.now()}));});})();</script>';
}

// Progressive Web App registration: enables network-first HTML with a
// cache-first asset layer + offline page, and exposes a custom install
// button when the browser fires `beforeinstallprompt`.
function pwaRegistration() {
  return `<script>(function(){
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      if (reg && reg.active) {
        try { navigator.serviceWorker.ready.then(function (r) { if (r && r.active) r.active.postMessage({ type: 'PING' }); }); } catch (e) {}
      }
    }).catch(function () {});
  });
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    var btn = document.querySelector('[data-spg-install]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'spg-install';
      btn.setAttribute('data-spg-install', '');
      btn.setAttribute('aria-label', 'Install Stuff Pretty Good');
      btn.innerHTML = '<span>↓</span><strong>Install</strong>';
      btn.addEventListener('click', function () { btn.setAttribute('hidden', ''); e.prompt(); });
      var refs = document.querySelectorAll('.nav-links');
      if (refs.length) refs[refs.length - 1].appendChild(btn);
      else document.body.appendChild(btn);
    } else { btn.removeAttribute('hidden'); }
    btn.__deferredPrompt = e;
  });
  window.addEventListener('appinstalled', function () {
    var btn = document.querySelector('[data-spg-install]');
    if (btn) btn.setAttribute('hidden', '');
  });
})();</script>`;
}
// SPG scroll-reveal motion. IntersectionObserver + prefers-reduced-motion + fade-up
// keyframe. Auto-targets the major card surfaces (cards, story cards, magazine
// cards, recommendation rows, panels, signup-band, hero stack, lanes, guide links).
// Inlined into every page so no extra request; runs once on DOM ready.
//
// Tick 6 update (closes t_98bc242f): wraps the initial setup in a MutationObserver
// that watches document.body so cards injected AFTER by data-live-picks /
// data-live-stories JS fetchers also get the reveal. Without this, the safety-net
// safety-net + IO captured a snapshot at body-end and missed ~87 of ~117 cards.
// `handled` Set dedupes nodes across the initial pass, MutationObserver path, and
// the 1.2s safety-net so no node is double-observed.
function scrollRevealScript() {
  return `<script>(function(){
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof IntersectionObserver === 'undefined') return;
  var SELECTOR = '.card, .story-card, .magazine-card, .recommendation, .panel, .signup-band, .lanes a, .guide-list a, .hero-stack, .hero-card, .hero-copy, .decision-boxes div, .visual-proof';
  var handled = new WeakSet();
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (!e.isIntersecting) return;
      e.target.classList.add('spg-reveal-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  function attach(n){
    if (!n || handled.has(n)) return;
    if (n.nodeType !== 1) return;
    if (!(n.matches && n.matches(SELECTOR))) return;
    if (n.dataset && n.dataset.spgReveal === 'off') return;
    handled.add(n);
    n.classList.add('spg-reveal');
    io.observe(n);
  }
  // Initial pass — snapshot of whatever the server already rendered.
  var initial = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
  initial.forEach(attach);
  // Late-arrival pass — MutationObserver picks up cards injected by the
  // data-live-picks / data-live-stories fetchers (see t_98bc242f).
  if (typeof MutationObserver !== 'undefined'){
    var mo = new MutationObserver(function(records){
      records.forEach(function(r){
        var added = r.addedNodes && r.addedNodes.length ? r.addedNodes : [];
        added.forEach(function(node){
          if (node.nodeType !== 1) return;
          attach(node);
          // Also descend one level — many fetchers inject wrapper divs with cards inside.
          if (node.querySelectorAll){
            Array.prototype.slice.call(node.querySelectorAll(SELECTOR)).forEach(attach);
          }
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  // Safety net: if IO never fires within 1.2s (e.g. cached offline page), flip
    // every handled-but-unrevealed node on. Still runs through the handled set so we
    // don't try to flip nodes added after the timeout (those go through IO).
  setTimeout(function(){
    handled && document.querySelectorAll(SELECTOR).forEach(function(n){
      if (!n.classList.contains('spg-reveal-in')) n.classList.add('spg-reveal-in');
    });
  }, 1200);
})();</script>`;
}

// Theme-toggle click handler (Lane A #4). Inlined into every page so no extra
// request. Reads/writes localStorage 'spg-theme'; flips data-theme between
// 'dark' and absent on the <html> element. The head-init script in layout()
// already applies the persisted/system choice before paint; this IIFE only
// wires the user gesture.
function themeToggleScript() {
  return `<script>(function(){
  var btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  function currentTheme(){
    var dt = document.documentElement.getAttribute('data-theme');
    if (dt === 'dark') return 'dark';
    if (dt === 'light') return 'light';
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function syncAria(){
    btn.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');
  }
  syncAria();
  btn.addEventListener('click', function(){
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('spg-theme', next); } catch(e) {}
    syncAria();
  });
  // Re-sync aria-pressed if the OS theme flips and no explicit choice has been made.
  if (window.matchMedia){
    try {
      var mql = window.matchMedia('(prefers-color-scheme: dark)');
      var onSys = function(){
        try { if (!localStorage.getItem('spg-theme')) syncAria(); } catch(e) { syncAria(); }
      };
      if (mql.addEventListener) mql.addEventListener('change', onSys);
      else if (mql.addListener) mql.addListener(onSys);
    } catch(e) {}
  }
})();</script>`;
}

// Pull-to-refresh for installed PWA (Lane A #5). Only active when the site is
// running in standalone/installed mode (html.is-pwa is set by the splash
// init script in layout()). Detects a downward drag from scrollTop=0 and
// reloads the page after a small visual indicator animation. In regular
// browser tabs the script early-returns — the browser's native chrome owns
// pull behavior there. Respects prefers-reduced-motion (skips the indicator
// animation; reload still fires).
function pullToRefreshScript() {
  return `<script>(function(){
  if (!document.documentElement.classList.contains('is-pwa')) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var THRESHOLD = 72;          // px of pull before we trigger a reload
  var MAX = 120;               // px the indicator can travel before rubber-banding hard
  var startY = 0;
  var pulling = false;
  var distance = 0;
  var pill = null;
  function ensurePill(){
    if (pill) return pill;
    pill = document.createElement('div');
    pill.className = 'spg-ptr';
    pill.setAttribute('aria-hidden', 'true');
    pill.innerHTML = '<div class="spg-ptr-arrow" aria-hidden="true"></div><div class="spg-ptr-label">Pull to refresh</div>';
    document.body.appendChild(pill);
    return pill;
  }
  function setText(s){
    if (!pill) return;
    var lbl = pill.querySelector('.spg-ptr-label');
    if (lbl) lbl.textContent = s;
  }
  function setDistance(d){
    if (!pill) return;
    pill.style.setProperty('--spg-ptr-d', d + 'px');
    pill.classList.toggle('is-ready', d >= THRESHOLD);
    setText(d >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh');
  }
  function onStart(e){
    if (window.scrollY > 0) return;
    if (!e.touches || e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    pulling = true;
    distance = 0;
    ensurePill();
  }
  function onMove(e){
    if (!pulling) return;
    var dy = e.touches[0].clientY - startY;
    if (dy <= 0){ distance = 0; setDistance(0); return; }
    // rubber-band: 1:1 up to MAX, then log-damped past it
    distance = dy < MAX ? dy : MAX + Math.log10(1 + (dy - MAX)) * 14;
    if (window.scrollY > 0){ reset(); return; }
    if (e.cancelable) e.preventDefault();
    setDistance(distance);
  }
  function onEnd(){
    if (!pulling) return;
    var was = distance;
    pulling = false;
    distance = 0;
    if (pill) pill.classList.remove('is-pulling');
    if (was >= THRESHOLD){
      if (pill){
        pill.classList.add('is-spinning');
        setText('Refreshing…');
      }
      // small delay so the indicator animates before reload tears it down
      setTimeout(function(){ try { location.reload(); } catch(e){} }, reduce ? 0 : 320);
    } else if (pill){
      setDistance(0);
    }
  }
  function reset(){
    pulling = false;
    distance = 0;
    if (pill) setDistance(0);
  }
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('touchcancel', reset, { passive: true });
})();</script>`;
}

function offlineIndicatorScript() {
  // Lane A #6 — offline indicator for installed PWA.
  // Same gate pattern as pullToRefreshScript (tick 21). The IIFE early-returns
  // unless the page is running in standalone display-mode or navigator.standalone
  // is true, so non-PWA browser tabs pay zero cost. The banner is lazily created
  // on the first offline event (ensureBanner) — it never enters the DOM unless
  // the device actually goes offline. Listens to window 'online' and 'offline'
  // events with a small debounce so the banner doesn't flicker on spotty cells.
  // pointer-events:none so it cannot intercept taps on the nav underneath.
  // z-index 9050 sits below the PTR pill (9100) and above the splash (9999 during
  // boot). aria-live=polite so AT users hear the transition without it yelling.
  return `<script>(function(){
  if (!document.documentElement.classList.contains('is-pwa')) return;
  if (typeof window === 'undefined' || !window.addEventListener) return;
  var banner = null;
  var hideTimer = null;
  var lastState = null;
  function ensureBanner(){
    if (banner) return banner;
    banner = document.createElement('div');
    banner.className = 'spg-offline';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-hidden', 'true');
    banner.innerHTML = '<span class="spg-offline-dot" aria-hidden="true"></span><span class="spg-offline-label">You\u2019re offline \u00b7 showing cached content</span>';
    document.body.appendChild(banner);
    return banner;
  }
  function show(){
    var b = ensureBanner();
    if (lastState === 'offline') return;
    lastState = 'offline';
    if (hideTimer){ clearTimeout(hideTimer); hideTimer = null; }
    b.classList.add('is-visible');
    b.setAttribute('aria-hidden', 'false');
  }
  function hide(){
    var b = ensureBanner();
    if (lastState === 'online') return;
    lastState = 'online';
    // brief grace so users see the "back online" confirmation before dismiss
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function(){
      b.classList.remove('is-visible');
      b.setAttribute('aria-hidden', 'true');
    }, 1400);
  }
  // Initial state — if the page loaded while already offline, show immediately.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) show();
  window.addEventListener('offline', function(){ show(); });
  window.addEventListener('online', function(){ hide(); });
})();</script>`;
}

function iosInstallHintScript() {
  // Lane A #21 — iOS Safari "Tap Share → Add to Home Screen" hint banner.
  // iOS Safari never fires beforeinstallprompt, so the install button IIFE
  // (in pwaRegistration) only ever appears on Android Chrome / desktop Edge.
  // This IIFE fills the gap: detects iPhone/iPad/iPod Safari (and iPadOS
  // desktop mode), adds .is-ios-safari to <html>, lazily creates a dismissable
  // banner after a 3.5s delay (so the splash + initial paint finish first),
  // and persists dismissal in localStorage so the hint doesn't nag every visit.
  // If already installed (navigator.standalone === true) or display-mode is
  // standalone, the IIFE early-returns — banner never appears.
  // pointer-events:auto (different from offline indicator) so the close
  // button can receive taps. aria-live=polite so AT users hear the nudge
  // without it yelling.
  return `<script>(function(){
  if (typeof navigator === 'undefined' || !window.addEventListener) return;
  // Already installed → never show
  if (navigator.standalone === true) return;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;
  // Detect iOS Safari. iPadOS desktop mode uses MacIntel + touch points;
  // iPadOS Safari mobile mode uses iPad UA. Cover both.
  var ua = navigator.userAgent || '';
  var isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  var isWebkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
  if (!isIos || !isWebkit) return;
  // Dismissed previously → don't nag
  var dismissed = false;
  try { dismissed = window.localStorage.getItem('spg-ios-hint-dismissed') === '1'; } catch (e) {}
  if (dismissed) return;
  document.documentElement.classList.add('is-ios-safari');
  function ensureBanner(){
    if (document.querySelector('.spg-ios-hint')) return document.querySelector('.spg-ios-hint');
    var b = document.createElement('div');
    b.className = 'spg-ios-hint is-dismissed';
    b.setAttribute('role', 'status');
    b.setAttribute('aria-live', 'polite');
    b.setAttribute('aria-hidden', 'true');
    b.innerHTML = '<span class="spg-ios-hint-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M12 2v12m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
      '</span>' +
      '<span class="spg-ios-hint-body">' +
      '<p class="spg-ios-hint-title">Install Stuff Pretty Good</p>' +
      '<p class="spg-ios-hint-sub">Tap <strong>Share</strong> \u2192 <strong>Add to Home Screen</strong></p>' +
      '</span>' +
      '<button type="button" class="spg-ios-hint-close" aria-label="Dismiss install hint">\u00d7</button>';
    document.body.appendChild(b);
    b.querySelector('.spg-ios-hint-close').addEventListener('click', function(){
      b.classList.add('is-dismissed');
      b.setAttribute('aria-hidden', 'true');
      try { window.localStorage.setItem('spg-ios-hint-dismissed', '1'); } catch (e) {}
    });
    return b;
  }
  // Wait 3.5s after DOM ready so splash + first paint finish first.
  function show(){
    var b = ensureBanner();
    requestAnimationFrame(function(){
      b.classList.remove('is-dismissed');
      b.setAttribute('aria-hidden', 'false');
    });
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(show, 3500);
  } else {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(show, 3500); });
  }
})();</script>`;
}

function recentlyViewedScript() {
  // Lane A #25 — recently viewed products bar.
  // Reads `<script type="application/json" id="spg-product-meta">{...}</script>`
  // (injected on /products/<id>/ pages only) to push the current product into
  // a localStorage list of up to 8 most-recently-viewed product IDs. Renders a
  // fixed bottom-anchored horizontal carousel of chips (thumbnail + title +
  // category) that lets a returning visitor jump back into a comparison they
  // started. Pure localStorage — works offline, no network. Dismiss button
  // clears the list. Hidden on home (data-route === ''), /open, /go/, legal,
  // and the product page currently being viewed (no self-reference). The
  // bar respects prefers-reduced-motion + safe-area-inset for iOS PWA bottom.
  return `<script>(function(){
  if (typeof window === 'undefined' || !window.localStorage) return;
  var STORAGE_KEY = 'spg-recents-v1';
  var MAX_KEEP = 8;
  var SKIP_ROUTES = { '': 1, 'open': 1 };
  var route = (document.body && document.body.getAttribute('data-route')) || '';
  var seg = route.split('/')[0] || '';
  if (SKIP_ROUTES[seg]) return;
  if (route.indexOf('go/') === 0) return;
  // Push current product to recents (if we are on a product page).
  try {
    var meta = document.getElementById('spg-product-meta');
    if (meta) {
      var obj = JSON.parse(meta.textContent || '{}');
      if (obj && obj.id && obj.title) {
        var raw = localStorage.getItem(STORAGE_KEY);
        var list = [];
        try { list = raw ? JSON.parse(raw) : []; } catch (e) { list = []; }
        if (!Array.isArray(list)) list = [];
        // Move to front if present, otherwise unshift; cap at MAX_KEEP.
        list = list.filter(function (r) { return r && r.id && r.id !== obj.id; });
        list.unshift({
          id: obj.id, title: String(obj.title).slice(0, 120),
          image_url: obj.image_url || '', category: obj.category || '',
          ts: Date.now()
        });
        if (list.length > MAX_KEEP) list = list.slice(0, MAX_KEEP);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
    }
  } catch (e) {}
  // Read final recents list (after the push above) and render.
  var recents = [];
  try {
    var raw2 = localStorage.getItem(STORAGE_KEY);
    var parsed = raw2 ? JSON.parse(raw2) : [];
    if (Array.isArray(parsed)) recents = parsed;
  } catch (e) { recents = []; }
  // Hide bar when there are no recents OR the only recent is the current page.
  var currentId = (function () {
    var m = (route.match(/^products\\/(.+?)\\/?$/) || [])[1];
    return m || '';
  })();
  var filtered = recents.filter(function (r) { return r && r.id && r.id !== currentId; });
  if (filtered.length === 0) return;
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function ensureBar() {
    if (document.querySelector('.spg-recents')) return document.querySelector('.spg-recents');
    var d = document.createElement('aside');
    d.className = 'spg-recents';
    d.setAttribute('role', 'region');
    d.setAttribute('aria-label', 'Recently viewed products');
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML =
      '<div class="spg-recents-head">' +
        '<p class="spg-recents-eyebrow">Recently viewed</p>' +
        '<button type="button" class="spg-recents-close" aria-label="Clear recently viewed list">&times;</button>' +
      '</div>' +
      '<div class="spg-recents-track" data-spg-recents-track></div>';
    document.body.appendChild(d);
    d.querySelector('.spg-recents-close').addEventListener('click', function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      d.classList.remove('is-shown');
      d.setAttribute('aria-hidden', 'true');
      setTimeout(function () { if (d && d.parentNode) d.parentNode.removeChild(d); }, 320);
    });
    return d;
  }
  function render() {
    var bar = ensureBar();
    var track = bar.querySelector('[data-spg-recents-track]');
    track.innerHTML = filtered.map(function (r) {
      return '<a class="spg-recents-chip" href="/products/' + esc(r.id) + '/">' +
        '<span class="spg-recents-thumb">' +
          (r.image_url
            ? '<img loading="lazy" decoding="async" src="' + esc(r.image_url) + '" alt="' + esc(r.title) + ' product thumbnail">'
            : '<span class="spg-recents-thumb-fallback" aria-hidden="true">' + esc((r.title || '?').slice(0, 1).toUpperCase()) + '</span>') +
        '</span>' +
        '<span class="spg-recents-meta">' +
          '<span class="spg-recents-cat">' + esc((r.category || '').replace(/-/g, ' ')) + '</span>' +
          '<span class="spg-recents-title">' + esc(r.title) + '</span>' +
        '</span>' +
      '</a>';
    }).join('');
    requestAnimationFrame(function () {
      bar.classList.add('is-shown');
      bar.setAttribute('aria-hidden', 'false');
    });
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(render, 120);
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(render, 120); });
  }
})();</script>`;
}

function exitIntentScript() {
  // Lane A #24 — exit-intent signup prompt.
  // Fires only when the user's mouse leaves the viewport toward the top of the
  // window (the canonical closing-tab signal). 7-day localStorage cooldown so we
  // don't nag returning visitors. On fire, slides up a bottom-right card with
  // email-only mini-form that posts to the existing /api/subscribe endpoint
  // (source=exit-intent) and dispatches a spg-signup-exit-intent CustomEvent
  // so the OMNI dispatcher can wire the welcome-drip webhook.
  // ESC and the close button both dismiss; the cooldown persists either way.
  return `<script>(function(){
  if (typeof window === 'undefined' || !window.addEventListener) return;
  if (navigator.standalone === true) return;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;
  var COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  var stored = 0;
  try { stored = parseInt(window.localStorage.getItem('spg-exit-intent-shown') || '0', 10) || 0; } catch (e) {}
  if (stored && (Date.now() - stored) < COOLDOWN_MS) return;
  var fired = false;
  function ensureCard(){
    if (document.querySelector('.spg-exit-intent')) return document.querySelector('.spg-exit-intent');
    var d = document.createElement('div');
    d.className = 'spg-exit-intent';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-labelledby', 'spg-exit-title');
    d.setAttribute('aria-describedby', 'spg-exit-sub');
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML =
      '<button type="button" class="spg-exit-close" aria-label="Dismiss signup prompt">x</button>' +
      '<p class="spg-exit-eyebrow">Before you go</p>' +
      '<p id="spg-exit-title" class="spg-exit-title">Get useful finds without doom-scrolling.</p>' +
      '<p id="spg-exit-sub" class="spg-exit-sub">One email. Unsubscribe anytime. No marketplace spam.</p>' +
      '<form class="spg-exit-form" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/subscribe" novalidate>' +
        '<input type="hidden" name="source" value="exit-intent">' +
        '<input type="hidden" name="list" value="pretty-good-finds">' +
        '<label class="spg-exit-field">Email <input name="email" type="email" autocomplete="email" required maxlength="254"></label>' +
        '<button class="spg-exit-btn" type="submit">Get useful finds</button>' +
      '</form>' +
      '<p class="spg-exit-micro" aria-hidden="true">We use your email only for our weekly drops and store it on our own infra.</p>';
    document.body.appendChild(d);
    d.querySelector('.spg-exit-close').addEventListener('click', function(){
      dismiss();
    });
    d.querySelector('.spg-exit-form').addEventListener('submit', function(e){
      e.preventDefault();
      var form = e.currentTarget;
      var email = form.querySelector('input[name="email"]').value || '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        form.querySelector('input[name="email"]').focus();
        return;
      }
      try {
        window.dispatchEvent(new CustomEvent('spg-signup-exit-intent', { detail: { email: email, ts: Date.now() } }));
      } catch (ev) {}
      fetch('https://stuffprettygood-api.mehyar.workers.dev/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: 'source=exit-intent&list=pretty-good-finds&email=' + encodeURIComponent(email)
      }).catch(function(){});
      d.querySelector('.spg-exit-title').textContent = "You are on the list.";
      d.querySelector('.spg-exit-sub').textContent = 'Check your inbox. First weekly drop ships Sunday.';
      d.querySelector('.spg-exit-form').remove();
      d.querySelector('.spg-exit-micro').remove();
      setTimeout(dismiss, 3200);
    });
    return d;
  }
  function show(){
    var card = ensureCard();
    requestAnimationFrame(function(){
      card.classList.add('is-shown');
      card.setAttribute('aria-hidden', 'false');
    });
    try { window.localStorage.setItem('spg-exit-intent-shown', String(Date.now())); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('spg-signup-exit-intent', { detail: { ts: Date.now(), phase: 'shown' } })); } catch (e) {}
  }
  function dismiss(){
    var card = document.querySelector('.spg-exit-intent');
    if (!card) return;
    card.classList.remove('is-shown');
    card.setAttribute('aria-hidden', 'true');
  }
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') dismiss();
  });
  document.addEventListener('mouseout', function(e){
    if (fired) return;
    if (e.relatedTarget || e.toElement) return;
    if (typeof e.clientY !== 'number' || e.clientY > -2) return;
    fired = true;
    setTimeout(show, 2000);
  });
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    var touchStart = null;
    document.addEventListener('touchstart', function(e){
      touchStart = e.touches && e.touches[0] ? e.touches[0].pageY : null;
    }, { passive: true });
    document.addEventListener('touchend', function(){
      if (touchStart !== null && touchStart < 20 && !fired) {
        fired = true;
        setTimeout(show, 2500);
      }
      touchStart = null;
    }, { passive: true });
  }
})();</script>`;
}

const microsoftClaritySnippet = `<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })})(window, document, "clarity", "script", "wt52najgso");
  </script>`;
  const impactSiteVerification = 'Impact-Site-Verification: c6f92ec5-b2a3-4bf2-8e8f-29fa6621424b';

    // AI companion rate limit — token-spend protection. Inlined into pages so
    // no external JS dependency. Tunable via window.SPG_RL_CONFIG override.
    //
    // Two layers of defense:
    //   1. Client-side soft limits (localStorage + cookie) — UX guard. Trivially
    //      bypassable, fine for today since the companion makes no LLM calls.
    //   2. Server-side hard limits — REQUIRED the moment an LLM is wired in.
    //      The Worker proxy at stuffprettygood-api.mehyar.workers.dev enforces
    //      IP-based rate limits in KV; this client check just saves the
    //      round-trip when the user is already over budget.
    // RATE_LIMIT_CONFIG is loaded at the top of this file from
    // data/rate-limit-config.json (with sensible fallback defaults).

    function rateLimitScript() {
      const cfg = JSON.stringify(RATE_LIMIT_CONFIG);
      return `<script>(function(global){
      'use strict';
      var CONFIG = ${cfg};
      var STATE = null;
      var QUOTA_PILL = null;
      function getSoftId(){
        var m = null;
        var cookies = document.cookie.split(';');
        var prefix = CONFIG.cookieName + '=';
        for (var i = 0; i < cookies.length; i++) {
          var c = cookies[i].replace(/^\s+/, '');
          if (c.indexOf(prefix) === 0) { m = [c, c.substring(prefix.length)]; break; }
        }
        if (m) return m[1];
        var id = (global.crypto && global.crypto.randomUUID)
          ? global.crypto.randomUUID()
          : 'rl-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        document.cookie = CONFIG.cookieName + '=' + id +
          '; max-age=' + CONFIG.cookieTtlSeconds + '; path=/; SameSite=Lax';
        return id;
      }
      function utcDay(){ return new Date().toISOString().slice(0,10); }
      function loadState(){
        try {
          var raw = localStorage.getItem(CONFIG.storageKey);
          if (!raw) return freshState();
          var p = JSON.parse(raw);
          var t = utcDay();
          if (p.day !== t) { p.day = t; p.dayCount = 0; }
          return p;
        } catch(e) {
          console.warn('[spg-rl] storage unavailable, failing open:', e);
          return freshState();
        }
      }
      function freshState(){ return { day: utcDay(), minute: [], hour: [], dayCount: 0 }; }
      function saveState(){
        try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(STATE)); }
        catch(e) { console.warn('[spg-rl] could not persist state:', e); }
      }
      function pruneWindow(win, ttlMs, now){
        var cutoff = now - ttlMs;
        while (win.length && win[0] < cutoff) win.shift();
      }
      function quotaRemaining(){
        var now = Date.now();
        pruneWindow(STATE.minute, 60000, now);
        pruneWindow(STATE.hour, 3600000, now);
        return Math.max(0, Math.min(
          CONFIG.perMinute - STATE.minute.length,
          CONFIG.perHour - STATE.hour.length,
          CONFIG.perDay - STATE.dayCount
        ));
      }
      function check(queryLength){
        var now = Date.now();
        pruneWindow(STATE.minute, 60000, now);
        pruneWindow(STATE.hour, 3600000, now);
        if (queryLength > CONFIG.maxQueryLength) {
          return { allowed: false, reason: 'query_too_long', retryAfterSeconds: 0,
            message: 'That message is a little long — try under ' + CONFIG.maxQueryLength + ' characters?' };
        }
        if (STATE.minute.length >= CONFIG.perMinute) {
          var oldest = STATE.minute[0];
          var sec = Math.ceil((oldest + 60000 - now) / 1000);
          return { allowed: false, reason: 'per_minute', retryAfterSeconds: sec,
            message: 'Slow down a sec — you can ask again in ' + sec + 's.' };
        }
        if (STATE.hour.length >= CONFIG.perHour) {
          var oldest2 = STATE.hour[0];
          var min = Math.max(1, Math.ceil((oldest2 + 3600000 - now) / 60000));
          return { allowed: false, reason: 'per_hour', retryAfterSeconds: min * 60,
            message: 'You have hit the hourly limit. Come back in ' + min + ' min.' };
        }
        if (STATE.dayCount >= CONFIG.perDay) {
          var now2 = new Date();
          var tomorrow = new Date(Date.UTC(now2.getUTCFullYear(), now2.getUTCMonth(), now2.getUTCDate() + 1));
          return { allowed: false, reason: 'per_day', retryAfterSeconds: Math.ceil((tomorrow.getTime() - now2.getTime())/1000),
            message: 'Daily limit reached. Resets at midnight UTC.' };
        }
        return { allowed: true, reason: null, retryAfterSeconds: 0, remaining: quotaRemaining() };
      }
      function record(){
        var now = Date.now();
        STATE.minute.push(now);
        STATE.hour.push(now);
        STATE.dayCount += 1;
        saveState();
        updateQuotaPill();
      }
      function updateQuotaPill(){
        if (!QUOTA_PILL) return;
        var r = quotaRemaining();
        QUOTA_PILL.textContent = r + ' of ' + CONFIG.perDay + ' left today';
        QUOTA_PILL.dataset.state = r === 0 ? 'exhausted' : r < 5 ? 'low' : 'ok';
        QUOTA_PILL.hidden = false;
      }
      function init(){
        STATE = loadState();
        QUOTA_PILL = document.getElementById('spg-quota-pill');
        if (QUOTA_PILL) updateQuotaPill();
      }
      function getEdgeAuthHeaders(){
        return {
          'X-SPG-Soft-Id': getSoftId(),
          'X-SPG-Quota-Remaining': String(quotaRemaining()),
          'X-SPG-Client': 'static-v1'
        };
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
      global.SPGRateLimit = {
        check: check,
        record: record,
        quotaRemaining: quotaRemaining,
        getEdgeAuthHeaders: getEdgeAuthHeaders,
        getSoftId: getSoftId,
        reset: function(){ STATE = freshState(); saveState(); updateQuotaPill(); },
        CONFIG: function(){ return Object.assign({}, CONFIG); }
      };
    })(window);</script>`;
    }



// Per-page <meta description> map. Each page routes to a unique, hand-written
// description under the 160-character SEO ceiling. Pages not listed fall back
// to the default in layout(). Adding a new category? Add a key here too.
const PAGE_DESCRIPTIONS = {
  '': 'Stuff Pretty Good helps you find useful gifts, starter kits, travel gear, kitchen helpers, and budget finds without marketplace doom-scrolling.',
  'gift-finder': 'AI Gift Finder: answer a few prompts and get practical gift ideas from the approved Stuff Pretty Good catalog. Grounded picks, no marketplace noise.',
  'starter-kits': 'AI Starter Kit Builder: build useful home-office, travel, kitchen, and desk setups from approved affiliate picks only.',
  'useful-finds': 'Browse useful upgrades for gifts, home, kitchen, travel, tech, pets, and everyday problems — every pick reviewed and approved.',
  'stories': 'AI shopping stories: situation-based checklists for travel, pets, home, and gifts, each backed by approved products.',
  'under-25': 'Useful picks under $25 — gift-safe, practical, and approved. Cheap useful wins without disposable junk.',
  'under-50': 'Useful picks under $50 — gift ideas and everyday upgrades reviewed and approved by Stuff Pretty Good.',
  'walmart': 'Approved Walmart catalog picks filtered for practical usefulness. Curated by Stuff Pretty Good via the Impact catalog gate.',
  'travel': 'Practical travel helpers plus fresh hotel-finder routes powered by the live Stuff Pretty Good catalog.',
  'home-office': 'Home-office upgrades that clean up your desk, posture, and cable mess — every pick reviewed and approved.',
  'kitchen': 'Kitchen tools that save time on weeknight cooking — practical picks approved by Stuff Pretty Good.',
  'pets': 'Pet products that solve annoying problems — fur, water, walks, and travel — every pick approved.',
  'tech': 'Tech accessories that are actually practical: cables, hubs, mounts, batteries, and small fixes.',
  'signup': 'Get Pretty Good Finds by email — useful picks, gift ideas, and starter kits. Email-only by default; SMS is opt-in.',
  'privacy': 'Stuff Pretty Good privacy policy: what we collect, how we use it, TCPA opt-in for SMS, and your rights.',
  'terms': 'Stuff Pretty Good terms of service: editorial standards, affiliate disclosure, disclaimers, and contact info.',
  'contact': 'Contact Stuff Pretty Good for partnerships, accessibility help, takedown requests, or general questions.',
  'about': 'About Stuff Pretty Good: editorial standards, affiliate disclosure, AI-assisted drafting under human review.',
  'affiliate-disclosure': 'Stuff Pretty Good affiliate disclosure: how we earn, what we never do, and FTC compliance details.',
  'advertise': 'Advertise on Stuff Pretty Good: partnership, sponsored placements, and rates for relevant brands.',
  'unsubscribe': 'Unsubscribe from Stuff Pretty Good email or SMS updates in one click. We honor every opt-out.',
  'preferences': 'Manage your Stuff Pretty Good email and SMS preferences: frequency, topics, and consent.',
};

function pageDescription(route) {
  return PAGE_DESCRIPTIONS[route || ''] || 'AI-assisted shopping guide for useful gifts, starter kits, and practical products.';
}

// Per-page <title> map. Each page gets a descriptive title stem (≤60 chars
// total with "| Stuff Pretty Good" suffix) instead of a bare titleCase(slug)
// like "Under 50" or "Privacy". The brand suffix is added by layout().
// Pages not listed fall back to titleCase(route) — same as before, so no
// regressions. Product pages and guide pages already pass descriptive titles
// directly into layout() and don't need this map.
const PAGE_TITLES = {
  '': 'Useful gifts, starter kits & budget finds',
  'gift-finder': 'AI Gift Finder',
  'starter-kits': 'AI Starter Kit Builder',
  'useful-finds': 'Useful finds across every category',
  'stories': 'AI shopping stories by situation',
  'under-25': 'Useful picks under $25',
  'under-50': 'Useful picks under $50',
  'walmart': 'Approved Walmart catalog picks',
  'travel': 'Travel gear, hotel finders & trip kits',
  'home-office': 'Home-office upgrades for desk & posture',
  'kitchen': 'Kitchen helpers that save weeknight time',
  'pets': 'Pet problem-solvers: fur, water, walks, travel',
  'tech': 'Practical tech accessories & small fixes',
  'signup': 'Get Pretty Good Finds by email',
  'privacy': 'Privacy policy & TCPA SMS opt-out',
  'terms': 'Terms of service & disclaimers',
  'contact': 'Contact Stuff Pretty Good',
  'about': 'About Stuff Pretty Good & editorial standards',
  'affiliate-disclosure': 'Affiliate disclosure & FTC compliance',
  'advertise': 'Advertise on Stuff Pretty Good',
  'unsubscribe': 'Unsubscribe from email or SMS updates',
  'preferences': 'Manage email & SMS preferences',
};

function pageTitle(route) {
  return PAGE_TITLES[route || ''] || titleCase(route || '');
}

// pageHeading keeps the on-page H1 in sync with the <title>. Without this, the
// category-page loop used to emit `<title>Useful picks under $50</title>` but
// the visible H1 stayed "Under 50" — search engines and on-page visitors saw
// different page names. Prefer the descriptive PAGE_TITLES entry so H1 and
// <title> agree, fall back to titleCase(route) for routes not in the map.
// Tick 3 fix — see skill pitfall #17 (H1/title sync).
function pageHeading(route) {
  return PAGE_TITLES[route || ''] || titleCase(route || '');
}

// Per-route OG image theme. Each page gets a distinct gradient + accent emoji
// so social shares (Twitter, iMessage, Slack previews) show unique artwork
// instead of every page pointing at the same global spg-shopping-guide.svg.
// Routes not listed get a deterministic neutral theme keyed off the route slug.
// Tick 7 fix — closes Lane A backlog item #1: per-page OG image variety.
const PAGE_OG_THEMES = {
  '':                     { a: '#0f766e', b: '#fde68a', emoji: '🎁', line: 'AI shortlists · better gifts · practical products' },
  'gift-finder':          { a: '#7c3aed', b: '#fde68a', emoji: '🎁', line: 'Answer a few prompts. Get gift shortlists you can act on.' },
  'starter-kits':         { a: '#0ea5e9', b: '#fbcfe8', emoji: '🧰', line: 'Build useful setups from approved affiliate picks.' },
  'useful-finds':         { a: '#0f766e', b: '#fde68a', emoji: '✨', line: 'Fresh daily finds from the approved catalog.' },
  'stories':              { a: '#db2777', b: '#fde68a', emoji: '📰', line: 'Shop by real-life situation with AI-built shortlists.' },
  'under-25':             { a: '#16a34a', b: '#fef9c3', emoji: '💸', line: 'Practical picks under $25.' },
  'under-50':             { a: '#0891b2', b: '#fde68a', emoji: '💵', line: 'Practical picks under $50.' },
  'walmart':              { a: '#ea580c', b: '#fde68a', emoji: '🛒', line: 'Approved Walmart catalog picks, filtered for usefulness.' },
  'travel':               { a: '#0284c7', b: '#bae6fd', emoji: '✈️', line: 'Travel gear, hotel finders & trip kits.' },
  'home-office':          { a: '#1d4ed8', b: '#e0e7ff', emoji: '🪑', line: 'Home-office upgrades for desk & posture.' },
  'kitchen':              { a: '#b45309', b: '#fde68a', emoji: '🍳', line: 'Kitchen helpers that save weeknight time.' },
  'pets':                 { a: '#059669', b: '#fde68a', emoji: '🐾', line: 'Pet problem-solvers: fur, water, walks, travel.' },
  'tech':                 { a: '#312e81', b: '#c7d2fe', emoji: '🔌', line: 'Practical tech accessories & small fixes.' },
  'signup':               { a: '#0f766e', b: '#fde68a', emoji: '📬', line: 'Get Pretty Good Finds by email.' },
  'privacy':              { a: '#1f2937', b: '#f3f4f6', emoji: '🔒', line: 'Privacy policy & TCPA SMS opt-out.' },
  'terms':                { a: '#1f2937', b: '#f3f4f6', emoji: '📄', line: 'Terms of service & disclaimers.' },
  'contact':              { a: '#0f172a', b: '#bae6fd', emoji: '✉️', line: 'Contact Stuff Pretty Good.' },
  'about':                { a: '#0f766e', b: '#fde68a', emoji: '🟢', line: 'About Stuff Pretty Good & editorial standards.' },
  'affiliate-disclosure': { a: '#0f172a', b: '#fde68a', emoji: '💼', line: 'Affiliate disclosure & FTC compliance.' },
  'advertise':            { a: '#9333ea', b: '#fde68a', emoji: '📣', line: 'Advertise on Stuff Pretty Good.' },
  'unsubscribe':          { a: '#475569', b: '#fde68a', emoji: '🛑', line: 'Unsubscribe from email or SMS updates.' },
  'preferences':          { a: '#0891b2', b: '#fde68a', emoji: '⚙️', line: 'Manage email & SMS preferences.' },
  'open':                 { a: '#1e3a8a', b: '#fde68a', emoji: '🔗', line: 'Open a Stuff Pretty Good deep link.' },
};

// Per-page mobile status-bar theme color. The light/dark pair is consumed by
// Safari iOS + Chrome Android when the page is saved to the home screen or
// installed as a PWA — the address bar / status-bar tint matches the route's
// brand accent instead of staying on the global cream/navy. Mirrors the route
// keys in PAGE_OG_THEMES so the social card gradient and the in-OS chrome
// gradient stay in sync. Routes not in the map fall back to the global
// cream/navy pair (handled in layout()).
const PAGE_THEME_COLORS = {
  '':                     { light: '#f6f1e8', dark: '#0b1220' },
  'gift-finder':          { light: '#fde68a', dark: '#1e1b4b' },
  'starter-kits':         { light: '#bae6fd', dark: '#0c4a6e' },
  'useful-finds':         { light: '#fde68a', dark: '#134e4a' },
  'stories':              { light: '#fde68a', dark: '#831843' },
  'under-25':             { light: '#fef9c3', dark: '#14532d' },
  'under-50':             { light: '#fde68a', dark: '#155e75' },
  'walmart':              { light: '#fde68a', dark: '#7c2d12' },
  'travel':               { light: '#bae6fd', dark: '#0c4a6e' },
  'home-office':          { light: '#e0e7ff', dark: '#1e3a8a' },
  'kitchen':              { light: '#fde68a', dark: '#78350f' },
  'pets':                 { light: '#fde68a', dark: '#064e3b' },
  'tech':                 { light: '#c7d2fe', dark: '#1e1b4b' },
  'signup':               { light: '#fde68a', dark: '#134e4a' },
  'privacy':              { light: '#f3f4f6', dark: '#111827' },
  'terms':                { light: '#f3f4f6', dark: '#111827' },
  'contact':              { light: '#bae6fd', dark: '#0f172a' },
  'about':                { light: '#fde68a', dark: '#134e4a' },
  'affiliate-disclosure': { light: '#fde68a', dark: '#0f172a' },
  'advertise':            { light: '#fde68a', dark: '#581c87' },
  'unsubscribe':          { light: '#fde68a', dark: '#334155' },
  'preferences':          { light: '#fde68a', dark: '#155e75' },
  'open':                 { light: '#fde68a', dark: '#1e3a8a' },
};

const OG_NEUTRAL_THEMES = [
  { a: '#0f766e', b: '#fde68a' },
  { a: '#7c3aed', b: '#bae6fd' },
  { a: '#db2777', b: '#fde68a' },
  { a: '#0891b2', b: '#fde68a' },
  { a: '#ea580c', b: '#fde68a' },
  { a: '#16a34a', b: '#fde68a' },
];

function hashSlug(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}

// Build a per-route OG image (1200x630-friendly aspect, 960x360 to match the
// existing global SVG so social cards stay consistent). Returns the file path
// relative to site root, and writes the SVG to dist/assets/og/<slug>.svg.
// Pitfall-aware: this is a single-quoted template-literal builder, NOT inlined
// into another template-literal block — keeps the inlined-string-build traps
// from pitfalls #27 + #28 at bay.
function pageOgImageSvg(route, title) {
  const key = route || 'index';
  const slug = key === '' ? 'home' : key.replace(/[^a-z0-9-]/gi, '-');
  const theme = PAGE_OG_THEMES[key] || (() => {
    const t = OG_NEUTRAL_THEMES[hashSlug(key) % OG_NEUTRAL_THEMES.length];
    return { a: t.a, b: t.b, emoji: '🟢', line: esc(title) || 'Stuff Pretty Good' };
  })();
  const safeTitle = esc(title || theme.line).slice(0, 64);
  const safeLine = esc(theme.line).slice(0, 90);
  return {
    filename: `assets/og/${slug}.svg`,
    url: `/assets/og/${slug}.svg`,
    svg:
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 360" role="img" aria-label="${esc(title || 'Stuff Pretty Good')} social preview">
  <defs><linearGradient id="og-${slug}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${theme.a}"/><stop offset="1" stop-color="${theme.b}"/></linearGradient><filter id="og-glow-${slug}"><feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#020617" flood-opacity=".28"/></filter></defs>
  <rect width="960" height="360" rx="44" fill="url(#og-${slug})"/>
  <circle cx="106" cy="92" r="58" fill="#fff7ed" opacity=".22"/><circle cx="848" cy="78" r="92" fill="#bfdbfe" opacity=".18"/><path d="M64 292C190 242 278 330 402 278s192-74 320 8 184 8 216-22" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity=".22"/>
  <g filter="url(#og-glow-${slug})"><rect x="62" y="54" width="836" height="252" rx="40" fill="#fff"/></g>
  <image href="/assets/site/spg-logo.svg" x="92" y="86" width="120" height="120"/>
  <text x="240" y="160" font-family="Inter,Arial,sans-serif" font-size="58" font-weight="900" fill="#111827">${theme.emoji}</text>
  <text x="92" y="240" font-family="Inter,Arial,sans-serif" font-size="44" font-weight="900" fill="#0f172a">${safeTitle}</text>
  <text x="92" y="280" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="600" fill="#475569">${safeLine}</text>
  <text x="880" y="328" text-anchor="end" font-family="Inter,Arial,sans-serif" font-size="20" font-weight="900" fill="#fff7ed">stuffprettygood.com</text>
</svg>`
  };
}

// Per-page AI-bubble suggestion chips. The AI helper on every page used to show
// the same 4 generic chips ("gift under $25", "travel kit", "desk setup", "pet
// problem") regardless of which category page the shopper was on. Now the chip
// set changes to match the page context — a kitchen shopper sees "kitchen time
// saver", a travel shopper sees "flight essentials", etc. Lane C backlog #1.
const DEFAULT_SUGGESTIONS = ['gift under $25', 'travel kit', 'desk setup', 'pet problem'];
const PAGE_SUGGESTIONS = {
  '':                          ['useful under $25', 'gift under $50', 'desk setup', 'starter kit ideas'],
  'gift-finder':               ['gift for dad under $50', 'gift for coworker', 'gift under $25', 'gift for mom'],
  'starter-kits':              ['home office starter kit', 'travel starter kit', 'kitchen starter kit', 'desk setup under $100'],
  'under-50':                  ['useful under $50', 'useful under $25', 'budget desk setup', 'cheap kitchen'],
  'under-25':                  ['useful under $25', 'cheap useful wins', 'desk upgrades', 'kitchen under $25'],
  'walmart':                   ['walmart approved picks', 'walmart under $25', 'walmart under $50', 'walmart desk'],
  'tech':                      ['phone accessories', 'laptop accessories', 'desk tech', 'cable organization'],
  'kitchen':                   ['kitchen time saver', 'kitchen under $25', 'meal prep tools', 'coffee upgrades'],
  'home-office':               ['desk setup under $100', 'desk upgrades', 'laptop stand', 'cable management'],
  'home':                      ['apartment essentials', 'small space storage', 'renters', 'kitchen home'],
  'pets':                      ['pet cleanup', 'pet under $25', 'cat owner essentials', 'dog walking kit'],
  'travel':                    ['flight essentials', 'carry-on kit', 'travel under $50', 'road trip kit'],
  'car':                       ['car under $30', 'road trip kit', 'commuter essentials', 'rideshare kit'],
  'wellness':                  ['desk wellness', 'sleep setup', 'recovery tools', 'hydration'],
  'organization':              ['apartment storage', 'closet organizers', 'kitchen organization', 'desk organization'],
  'hobby':                     ['beginner tool kit', 'starter creative', 'hobby under $25', 'desk hobby'],
  'gifts':                     ['gift under $25', 'gift under $50', 'gift for dad', 'gift for mom'],
  'signup':                    ['what is the email list', 'how do SMS updates work', 'privacy policy', 'unsubscribe'],
  'stories':                   ['useful stories', 'gift stories', 'travel stories', 'kitchen stories'],
  'guides':                    ['useful finds guide', 'gifts guide', 'kitchen guide', 'home office guide'],
  'privacy':                   ['what data do you collect', 'how to unsubscribe', 'how to update preferences', 'tcpa disclosure'],
  'terms':                     ['return policy', 'warranty', 'how pricing works', 'affiliate disclosure'],
  'contact':                   ['how do I contact support', 'affiliate partnership', 'press inquiry', 'takedown request'],
  'affiliate-disclosure':      ['how affiliate links work', 'which merchants', 'return policy', 'editorial policy'],
  'preferences':               ['how to unsubscribe', 'how to update email', 'how to opt out of SMS', 'privacy policy'],
  'about':                     ['what is stuff pretty good', 'how do you pick products', 'editorial policy', 'who runs spg'],
  'advertise':                 ['advertising options', 'sponsored placement', 'newsletter sponsorship', 'contact sales'],
  'products':                  ['compare two picks', 'show cheaper options', 'best for travel', 'best for desk'],
};

// JSON-LD structured-data blocks. Per Lane B backlog #1 (tick 2): per-page meta
// is in layout()/mkdirPage(); per pitfall #12: site-wide meta belongs in layout().
// `Organization` and `WebSite` (with SearchAction) ship on EVERY page; route-aware
// blocks (`BreadcrumbList`, `Product`, `FAQPage`) ship only when the route matches.
// Each block is one <script type="application/ld+json"> so JSON-LD parsers see it
// individually and Google's Rich Results Test can validate per-page.
//
// Lane B tick 47: extend Organization JSON-LD so Google Knowledge Graph + rich
// results can populate the brand panel without guessing. (a) telephone at the
// top level (Knowledge Panel direct-line); (b) email at the top level
// (search-result snippet); (c) PostalAddress block (Knowledge Panel local
// listing — SPG_OPERATOR is a New York LLC); (d) foundingDate '2026'
// (Knowledge Panel timeline); (e) areaServed Expanded to ['US','CA','GB'] for
// future Google Shopping expansion; (f) sameAs stays [] until social profiles
// are live (empty sameAs is the documented safe-state).
const ORGANIZATION_JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SPG_BRAND,
  alternateName: 'SPG',
  url: `https://${SPG_DOMAIN}/`,
  logo: `https://${SPG_DOMAIN}/assets/site/spg-logo.svg`,
  description: 'AI-assisted shopping guide for useful gifts, starter kits, and practical products.',
  foundingDate: '2026',
  founder: { '@type': 'Organization', name: SPG_OPERATOR },
  email: SPG_CONTACT_EMAIL,
  telephone: SPG_CONTACT_PHONE,
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'US',
    addressRegion: 'NY',
    addressLocality: 'New York',
    name: SPG_OPERATOR
  },
  sameAs: [],
  contactPoint: [{
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: SPG_CONTACT_EMAIL,
    telephone: SPG_CONTACT_PHONE,
    areaServed: ['US', 'CA', 'GB'],
    availableLanguage: ['en']
  }]
});

const WEBSITE_JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SPG_BRAND,
  url: `https://${SPG_DOMAIN}/`,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `https://${SPG_DOMAIN}/useful-finds/?q={search_term_string}` },
    'query-input': 'required name=search_term_string'
  }
});

// `FAQPage` blocks for the AI shopping tools. These are the canonical FAQ-shaped
// questions a user might ask when landing on gift-finder / starter-kits and they
// double as structured-data Q/A pairs (eligible for Google FAQ rich-results).
const FAQ_JSONLD = {
  'gift-finder': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'How does the AI Gift Finder work?', acceptedAnswer: { '@type': 'Answer', text: 'Answer a few short prompts about who you are shopping for, your budget, and the situation. The assistant pulls 5–8 practical picks from the approved Stuff Pretty Good catalog — no marketplace doom-scroll.' } },
      { '@type': 'Question', name: 'Are the gift picks from real products?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Every pick comes from the approved affiliate catalog. Each link routes through /go/<id>/ to the merchant page so you can confirm current price, availability, and shipping before buying.' } },
      { '@type': 'Question', name: 'Do I have to sign up to use the Gift Finder?', acceptedAnswer: { '@type': 'Answer', text: 'No. The Gift Finder is free and open. Signup is optional — it gets you a weekly useful-finds email if you want one.' } },
      { '@type': 'Question', name: 'Can I ask follow-up questions about the picks?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The SPG AI bubble in the bottom-right can answer follow-ups like "show cheaper picks," "what should I avoid?" or "compare two options" using the same approved catalog.' } }
    ]
  },
  'starter-kits': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'What is the AI Starter Kit Builder?', acceptedAnswer: { '@type': 'Answer', text: 'It assembles a useful starter kit from approved affiliate picks based on the situation you describe — home office, travel, kitchen, desk setup, first apartment, and more. The output is a shortlist of 5–8 products you can buy individually.' } },
      { '@type': 'Question', name: 'Are these kits physical bundles I can buy?', acceptedAnswer: { '@type': 'Answer', text: 'No — they are shortlists of standalone products from the approved catalog that work well together. You buy each item separately through its /go/<id>/ page so current pricing and availability stay accurate.' } },
      { '@type': 'Question', name: 'How is this different from the AI Gift Finder?', acceptedAnswer: { '@type': 'Answer', text: 'Gift Finder targets a person and an occasion. Starter Kit Builder targets a setup or situation (e.g. "first apartment essentials" or "travel kit under $150") and assembles the kit across multiple categories.' } }
    ]
  },
  // Lane B category-page FAQPage blocks (tick 35). Each route below is a curated
  // shop-by-category page that benefits from 3-4 FAQ Q/A pairs so search engines
  // and AI tools can ingest the "what is this page" + "how do picks qualify"
  // canonical questions. mainEntity questions are unique per route — no overlap
  // with the gift-finder / starter-kits entries above.
  'under-50': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'What is Stuff Pretty Good\'s Under $50 page?', acceptedAnswer: { '@type': 'Answer', text: 'A curated shortlist of useful products under $50 pulled from our approved affiliate catalog. Each pick solves a concrete daily problem — desk cleanup, kitchen prep, travel, pet care — without hitting premium pricing.' } },
      { '@type': 'Question', name: 'How do you decide what makes the Under $50 list?', acceptedAnswer: { '@type': 'Answer', text: 'Every pick is approved-affiliate, currently priced under $50 at the merchant, and reviews as genuinely useful (not a cheap filler gadget). We rotate weekly based on stock, price changes, and reader feedback.' } },
      { '@type': 'Question', name: 'Does Under $50 include the cheapest possible product?', acceptedAnswer: { '@type': 'Answer', text: 'No — cheap is not the goal. The page favors the best value at the price, with products that hold up to daily use rather than one-time novelty.' } },
      { '@type': 'Question', name: 'Can I ask the AI to narrow Under $50 picks for me?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Open the SPG AI bubble in the bottom-right and ask for "useful under $50" or a more specific situation like "desk setup under $50" — the bubble will pull from the same approved catalog.' } }
    ]
  },
  'walmart': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'What is the Walmart-approved picks page on SPG?', acceptedAnswer: { '@type': 'Answer', text: 'A shortlist of products available through Walmart\'s affiliate program that we have vetted as useful enough to recommend. Every link routes through /go/<id>/ so you still confirm current price and shipping on Walmart before buying.' } },
      { '@type': 'Question', name: 'Why filter picks to one retailer like Walmart?', acceptedAnswer: { '@type': 'Answer', text: 'Some shoppers prefer the predictability of one retailer — easy returns, store pickup, and a familiar checkout. This page keeps the SPG "no fake hype" rule while letting you shop that constraint.' } },
      { '@type': 'Question', name: 'Is the Walmart page a substitute for the main catalog?', acceptedAnswer: { '@type': 'Answer', text: 'No. It is a subset. The full approved catalog spans many retailers and price points; the Walmart page only shows the picks that route to Walmart.' } },
      { '@type': 'Question', name: 'Are Walmart prices on SPG updated in real time?', acceptedAnswer: { '@type': 'Answer', text: 'No — we link to the merchant and let Walmart serve the live price. SPG shows the category and price band we vetted the product at; final pricing lives on the merchant page.' } }
    ]
  },
  'home-office': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'What makes the Home Office picks page worth browsing?', acceptedAnswer: { '@type': 'Answer', text: 'It rounds up practical home-office upgrades — monitor lights, laptop stands, cable management, footrests, desk mats — from the approved SPG catalog, so you can build a less painful desk without researching every gadget.' } },
      { '@type': 'Question', name: 'I already own a laptop and monitor — what would actually help?', acceptedAnswer: { '@type': 'Answer', text: 'The most useful add-ons tend to be cable management, a monitor light bar, an adjustable laptop stand, and an under-desk headphone hook. All four appear on this page with short buyer notes.' } },
      { '@type': 'Question', name: 'Are these picks suitable for a small desk or apartment?', acceptedAnswer: { '@type': 'Answer', text: 'Yes — most home-office picks are sized for shared desks and small rooms. Picks like the vertical laptop stand and cable management box are specifically chosen for tight spaces.' } },
      { '@type': 'Question', name: 'Does Home Office overlap with the desk-setup guide?', acceptedAnswer: { '@type': 'Answer', text: 'They share product picks but serve different jobs: the category page is a browseable shortlist, the desk-setup guide is a curated walkthrough for someone starting from zero.' } }
    ]
  },
  'kitchen': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'What kind of products are on the SPG Kitchen page?', acceptedAnswer: { '@type': 'Answer', text: 'Practical kitchen helpers — magnetic measuring spoons, clip-on pot strainers, produce-saver containers, utensil rests, jar openers, and other small tools that make weeknight cooking less annoying.' } },
      { '@type': 'Question', name: 'Are the kitchen picks suitable for small apartments or dorms?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The shortlist favors space-saving tools (clip-on strainers, magnetic organizers, single-purpose gadgets) over bulky appliances. Most picks fit in a single drawer.' } },
      { '@type': 'Question', name: 'Are any of these picks single-use novelties?', acceptedAnswer: { '@type': 'Answer', text: 'No — every kitchen pick is something a regular home cook reaches for at least weekly. Single-use gadgets without repeat-use value are filtered out before they reach the list.' } },
      { '@type': 'Question', name: 'Can I ask the AI which kitchen pick to start with?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Open the SPG AI bubble and ask something like "what should I get first for a small kitchen" — the bubble will answer with a short shortlist from the same approved catalog.' } }
    ]
  },
  'travel': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'What kind of products are on the SPG Travel page?', acceptedAnswer: { '@type': 'Answer', text: 'Practical travel gear — compression packing cubes, refillable toiletry bottles, luggage scales, neck pillows, cable organizers, passport wallets — small enough to carry, useful enough to use on every trip.' } },
      { '@type': 'Question', name: 'I only travel carry-on. Are any of these still useful?', acceptedAnswer: { '@type': 'Answer', text: 'Most picks are carry-on-friendly by design: refillable bottles that fit TSA bags, packable neck pillows, slim passport wallets, and cable pouches. We avoid bulky gear.' } },
      { '@type': 'Question', name: 'Do you recommend travel adapters and converters?', acceptedAnswer: { '@type': 'Answer', text: 'A universal travel adapter is on the page. For voltage conversion, we link to general guidance rather than recommending a specific converter — needs vary by destination and device.' } },
      { '@type': 'Question', name: 'Can the AI build me a travel kit for a specific trip?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Open the SPG AI bubble and describe your trip — length, destination type, and whether you will check a bag — and the assistant will pull a shortlist from the approved travel catalog.' } }
    ]
  }
};

// Build an ItemList JSON-LD block from a list of product records shown on a
// category page. Each top-level product on the page becomes a ListItem with the
// canonical product URL as the `url` and the title as the `name`. Helps Google
// surface the category page as a list of products in search results. Pairs with
// the existing BreadcrumbList on the same page. Lane B tick 42.
function categoryItemListJsonLd(route, title, picks) {
  if (!Array.isArray(picks) || picks.length === 0) return '';
  const itemListElement = picks.slice(0, 24).map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `https://${SPG_DOMAIN}/products/${p.id}/`,
    name: p.title
  }));
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title || 'Products',
    itemListOrder: 'https://schema.org/ItemListUnordered',
    numberOfItems: itemListElement.length,
    itemListElement
  });
}

// Auto-derive a BreadcrumbList from the route path. Routes like `products/<id>` and
// `guides/<slug>` get one more level than top-level routes. The home route (`''`)
// gets just Home so the list is still valid JSON-LD even if trivial.
function breadcrumbJsonLd(route, title) {
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `https://${SPG_DOMAIN}/` }];
  const r = route || '';
  if (r.startsWith('products/')) {
    items.push({ '@type': 'ListItem', position: 2, name: 'Useful Finds', item: `https://${SPG_DOMAIN}/useful-finds/` });
    items.push({ '@type': 'ListItem', position: 3, name: title || 'Product', item: `https://${SPG_DOMAIN}/${r}/` });
  } else if (r.startsWith('guides/')) {
    items.push({ '@type': 'ListItem', position: 2, name: 'Buying Guides', item: `https://${SPG_DOMAIN}/useful-finds/` });
    items.push({ '@type': 'ListItem', position: 3, name: title || 'Guide', item: `https://${SPG_DOMAIN}/${r}/` });
  } else if (r) {
    items.push({ '@type': 'ListItem', position: 2, name: title || r, item: `https://${SPG_DOMAIN}/${r}/` });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items });
}

// Build a Product JSON-LD block from a product record. Uses the existing schema
// shape so we don't need to add fields to data/products.json.
function productJsonLd(p) {
  const url = `https://${SPG_DOMAIN}/products/${p.id}/`;
  const offers = {
    '@type': 'Offer',
    url: url,
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    price: typeof p.price === 'number' ? p.price : undefined,
    priceValidUntil: '2027-12-31'
  };
  // Drop undefined `price` so we don't claim a price we don't have.
  if (offers.price === undefined) delete offers.price;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: `${p.title} — ${p.why_useful}`,
    image: p.image_url ? (p.image_url.startsWith('http') ? p.image_url : `https://${SPG_DOMAIN}${p.image_url}`) : undefined,
    brand: { '@type': 'Brand', name: SPG_BRAND },
    category: p.category,
    offers: offers
  });
}

function layout(title, body, opts = {}, description) {
  const desc = description || 'AI-assisted shopping guide for useful gifts, starter kits, and practical products.';
  const shellClass = body.includes('compact-hero') ? 'site-shell home-shell' : 'site-shell';
  const showModal = opts.showModal !== false; // default true
  const modalHtml = showModal ? signupModal() : '';
  // Tick 65: route-scoped preconnect hints. Amazon ad system preconnect only
  // on product detail pages (where amazonNativeAd(p) injects the widget);
  // site-wide clarity + internal API preconnect on every page.
  const preconnectHints = (opts.route && /^products\//.test(opts.route))
    ? '<link rel="preconnect" href="https://z-na.amazon-adsystem.com" crossorigin>'
    : '';
  const fullTitle = `${esc(title)} | Stuff Pretty Good`;
  // Per-route JSON-LD blocks. Site-wide Organization + WebSite always ship;
  // BreadcrumbList/Product/FAQPage are picked by route.
  const route = opts.route || '';
  const jsonLdBlocks = [
    `<script type="application/ld+json">${ORGANIZATION_JSONLD}</script>`,
    `<script type="application/ld+json">${WEBSITE_JSONLD}</script>`
  ];
  // Per-page breadcrumbs (skip on `/` since a single-item list is noise).
    if (route) jsonLdBlocks.push(`<script type="application/ld+json">${breadcrumbJsonLd(route, title)}</script>`);
    // Per-page ItemList JSON-LD for category pages that ship with a picks array
    // (under-25 / under-50 / travel / home-office / kitchen / pets / tech / walmart).
    // Threaded via opts.categoryItemListJsonLd so the layout stays schema-source-of-truth.
    if (opts.categoryItemListJsonLd) jsonLdBlocks.push(`<script type="application/ld+json">${opts.categoryItemListJsonLd}</script>`);
  // Per-page Product schema for /products/<id>/ pages.
  if (opts.productJsonLd) jsonLdBlocks.push(`<script type="application/ld+json">${opts.productJsonLd}</script>`);
  // Per-page FAQPage schema for the AI tools.
  if (FAQ_JSONLD[route]) jsonLdBlocks.push(`<script type="application/ld+json">${JSON.stringify(FAQ_JSONLD[route])}</script>`);
  return normalizeLinks(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="fo-verify" content="da9ff319-a228-4e53-905f-5cde75aaf50b"><link rel="preconnect" href="https://www.clarity.ms" crossorigin>
<link rel="dns-prefetch" href="https://www.clarity.ms">
<link rel="preconnect" href="https://stuffprettygood-api.mehyar.workers.dev" crossorigin>
<link rel="dns-prefetch" href="https://stuffprettygood-api.mehyar.workers.dev">${preconnectHints}${microsoftClaritySnippet}<script>(function(){try{var t=localStorage.getItem('spg-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}else if(t==='light'){document.documentElement.setAttribute('data-theme','light');}else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();</script><title>${fullTitle}</title><meta name="description" content="${esc(desc)}"><meta property="og:title" content="${fullTitle}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="https://stuffprettygood.com${opts.canonical || '/'}"><meta property="og:site_name" content="Stuff Pretty Good"><meta property="og:locale" content="en_US"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#f6f1e8" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0b1220" media="(prefers-color-scheme: dark)"><meta name="theme-color" content="#111827"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="SPG"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="format-detection" content="telephone=no,email=no,address=no,date=no"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="manifest" href="/site.webmanifest"><link rel="apple-touch-icon" href="/favicon.svg"><meta property="og:image" content="/assets/site/spg-shopping-guide.svg">${jsonLdBlocks.join('')}<link rel="stylesheet" href="/styles.css"></head><body id="top" data-route="${esc(route)}"><a class="skip-link" href="#main">Skip to main content</a><div class="spg-splash" aria-hidden="true" id="spg-splash"><div class="spg-splash-logo">SPG</div><span>Stuff Pretty Good</span><small>loading</small></div><script>(function(){try{if(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches){document.documentElement.classList.add('is-pwa');}else if(navigator.standalone===true){document.documentElement.classList.add('is-pwa');}var s=document.getElementById('spg-splash');if(!s)return;function dismiss(){s.classList.add('is-loaded');setTimeout(function(){if(s&&s.parentNode){s.parentNode.removeChild(s);}},500);}if(document.readyState==='complete'||document.readyState==='interactive'){setTimeout(dismiss,80);}else{document.addEventListener('DOMContentLoaded',function(){setTimeout(dismiss,40);});}setTimeout(dismiss,1400);}catch(e){var s=document.getElementById('spg-splash');if(s&&s.parentNode){s.parentNode.removeChild(s);}}})();</script><div class="${shellClass}"><nav class="nav" aria-label="Primary navigation"><a class="logo" href="/"><img class="logo-img" src="/assets/site/spg-logo.svg" alt="Stuff Pretty Good logo"><span>Stuff Pretty Good</span></a><div class="nav-links"><a href="/gift-finder/">Gift Finder</a><a href="/starter-kits/">Starter Kits</a><a href="/under-50/">Under $50</a><a href="/walmart/">Walmart</a><a href="/stories/">Stories</a><a href="/signup/">Sign up</a><button type="button" class="theme-toggle" data-theme-toggle aria-label="Toggle dark mode" aria-pressed="false"><span class="moon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" focusable="false"><path fill="currentColor" d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"/></svg></span><span class="sun" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" focusable="false"><path fill="currentColor" d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5Z"/></svg></span><span class="label">Theme</span></button></div></nav><p class="impact-verification" aria-hidden="true">${impactSiteVerification}</p><div class="page-art"><img src="/assets/site/spg-shopping-guide.svg" alt="Stuff Pretty Good shopping guide visual"></div><main id="main" tabindex="-1">${body}</main>${assistantWidget(route)}${backToTop()}${pwaRegistration()}${scrollRevealScript()}${themeToggleScript()}${pullToRefreshScript()}${offlineIndicatorScript()}${iosInstallHintScript()}${exitIntentScript()}${recentlyViewedScript()}${modalHtml}<footer class="footer" aria-label="Site footer"><div><strong>Stuff Pretty Good</strong><p>Useful finds, starter kits, and gifts picked to help you buy faster and waste less.</p></div><div class="footer-links"><a href="/affiliate-disclosure/">Affiliate Disclosure</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/contact/">Contact</a><a href="/signup/">Sign up</a><a href="/unsubscribe/">Unsubscribe</a><a href="/preferences/">Preferences</a></div></footer></div></body></html>`);
  }

  function card(p, i = 0) {
  return `<article class="card" style="--delay:${i % 6}"><a class="thumb" href="/products/${p.id}/"><img src="${p.image_url}" alt="${esc(p.title)} illustrated fallback"></a><div class="value-chip">Useful pick · quick decision notes</div><div class="card-meta"><span>${esc(p.price_band.replace('-', ' $'))}</span><span>${esc(p.category.replace('-', ' '))}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.why_useful)}</p><p class="best"><strong>Best for:</strong> ${esc(p.best_for)}</p><a class="btn small" href="/products/${p.id}/">Get</a></article>`;
}

// Stable sort: image-bearing products first, then text-only products.
// Preserves existing manual order within each group.
const productsWithImagesFirst = (a, b) => {
  const ai = !!(a.image || a.imageUrl || a.thumb || a.image_url);
  const bi = !!(b.image || b.imageUrl || b.thumb || b.image_url);
  return Number(bi) - Number(ai);
};


// Lane C #8 (tick 62→63): extract assistantWidget() IIFE to an external file.
// The inline IIFE body moves to scripts/templates/ai-bubble.js so all /regex/
// literals are plain JS (no template-literal escape consumption).
// Writes ai-bubble.js once per build, then emits a <script defer> tag.
function assistantWidget(route) {
  const knowledge = products.map((p) => ({ id: p.id, title: p.title, category: p.category, price_band: p.price_band, image_url: p.image_url, why_useful: p.why_useful, best_for: p.best_for, avoid_if: p.avoid_if })).slice(0, 180);
  const siteFacts = {
    brand: 'Stuff Pretty Good helps shoppers find useful gifts, starter kits, travel gear, kitchen helpers, pet fixes, home-office upgrades, and budget finds.',
    rules: 'The assistant recommends products already on the site and sends shoppers to internal pick pages first.',
    shipping: 'Purchases, pricing, shipping, returns, warranties, and availability are handled by the merchant. Confirm details before buying.',
    signup: 'Signup is email-only by default. Phone is collected only if the user wants SMS updates and ticks the explicit TCPA consent box on the signup form. SMS frequency is up to 4 messages per month; reply STOP to opt out.',
    bestQuestions: ['gift for dad under $50', 'travel kit for a long flight', 'desk setup under $100', 'pet cleanup products', 'small apartment essentials']
  };
  const r = (typeof route === 'string' ? route : '');
  const suggestionChips = PAGE_SUGGESTIONS[r]
    || PAGE_SUGGESTIONS[r.split('/')[0]]
    || DEFAULT_SUGGESTIONS;
  const chipsHtml = suggestionChips.map(t => `<button type="button">${esc(t)}</button>`).join('');

  // ── Write ai-bubble.js once ──────────────────────────────────────────────
  // PAGE_SUGGESTIONS and DEFAULT_SUGGESTIONS are closure variables from the
  // build context; bake them into the emitted JS so aiBubbleInit() is stateless.
  // __dirname unavailable in ES module scope — derive from process.cwd()
  const scriptsDir = path.join(root, 'scripts');
  const aiBubbleTemplatePath = path.join(scriptsDir, 'templates', 'ai-bubble.js');
  const aiBubbleContent = `/***** ai-bubble.js — generated by build.mjs assistantWidget() *****/
/* DO NOT EDIT BY HAND — rebuild to regenerate */
var _PAGE_SUGGESTIONS = ${JSON.stringify(PAGE_SUGGESTIONS)};
var _DEFAULT_SUGGESTIONS = ${JSON.stringify(DEFAULT_SUGGESTIONS)};
${fs.readFileSync(aiBubbleTemplatePath, 'utf8')}`;
  fs.writeFileSync(path.join(dist, 'scripts', 'templates', 'ai-bubble.js'), aiBubbleContent);

  return `${rateLimitScript()}<div class="ai-bubble" data-ai-bubble><button class="ai-launch" type="button" aria-label="Open SPG AI helper"><span>AI</span><strong>Ask SPG</strong><span class="ai-launch-pill" data-ai-launch-pill hidden aria-live="polite"></span></button><button class="ai-verdict-launch" type="button" data-ai-verdict-launch aria-label="Pretty good or not? Quick verdict on a URL or product" hidden><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1 14.5L6.5 12l1.4-1.4L11 13.7l5.1-5.1L17.5 10Z"/></svg><strong>Pretty good or not?</strong></button><form class="ai-verdict" data-ai-verdict hidden novalidate><label class="eyebrow" for="spg-verdict-q">Paste a URL or product name</label><div class="ai-verdict-row"><input id="spg-verdict-q" name="verdict" autocomplete="off" placeholder="e.g. https://amzn.to/... or Anova Precision Cooker" required><button type="submit">Verdict</button><button type="button" class="ai-verdict-cancel" aria-label="Cancel verdict">×</button></div></form><section class="ai-panel" aria-label="AI helper chat" hidden><header aria-label="AI helper header"><div><p class="eyebrow">SPG AI Helper</p><h2>Ask about gifts, kits, budgets, or any pick.</h2><span id="spg-quota-pill" class="spg-quota-pill" hidden></span></div><div class="ai-header-actions"><button type="button" class="ai-share" data-ai-share hidden aria-label="Copy shareable link"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18 8a3 3 0 0 0-2.05-.81 3 3 0 0 0-2.95 2.4 1 1 0 1 0 1.96.4 1 1 0 0 1 1.99-.2 1 1 0 0 1-.6 1.18 1 1 0 1 0 .7 1.86A3 3 0 0 0 18 8Zm-9.95 8.81a3 3 0 0 0 2.05.81 3 3 0 0 0 2.95-2.4 1 1 0 1 0-1.96-.4 1 1 0 0 1-1.99.2 1 1 0 0 1 .6-1.18 1 1 0 1 0-.7-1.86A3 3 0 0 0 8.05 16.81Zm5.45-3.31a1 1 0 0 0-1.32-.5l-3.16 1.4a1 1 0 1 0 .81 1.83l3.16-1.4a1 1 0 0 0 .51-1.33Z"/></svg></button><button type="button" class="ai-reset" data-ai-reset aria-label="Start new chat" title="New chat" hidden><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 4V1L8 5l4 4V6a6 6 0 0 1 5.65 8H20A8 8 0 0 0 4 12a8 8 0 0 0 8 8 8 8 0 0 0 8-8 1 1 0 0 1 2 0 6 6 0 0 1-6 6 6 6 0 0 1-6-6 1 1 0 0 1 2 0 8 8 0 0 1 0-8 8 8 0 0 1 0 8 1 1 0 0 1-2 0 6 6 0 0 1 0-12 6 6 0 0 1 5.65-4H12a8 8 0 0 0 0-16Zm-1 8v6l5.25 3.15.75-1.23-4-2.42V12Z"/></svg></button></div></header><div class="ai-suggestions" aria-label="Suggested prompts">${chipsHtml}</div><div class="ai-messages" data-ai-messages role="log" aria-live="polite"></div><footer class="ai-footer"><form class="ai-form" data-ai-form autocomplete="off" novalidate><div class="ai-input-row"><input class="ai-input" name="q" type="text" placeholder="Ask: gift for dad under $50" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Ask the AI helper"><button type="button" class="ai-mic" data-ai-mic hidden aria-label="Voice input"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 14a1 1 0 0 0 1-1v-3a1 1 0 0 0-2 0v3a1 1 0 0 0 1 1Zm7-1.5a1 1 0 0 0-1-1A5 5 0 0 0 7 9v4a5 5 0 0 0 10 0v-4a5 5 0 0 0-4.5-4.95 1 1 0 0 0-1 1Z"/></svg></button><button type="submit" class="ai-send" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M2 21l21-9L2 3v7l15 2-15 2v7Z"/></svg></button></div></form></footer></section><div class="ai-compare-chip" data-ai-compare-chip hidden aria-live="polite"><span data-ai-compare-chip-text></span><button type="button" class="ai-compare-chip-clear" aria-label="Clear comparison">×</button></div></div><script type="application/json" id="spg-ai-catalog">${JSON.stringify({ products: knowledge, siteFacts }).replace(/</g, '\\u003c')}</script><script src="/scripts/templates/ai-bubble.js" defer></script><script>window.aiBubbleInit && window.aiBubbleInit(${JSON.stringify(route)});</script>`;
}

function mkdirPage(route, html) {
  const dir = path.join(dist, route);
  fs.mkdirSync(dir, { recursive: true });
  // Inject a canonical link right before </head> if the page doesn't already have one
  // (the /go/<id>/ redirect pages have their own canonical pointing at the merchant).
  // Also rewrite the og:url placeholder so social shares show the real page URL.
  let final = html;
  const canonicalHref = `https://stuffprettygood.com/${route ? route + '/' : ''}`;
  if (!/<link\s+rel="canonical"/i.test(final)) {
    final = final.replace('</head>', `<link rel="canonical" href="${canonicalHref}"></head>`);
  }
  // og:url defaults to '/' in the layout template — rewrite it to the real URL.
  final = final.replace(
    /<meta property="og:url" content="https:\/\/stuffprettygood\.com\/">/,
    `<meta property="og:url" content="${canonicalHref}">`
  );
  // Per-page OG image: write a route-specific SVG and point og:image at it,
  // instead of every page sharing /assets/site/spg-shopping-guide.svg. The
  // page title is extracted from the layout's <title> tag when available;
  // fall back to PAGE_TITLES[route] for routed pages, and to the pass-through
  // slug for ad-hoc pages. Tick 7 fix — Lane A polish: per-page OG image.
  fs.mkdirSync(path.join(dist, 'assets/og'), { recursive: true });
  const titleMatch = final.match(/<title>([^<]+)<\/title>/);
  const rawTitle = titleMatch ? titleMatch[1].split(' | ')[0].trim() : '';
  const ogSlug = pageOgImageSvg(route, rawTitle);
  fs.writeFileSync(path.join(dist, ogSlug.filename), ogSlug.svg);
  final = final.replace(
    /<meta property="og:image" content="\/assets\/site\/spg-shopping-guide\.svg">/,
    `<meta property="og:image" content="${ogSlug.url}"><meta property="og:image:width" content="960"><meta property="og:image:height" content="360">`
  );
  // Per-page Twitter Card metadata: rewrite the generic twitter:image placeholder
  // to point at the same per-page SVG, and inject twitter:title/twitter:description
  // matching the OG metadata so Twitter and Slack unfurls render the right card.
  // twitter:card stays 'summary_large_image' from the layout template.
  // Description and title are re-extracted from the final HTML (rather than passed
  // through mkdirPage's argument list) so callers don't need updating.
  const descMatch = final.match(/<meta name="description" content="([^"]+)"/);
  const twitterDesc = descMatch ? descMatch[1] : '';
  const twitterTitle = titleMatch ? titleMatch[1] : '';
  final = final.replace(
    /<meta property="og:image" content="([^"]+)"><meta property="og:image:width" content="960"><meta property="og:image:height" content="360">/,
    `<meta property="og:image" content="$1"><meta property="og:image:width" content="960"><meta property="og:image:height" content="360"><meta property="og:image:alt" content="Stuff Pretty Good — ${(rawTitle || 'home').slice(0, 80)} social preview"><meta name="twitter:image" content="$1"><meta name="twitter:title" content="${twitterTitle}"><meta name="twitter:description" content="${twitterDesc}"><meta name="twitter:site" content="@stuffprettygood">`
  );
  // Per-page theme-color: replace the global cream/navy triple with the route's
  // brand-tinted pair from PAGE_THEME_COLORS so the iOS Safari + Android Chrome
  // status bar / address bar tint matches the page's accent gradient when the
  // page is installed as a PWA or saved to the home screen. Routes not in the
  // map fall back to the layout's default (no rewrite happens, the original
  // 3-line block stays). Same pattern as the Twitter Card injection above:
  // re-extract from rendered HTML rather than threading new params through every
  // caller of mkdirPage.
  const themeColors = PAGE_THEME_COLORS[route];
  if (themeColors) {
    final = final.replace(
      /<meta name="theme-color" content="#f6f1e8" media="\(prefers-color-scheme: light\)"><meta name="theme-color" content="#0b1220" media="\(prefers-color-scheme: dark\)"><meta name="theme-color" content="#111827">/,
      `<meta name="theme-color" content="${themeColors.light}" media="(prefers-color-scheme: light)"><meta name="theme-color" content="${themeColors.dark}" media="(prefers-color-scheme: dark)"><meta name="theme-color" content="${themeColors.dark}">`
    );
  }
  // Mark the current nav link with aria-current="page" for screen-reader users
  // and visual highlight (CSS rule in styles.css). Scoped to <div class="nav-links">
  // so the same /signup/ footer link is not touched. Home route '' marks the
  // logo link (which is the only "/"-href inside the nav element).
  if (route === '' || /^[a-z0-9-]+$/.test(route)) {
    if (route === '') {
      final = final.replace(
        /<a class="logo" href="\/">/,
        `<a class="logo" aria-current="page" href="/">`
      );
        } else {
      // Locate the nav-links <div>, find the matching <a href="/<route>/"> inside it,
      // inject aria-current="page". Uses indexOf + slice to avoid new RegExp() with
      // dynamic interpolation (see pitfall #97/#98 — template-literal backslash
      // consumption silently corrupts regex patterns at runtime).
      const targetHref = `/${route}/`;
      const navOpen = final.indexOf('<div class="nav-links">');
      const navClose = final.indexOf('</div>', navOpen);
      if (navOpen !== -1 && navClose !== -1) {
        const needle = `<a href="${targetHref}">`;
        const linkAt = final.indexOf(needle, navOpen);
        if (linkAt !== -1 && linkAt < navClose) {
          final = final.slice(0, linkAt) + '<a aria-current="page" href="' + targetHref + '">' + final.slice(linkAt + needle.length);
        }
      }
    }
  }
  fs.writeFileSync(path.join(dir, 'index.html'), normalizeLinks(final));
}

const categories = ['gift-finder', 'starter-kits', 'under-25', 'under-50', 'travel', 'home-office', 'kitchen', 'pets', 'tech', 'walmart', 'useful-finds'];
const featured = products.slice(0, 12).sort(productsWithImagesFirst);

const home = `<section class="hero compact-hero"><div class="hero-copy"><div><div class="eyebrow">Practical shopping guide</div><h1>Useful stuff worth buying.</h1><p class="sub">Fast AI-assisted shortlists for gifts, Walmart finds, starter kits, and everyday upgrades — product-first, no marketplace doom-scroll.</p></div><div class="actions"><a class="btn" href="/walmart/">Shop Walmart</a><a class="btn ghost" href="/useful-finds/">All Finds</a><a class="btn ghost" href="/gift-finder/">Gift Finder</a><a class="btn ghost" href="/stories/">Story Lists</a></div></div></section>
<section class="section above-fold-products"><div class="section-head"><div><p class="eyebrow">Featured finds</p><h2>Shop useful picks first</h2></div><a class="pill" href="/useful-finds/">Browse all</a></div><div class="grid">${featured.map(card).join('')}</div></section>
<section class="section"><div class="section-head"><div><p class="eyebrow">Walmart picks</p><h2>Curated Walmart finds from the approved catalog</h2></div><a class="pill" href="/walmart/">Browse Walmart</a></div><div class="grid product-wall" data-live-picks="walmart"><p class="micro">Loading Walmart picks…</p></div></section>${liveDailyPicksScript('', 'walmart', '[data-live-picks="walmart"]', 36)}
<section class="section"><div class="section-head"><div><p class="eyebrow">Fresh daily picks</p><h2>New useful finds from the live catalog</h2></div><a class="pill" href="/useful-finds/">See more</a></div><div class="grid product-wall" data-live-picks="fresh"><p class="micro">Loading today’s fresh picks…</p></div></section>${liveDailyPicksScript('', '', '[data-live-picks="fresh"]', 48)}
<section class="section"><div class="section-head"><div><p class="eyebrow">AI story lists</p><h2>Shop by real-life situation</h2></div><a class="pill" href="/stories/">See stories</a></div><div class="story-strip" data-live-stories><p class="micro">Loading new story lists…</p></div></section>${liveStoriesScript(3)}
<section class="section lanes"><a href="/under-25/"><strong>Under $25</strong><span>cheap useful wins</span></a><a href="/under-50/"><strong>Under $50</strong><span>gift-safe picks</span></a><a href="/walmart/"><strong>Walmart</strong><span>approved catalog picks</span></a><a href="/travel/"><strong>Travel</strong><span>stuff people actually use</span></a><a href="/home-office/"><strong>Home office</strong><span>cleaner desk setups</span></a></section>
<section class="section split sales-strip"><div><p class="eyebrow">How it works</p><h2>Tell us the job. We show the stuff worth considering.</h2></div><p class="sub">Stuff Pretty Good is built around useful outcomes: better gifts, cleaner desks, smarter travel, faster kitchens, calmer pet care, and budget-friendly upgrades.</p></section>
<section class="section panel"><div class="section-head"><div><p class="eyebrow">Buying guides</p><h2>Start with the problem. Leave with a shortlist.</h2></div></div><div class="guide-list">${posts.map((p) => `<a href="/guides/${p.slug}/">${esc(p.title)}<span>Get guide →</span></a>`).join('')}</div></section>
<section class="signup-band"><div><p class="eyebrow">Email list</p><h2>Get useful finds without doom-scrolling.</h2><p>Join for useful finds, gift ideas, and starter kits. Email is required; everything else is optional.</p></div>${signupForm('homepage')}</section>`;
mkdirPage('', layout(pageTitle(''), home, { route: '' }, pageDescription('')));

function filtered(route) {
  if (route === 'under-25' || route === 'under-50') return products.filter((p) => p.price_band === route);
  if (route === 'tech') return products.filter((p) => p.category === 'tech');
  if (route === 'useful-finds') return products;
  return products.filter((p) => p.category === route).concat(products.slice(0, 4));
}

for (const route of categories.filter((r) => !['gift-finder', 'starter-kits', 'useful-finds'].includes(r))) {
  const isTravel = route === 'travel';
  const isWalmart = route === 'walmart';
  const picks = isWalmart ? [] : filtered(route).slice(0, 12).sort(productsWithImagesFirst);
  const intro = isTravel
    ? 'Practical travel helpers plus fresh hotel-finder routes powered by the live SPG catalog.'
    : isWalmart
      ? 'Curated Walmart products pulled through the approved Impact catalog gate, filtered for practical usefulness.'
      : 'Practical picks organized by budget, job, and real-life usefulness.';
  const liveSection = isTravel
    ? `<section class="section"><div class="section-head"><div><p class="eyebrow">Live travel</p><h2>Fresh hotel and trip finders</h2></div></div><div class="grid" data-live-picks><p class="micro">Loading fresh travel picks…</p></div>${liveDailyPicksScript('travel', 'stay22')}</section>`
    : isWalmart
      ? `<section class="section"><div class="section-head"><div><p class="eyebrow">Impact catalog</p><h2>Fresh Walmart picks</h2></div></div><div class="grid product-wall" data-live-picks><p class="micro">Loading approved Walmart picks…</p></div>${liveDailyPicksScript('', 'walmart', '[data-live-picks]', 60)}</section>`
      : '';
  const staticGrid = picks.length ? `<div class="grid">${picks.map(card).join('')}</div>` : '';
    // Walmart renders live Impact picks only (no static grid). The static catalog
    // doesn't tag any product as `category === 'walmart'` (walmart is a merchant
    // overlay sourced from the Impact live feed, not a static field), so the
    // ItemList JSON-LD would be misleading if we fed it the `filtered('walmart')`
    // fallback. Skip walmart's ItemList — let the live picks surface as the visible
    // list and let crawlers lean on BreadcrumbList + Organization for context.
    const itemListJsonLd = !isWalmart && picks.length ? categoryItemListJsonLd(route, pageTitle(route), picks) : '';
    mkdirPage(route, layout(pageTitle(route), `<section class="section"><p class="eyebrow">Useful picks</p><h1>${pageHeading(route)}</h1><p class="sub">${intro}</p>${staticGrid}</section>${liveSection}`, { route, categoryItemListJsonLd: itemListJsonLd }, pageDescription(route)));
}

for (const p of products) {
  // Lane A #25 — inject product meta JSON for the recently-viewed bar. The
  // recentlyViewedScript() IIFE on every page reads this block and pushes the
  // product into localStorage. Slim shape (id + title + image + category)
  // keeps each product page's HTML footprint small (~150 bytes).
  const productMeta = `<script type="application/json" id="spg-product-meta">${JSON.stringify({ id: p.id, title: p.title, image_url: p.image_url, category: p.category }).replace(/</g, '\\u003c')}</script>`;
  mkdirPage(`products/${p.id}`, layout(p.title, productMeta + `<article class="post product-detail"><div class="detail-grid"><div>${amazonNativeAd(p)}<div class="visual-proof"><span>Original SPG visual</span><strong>Built for fast shopping decisions</strong></div></div><div><div class="card-meta"><span>${esc(p.category.replace('-', ' '))}</span><span>${esc(p.price_band.replace('-', ' $'))}</span></div><h1>${esc(p.title)}</h1><p class="sub">${esc(p.why_useful)}</p><div class="decision-boxes"><div><span>Best for</span><strong>${esc(p.best_for)}</strong></div><div><span>Skip if</span><strong>${esc(p.avoid_if)}</strong></div><div><span>Good fit when</span><strong>You want a practical upgrade without overthinking it.</strong></div></div><a class="btn" href="/go/${p.id}/" rel="nofollow sponsored" data-affiliate-click data-affiliate-source="detail-inline">Get</a><p class="micro">Confirm current product details with the merchant before buying.</p></div></div><div class="spg-sticky-cta"><div class="spg-sticky-meta"><span class="spg-sticky-cat">${esc(p.category.replace('-', ' '))}</span><span class="spg-sticky-price">${esc(p.price_band.replace('-', ' $'))}</span></div><a class="btn" href="/go/${p.id}/" rel="nofollow sponsored" data-affiliate-click data-affiliate-source="sticky-mobile-bar">View on Amazon →</a></div></article>`, { route: `products/${p.id}`, productJsonLd: productJsonLd(p) }, `${esc(p.title)} — ${esc(p.why_useful)} Best for ${esc(p.best_for)}. Approved by Stuff Pretty Good.`));
  mkdirPage(`go/${p.id}`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirecting</title><meta name="robots" content="noindex"><link rel="canonical" href="${p.affiliate_url}"><body id="top" data-route="go/${esc(p.id)}"><img src="${p.image_url}" alt="${esc(p.title)}" style="max-width:420px;width:100%;border-radius:20px"><p>Opening the pick…</p><script>location.replace(${JSON.stringify(p.affiliate_url)})</script><p><a href="${p.affiliate_url}" rel="nofollow sponsored noopener">Continue</a></p>${backToTop()}</body></html>`);
}

for (const post of posts) {
  const picks = products.filter((p) => p.category === post.category || p.price_band === post.category).concat(products).slice(0, 8).sort(productsWithImagesFirst);
  mkdirPage(`guides/${post.slug}`, layout(post.title, `<article class="post"><p class="eyebrow">Buying guide</p><h1>${esc(post.title)}</h1><p class="sub">${esc(post.intro)}</p><ol class="pick-list">${picks.map((p) => `<li><strong>${esc(p.title)}</strong><br>Why useful: ${esc(p.why_useful)}<br>Best for: ${esc(p.best_for)}<br>Avoid if: ${esc(p.avoid_if)}<br><a href="/products/${p.id}/">Get details</a></li>`).join('')}</ol></article>`, { route: `guides/${post.slug}` }, `${esc(post.title)} — ${esc(post.intro)}`.slice(0, 160)));
}

function toolScript(seedProducts) {
  const safeProducts = seedProducts.map((p) => ({ id: p.id, title: p.title, category: p.category, price_band: p.price_band, image_url: p.image_url, why_useful: p.why_useful, best_for: p.best_for, avoid_if: p.avoid_if }));
  return `${rateLimitScript()}<script type="application/json" id="spg-catalog">${JSON.stringify(safeProducts).replace(/</g, '\\u003c')}</script><script>
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
    const intent = new FormData(form).get('intent') || '';
    const interests = new FormData(form).get('interests') || '';
    const q = (intent + ' ' + interests).trim();
    const rl = window.SPGRateLimit && window.SPGRateLimit.check(q.length);
    if (rl && !rl.allowed) {
      results.innerHTML = '<p class="notice rate-limit-msg">' + htmlEscape(rl.message) + '</p>';
      results.scrollIntoView({behavior:'smooth', block:'start'});
      return;
    }
    const query = intent.toLowerCase() + ' ' + interests.toLowerCase();
    const budget = new FormData(form).get('budget');
    const ranked = catalog.map(p => ({...p, score: score(p, query, budget)})).sort((a,b) => b.score - a.score).slice(0,8);
    render(ranked);
    results.scrollIntoView({behavior:'smooth', block:'start'});
    if (rl && rl.allowed) window.SPGRateLimit.record();
  });
  render(catalog.slice(0,6));
})();
</script>`;
}

function toolPage(name, desc, mode = 'gift') {
  const seed = products.slice(mode === 'kit' ? 8 : 0, mode === 'kit' ? 24 : 24).sort(productsWithImagesFirst);
  const examples = mode === 'kit'
    ? ['home office under $250', 'travel kit under $150', 'first apartment essentials']
    : ['gift for dad under $50', 'practical gift for coworker', 'pet owner gift'];
  const route = mode === 'kit' ? 'starter-kits' : 'gift-finder';
  return layout(name, `<section class="section tool upgraded-tool"><div><p class="eyebrow">AI shopping assistant</p><h1>${esc(name)}</h1><span id="spg-quota-pill" class="spg-quota-pill" hidden></span><p class="sub">${esc(desc)} Ask naturally. Answers are grounded in useful picks and guides already on Stuff Pretty Good.</p><form class="finder" data-finder-form><label>What are you shopping for?<input class="input" name="intent" placeholder="${esc(examples[0])}" required></label><label>Budget<select class="input" name="budget"><option value="">Any budget</option><option value="under-25">Under $25</option><option value="under-50">Under $50</option><option value="under-100">Under $100</option></select></label><label>Interests / situation<input class="input" name="interests" placeholder="${esc(examples.slice(1).join(' · '))}"></label><button class="btn" type="submit">Find my shortlist</button></form><p class="notice">Tip: try “travel gift under $50,” “desk setup,” “pet problem,” or “kitchen time saver.”</p></div><div class="tool-preview"><h2>What you get</h2><ul><li>5–8 practical picks</li><li>why it helps</li><li>who it fits</li><li>when to skip it</li></ul></div></section><section class="section results-section"><div class="section-head"><div><p class="eyebrow">AI shortlist</p><h2>Useful picks for this session</h2></div></div><div class="recommendation-list" data-finder-results></div></section>${toolScript(seed)}`, { route }, pageDescription(mode === 'kit' ? 'starter-kits' : 'gift-finder'));
}
mkdirPage('gift-finder', toolPage('AI Gift Finder', 'Answer a few prompts and get gift ideas from the approved-offer catalog only.'));
mkdirPage('starter-kits', toolPage('AI Starter Kit Builder', 'Build useful setups from approved affiliate products only.', 'kit'));
mkdirPage('useful-finds', layout(pageTitle('useful-finds'), `<section class="section"><p class="eyebrow">Useful picks</p><h1>Useful Finds</h1><p class="sub">Browse useful upgrades for gifts, home, kitchen, travel, tech, pets, and everyday problems.</p><div class="section-head"><div><p class="eyebrow">Fresh daily picks</p><h2>Newest from the live catalog</h2></div></div><div class="grid product-wall" data-live-picks="fresh"><p class="micro">Loading daily picks…</p></div>${liveDailyPicksScript('', '', '[data-live-picks="fresh"]', 60)}<div class="section-head"><div><p class="eyebrow">Walmart via Impact</p><h2>Approved Walmart catalog picks</h2></div><a class="pill" href="/walmart/">Browse Walmart</a></div><div class="grid product-wall" data-live-picks="walmart"><p class="micro">Loading Walmart picks…</p></div>${liveDailyPicksScript('', 'walmart', '[data-live-picks="walmart"]', 60)}<h2>Full launch catalog</h2><div class="grid">${products.sort(productsWithImagesFirst).map(card).join('')}</div></section>`, { route: 'useful-finds', categoryItemListJsonLd: categoryItemListJsonLd('useful-finds', pageTitle('useful-finds'), products) }, pageDescription('useful-finds')));
mkdirPage('stories', layout(pageTitle('stories'), `<section class="section stories-page magazine-page"><div class="magazine-hero"><div><p class="eyebrow">Daily AI shopping stories</p><h1>Shopping magazine built from real scenarios.</h1><p class="sub">Every feature is a situation — trail day, emergency prep, travel day, game day, home reset — with image-backed products from the approved catalog and monetized /go paths. The daily AI process checks prior stories before publishing new lists.</p><div class="magazine-stats"><span>10+ live story lists</span><span>Image-backed products</span><span>Approved links only</span></div></div><div class="magazine-cover"><span>Today’s issue</span><strong>Useful stuff by situation</strong><small>Fresh checklists, practical products, no random marketplace dump.</small></div></div><div class="section-head magazine-head"><div><p class="eyebrow">Shop the issue</p><h2>Visual story checklists</h2></div><a class="pill" href="/walmart/">Walmart picks</a></div><div class="story-wall magazine-wall" data-live-stories><p class="micro">Loading today’s stories…</p></div>${liveStoriesScript(20)}</section>`, { route: 'stories' }, pageDescription('stories')));

function signupForm(source = 'site') {
  return `<form class="signup-form signup-form-sms" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/subscribe" novalidate>
<input type="hidden" name="source" value="${esc(source)}">
<input type="hidden" name="list" value="pretty-good-finds">
<input type="hidden" name="sms_consent_version" value="${esc(SPG_SMS_CONSENT_VERSION)}">
<fieldset class="form-section">
  <legend class="form-section-label">About you</legend>
  <div class="form-grid">
    <label>First name<input name="first_name" autocomplete="given-name" maxlength="80"></label>
    <label>Last name<input name="last_name" autocomplete="family-name" maxlength="80"></label>
  </div>
</fieldset>
<fieldset class="form-section form-section-primary">
  <legend class="form-section-label">How we reach you</legend>
  <div class="form-grid">
    <label class="form-field-primary">Email <span class="req">required</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>
    <label>Zip<input name="zip" inputmode="numeric" autocomplete="postal-code" pattern="[0-9A-Za-z \\-]{3,12}" maxlength="12"></label>
  </div>
</fieldset>
<fieldset class="form-section form-section-optional">
  <legend class="form-section-label">Text-message updates <span class="opt-flag">optional</span></legend>
  <div class="form-grid form-grid-single">
    <label class="phone-field">US mobile phone<input name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="\\+?[0-9 () \\-]{7,20}" placeholder="+1 555 123 4567" maxlength="20" data-phone-input><span class="field-hint">Only used if you opt in to SMS below. Leave blank to skip.</span></label>
  </div>
  <div class="sms-consent" data-sms-consent-block aria-describedby="sms-disclosure">
    <p id="sms-disclosure" class="micro">
      By checking the box below and submitting this form, you provide your <strong>prior express written consent</strong> for <strong>MehyarSoft LLC</strong> (operator of <strong>Stuff Pretty Good</strong>) to send you recurring automated marketing and informational text messages at the US mobile number you provided. The program is registered with The Campaign Registry (TCR) and operates on A2P 10DLC long codes registered to MehyarSoft LLC. <strong>Message frequency varies</strong>, typically up to <strong>4 messages per month</strong>. <strong>Message and data rates may apply</strong>. <strong>Consent is not a condition of any purchase</strong>, and signing up for SMS is not a condition of receiving any other benefit from Stuff Pretty Good. Carriers (e.g., AT&amp;T, T-Mobile, Verizon, and their MVNOs) are not liable for delayed or undelivered messages. By submitting, you confirm that you are the account holder for the mobile number provided, or that you have the account holder's permission to receive messages at it. You can opt out at any time by replying <strong>STOP</strong> to any message; reply <strong>HELP</strong> for help. Opt-out requests are honored within 10 business days, and usually within one business day. <strong>State notice.</strong> Residents of Florida, Washington, Oklahoma, Maryland, and other states with their own telephone-solicitation laws receive the additional protections of those laws. For questions, contact <a href="mailto:hello@mehyar.us">hello@mehyar.us</a> or call <a href="tel:+155****0100">+1 (555) 555-0100</a>. See our <a href="/privacy/">Privacy Policy</a> and <a href="/terms/">Terms of Service</a>. Consent version: <code>${esc(SPG_SMS_CONSENT_VERSION)}</code>.
    </p>
    <label class="consent-check">
      <input type="checkbox" name="sms_consent" value="yes" data-sms-consent>
      <span>I agree to receive recurring automated marketing and informational text messages from <strong>Stuff Pretty Good</strong> (operated by MehyarSoft LLC) at the US mobile number I provided. I confirm I am the account holder for that number, or I have the account holder's permission. I understand I can reply <strong>STOP</strong> at any time to opt out and <strong>HELP</strong> for help. I have read the SMS Terms above and the <a href="/privacy/">Privacy Policy</a>.</span>
    </label>
  </div>
</fieldset>
<button class="btn" type="submit">Sign up</button>
<p class="micro form-foot">Email is required. We send practical finds, gift ideas, and useful under-budget picks. Unsubscribe anytime via the link in any email or at <a href="/unsubscribe/">/unsubscribe</a>. SMS opt-out: reply STOP to any text. Your information is handled under our <a href="/privacy/">Privacy Policy</a> and our <a href="/terms/">Terms of Service</a>.</p>
</form>
<script>
(function(){
  // Conditional SMS consent: consent is required ONLY if a phone is entered.
  // Email-only signups skip the SMS block entirely.
  var form = document.currentScript ? document.currentScript.previousElementSibling : null;
  if (!form || !form.classList || !form.classList.contains('signup-form')) return;
  var phone = form.querySelector('[data-phone-input]');
  var consent = form.querySelector('[data-sms-consent]');
  function sync(){
    var hasPhone = phone && phone.value && phone.value.trim().length >= 7;
    if (consent) {
      if (hasPhone) consent.setAttribute('required', ''); else consent.removeAttribute('required');
      var block = consent.closest('.sms-consent');
      if (block) block.style.opacity = hasPhone ? '1' : '0.55';
    }
    if (phone) {
      if (hasPhone) phone.setAttribute('required', ''); else phone.removeAttribute('required');
    }
  }
  if (phone) phone.addEventListener('input', sync);
  sync();
  form.addEventListener('submit', function(e){
    var hasPhone = phone && phone.value && phone.value.trim().length >= 7;
    if (hasPhone && !(consent && consent.checked)) {
      e.preventDefault();
      consent && consent.focus();
      var block = consent && consent.closest('.sms-consent');
      if (block) block.scrollIntoView({behavior:'smooth', block:'center'});
    }
  });
})();
</script>`;
}


// ============================================================================
// Signup modal: an opt-in modal dialog that holds the same signup form.
// Renders a button (always visible in the nav) plus a hidden dialog. The
// button opens the modal manually. The trigger script auto-opens it on
// exit-intent (desktop) or after a 10s scroll-past-50% timer (mobile),
// with a 7-day localStorage cap so the user is not re-prompted.
// Excludes legal pages, the signup page itself, and outbound /go/ pages
// (popup on a redirect is a sin).
// ============================================================================
function signupModal() {
  return `
<button class="signup-modal-launch" type="button" data-signup-modal-open aria-label="Sign up for Pretty Good Finds">
  <span class="signup-modal-launch-text">Sign up</span>
</button>
<div class="signup-modal-overlay" data-signup-modal-overlay hidden></div>
<dialog class="signup-modal" data-signup-modal role="dialog" aria-modal="true" aria-labelledby="signup-modal-title" aria-describedby="signup-modal-desc" hidden>
  <div class="signup-modal-card">
    <header class="signup-modal-head" aria-label="Sign up dialog header">
      <p class="eyebrow">Get Pretty Good Finds</p>
      <h2 id="signup-modal-title">Useful finds, no spam.</h2>
      <p id="signup-modal-desc" class="sub">Email-only by default. Add a phone below if you also want occasional SMS updates.</p>
      <button class="signup-modal-close" type="button" data-signup-modal-close aria-label="Close signup form">×</button>
    </header>
    <div class="signup-modal-body">
      <form class="signup-form signup-form-sms" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/subscribe" novalidate data-modal-form>
<input type="hidden" name="source" value="modal-popup">
<input type="hidden" name="list" value="pretty-good-finds">
<input type="hidden" name="sms_consent_version" value="${esc(SPG_SMS_CONSENT_VERSION)}">
<fieldset class="form-section">
  <legend class="form-section-label">About you</legend>
  <div class="form-grid">
    <label>First name<input name="first_name" autocomplete="given-name" maxlength="80"></label>
    <label>Last name<input name="last_name" autocomplete="family-name" maxlength="80"></label>
  </div>
</fieldset>
<fieldset class="form-section form-section-primary">
  <legend class="form-section-label">How we reach you</legend>
  <div class="form-grid">
    <label class="form-field-primary">Email <span class="req">required</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>
    <label>Zip<input name="zip" inputmode="numeric" autocomplete="postal-code" pattern="[0-9A-Za-z \\-]{3,12}" maxlength="12"></label>
  </div>
</fieldset>
<fieldset class="form-section form-section-optional">
  <legend class="form-section-label">Text-message updates <span class="opt-flag">optional</span></legend>
  <div class="form-grid form-grid-single">
    <label class="phone-field">US mobile phone<input name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="\\+?[0-9 () \\-]{7,20}" placeholder="+1 555 123 4567" maxlength="20" data-phone-input><span class="field-hint">Only used if you opt in to SMS below. Leave blank to skip.</span></label>
  </div>
  <div class="sms-consent" data-sms-consent-block aria-describedby="sms-disclosure-modal">
    <p id="sms-disclosure-modal" class="micro">
      By checking the box below and submitting this form, you provide your <strong>prior express written consent</strong> for <strong>MehyarSoft LLC</strong> (operator of <strong>Stuff Pretty Good</strong>) to send you recurring automated marketing and informational text messages at the US mobile number you provided. Message frequency varies, typically up to 4 messages per month. Message and data rates may apply. Consent is not a condition of any purchase. Carriers (AT&amp;T, T-Mobile, Verizon, and their MVNOs) are not liable for delayed or undelivered messages. You can opt out at any time by replying STOP to any message; reply HELP for help. Opt-out requests are honored within 10 business days. Consent version: <code>${esc(SPG_SMS_CONSENT_VERSION)}</code>. <a href="/privacy/">Privacy Policy</a> · <a href="/terms/">Terms of Service</a>.
    </p>
    <label class="consent-check">
      <input type="checkbox" name="sms_consent" value="yes" data-sms-consent>
      <span>I agree to receive recurring automated marketing and informational text messages from <strong>Stuff Pretty Good</strong> at the US mobile number I provided. I confirm I am the account holder for that number, or I have the account holder's permission. I can reply STOP at any time to opt out.</span>
    </label>
  </div>
</fieldset>
<button class="btn" type="submit">Sign up</button>
<p class="micro form-foot">Email is required. Unsubscribe via the link in any email or at <a href="/unsubscribe/">/unsubscribe</a>. SMS opt-out: reply STOP.</p>
</form>
    </div>
  </div>
</dialog>
<script>
(function(){
  if (typeof window === 'undefined' || !window.document) return;
  var modal = document.querySelector('[data-signup-modal]');
  var overlay = document.querySelector('[data-signup-modal-overlay]');
  var openBtn = document.querySelector('[data-signup-modal-open]');
  var closeBtn = document.querySelector('[data-signup-modal-close]');
  var CAP_KEY = 'spg_signup_popup_dismissed';
  var CAP_DAYS = 7;
  var TRIGGERED_KEY = 'spg_signup_popup_shown';
  var AUTO_DELAY_MS = 10000;
  if (!modal) return;
  function now(){ return Date.now(); }
  function capActive(){
    try {
      var raw = window.localStorage && window.localStorage.getItem(CAP_KEY);
      if (!raw) return false;
      var t = parseInt(raw, 10);
      if (!t) return false;
      return (now() - t) < (CAP_DAYS * 24 * 60 * 60 * 1000);
    } catch (e) { return false; }
  }
  function writeCap(){
    try { window.localStorage && window.localStorage.setItem(CAP_KEY, String(now())); } catch (e) {}
  }
  function markTriggered(){
    try { window.localStorage && window.localStorage.setItem(TRIGGERED_KEY, '1'); } catch (e) {}
  }
  function alreadyTriggered(){
    try { return !!(window.localStorage && window.localStorage.getItem(TRIGGERED_KEY)); } catch (e) { return false; }
  }
  function isCoarsePointer(){
    try { return window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
  }
  var lastFocused = null;
  function openModal(source){
    if (modal.hasAttribute('hidden')) {
      lastFocused = document.activeElement;
      modal.removeAttribute('hidden');
      if (overlay) overlay.removeAttribute('hidden');
      // focus the email input first
      try {
        var email = modal.querySelector('input[name="email"]');
        if (email) email.focus();
      } catch (e) {}
      document.documentElement.style.overflow = 'hidden';
      if (source) try { markTriggered(); } catch (e) {}
    }
  }
  function closeModal(){
    if (!modal.hasAttribute('hidden')) {
      modal.setAttribute('hidden', '');
      if (overlay) overlay.setAttribute('hidden', '');
      document.documentElement.style.overflow = '';
      try { if (lastFocused && lastFocused.focus) lastFocused.focus(); } catch (e) {}
    }
  }
  // Manual open
  if (openBtn) openBtn.addEventListener('click', function(){ openModal('manual'); });
  // Close handlers
  if (closeBtn) closeBtn.addEventListener('click', function(){ closeModal(); writeCap(); });
  if (overlay) overlay.addEventListener('click', function(){ closeModal(); writeCap(); });
  document.addEventListener('keydown', function(e){
    if (e && e.key === 'Escape' && !modal.hasAttribute('hidden')) { closeModal(); writeCap(); }
  });
  // Form submit (intercept for the cap; let the form post to the Worker)
  var form = modal.querySelector('form');
  if (form) form.addEventListener('submit', function(){
    writeCap();
    markTriggered();
  });
  // Conditional SMS required toggle for the modal form (mirror the inline form's logic)
  function wireForm(formEl){
    if (!formEl) return;
    var phone = formEl.querySelector('[data-phone-input]');
    var consent = formEl.querySelector('[data-sms-consent]');
    var block = formEl.querySelector('[data-sms-consent-block]');
    function sync(){
      var hasPhone = phone && phone.value && phone.value.trim().length >= 7;
      if (consent) {
        if (hasPhone) consent.setAttribute('required',''); else consent.removeAttribute('required');
      }
      if (phone) {
        if (hasPhone) phone.setAttribute('required',''); else phone.removeAttribute('required');
      }
      if (block) block.style.opacity = hasPhone ? '1' : '0.55';
    }
    if (phone) phone.addEventListener('input', sync);
    sync();
    formEl.addEventListener('submit', function(e){
      var hasPhone = phone && phone.value && phone.value.trim().length >= 7;
      if (hasPhone && consent && !consent.checked) {
        e.preventDefault();
        consent.focus();
        if (block && block.scrollIntoView) block.scrollIntoView({behavior:'smooth', block:'center'});
      }
    });
  }
  wireForm(form);
  // Wire any inline form too (e.g. homepage signup band) so a single script covers both
  document.querySelectorAll('.signup-form-sms:not([data-modal-form])').forEach(wireForm);

  // Auto-trigger rules:
  // - Mobile / coarse pointer: timed fallback after AUTO_DELAY_MS, only if user scrolled past 50% of viewport
  // - Desktop: exit-intent (mouseleave toward top of viewport)
  // - Respect 7-day cap and a "already triggered this page-load" guard
  if (capActive() || alreadyTriggered()) return;
  function scrollPastHalf(){
    try {
      var docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      var viewH = window.innerHeight || document.documentElement.clientHeight;
      var scrolled = window.scrollY || window.pageYOffset || 0;
      return scrolled + viewH >= docH * 0.5;
    } catch (e) { return false; }
  }
  if (isCoarsePointer()) {
    setTimeout(function(){
      if (capActive() || alreadyTriggered()) return;
      if (scrollPastHalf()) openModal('auto-timed');
    }, AUTO_DELAY_MS);
  } else {
    var doc = document.documentElement;
    function onLeave(e){
      // Only fire when cursor crosses the very top edge (intent to navigate away)
      if (e && e.clientY <= 0) {
        openModal('auto-exit');
        doc.removeEventListener('mouseleave', onLeave);
      }
    }
    // Bind on documentElement so iframe-less top window catches the leave
    doc.addEventListener('mouseleave', onLeave);
  }
})();
</script>`;
}


function liveStoriesScript(limit = 10) {
  return `<script>
(function(){
  const mount = document.querySelector('[data-live-stories]');
  if (!mount) return;
  function esc(value){ return String(value || '').replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
  fetch('https://stuffprettygood-api.mehyar.workers.dev/api/stories?limit=${String(limit)}')
    .then(function(r){ return r.json(); })
    .then(function(data){
      const stories = (data.stories || []).slice(0, ${Number(limit)});
      if (!stories.length) return;
      mount.innerHTML = stories.map(function(story, storyIndex){
        const checklist = (story.checklist || []).filter(function(item){ return item && item.image_url; }).slice(0, 9);
        const lead = checklist[0] || {};
        const collage = checklist.slice(0, 4).map(function(item){
          return '<img src="'+esc(item.image_url)+'" alt="'+esc(item.title)+'" loading="lazy">';
        }).join('');
        const items = checklist.map(function(item, idx){
          return '<a class="story-item" href="'+esc(item.product_url)+'"><img src="'+esc(item.image_url)+'" alt="'+esc(item.title)+'" loading="lazy"><span><em>Pick '+(idx+1)+'</em><b>'+esc(item.title)+'</b><small>'+esc(item.category || '')+' · View product</small></span></a>';
        }).join('');
        const leadCta = lead.product_url ? '<a class="btn small story-shop-now" href="'+esc(lead.product_url)+'">Shop the lead pick</a>' : '';
        return '<article class="story-card magazine-card '+(storyIndex === 0 ? 'lead-story' : '')+'"><div class="story-visual"><div class="story-collage">'+collage+'</div><div class="story-label"><span>'+esc(story.theme).replace(/-/g,' ')+'</span><strong>'+checklist.length+' picks</strong></div></div><div class="story-copy"><div class="story-kicker">Scenario '+(storyIndex+1)+'</div><h2>'+esc(story.title)+'</h2><p>'+esc(story.story_text || story.situation)+'</p>'+leadCta+'</div><div class="story-items">'+items+'</div></article>';
      }).join('');
    })
    .catch(function(){ mount.innerHTML = '<p class="micro">Story lists are refreshing. Try again shortly.</p>'; });
})();
</script>`;
}

function liveDailyPicksScript(category = '', merchant = '', selector = '[data-live-picks]', limit = 12) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (merchant) params.set('merchant', merchant);
  params.set('limit', String(limit));
  const query = `?${params.toString()}`;
  return `<script>
(function(){
  const mount = document.querySelector(${JSON.stringify(selector)});
  if (!mount) return;
  const displayLimit = ${JSON.stringify(limit)};
  function esc(value){ return String(value || '').replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
  fetch('https://stuffprettygood-api.mehyar.workers.dev/api/catalog${query}')
    .then(function(r){ return r.json(); })
    .then(function(data){
      const products = (data.products || []).filter(function(p){ return p.image_url; }).slice(0, displayLimit);
      if (!products.length) return;
      mount.innerHTML = products.map(function(p){
        const id = encodeURIComponent(p.id);
        const source = ${JSON.stringify(merchant)} === 'walmart' ? '<div class="value-chip">Walmart · Impact approved</div>' : '<div class="value-chip">Approved live catalog</div>';
        const fallback = 'https://stuffprettygood-api.mehyar.workers.dev/api/images/'+id+'.svg';
        return '<article class="card"><a class="thumb" href="https://stuffprettygood-api.mehyar.workers.dev/products/'+id+'"><img src="'+esc(p.image_url)+'" data-fallback="'+fallback+'" alt="'+esc(p.title)+'" loading="lazy"></a>'+source+'<div class="card-meta"><span>'+esc(String(p.price_band).replace('-', ' $'))+'</span><span>'+esc(String(p.category).replace('-', ' '))+'</span></div><h3>'+esc(p.title)+'</h3><p>'+esc(p.why_useful)+'</p><p class="best"><strong>Best for:</strong> '+esc(p.best_for)+'</p><a class="btn small" href="https://stuffprettygood-api.mehyar.workers.dev/products/'+id+'">Get</a></article>';
      }).join('');
      mount.querySelectorAll('img[data-fallback]').forEach(function(img){
        function useFallback(){ if (img.dataset.fallback && img.src !== img.dataset.fallback) img.src = img.dataset.fallback; }
        img.addEventListener('error', useFallback, { once: true });
        setTimeout(function(){ if (!img.complete || img.naturalWidth === 0) useFallback(); }, 1200);
      });
    })
    .catch(function(){ mount.innerHTML = '<p class="micro">Daily picks are refreshing. Try the static catalog below.</p>'; });
})();
</script>`;
}

const policyPages = {
  about: `<h1>About ${SPG_BRAND}</h1>
<p class="sub">${SPG_BRAND} is a product-first, AI-assisted shopping guide operated by ${SPG_OPERATOR}. We help shoppers move from a vague need to a short, honest shortlist: what a product helps with, who it actually fits, and when to skip it. ${SPG_BRAND} is editorially independent — our picks are made by humans against a usefulness bar, then published with AI-assisted summaries.</p>

<h2>What ${SPG_BRAND} does</h2>
<p>${SPG_BRAND} curates useful gifts, starter kits, travel helpers, home-office upgrades, kitchen time-savers, pet fixes, car accessories, wellness picks, and budget-friendly finds. Every outbound product link on the site goes through an approved-offer policy: we only link out to merchants and programs we have an active, written partnership with, and we only feature products that meet our usefulness bar. If a useful product does not have an approved affiliate or partner relationship, we still mention it — we just don't link out from our site to it.</p>

<h2>How we choose products</h2>
<p>Our editorial process favors practical usefulness over hype. For every pick, our editorial team tries to answer five questions before it goes live:</p>
<ul>
  <li><strong>What does it help with?</strong> The specific job-to-be-done, in plain language.</li>
  <li><strong>Who is it best for?</strong> The person, situation, or stage of life where it actually solves something.</li>
  <li><strong>When should you skip it?</strong> An honest "not for you if…" note — quality picks have known tradeoffs.</li>
  <li><strong>What is the realistic budget?</strong> Including the consumables, replacements, or subscriptions that drive the true total cost.</li>
  <li><strong>Is the affiliate relationship honest?</strong> Approved status only — affiliate is a last filter, not a first one.</li>
</ul>
<p>Picks are organized into clear categories — gifts, starter kits, home, kitchen, travel, tech, pets, car, wellness, and organization — so you can shop by the job you need done rather than by brand name.</p>

<h2>How we make money</h2>
<p>${SPG_BRAND} is free to read. When you click certain outbound links to merchants (for example, Amazon, Walmart, or other retailers in our partner programs) and complete a qualifying purchase, ${SPG_OPERATOR} may earn a commission at no extra cost to you. <strong>This never changes the price you pay</strong> and never affects which picks we feature or how we rank them. We also disclose when content is sponsored or when a merchant has supplied a sample. See our <a href="/affiliate-disclosure/">Affiliate Disclosure</a> for the full picture, including the specific programs we participate in.</p>

<h2>Who we are</h2>
<p>${SPG_OPERATOR} is a privately held limited liability company organized under the laws of the State of New York. ${SPG_OPERATOR} holds an Employer Identification Number (EIN) issued by the United States Internal Revenue Service, and is the legal entity that contracts with affiliate networks, signs up for merchant programs, and operates the ${SPG_BRAND} brand. The ${SPG_BRAND} site, the brand name, the logos, the original illustrations, and all related trademarks are owned by ${SPG_OPERATOR}. Our company site is <a href="https://mehyar.us" rel="noopener noreferrer">mehyar.us</a>.</p>

<h2>Our editorial standards</h2>
<ul>
  <li><strong>No paid placement.</strong> We do not accept payment to feature a specific product, rank a specific listing higher, or write a positive review of a merchant's product. Affiliate status is the last filter applied to a pick, never the first.</li>
  <li><strong>No scraping.</strong> We do not scrape or republish copyrighted product images, prices, reviews, ratings, or availability data from third-party marketplaces, search engines, or merchant product feeds without a written license. Where we cannot license product imagery, we use original AI-generated illustrations and label them as such.</li>
  <li><strong>Disclosure of material relationships.</strong> Every page that contains affiliate links, sponsored content, or merchant-supplied samples discloses the relationship near the relevant content and again in our global <a href="/affiliate-disclosure/">Affiliate Disclosure</a>.</li>
  <li><strong>Correction policy.</strong> If a reader flags a factual error we investigate and correct it within five business days. Material corrections include a dated note on the affected page.</li>
  <li><strong>No content directed to children.</strong> ${SPG_BRAND} is intended for a general adult audience. We do not knowingly publish content directed at children under 13 (COPPA) or under 16 where the GDPR's higher age applies.</li>
  <li><strong>AI assistance, human accountability.</strong> Some of our editorial summaries, comparisons, and category descriptions are drafted with AI assistance. A human editor reviews every published pick before it goes live. AI does not write our disclosure language, our privacy policy, or our terms — those are written and updated by humans.</li>
  <li><strong>Independence from merchants.</strong> Merchants in our affiliate programs do not see our unpublished editorial, do not approve our picks, and do not receive advance notice of which products we plan to feature before publication.</li>
</ul>

<h2>AI features and how they work</h2>
<p>${SPG_BRAND} offers AI-assisted shopping tools, including a Gift Finder, a Starter Kit Builder, and an "is it worth it?" checker. These tools do not invent products on the fly. They rank and summarize products drawn from our approved catalog. If a request has no approved-affiliate match in our catalog, the tool says so honestly rather than fabricating a product we have not vetted. For full details on how AI features handle your inputs, see our <a href="/privacy/">Privacy Policy</a>.</p>

<h2>Communications you can opt into</h2>
<p>${SPG_BRAND} offers an opt-in email newsletter and an opt-in SMS program. <strong>Email is required</strong> to join the email list. <strong>Phone is collected only when you opt in to SMS</strong> by typing a US mobile number and explicitly ticking the consent box on the signup form. You can unsubscribe from email at any time via the link in any email or at <a href="/unsubscribe/">/unsubscribe</a>; you can opt out of SMS by replying STOP to any message. Reply HELP for help. The full SMS terms, including message frequency, message-and-data-rate disclosure, and our carrier-not-liable notice, are presented on the signup form and reprinted in our <a href="/privacy/">Privacy Policy</a>.</p>

<h2>Privacy and data</h2>
<p>${SPG_BRAND} collects only the information needed to operate the site and the communications you sign up for. We do not sell personal information. Full details — what we collect, why, who we share with, your rights, retention, security, and how to contact us — are in our <a href="/privacy/">Privacy Policy</a>.</p>

<h2>Get in touch</h2>
<p>Questions, corrections, product suggestions, affiliate partnerships, press inquiries, and takedown or DMCA notices: <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>. For full contact details including a mailing address and phone number, see <a href="/contact/">/contact</a>. We respond within five business days; usually faster.</p>`,

  advertise: `<h1>Advertise / Partner with ${SPG_BRAND}</h1>
<p class="sub">Reach shoppers who are actively looking for practical gifts, starter kits, useful home upgrades, travel helpers, and budget-friendly finds. ${SPG_BRAND} is a clean commerce publication built around helpful recommendations, clear categories, and an opt-in email and SMS audience.</p>
<h2>Who reads ${SPG_BRAND}</h2>
<p>Our audience is US-based and skews toward practical shoppers: gift-givers, first-apartment furnishers, new pet owners, remote workers upgrading their home office, and travelers packing lighter. Most sessions come from organic search for specific problems (e.g. “gift for coworker under $25,” “cordless spin scrubber,” “USB-C car charger”).</p>
<h2>What we offer partners</h2>
<ul>
  <li><strong>Affiliate partnerships</strong> — Amazon Associates, Walmart Impact, FlexOffers, Stay22, and other vetted networks. We integrate approved catalog links into relevant guides and pick pages.</li>
  <li><strong>Sponsored placements</strong> — clearly labeled, editorially separated from organic picks. Sponsored content does not influence which products we recommend organically.</li>
  <li><strong>Sampling programs</strong> — when a merchant provides a product sample for review, we disclose the relationship on the relevant page.</li>
  <li><strong>Custom integrations</strong> — affiliate widgets, comparison tables, gift finders, and AI-assisted shortlists scoped per partnership.</li>
</ul>
<h2>What we don’t do</h2>
<ul>
  <li>We do not sell link placements, nofollow passthroughs, or guaranteed rankings.</li>
  <li>We do not run paid reviews without clear disclosure.</li>
  <li>We do not promote affiliate offers we have not personally vetted against our usefulness bar.</li>
</ul>
<h2>Get in touch</h2>
<p>Send partnership inquiries to <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a> with “Partnership” in the subject line, a brief description of your program, and the audience you are trying to reach. We reply within five business days.</p>`,

  'affiliate-disclosure': `<h1>Affiliate Disclosure</h1>
<p class="sub">${SPG_BRAND} partners with shopping programs so the guide can stay free for readers. This page explains how those relationships work and how they affect what you see on the site.</p>
<h2>The short version</h2>
<p>Some links on ${SPG_DOMAIN} are affiliate links. If you click one and complete a qualifying purchase, ${SPG_OPERATOR} may earn a commission. <strong>This never costs you anything extra</strong>, and it never changes the price you pay. It also never changes which products we feature or how we rank them.</p>
<h2>How affiliate links work</h2>
<p>When you click an outbound link from ${SPG_BRAND} to a merchant site (for example, an Amazon search-results page or a Walmart product page), the link carries a tracking identifier tied to our partner account. If a qualifying purchase is attributed to that click within the merchant's cookie window, ${SPG_OPERATOR} receives a commission. Merchants set the commission rates and attribution windows; we do not control them.</p>
<h2>Programs we participate in</h2>
<p>Currently active or pending programs include, without limitation:</p>
<ul>
  <li><strong>Amazon Associates</strong> — qualifying purchases across Amazon.com.</li>
  <li><strong>Walmart Impact</strong> — approved Walmart catalog items.</li>
  <li><strong>FlexOffers</strong> — selected retail, travel, and lifestyle merchants.</li>
  <li><strong>Stay22</strong> — hotels, vacation rentals, and travel inventory.</li>
  <li>Direct merchant partnerships where applicable.</li>
</ul>
<p>Program participation may change without notice. We update this page when we add or remove a program.</p>
<h2>How affiliate relationships affect our editorial</h2>
<p>Affiliate status is a <em>last</em> filter, not a first one. A product has to clear our usefulness bar before we ever consider whether it has an affiliate program. If two products are equally useful and only one has an active affiliate program, we do not favor the one with the commission — we surface the one that fits the shopper's stated need.</p>
<h2>Sponsored content</h2>
<p>If a piece of content is sponsored by a merchant or advertiser, we label it as sponsored at the top of the page, in the metadata, and in the footer of the affected content. Sponsored content is editorially separated from our organic recommendations.</p>
<h2>Sampling and gifting</h2>
<p>When a merchant provides a product sample, loaner, or gift in connection with a review or feature, we disclose that relationship on the relevant page.</p>
<h2>Your choices</h2>
<p>You can always visit a merchant directly and search for the same product — you will pay the same price, and we will not earn a commission. Affiliate links are a convenience, not a surcharge.</p>
<h2>Questions</h2>
<p>Affiliate, partnership, or disclosure questions: <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>.</p>`,

  privacy: `<h1>Privacy Policy</h1>
<p class="sub"><em>Last updated: ${SPG_EFFECTIVE_DATE}.</em> ${SPG_BRAND} (operated by ${SPG_OPERATOR}, a New York limited liability company) respects your privacy. This Privacy Policy explains in plain English what personal information we collect, why we collect it, how we use it, who we share it with, how long we keep it, what rights you have, and how to contact us. If anything in this policy is unclear, please email <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a> and we will answer.</p>

<h2>1. Who we are</h2>
<p>${SPG_BRAND} is a brand owned and operated by ${SPG_OPERATOR}, a privately held limited liability company organized under the laws of the State of New York, United States. ${SPG_OPERATOR} holds a US Employer Identification Number (EIN) issued by the Internal Revenue Service. References in this policy to "we," "us," or "our" mean ${SPG_OPERATOR}. You can contact us at <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>, by phone at <a href="tel:${SPG_CONTACT_PHONE.replace(/[^+\\\\d]/g, '')}">${SPG_CONTACT_PHONE}</a>, or by mail at the address available on request to ${SPG_CONTACT_EMAIL}.</p>

<h2>2. Scope of this policy</h2>
<p>This policy applies to the website located at <a href="https://${SPG_DOMAIN}">${SPG_DOMAIN}</a> and any subdomains we operate (for example, <code>www.${SPG_DOMAIN}</code>), the ${SPG_BRAND} signup, unsubscribe, and preferences pages, and any email or SMS messages we send to subscribers. It does <strong>not</strong> apply to third-party websites we link to — once you click an outbound link to a merchant, partner, or social platform, that destination's privacy practices apply. We encourage you to read those policies before submitting personal information. This policy also does not apply to background processing performed by affiliate networks on their own systems after a click is attributed to us; those networks have their own privacy notices.</p>

<h2>3. The short version (a one-paragraph summary)</h2>
<p>${SPG_OPERATOR} collects the information you choose to give us (email, optionally your name and ZIP, and a US mobile phone number only if you opt in to SMS), plus basic device and usage information when you visit the site (IP, browser type, pages viewed, link clicks). We use that information to operate the site, send you the messages you signed up for, attribute affiliate commissions to the merchants who fund the site, debug problems, and meet legal recordkeeping obligations. We do not sell personal information. We do not deliver third-party behavioral advertising. We share information only with service providers who act on our instructions, with affiliate networks to attribute clicks, and with authorities when the law requires it. You can access, correct, delete, port, or restrict your information, and you can withdraw any consent at any time.</p>

<h2>4. Information we collect</h2>
<p>We collect personal information only when we have a lawful basis and a clear purpose. The categories below describe what we collect, where it comes from, and why.</p>

<h3>4.1 Information you give us</h3>
<ul>
  <li><strong>Account and signup data.</strong> When you sign up for our email list or SMS list, we collect your first name, last name, email address, ZIP / postal code, and mobile phone number (only if you provide one). <strong>Email is required</strong> to join the email list. <strong>Phone is collected only when you opt in to SMS messaging</strong> by typing a US mobile number and explicitly ticking the SMS consent box. We never require a phone number as a condition of any purchase, signup, or other benefit.</li>
  <li><strong>Preferences.</strong> When you use the Preferences page or interact with the AI tools, we store your interest categories (gifts, home, tech, travel, pets, kitchen, deals under $50, and similar) so future messages stay relevant.</li>
  <li><strong>Prompts you submit to AI tools.</strong> When you use the Gift Finder, Starter Kit Builder, or similar AI-assisted features, we collect the free-text prompts you submit and the responses we generate. We use these to operate the feature, improve ranking quality, and debug issues. Do not include sensitive personal information (such as Social Security numbers, financial account numbers, or health information) in prompts.</li>
  <li><strong>Messages you send us.</strong> If you email us, fill out a form, message us through a partner platform, or reply to one of our emails or SMS messages, we keep a record of the communication so we can respond, follow up, and improve.</li>
  <li><strong>Survey responses and feedback.</strong> If you respond to a survey or send feedback, we collect what you choose to share.</li>
</ul>

<h3>4.2 Information collected automatically</h3>
<ul>
  <li><strong>Device and connection data.</strong> IP address, approximate geolocation derived from IP, browser type and version, operating system, device type, screen size, referrer URL, and the pages of our site you viewed.</li>
  <li><strong>Usage data.</strong> Time on page, scroll depth, clicks, outbound link clicks (including affiliate link clicks, which carry our tracking identifier), in-site search queries, and product interactions (such as which picks you expand or save).</li>
  <li><strong>Cookies and similar technologies.</strong> We use first-party cookies, local storage, and session storage for session state, preferences, and analytics. See Section 6 for categories and control options.</li>
  <li><strong>Server logs.</strong> Standard web server logs including timestamp, IP, request path, status code, and user agent, retained for security and debugging.</li>
</ul>

<h3>4.3 Information from partners and service providers</h3>
<ul>
  <li><strong>Affiliate networks.</strong> Amazon Associates, Walmart Impact, FlexOffers, Stay22, and other networks may share aggregated, anonymized, or attributed reporting (for example, "a click from our site resulted in a purchase within the cookie window"). Some reports include identifiers — for example, the date and time of a click, the product viewed, the order ID, or a hashed email — that we treat as personal information under applicable law. They use this information to compute and pay our commissions and to detect fraud.</li>
  <li><strong>Email and SMS delivery providers.</strong> Our email and SMS providers give us delivery, open, click, and bounce information so we can keep our lists clean and honor opt-outs.</li>
  <li><strong>Analytics providers.</strong> We use Microsoft Clarity for session replay and heatmapping; Clarity may record anonymized interactions to help us understand how the site is used.</li>
  <li><strong>Social and platform providers.</strong> If you interact with us through social media (for example, by tagging us or DMing us), we may receive profile information consistent with your privacy settings on that platform.</li>
</ul>

<h2>5. How we use personal information</h2>
<p>We use personal information to:</p>
<ul>
  <li>Operate, secure, and improve the site and our services.</li>
  <li>Send the email and SMS messages you signed up for, including useful finds, gift ideas, preference updates, and transactional notices.</li>
  <li>Process unsubscribe, preference, and account requests.</li>
  <li>Attribute affiliate clicks to merchant networks so we can be paid the commissions that fund the site.</li>
  <li>Measure content performance, debug issues, and understand which categories and picks are most useful.</li>
  <li>Detect, prevent, and address fraud, abuse, security incidents, and violations of our terms.</li>
  <li>Comply with applicable laws, regulations, and lawful government requests.</li>
  <li>Enforce our Terms of Service and protect our rights, your safety, and the safety of others.</li>
</ul>
<p>We do <strong>not</strong> sell personal information. We do not use your phone number or email to deliver third-party advertising to you. We do not run cross-context behavioral advertising on this site.</p>

<h2>6. Cookies, analytics, and session replay</h2>
<p>We use the following categories of cookies and similar technologies. We try to limit non-essential cookies to those that materially help us run the site.</p>
<ul>
  <li><strong>Strictly necessary.</strong> Session, security, and preference cookies required for the site to function. These are set by default and do not require consent under most privacy laws.</li>
  <li><strong>Analytics.</strong> Aggregated traffic and behavior analytics. We use Microsoft Clarity (<code>clarity.ms</code>) to understand how visitors move through the site via session replay and heatmaps. Clarity may set its own cookies; you can opt out at <a href="https://clarity.microsoft.com/privacy" rel="noopener noreferrer">clarity.microsoft.com/privacy</a>.</li>
  <li><strong>Affiliate.</strong> Cookies or URL parameters set by affiliate networks (for example, Amazon's <code>tag=...</code> parameter) to attribute clicks and qualifying purchases. These are necessary to operate the site's approved-offer business model and we have no practical alternative if you want to use outbound links.</li>
  <li><strong>Verification.</strong> Site-verification meta tags from Impact, Amazon, and similar partners to confirm our partnership status. These do not set cookies.</li>
</ul>
<p>You can clear or block cookies in your browser settings. Blocking strictly necessary cookies may break parts of the site (for example, you may not be able to stay signed in or save preferences). You can also use the Global Privacy Control signal where required by applicable law (see Section 14).</p>

<h2>7. Email and SMS communications</h2>

<h3>7.1 Email</h3>
<p>When you sign up for the email list, we collect your email and use it to send you the messages you opted into. Every marketing email contains an unsubscribe link and our physical mailing address. You can also unsubscribe at <a href="/unsubscribe/">/unsubscribe</a> or change what you receive at <a href="/preferences/">/preferences</a>. We honor opt-out requests promptly, typically within ten business days and usually within one business day. Transactional messages (account notices, security alerts, confirmations, double opt-in confirmations) may be sent regardless of marketing opt-out status where required to deliver a service you requested.</p>

<h3>7.2 SMS / text messages</h3>
<p>SMS is opt-in only. We will not text the mobile number you provide unless you explicitly tick the SMS consent box on the signup form. By submitting the form with the box ticked, you agree that ${SPG_OPERATOR} (operator of ${SPG_BRAND}) may send you recurring automated marketing and informational text messages at that number.</p>
<p><strong>Key terms of our SMS program:</strong></p>
<ul>
  <li><strong>Program operator.</strong> ${SPG_OPERATOR} (operator of ${SPG_BRAND}), a New York limited liability company, EIN on file.</li>
  <li><strong>What you consent to.</strong> Recurring automated marketing and informational text messages from ${SPG_BRAND} at the mobile number you provided.</li>
  <li><strong>Frequency.</strong> Message frequency varies; typically up to <strong>4 messages per month</strong>. The exact frequency depends on your selected preferences and seasonal campaigns.</li>
  <li><strong>Rates.</strong> Message and data rates may apply. Carriers (e.g., AT&amp;T, T-Mobile, Verizon, and their MVNOs) are not liable for delayed or undelivered messages.</li>
  <li><strong>Not a condition of any purchase.</strong> Consent is not a condition of any purchase, and SMS signup is not a condition of receiving any other benefit from ${SPG_BRAND}.</li>
  <li><strong>Account holder.</strong> By providing your mobile number, you confirm that you are the account holder for that number or that you have the account holder's permission to receive messages at it.</li>
  <li><strong>Opt out.</strong> Reply <strong>STOP</strong> to any message to unsubscribe. We honor opt-out requests within 10 business days and usually much faster.</li>
  <li><strong>Help.</strong> Reply <strong>HELP</strong> for help, or contact <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>.</li>
  <li><strong>Records.</strong> We log the date, time, source URL, and version of the SMS consent you provided, the IP address you submitted from, the user agent, and the consent text shown at the time. We retain these records for at least four years from the date of consent to comply with TCPA, A2P 10DLC, CTIA, and applicable state law.</li>
  <li><strong>Registration.</strong> Our SMS program is registered with The Campaign Registry (TCR) and operates on A2P 10DLC long codes registered to ${SPG_OPERATOR}.</li>
</ul>
<p><strong>State-specific SMS notice.</strong> Residents of Florida, Washington, Oklahoma, Maryland, and other states with their own mini-TCPA or telephone-solicitation laws receive the protections of those laws in addition to the TCPA protections above. Where a state law requires additional or earlier consent, that additional consent is collected before any SMS is sent.</p>

<h2>8. How we share personal information</h2>
<p>We do not sell personal information. We share personal information only with:</p>
<ul>
  <li><strong>Service providers</strong> who process data on our behalf — for example, hosting (Cloudflare Pages, Cloudflare Workers), email delivery, SMS delivery, analytics, error monitoring, and database providers. Each provider is bound by confidentiality and data-processing terms consistent with this policy, and only receives the information needed to perform its service.</li>
  <li><strong>Affiliate and partner networks</strong> (Amazon Associates, Walmart Impact, FlexOffers, Stay22, and similar) so they can attribute clicks and qualifying purchases to our account and pay the resulting commissions to ${SPG_OPERATOR}. These networks may set their own cookies or use URL parameters when you follow an outbound link, and their privacy practices apply once you have clicked through.</li>
  <li><strong>Legal and regulatory authorities</strong> when we believe in good faith that disclosure is necessary to comply with a law, valid subpoena, court order, or government request, or to protect our rights, your safety, or the safety of others.</li>
  <li><strong>A successor entity</strong> in the event of a merger, acquisition, reorganization, or sale of assets, in which case we will notify affected users as required by law (typically by email and a banner on the site) and the receiving entity will be required to honor this policy or give you a chance to opt out.</li>
  <li><strong>Aggregated or de-identified information</strong> that cannot reasonably be used to identify you, which we may share without restriction (for example, "our readers clicked on gift picks 23% more often than home picks in Q4").</li>
</ul>
<p>We do not sell personal information for money or other value, and we do not share personal information with third parties for their own cross-context behavioral advertising purposes.</p>

<h2>9. Data retention</h2>
<p>We keep personal information only as long as we have a lawful basis to do so. In practice:</p>
<ul>
  <li><strong>Account and signup records:</strong> until you unsubscribe or delete your account, plus a reasonable wind-down period (typically up to 90 days), after which records are deleted or fully anonymized.</li>
  <li><strong>SMS consent records:</strong> for at least four years from the date of consent, in line with TCPA, A2P 10DLC, CTIA, and applicable state law.</li>
  <li><strong>Email consent and suppression records:</strong> indefinitely, to ensure we do not email a previously opted-out address.</li>
  <li><strong>Server logs and analytics:</strong> typically 13–26 months, then aggregated or deleted.</li>
  <li><strong>Tax and accounting records:</strong> as required by law (typically seven years in the US for federal tax purposes, longer in some states).</li>
  <li><strong>Backups:</strong> encrypted backups are retained on a rolling basis for disaster-recovery purposes and are deleted on the same schedule as the underlying records.</li>
</ul>

<h2>10. Your rights and choices</h2>
<p>Depending on where you live, you may have the right to:</p>
<ul>
  <li><strong>Access</strong> the personal information we hold about you.</li>
  <li><strong>Correct</strong> inaccurate or incomplete information.</li>
  <li><strong>Delete</strong> personal information, subject to our legal recordkeeping obligations (we cannot delete SMS consent records within the four-year retention window, and we cannot delete suppression records used to honor your opt-outs).</li>
  <li><strong>Object to or restrict</strong> certain processing.</li>
  <li><strong>Withdraw consent</strong> at any time (without affecting the lawfulness of processing before withdrawal).</li>
  <li><strong>Receive a portable copy</strong> of your information.</li>
  <li><strong>Opt out of "sale" or "sharing"</strong> for cross-context behavioral advertising (we do not sell personal information; we do not currently run cross-context behavioral ads).</li>
  <li><strong>Non-discrimination</strong> for exercising any of the rights above.</li>
</ul>
<p><strong>How to exercise these rights.</strong> Email <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a> with the right you want to exercise. For your protection, we may need to verify your identity before fulfilling the request. We respond within the timeframes required by applicable law (typically 30–45 days; up to 90 days where complexity warrants, with notice). If we deny your request, we tell you why and how to appeal.</p>
<p><strong>Authorized agents.</strong> If you submit a request through an authorized agent, we may require proof of the agent's authority and may still verify your identity directly.</p>

<h2>11. California-specific rights (CCPA / CPRA)</h2>
<p>If you are a California resident, you have additional rights under the California Consumer Privacy Act, as amended by the California Privacy Rights Act ("CCPA/CPRA"):</p>
<ul>
  <li><strong>Right to know</strong> what categories of personal information we collect, the sources, the business purposes, and the categories of recipients.</li>
  <li><strong>Right to delete</strong> personal information we collected from you, subject to the exceptions in Section 10.</li>
  <li><strong>Right to correct</strong> inaccurate personal information.</li>
  <li><strong>Right to opt out of sale or sharing</strong> — we do not sell or share personal information as those terms are defined under CCPA/CPRA.</li>
  <li><strong>Right to limit use of sensitive personal information</strong> — we do not collect sensitive personal information as defined under CCPA/CPRA.</li>
  <li><strong>Right to non-discrimination</strong> for exercising CCPA/CPRA rights.</li>
</ul>
<p>To exercise these rights, follow the process in Section 10. You may also submit a "Do Not Sell or Share My Personal Information" request at any time by emailing <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>; while we do not sell or share, we will confirm that in writing. California "shining a light" requests can be sent to the same address.</p>

<h2>12. Other US state privacy rights</h2>
<p>Residents of Colorado, Connecticut, Virginia, Utah, Texas, Oregon, Montana, Iowa, and other US states with comprehensive privacy laws have rights similar to those in Section 10. To exercise those rights, follow the process in Section 10. We honor Global Privacy Control signals as required.</p>

<h2>13. International transfers</h2>
<p>We are a US-based company. If you visit the site from outside the United States, your information will be transferred to and processed in the United States. By using the site, you understand that US data protection laws may differ from those of your jurisdiction. Where required by law, including for transfers from the EEA, the UK, or Switzerland, we rely on Standard Contractual Clauses (the EU Commission Decision 2021/914 modules) or other approved transfer mechanisms to protect your information.</p>

<h2>14. Children's privacy</h2>
<p>${SPG_BRAND} is intended for a general adult audience and is not directed at children. We do not knowingly collect personal information from children under 13 (COPPA), under 16 where the GDPR's higher age applies, or under any higher age where local law requires. If you believe a child has provided us with personal information, contact <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a> and we will delete it. The Service is not directed at children, and parents who believe their child has interacted with the Service should contact us.</p>

<h2>15. Security</h2>
<p>We use reasonable technical and organizational safeguards designed to protect personal information, including: HTTPS/TLS in transit, encryption at rest where supported by our providers, access controls with least-privilege permissions, audit logging of access to administrative functions, separation of environments, and periodic review of vendor security posture. No system is 100% secure; we cannot guarantee absolute security. If a breach affects you, we will notify you and the relevant authorities as required by applicable law.</p>

<h2>16. Third-party links and widgets</h2>
<p>Outbound merchant links, Amazon Native Shopping Ads, Walmart catalog embeds, embedded reviews, and similar widgets are governed by the privacy practices of the third parties operating them. We do not control and are not responsible for their practices. Once you click an outbound link, the privacy policy of the destination merchant or partner applies. We encourage you to read those policies before submitting personal information.</p>

<h2>17. "Do Not Track" and Global Privacy Controls</h2>
<p>We honor Global Privacy Control (GPC) signals where required by applicable law (for example, California, Colorado, Connecticut, Virginia, Utah). If your browser sends a GPC signal, we treat it as a valid opt-out of "sale" or "sharing." We do not currently respond to legacy Do Not Track (DNT) browser signals, which are not regulated.</p>

<h2>18. AI features and how they handle inputs</h2>
<p>${SPG_BRAND} uses AI to summarize and rank products in our approved catalog. AI features operate against a curated product catalog; they do not invent products. Prompts you submit to AI features are:</p>
<ul>
  <li>Sent to our AI service provider under a data-processing agreement that prohibits secondary use for model training.</li>
  <li>Retained only as long as necessary to operate the feature and improve ranking quality, subject to our retention schedule.</li>
  <li>Not used by us or our providers to train foundation models on your input.</li>
</ul>
<p>Do not include sensitive personal information (Social Security numbers, financial account numbers, health information, passwords, or similar) in prompts.</p>

<h2>19. Changes to this policy</h2>
<p>We may update this policy from time to time. When we do, we revise the "Last updated" date above. For material changes, we will provide additional notice (for example, a banner on the site or an email to active subscribers at least 30 days before the change takes effect, where required by law). Continued use of the site after the effective date of a change constitutes acceptance of the updated policy, except where a law requires affirmative consent. You can always find the current version at this URL, and prior versions are available on request to <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>.</p>

<h2>20. Contact us</h2>
<p>Privacy questions, access requests, complaints, and authorized-agent requests:</p>
<p>Email: <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a><br>
Phone: <a href="tel:${SPG_CONTACT_PHONE.replace(/[^+\\\\d]/g, '')}">${SPG_CONTACT_PHONE}</a><br>
Mailing address: available on request to <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>.</p>
<p><strong>Designated privacy contact.</strong> For state-specific requests or authorized-agent submissions, address your email to "Privacy" in the subject line so it is routed correctly.</p>
<p><strong>Complaint escalation.</strong> If we cannot resolve your complaint, you may have the right to lodge a complaint with your local data protection authority (for example, the California Attorney General, the relevant US state attorney general, or the supervisory authority in your EEA Member State). We would, however, appreciate the chance to address your concerns directly before you approach a regulator.</p>`,

  terms: `<h1>Terms of Service</h1>
<p class="sub"><em>Last updated: ${SPG_EFFECTIVE_DATE}.</em> These Terms of Service ("Terms") govern your access to and use of the website located at <a href="https://${SPG_DOMAIN}">${SPG_DOMAIN}</a> and any subdomains, products, AI-assisted features, signup, unsubscribe, and preferences pages, and email or SMS messages we send (together, the "Service"), operated by ${SPG_OPERATOR}, a New York limited liability company. By accessing or using the Service, clicking "I agree," or submitting a form, you agree to these Terms. If you do not agree, do not use the Service.</p>

<h2>1. Who we are</h2>
<p>${SPG_BRAND} is a brand owned and operated by ${SPG_OPERATOR}, a privately held limited liability company organized under the laws of the State of New York, United States. ${SPG_OPERATOR} holds a US Employer Identification Number (EIN) issued by the Internal Revenue Service. References to "we," "us," or "our" mean ${SPG_OPERATOR}. You can contact us at <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>, by phone at <a href="tel:${SPG_CONTACT_PHONE.replace(/[^+\\\\d]/g, '')}">${SPG_CONTACT_PHONE}</a>, or by mail at the address available on request.</p>

<h2>2. Eligibility</h2>
<p>You must be at least 18 years old (or the age of digital consent in your jurisdiction, whichever is higher) to use the Service. By using the Service, you represent that you meet this requirement and that you are legally able to enter into a binding contract in your jurisdiction. The Service is not directed at children under 13 (COPPA). Parents who believe their child has used the Service should contact us so we can delete any information collected.</p>

<h2>3. What we provide</h2>
<p>${SPG_BRAND} provides editorial content, AI-assisted shopping tools (including a Gift Finder, Starter Kit Builder, and "is it worth it?" checker), and outbound links to merchants and partner programs. We do not sell products directly, do not process payments, do not ship orders, and do not warehouse inventory. All purchases, returns, warranties, customer service, fulfillment, taxes, and post-purchase support are handled by the merchant you ultimately transact with. We are not a party to any transaction between you and a merchant, and we make no representations or warranties about any merchant, product, or service beyond what is explicitly stated in our editorial content or <a href="/affiliate-disclosure/">Affiliate Disclosure</a>.</p>

<h2>4. Informational purposes only — no professional advice</h2>
<p>Our recommendations, descriptions, ratings, comparisons, AI-generated summaries, and editorial content are provided for informational and entertainment purposes only. They are not professional advice of any kind — not legal advice, not medical advice, not financial advice, not tax advice, not veterinary advice, not safety advice, and not engineering or installation advice. You are responsible for confirming product details, current pricing, availability, shipping costs, returns, warranties, recalls, compatibility, safety, and merchant terms before making a purchase or use decision. Do not rely on our content as a substitute for professional advice that is appropriate to your circumstances.</p>

<h2>5. Affiliate and sponsored content</h2>
<p>Some outbound links on the Service are affiliate links. We may earn a commission on qualifying purchases at no extra cost to you. Some content may be sponsored or provided in connection with a merchant sampling program; sponsored content is clearly labeled at the top of the page, in metadata, and at the relevant call-to-action. We are participants in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn fees by linking to Amazon.com and affiliated sites. Amazon, the Amazon logo, AmazonSupply, and the AmazonSupply logo are trademarks of Amazon.com, Inc. or its affiliates. See our <a href="/affiliate-disclosure/">Affiliate Disclosure</a> and <a href="/advertise/">Advertise</a> pages for the full picture.</p>

<h2>6. Account, signup, and SMS terms</h2>
<p>When you sign up for email or SMS messages, you agree to:</p>
<ul>
  <li>Provide accurate, current, and complete information.</li>
  <li>Keep your contact details — especially your mobile number — up to date.</li>
  <li>Use the unsubscribe link in any email, or reply <strong>STOP</strong> to any SMS message, to opt out at any time.</li>
  <li>Reply <strong>HELP</strong> for help with SMS messages.</li>
  <li>Confirm that you are the account holder for any mobile number you provide, or that you have the account holder's permission to receive messages at it.</li>
  <li>Not enroll a mobile number belonging to another person without their permission.</li>
</ul>
<p>SMS messages you agree to receive are governed by the versioned SMS Terms presented on the signup form at the time you opted in. We log the date, time, source URL, version, IP, user agent, and consent text shown at the time of every consent we collect. The current SMS Terms version is ${SPG_SMS_CONSENT_VERSION}; prior versions are available on request to <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>. We will not text you without your affirmative consent, and SMS signup is not a condition of any purchase or of receiving any other benefit from ${SPG_BRAND}.</p>
<p>${SPG_OPERATOR}'s SMS program is registered with The Campaign Registry (TCR) and operates on A2P 10DLC long codes. By submitting a phone number to enroll in SMS, you confirm your agreement with these Terms and with all applicable TCR, carrier, and CTIA messaging guidelines. Where state law (for example, Florida, Washington, Oklahoma, or Maryland) requires additional consent language, that additional consent is collected on the signup form before any SMS is sent.</p>

<h2>7. AI-assisted features and their limits</h2>
<p>The Service offers AI-assisted shopping tools that summarize and rank products in our approved catalog. These tools do not invent products; they rank and summarize products drawn from our catalog. AI-generated summaries may, despite our review, contain errors or omit relevant details. You should treat AI-assisted output as a starting point, not as a final recommendation. The tools may refuse to recommend a product when no approved-affiliate match exists in our catalog. Outputs may change over time as we update the catalog and the underlying models.</p>
<p>Do not submit prompts to AI features that contain personal information about yourself or others (including names, phone numbers, email addresses, account numbers, Social Security numbers, or health information). We do not train foundation models on your prompts, but you should assume anything you submit to an AI tool is being processed by a third-party AI provider under our data-processing agreement, which prohibits secondary use for training.</p>

<h2>8. Acceptable use</h2>
<p>You agree not to:</p>
<ul>
  <li>Use the Service for any unlawful purpose or in violation of any applicable law, regulation, or contractual obligation.</li>
  <li>Submit forms with automated means (bots, scripts, macros) or with information that is not your own.</li>
  <li>Scrape, crawl, mirror, or otherwise copy the Service or its content at a rate that interferes with normal operation, or in violation of the robots.txt file or any rate-limiting signals we publish.</li>
  <li>Attempt to access non-public areas of the Service, probe or scan for vulnerabilities, bypass any security measure, or use the Service to gain unauthorized access to any system or network.</li>
  <li>Interfere with or disrupt the Service, its servers, or any networks connected to it (including denial-of-service attacks).</li>
  <li>Upload or transmit viruses, malware, ransomware, or any other malicious code.</li>
  <li>Misrepresent your identity or impersonate any person or entity, including ${SPG_OPERATOR} or any ${SPG_BRAND} staff or affiliate.</li>
  <li>Use the Service to harass, defame, harm, stalk, or threaten another person.</li>
  <li>Use the Service in any way that could damage, disable, overburden, or impair our infrastructure or interfere with any other user's enjoyment of the Service.</li>
  <li>Use the Service to send unsolicited communications, promotions, advertisements, or spam, or to harvest or collect personal information about other users.</li>
  <li>Circumvent any technological measure we use to protect the Service, including rate limits, CAPTCHA challenges, and access controls.</li>
</ul>
<p>We may investigate and take appropriate legal action against anyone who, in our sole discretion, engages in prohibited conduct, including reporting such conduct to law enforcement authorities.</p>

<h2>9. Intellectual property — our content</h2>
<p>The Service, including its design, code, original illustrations, AI-generated illustrations, copy, photographs, logos, trademarks, and service marks, is owned by ${SPG_OPERATOR} or its licensors and is protected by United States and international intellectual property laws, including copyright, trademark, trade dress, and trade-secret law. You may view and use the Service for personal, non-commercial purposes. You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any material from the Service without our prior written consent, except as enabled by normal browser functionality (for example, a single copy cached by your browser for offline viewing) or as permitted by applicable copyright law (for example, brief quotations used in accordance with fair use).</p>
<p>All ${SPG_BRAND} trademarks, trade names, logos, and service marks (including the ${SPG_BRAND} name and logo) are the property of ${SPG_OPERATOR}. You may not use these marks without our prior written permission. Feedback you provide about the marks does not grant you any rights in them.</p>

<h2>10. Intellectual property — our content, more specifically</h2>
<ul>
  <li><strong>Original illustrations.</strong> Product illustrations on the Service are AI-generated original works created by or for ${SPG_OPERATOR}. They are not licensed from third parties and do not depict any specific real-world product. They are placeholders that we use when we have not licensed product imagery from the merchant.</li>
  <li><strong>Copy and editorial commentary.</strong> Original copy, comparison write-ups, "is it worth it?" analyses, and category descriptions on the Service are original works authored by ${SPG_OPERATOR} (with AI assistance in some drafts, under human review).</li>
  <li><strong>Trademarks of third parties.</strong> Merchant names, logos, and product names referenced on the Service are the property of their respective owners. References are for informational purposes only and do not imply endorsement, sponsorship, or affiliation.</li>
  <li><strong>No scraping.</strong> We do not scrape or republish copyrighted merchant content (product images, prices, reviews, ratings, availability). ${SPG_BRAND} content reflects our independent editorial judgment, not the catalog of any single merchant.</li>
</ul>

<h2>11. User submissions and the license you grant us</h2>
<p>If you submit content to us (for example, product suggestions, comments, feedback, survey responses, or messages you send us), you grant ${SPG_OPERATOR} a non-exclusive, royalty-free, worldwide, perpetual, irrevocable, and fully sublicensable right to use, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, and display such content in any media, subject to our <a href="/privacy/">Privacy Policy</a>. You represent and warrant that you own or have the necessary rights to the content you submit, that the content does not violate the rights of any third party (including privacy, publicity, copyright, trademark, or contractual rights), and that the content is not unlawful, defamatory, obscene, or otherwise objectionable. You waive any moral rights in the content to the extent permitted by law. We are not obligated to publish, maintain, or return any submission.</p>

<h2>12. Feedback</h2>
<p>If you send us unsolicited feedback, suggestions, or ideas about the Service, you agree that we may use that feedback without restriction or compensation to you. You assign any rights in the feedback to ${SPG_OPERATOR} to the maximum extent permitted by law, and you waive any moral rights in the feedback to the extent permitted by law.</p>

<h2>13. Third-party services and links</h2>
<p>The Service contains links to third-party websites, services, embedded widgets, and APIs (for example, Amazon, Walmart, hotel and travel providers, social platforms, analytics providers, AI providers, and SMS delivery providers). We do not control and are not responsible for the content, policies, or practices of any third party. Your use of third-party services is at your own risk and subject to their terms and privacy policies. Some outbound links are tracked by affiliate networks; see our <a href="/affiliate-disclosure/">Affiliate Disclosure</a>.</p>

<h2>14. Electronic communications; SMS consent and program</h2>
<p>By submitting a form on the Service or otherwise providing us with a mobile number, you agree that we (and our SMS delivery provider) may send you electronic communications, including SMS messages, at the address or number you provided. Electronic communications include any messages sent via email, SMS, push notification, web in-app message, or similar digital channel. You may opt out of marketing communications at any time (see Section 6), but you consent to receive transactional or administrative communications related to your account.</p>
<p><strong>SMS Program Terms — Additional Disclosures (TCPA, A2P 10DLC, CTIA):</strong></p>
<ul>
  <li><strong>Program operator.</strong> ${SPG_OPERATOR} (operator of ${SPG_BRAND}), a New York limited liability company, EIN on file.</li>
  <li><strong>What you consent to.</strong> Recurring automated marketing and informational text messages from ${SPG_BRAND} at the mobile number you provided.</li>
  <li><strong>Frequency.</strong> Message frequency varies; typically up to 4 messages per month.</li>
  <li><strong>Rates.</strong> Message and data rates may apply.</li>
  <li><strong>Carriers.</strong> Carriers (e.g., AT&amp;T, T-Mobile, Verizon, and their MVNOs) are not liable for delayed or undelivered messages.</li>
  <li><strong>Not a condition of purchase.</strong> Consent is not a condition of any purchase.</li>
  <li><strong>Opt out.</strong> Reply <strong>STOP</strong> at any time. Reply <strong>HELP</strong> for help.</li>
  <li><strong>Records.</strong> We retain consent records, including the versioned disclosure text, timestamp, source URL, IP, and user agent, for at least four years.</li>
  <li><strong>Registration.</strong> Our SMS program is registered with The Campaign Registry and operates on A2P 10DLC long codes.</li>
  <li><strong>Consent version.</strong> The version of the SMS Terms displayed on the signup form at the time of your signup is the binding version for that signup; subsequent versions apply only to new signups.</li>
</ul>

<h2>15. Disclaimer of warranties</h2>
<p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, RELIABILITY, AND TITLE. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF HARMFUL COMPONENTS, OR THAT DEFECTS WILL BE CORRECTED. WE DO NOT WARRANT THE ACCURACY, COMPLETENESS, USEFULNESS, OR LAWFULNESS OF ANY PRODUCT RECOMMENDATION, EDITORIAL CONTENT, AI-GENERATED OUTPUT, MERCHANT LISTING, OR MERCHANT PRODUCT. NO ADVICE OR INFORMATION, WHETHER ORAL OR WRITTEN, OBTAINED BY YOU FROM US SHALL CREATE ANY WARRANTY NOT EXPRESSLY STATED IN THESE TERMS. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF CERTAIN WARRANTIES; IN SUCH JURISDICTIONS, THE EXCLUSIONS ABOVE APPLY TO THE FULLEST EXTENT PERMITTED BY LAW.</p>

<h2>16. Limitation of liability</h2>
<p>TO THE FULLEST EXTENT PERMITTED BY LAW, ${SPG_OPERATOR}, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND LICENSORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, REVENUE, DATA, USE, GOODWILL, BUSINESS OPPORTUNITY, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (A) YOUR ACCESS TO OR USE OF (OR INABILITY TO ACCESS OR USE) THE SERVICE; (B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON OR THROUGH THE SERVICE, INCLUDING ANY MERCHANT, AFFILIATE NETWORK, OR AI PROVIDER; (C) ANY CONTENT OBTAINED FROM THE SERVICE, INCLUDING AI-GENERATED OUTPUT; (D) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT; OR (E) ANY OTHER MATTER RELATING TO THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
<p>IN NO EVENT WILL OUR AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATING TO THE SERVICE EXCEED ONE HUNDRED US DOLLARS (US$100). THE LIMITATIONS IN THIS SECTION APPLY TO ALL CLAIMS, WHETHER BASED ON WARRANTY, CONTRACT, STATUTE, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR ANY OTHER LEGAL THEORY, AND WHETHER OR NOT WE HAVE BEEN INFORMED OF THE POSSIBILITY OF SUCH DAMAGES. SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS OF LIABILITY; IN SUCH JURISDICTIONS, THE LIMITATIONS APPLY TO THE FULLEST EXTENT PERMITTED BY LAW.</p>

<h2>17. Indemnification</h2>
<p>You agree to defend, indemnify, and hold harmless ${SPG_OPERATOR} and its affiliates, officers, directors, employees, agents, licensors, and service providers from and against any claim, liability, damage, loss, and expense (including reasonable attorneys' fees and costs) arising out of or in any way connected with (a) your access to or use of the Service; (b) your violation of these Terms; (c) your violation of any third-party right, including any intellectual-property, privacy, publicity, or contractual right; (d) your violation of any applicable law; (e) any content you submit or transmit via the Service; or (f) any dispute between you and a third party (including any merchant).</p>

<h2>18. Termination</h2>
<p>We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice, including (without limitation) if we believe you have violated these Terms, if we suspect fraudulent or abusive activity, if we are required to do so by law or by a merchant or affiliate network, or if we discontinue the Service. Upon termination, all provisions of these Terms that by their nature should survive termination will survive, including ownership, intellectual-property, disclaimers, indemnification, limitations of liability, dispute resolution, and contact provisions. You may stop using the Service at any time. Termination does not affect consent records we are required to retain (typically four years for SMS consent), opt-out records, or any right that has already accrued to either party.</p>

<h2>19. Accessibility</h2>
<p>We aim to make ${SPG_BRAND} usable for as broad an audience as possible. If you encounter an accessibility barrier or need an alternative format for any content (for example, a large-print or screen-reader-friendly version of these Terms), please contact <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a> with the URL of the page and a description of the issue, and we will work with you to provide the content in a usable form.</p>

<h2>20. Force majeure</h2>
<p>We will not be liable for any delay or failure to perform resulting from causes outside our reasonable control, including acts of God, war, terrorism, riots, embargoes, sanctions, actions of any governmental authority, epidemics, pandemics, internet or telecommunications outages, power failures, labor disputes, fires, floods, earthquakes, severe weather, or supply-chain disruptions affecting our service providers or affiliate networks.</p>

<h2>21. Export controls and sanctions</h2>
<p>You may not use the Service if doing so would violate US export controls or sanctions laws (including those administered by the US Department of the Treasury's OFAC or the US Department of Commerce). You represent and warrant that you are not located in, or a resident or national of, any country or territory subject to US sanctions, and that you are not on any list of restricted parties maintained by the US government.</p>

<h2>22. Governing law and venue</h2>
<p>These Terms are governed by the laws of the State of New York, without regard to its conflict-of-laws rules. The United Nations Convention on Contracts for the International Sale of Goods does not apply. You and ${SPG_OPERATOR} agree to submit to the exclusive jurisdiction of the state and federal courts located in New York County, New York, for any dispute arising out of or relating to these Terms or the Service, except that we may seek injunctive relief in any court of competent jurisdiction to protect our intellectual property, confidential information, or our rights under Section 6 (Account, signup, and SMS terms).</p>

<h2>23. Dispute resolution and arbitration</h2>
<p><strong>PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.</strong></p>
<p>You and ${SPG_OPERATOR} agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service (a "Dispute") will be resolved by binding individual arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules, rather than in court, except that either party may bring a qualifying claim in small-claims court. There is no judge or jury in arbitration, and class actions and class arbitrations are not permitted. You and ${SPG_OPERATOR} each waive any right to a jury trial and to participate in any class action, class arbitration, or other representative action. Nothing in this section prevents either party from seeking injunctive or equitable relief in court to protect intellectual property, confidential information, or rights under Section 6.</p>
<p>The arbitration will be conducted by a single arbitrator in New York County, New York, unless the parties agree otherwise. The arbitrator's award will be final and binding and may be entered as a judgment in any court of competent jurisdiction. The arbitrator may award the same damages or relief that a court could award, including reasonable attorneys' fees and costs, but only to the extent that a court could award them under these Terms.</p>
<p>You may opt out of arbitration by sending written notice, including your name and the email address you used to sign up, to <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a> within 30 days of first accepting these Terms. If you opt out, you may pursue your Dispute in court.</p>
<p>Notwithstanding the above, either party may bring a qualifying action in small-claims court. Either party may also seek injunctive or equitable relief to prevent or remedy a breach of intellectual property rights, confidential information, or the SMS Terms.</p>

<h2>24. Modifications</h2>
<p>We may modify these Terms from time to time. The "Last updated" date above reflects the most recent change. Material changes will be announced via a banner on the site, an email to active subscribers, or both, at least 30 days before the change takes effect, where required by law. Your continued use of the Service after the effective date of a change constitutes acceptance of the updated Terms, except where the change is material and applicable law requires affirmative consent. If you do not agree to a material change, you may stop using the Service and unsubscribe from communications; for SMS, you may also reply STOP at any time to opt out.</p>

<h2>25. Severability</h2>
<p>If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court or arbitrator of competent jurisdiction, that provision will be severed, and the remaining provisions will remain in full force and effect. The parties intend that the court or arbitrator modify any severed provision to the minimum extent necessary to render it valid and enforceable while preserving the parties' intent.</p>

<h2>26. No waiver</h2>
<p>Our failure to enforce any right or provision of these Terms will not be deemed a waiver of such right or provision. Any waiver of any provision of these Terms will be effective only if in writing and signed by an authorized representative of ${SPG_OPERATOR}.</p>

<h2>27. Assignment</h2>
<p>You may not assign or transfer your rights or obligations under these Terms without our prior written consent. We may assign or transfer these Terms, in whole or in part, without restriction, including in connection with a merger, acquisition, reorganization, sale of assets, or operation of law. Subject to the foregoing, these Terms bind and benefit the parties and their permitted successors and assigns.</p>

<h2>28. Entire agreement</h2>
<p>These Terms, together with our <a href="/privacy/">Privacy Policy</a> and <a href="/affiliate-disclosure/">Affiliate Disclosure</a>, constitute the entire agreement between you and ${SPG_OPERATOR} regarding the Service and supersede all prior or contemporaneous understandings, proposals, communications, or agreements, whether oral or written, regarding the Service.</p>

<h2>29. Notices</h2>
<p>You agree that any notices we send you electronically (via email, SMS, or posting on the Service) satisfy any legal requirement that such notices be in writing. You must keep your contact information current. You may send us notices at <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>.</p>

<h2>30. Contact us</h2>
<p>Questions, complaints, or notices about these Terms:<br>
Email: <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a><br>
Phone: <a href="tel:${SPG_CONTACT_PHONE.replace(/[^+\\\\d]/g, '')}">${SPG_CONTACT_PHONE}</a><br>
Mailing address: available on request to <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>.<br>
Subject-line routing: please address Terms-related messages to "Terms" in the subject line so they are routed correctly.</p>`,

  contact: `<h1>Contact ${SPG_BRAND}</h1>
<p class="sub">For everything listed below, we are reachable at <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>. We respond within five business days; usually faster.</p>
<h2>What to email us about</h2>
<ul>
  <li><strong>Questions about a pick.</strong> Send the page URL and what's unclear.</li>
  <li><strong>Corrections.</strong> Found a factual error? We will correct it promptly and add a note to the page if material.</li>
  <li><strong>Product suggestions.</strong> Tell us the job, not the brand — we surface by use case.</li>
  <li><strong>Affiliate and partnership inquiries.</strong> See <a href="/advertise/">Advertise</a>.</li>
  <li><strong>Press and media.</strong> Add “Press” to the subject line.</li>
  <li><strong>Takedown requests.</strong> Include the URL and a brief description; we respond within five business days.</li>
  <li><strong>Privacy and data requests.</strong> See <a href="/privacy/">Privacy</a>.</li>
  <li><strong>SMS support.</strong> Reply HELP to any message, or email us with your mobile number (do not text it back for support).</li>
</ul>
<h2>About the operator</h2>
<p>Company: <strong>${SPG_OPERATOR}</strong>.<br>
Brand: <strong>${SPG_BRAND}</strong>.<br>
Site: <a href="https://${SPG_DOMAIN}">${SPG_DOMAIN}</a>.<br>
Company site: <a href="https://mehyar.us" rel="noopener noreferrer">mehyar.us</a>.</p>
<h2>Phone</h2>
<p><a href="tel:${SPG_CONTACT_PHONE.replace(/[^+\\d]/g, '')}">${SPG_CONTACT_PHONE}</a> (general inquiries; not a support hotline).</p>
<h2>Mailing address</h2>
<p>Available on request to <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a>.</p>`,

  signup: `<h1>Sign up for Pretty Good Finds</h1>
<p class="sub">Get useful finds, gift ideas, and starter kits by email — and, if you opt in, occasional text-message updates too. ${SPG_OPERATOR} (operator of ${SPG_BRAND}) runs the list.</p>
<h2>How signup works</h2>
<ol>
  <li>Fill in your details below. Email is required; first name, last name, and ZIP are optional and help us tailor recommendations.</li>
  <li>If you want SMS updates, enter a US mobile number and tick the SMS consent box. SMS is opt-in only — we will not text you without that box checked.</li>
  <li>We send a confirmation email. Click the link inside to finish signing up.</li>
  <li>Reply STOP to any text to opt out, or HELP for help. The unsubscribe link in any email opts you out of email.</li>
</ol>
<h2>What we'll send</h2>
<ul>
  <li><strong>Email:</strong> useful finds, gift ideas, starter-kit roundups, deal highlights, occasional product updates. Typically a few emails per month.</li>
  <li><strong>SMS (if you opt in):</strong> short alerts when a useful pick drops, a new story list goes live, or a small batch we think you'll care about ships. Frequency varies, typically up to 4 messages per month. Message and data rates may apply.</li>
</ul>
<h2>Your privacy</h2>
<p>We keep what you submit on this form only as long as we need it to operate the list and meet legal recordkeeping requirements (typically at least four years for SMS consent). We do not sell your information. See our <a href="/privacy/">Privacy Policy</a> for the full picture and our <a href="/terms/">Terms of Service</a> for the rules of the road.</p>
${signupForm('signup-page')}`,

  unsubscribe: `<h1>Unsubscribe</h1>
<p class="sub">Enter the email address you signed up with and we will opt you out of marketing emails. We honor requests promptly, typically within ten business days. If you want to opt out of text messages, simply reply <strong>STOP</strong> to any text we have sent you.</p>
<p class="micro">If the unsubscribe form below does not work for any reason, email <a href="mailto:${SPG_CONTACT_EMAIL}">${SPG_CONTACT_EMAIL}</a> from the address you signed up with and we will remove you manually.</p>
<form class="signup-form" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/unsubscribe">
  <input type="hidden" name="source" value="unsubscribe-page">
  <label>Email <span class="req">required</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>
  <button class="btn" type="submit">Unsubscribe</button>
</form>
<h2>What happens next</h2>
<ul>
  <li>We mark your email as unsubscribed and stop marketing sends within ten business days.</li>
  <li>We may still send transactional messages required to deliver a service you requested (for example, a confirmation).</li>
  <li>Unsubscribing from email does not automatically unsubscribe you from SMS. Reply STOP to any text.</li>
</ul>`,

  preferences: `<h1>Preferences</h1>
<p class="sub">Tell us what you care about so future emails and (if you opted in) texts stay useful. We use this only to tailor the content you receive from ${SPG_BRAND}; we do not share or sell your preferences.</p>
<form class="signup-form" method="post" action="https://stuffprettygood-api.mehyar.workers.dev/api/preferences">
  <input type="hidden" name="source" value="preferences-page">
  <label>Email <span class="req">required</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>
  <div class="checks">
    <label><input type="checkbox" name="interests" value="gifts"> Gifts</label>
    <label><input type="checkbox" name="interests" value="home"> Home</label>
    <label><input type="checkbox" name="interests" value="tech"> Tech</label>
    <label><input type="checkbox" name="interests" value="travel"> Travel</label>
    <label><input type="checkbox" name="interests" value="pets"> Pets</label>
    <label><input type="checkbox" name="interests" value="kitchen"> Kitchen</label>
    <label><input type="checkbox" name="interests" value="under-50"> Useful deals under $50</label>
  </div>
  <div class="checks">
    <label><input type="radio" name="cadence" value="standard" checked> Standard cadence (default)</label>
    <label><input type="radio" name="cadence" value="low"> Low cadence (fewer emails)</label>
  </div>
  <button class="btn" type="submit">Save preferences</button>
</form>
<p class="micro">Manage text-message consent at <a href="/signup/">/signup</a> or reply STOP to any text. See our <a href="/privacy/">Privacy Policy</a>.</p>`
};
// Pages that should NOT show the signup modal: legal/transactional pages where a popup is hostile or redundant.
const SPG_NO_MODAL_SLUGS = new Set(['privacy', 'terms', 'affiliate-disclosure', 'signup', 'unsubscribe', 'preferences', 'open']);
for (const [slug, html] of Object.entries(policyPages)) {
  const showModal = !SPG_NO_MODAL_SLUGS.has(slug);
  mkdirPage(slug, layout(pageTitle(slug), `<section class="section post">${html}</section>`, { route: slug, showModal }, pageDescription(slug)));
}

// Deep-link handler. The site.webmanifest declares protocol_handlers:
// [{ protocol: 'web+spg', url: '/open?u=%s' }], which means a user tapping a
// web+spg:// link in another app gets routed here with the URL in ?u=. Because
// Cloudflare Pages is static hosting, the query string is parsed client-side.
// We validate the URL scheme (only http/https/web+spg — never javascript:/
// data:/vbscript:/file:), and either:
//   * auto-redirect to an internal SPG route if ?u= matches one,
//   * show a preview card for external URLs (with a Continue CTA),
//   * show an "unrecognized link" panel + search box for malformed input.
const openDeepLinkBody = `<section class="section post"><p class="eyebrow">Deep link</p><h1 id="spg-open-title">Open a Stuff Pretty Good link</h1><p class="sub" id="spg-open-sub">Waiting for the link you tapped. If you arrived here without a link, the page below explains what this is and where to go next.</p><div id="spg-open-status" class="spg-open-status" role="status" aria-live="polite"><div class="spg-open-card" id="spg-open-card"><div class="spg-open-spinner" aria-hidden="true"></div><p id="spg-open-status-text">Reading the link…</p></div></div><div id="spg-open-actions" class="spg-open-actions" hidden><a class="btn" id="spg-open-continue" href="#" rel="noopener noreferrer">Continue</a><a class="btn ghost" href="/" id="spg-open-home">Back to home</a></div><h2>What this page does</h2><p>Stuff Pretty Good registers itself as a handler for <code>web+spg://</code> links. When another app (a share sheet, a chat message, an email link) hands off a <code>web+spg://…</code> URL, the system routes it here. This page:</p><ul><li>reads the URL that was opened,</li><li>checks that it is a safe <code>http</code>, <code>https</code>, or internal <code>web+spg</code> link,</li><li>auto-redirects to internal Stuff Pretty Good pages (product details, gift guides, etc.), and</li><li>shows a preview card before opening any external URL, so you can decide whether to continue.</li></ul><p class="micro">Privacy: no link data leaves your device. The check happens entirely in your browser.</p></section><script>(function(){try{var params=new URLSearchParams(location.search);var raw=params.get('u')||'';var fileParam=params.get('file')||'';var titleEl=document.getElementById('spg-open-title');var subEl=document.getElementById('spg-open-sub');var statusEl=document.getElementById('spg-open-status');var statusText=document.getElementById('spg-open-status-text');var cardEl=document.getElementById('spg-open-card');var actionsEl=document.getElementById('spg-open-actions');var continueEl=document.getElementById('spg-open-continue');function setStatus(html){statusText.innerHTML=html;}function escapeHtml(s){return String(s).replace(/[&<>"]/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;",'\u0022':'&quot;',"'":"&#39;"})[c];});}function showError(msg){cardEl.classList.add('spg-open-card--error');setStatus('<strong>We can\\u2019t open that link.</strong><br>'+escapeHtml(msg));actionsEl.hidden=false;continueEl.hidden=true;}function showPreview(targetUrl,kind){cardEl.classList.remove('spg-open-card--error');var host='(unknown host)';try{host=new URL(targetUrl,location.href).host;}catch(e){}setStatus('<strong>'+escapeHtml(kind)+'</strong><br><span class="spg-open-url">'+escapeHtml(targetUrl)+'</span><br><small>Host: '+escapeHtml(host)+'</small>');continueEl.href=targetUrl;actionsEl.hidden=false;continueEl.hidden=false;}if(fileParam && !raw){titleEl.textContent='File ready to read';subEl.textContent='A file from another app was opened with Stuff Pretty Good. Read it below, then decide what to do next.';cardEl.classList.remove('spg-open-card--error');setStatus('<strong>File: '+escapeHtml(decodeURIComponent(fileParam))+'</strong><br><small>Open this file in the AI companion to extract product names, prices, or reviews.</small>');actionsEl.hidden=false;continueEl.href='/';continueEl.textContent='Open in AI companion';continueEl.hidden=false;return;}if(!raw){titleEl.textContent='Open a Stuff Pretty Good link';subEl.textContent='No link was attached. Use one of the buttons below, or share a web+spg:// link into this device.';cardEl.classList.add('spg-open-card--info');setStatus('No <code>?u=</code> parameter found.');actionsEl.hidden=false;continueEl.hidden=true;return;}var normalized=raw.trim();if(/^(javascript|data|vbscript|file|blob|about):/i.test(normalized)){showError('That link uses a scheme ('+normalized.split(':')[0].toLowerCase()+':) we don\u2019t open from this page. Only http, https, and web+spg links are accepted.');return;}var parsed;try{parsed=new URL(normalized,'https://stuffprettygood.local/');}catch(e){showError('That isn\u2019t a valid URL. Check the link and try again.');return;}if(parsed.protocol==='http:'||parsed.protocol==='https:'){var host=parsed.hostname.toLowerCase();if(host==='stuffprettygood.com'||host==='www.stuffprettygood.com'||host==='stuffprettygood-api.mehyar.workers.dev'){var internalPath=parsed.pathname.replace(/\\/$/,'');if(/^\\/products\\/[a-z0-9-]+$/.test(internalPath)){titleEl.textContent='Opening product\u2026';setStatus('Internal Stuff Pretty Good link. Routing you to <code>'+escapeHtml(internalPath)+'</code>.');location.replace(parsed.toString());return;}if(/^\\/guides\\/[a-z0-9-]+$/.test(internalPath)){titleEl.textContent='Opening guide\u2026';setStatus('Internal Stuff Pretty Good guide. Routing you to <code>'+escapeHtml(internalPath)+'</code>.');location.replace(parsed.toString());return;}if(internalPath==='/go'){titleEl.textContent='Opening pick\u2026';setStatus('Internal Stuff Pretty Good redirect. Routing you to <code>'+escapeHtml(internalPath)+'</code>.');location.replace(parsed.toString());return;}showPreview(parsed.toString(),'Stuff Pretty Good link');return;}showPreview(parsed.toString(),'External link');return;}if(parsed.protocol==='web+spg:'){var inner=normalized.replace(/^web\\+spg:\\/\\//i,'https://stuffprettygood.com/');try{var innerParsed=new URL(inner);if(innerParsed.pathname&&innerParsed.pathname!=='/'){location.replace(innerParsed.pathname+innerParsed.search+innerParsed.hash);return;}}catch(e){}showError('That web+spg link looks malformed.');return;}showError('That link uses the '+parsed.protocol.replace(':','')+':// scheme, which we don\u2019t open from this page.');}catch(err){var card=document.getElementById('spg-open-card');if(card){card.classList.add('spg-open-card--error');document.getElementById('spg-open-status-text').textContent='Something went wrong while reading this link.';document.getElementById('spg-open-actions').hidden=false;}}})();</script>`;
mkdirPage('open', layout(pageTitle('open'), openDeepLinkBody, { route: 'open', showModal: false }, 'Open a Stuff Pretty Good deep link (web+spg://) routed from another app. We validate the URL and either route you to the right internal page or show a preview before opening an external link.'));

fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /open\nSitemap: https://stuffprettygood.com/sitemap.xml\n');
const urls = ['', 'gift-finder', 'starter-kits', 'under-25', 'under-50', 'walmart', 'stories', 'useful-finds', 'travel', 'home-office', 'kitchen', 'pets', 'tech', 'signup', 'about', 'advertise', 'affiliate-disclosure', 'privacy', 'terms', 'contact', 'unsubscribe', 'preferences', 'open', ...posts.map((p) => 'guides/' + p.slug), ...products.map((p) => 'products/' + p.id)];
const _spgBuildIso = new Date().toISOString();
const _spgSitemapEntries = urls.map((u) => {
  let _spgLastmod = _spgBuildIso;
  try { _spgLastmod = fs.statSync(path.join(dist, slugUrl(u), 'index.html')).mtime.toISOString(); } catch (_) { /* route not built — fall back to build-time ISO */ }
  return `<url><loc>https://stuffprettygood.com${slugUrl(u)}</loc><lastmod>${_spgLastmod}</lastmod></url>`;
}).join('\n');
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${_spgSitemapEntries}\n</urlset>\n`);

console.log(`built ${products.length} approved products, ${posts.length} guides`);
