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
  for (const must of ['Useful stuff worth buying', 'Approved links only, explained plainly', 'As an Amazon Associate', '/signup/']) {
    if (!html.includes(must)) bad.push('homepage missing ' + must);
  }
  for (const ugly of ['affiliate_status=approvedtag=mehyarmedia-20', 'no scraped Amazon metadata????']) {
    if (html.includes(ugly)) bad.push('homepage still has ugly implementation text: ' + ugly);
  }
}
for (const page of ['signup', 'unsubscribe', 'preferences', 'privacy', 'terms', 'contact']) {
  if (!fs.existsSync(`dist/${page}/index.html`)) bad.push(`${page} page missing`);
}
const productPages = fs.existsSync('dist/products') ? fs.readdirSync('dist/products').length : 0;
if (productPages < 20) bad.push('expected at least 20 product pages');
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`validation passed: ${data.length} catalog records, ${productPages} product pages`);
