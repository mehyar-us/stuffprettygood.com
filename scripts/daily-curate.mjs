import fs from 'fs';
import path from 'path';

const AMAZON_TAG = process.env.SPG_AMAZON_ASSOCIATES_TAG || process.env.AMAZON_ASSOCIATES_TAG || 'mehyarmedia-20';
const countArg = process.argv.find((arg) => arg.startsWith('--count='));
const requestedCount = countArg ? Number(countArg.split('=')[1]) : 5;
const dryRun = process.argv.includes('--dry-run');
const root = process.cwd();
const productsPath = path.join(root, 'data/products.json');
const backlogPath = path.join(root, 'data/curation-backlog.json');
const reportPath = path.join(root, 'data/reports/latest-curation-run.json');

const data = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
const backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
const products = data.products || [];
const existingIds = new Set(products.map((p) => p.id));
const existingTitles = new Set(products.map((p) => normalize(p.title)));
const failures = [];

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}
function amazonSearchUrl(search) {
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', search);
  url.searchParams.set('tag', AMAZON_TAG);
  return url.toString().replace(/%20/g, '+');
}
function productFromIdea(idea) {
  const idBase = slugify(`${idea.category}-${idea.title}`);
  let id = idBase;
  let suffix = 2;
  while (existingIds.has(id)) id = `${idBase}-${suffix++}`;
  return {
    id,
    merchant_id: 'amazon',
    title: idea.title,
    category: idea.category,
    price_band: idea.price_band,
    affiliate_status: 'approved',
    approval_status: 'approved',
    affiliate_url: amazonSearchUrl(idea.search || idea.title),
    image_url: `/assets/products/${id}.svg`,
    image_status: 'generated_original_placeholder',
    why_useful: idea.why_useful,
    best_for: idea.best_for,
    avoid_if: idea.avoid_if,
    created_at: new Date().toISOString()
  };
}
function validateProduct(p) {
  const required = ['id','merchant_id','title','category','price_band','affiliate_url','image_url','image_status','why_useful','best_for','avoid_if'];
  for (const key of required) if (!p[key]) failures.push(`${p.id || p.title}: missing ${key}`);
  if (p.affiliate_status !== 'approved' || p.approval_status !== 'approved') failures.push(`${p.id}: not approved`);
  if (!p.affiliate_url.includes(`tag=${AMAZON_TAG}`)) failures.push(`${p.id}: missing Amazon tag`);
  if (!p.affiliate_url.startsWith('https://www.amazon.com/s?')) failures.push(`${p.id}: not an Amazon search link`);
  if (p.image_status !== 'generated_original_placeholder') failures.push(`${p.id}: unsafe image status`);
  if (/(price|rating|review|stars|discount|sale)/i.test(`${p.why_useful} ${p.best_for} ${p.avoid_if}`)) failures.push(`${p.id}: may imply scraped/volatile metadata`);
}

const candidates = [];
for (const idea of backlog.ideas || []) {
  if (existingTitles.has(normalize(idea.title))) continue;
  candidates.push(idea);
  if (candidates.length >= requestedCount) break;
}
const additions = candidates.map(productFromIdea);
for (const p of additions) validateProduct(p);

const report = {
  ran_at: new Date().toISOString(),
  mode: dryRun ? 'dry_run' : 'write',
  requested_count: requestedCount,
  added_count: additions.length,
  previous_total: products.length,
  next_total: products.length + additions.length,
  amazon_tag_key: 'SPG_AMAZON_ASSOCIATES_TAG|AMAZON_ASSOCIATES_TAG',
  image_policy: 'generated_original_placeholder until approved PA-API/SiteStripe/feed assets exist',
  added_ids: additions.map((p) => p.id),
  skipped_reason_if_zero: additions.length ? null : 'backlog exhausted or all ideas already present',
  failures
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
if (!dryRun && additions.length) {
  data.products = products.concat(additions);
  fs.writeFileSync(productsPath, `${JSON.stringify(data, null, 2)}\n`);
}
console.log(`daily curation ${dryRun ? 'dry-run ' : ''}passed: ${additions.length} additions, ${report.next_total} total`);
