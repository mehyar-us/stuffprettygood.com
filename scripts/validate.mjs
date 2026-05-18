import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/products.json', 'utf8')).products;
const bad = [];
for (const p of data) {
  if (p.affiliate_status === 'approved' && !p.affiliate_url.includes('tag=mehyarmedia-20')) bad.push(`${p.id}: missing amazon tag`);
  if (p.affiliate_status !== 'approved' && p.affiliate_url) bad.push(`${p.id}: unapproved has url`);
  if (p.affiliate_status === 'approved' && p.image_status !== 'generated_original_placeholder') bad.push(`${p.id}: unsafe image status`);
}
if (!fs.existsSync('dist/index.html')) bad.push('dist missing; run build first');
if (fs.existsSync('dist/index.html')) {
  const html = fs.readFileSync('dist/index.html', 'utf8');
  for (const must of ['Useful stuff worth buying', 'Shop useful picks first', 'Curated Walmart finds from the approved catalog', '/signup/']) {
    if (!html.includes(must)) bad.push('homepage missing ' + must);
  }
  for (const ugly of ['affiliate_status=approvedtag=mehyarmedia-20', 'no scraped Amazon metadata????', 'Disclosure: paid links may earn us a commission at no extra cost to you', 'Some links are paid links. If you buy through them', 'Approved links only, explained plainly', 'As an Amazon Associate']) {
    if (html.includes(ugly)) bad.push('homepage still has ugly implementation text: ' + ugly);
  }
}
for (const page of ['signup', 'unsubscribe', 'preferences', 'privacy', 'terms', 'contact']) {
  if (!fs.existsSync(`dist/${page}/index.html`)) bad.push(`${page} page missing`);
}

const htmlPages = [];
function collectHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) collectHtml(file);
    else if (entry.name === 'index.html') htmlPages.push(file);
  }
}
if (fs.existsSync('dist')) collectHtml('dist');
for (const page of htmlPages) {
  const html = fs.readFileSync(page, 'utf8');
  if (!html.includes('<img ')) bad.push(`${page}: missing visible image`);
  const anchors = html.match(/<a\b[^>]*>/g) || [];
  for (const a of anchors) {
    const href = (a.match(/\shref=["']([^"']+)["']/) || [])[1] || '';
    const outboundIntent = /^(?:https?:\/\/(?:www\.)?stuffprettygood\.com)?\/go\//i.test(href) || /^https?:\/\/stuffprettygood-api\.mehyar\.workers\.dev\/go\//i.test(href);
    const isExternal = outboundIntent || (/^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?stuffprettygood\.com\b/i.test(href) && !/^https?:\/\/stuffprettygood-api\.mehyar\.workers\.dev\b/i.test(href));
    if (isExternal && !/target=["']_blank["']/.test(a)) bad.push(`${page}: outbound/external anchor missing target _blank: ${a.slice(0, 100)}`);
    if (!isExternal && /target=["']_blank["']/.test(a)) bad.push(`${page}: internal anchor should navigate in-page: ${a.slice(0, 100)}`);
  }
  if (!html.includes('class="back-top"')) bad.push(`${page}: missing floating back-to-top link`);
}

const productPages = fs.existsSync('dist/products') ? fs.readdirSync('dist/products').length : 0;
if (productPages < 20) bad.push('expected at least 20 product pages');
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`validation passed: ${data.length} catalog records, ${productPages} product pages`);
