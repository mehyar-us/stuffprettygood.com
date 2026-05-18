import fs from 'fs';

const AMAZON_TAG = process.env.SPG_AMAZON_ASSOCIATES_TAG || process.env.AMAZON_ASSOCIATES_TAG || 'mehyarmedia-20';
const data = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
const products = data.products || [];
const approved = products.filter((p) => p.affiliate_status === 'approved' && p.approval_status === 'approved');
const failures = [];

for (const p of approved) {
  if (!p.affiliate_url || !p.affiliate_url.includes(`tag=${AMAZON_TAG}`)) failures.push(`${p.id}: missing Amazon tag`);
  if (!p.why_useful || !p.best_for || !p.avoid_if) failures.push(`${p.id}: missing curation copy`);
  if (!p.image_url || p.image_status !== 'generated_original_placeholder') failures.push(`${p.id}: unsafe/missing image status`);
}

const pending = products.filter((p) => p.affiliate_status !== 'approved' || p.approval_status !== 'approved').length;
const report = {
  checked_at: new Date().toISOString(),
  total_products: products.length,
  approved_products: approved.length,
  hidden_pending_or_unavailable: pending,
  amazon_tag_present: AMAZON_TAG,
  failures,
  next_sources_blocked_until_access: ['eBay Partner Network', 'Sovrn Commerce', 'Skimlinks', 'Walmart Affiliates', 'Awin', 'Etsy Affiliates', 'FlexOffers', 'Impact.com']
};
fs.mkdirSync('data/reports', { recursive: true });
fs.writeFileSync('data/reports/latest-offer-check.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(`daily offer check passed: ${approved.length} approved products, ${pending} hidden pending/unavailable`);
