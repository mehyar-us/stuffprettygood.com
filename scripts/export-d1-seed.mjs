import fs from 'fs';
import path from 'path';

const outArg = process.argv.find((arg) => arg.startsWith('--out='));
const outPath = outArg ? outArg.split('=').slice(1).join('=') : null;
const data = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
const merchants = data.merchants || [];
const products = data.products || [];

function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

const lines = [
  '-- Product catalog refresh only. Do not delete subscribers, clicks, or recommendation sessions.',
  'DELETE FROM products;',
  'DELETE FROM merchants;'
];

for (const m of merchants) {
  lines.push(`INSERT INTO merchants (id,name,network,approval_status,allowed_channels,notes) VALUES (${sql(m.id)},${sql(m.name)},${sql(m.network)},${sql(m.approval_status)},${sql((m.allowed_channels || []).join(','))},${sql(m.notes || '')});`);
}
for (const p of products) {
  if (p.affiliate_status !== 'approved' || p.approval_status !== 'approved') continue;
  lines.push(`INSERT INTO products (id,merchant_id,title,category,price_band,affiliate_url,image_url,why_useful,best_for,avoid_if,affiliate_status,approval_status,created_at) VALUES (${sql(p.id)},${sql(p.merchant_id)},${sql(p.title)},${sql(p.category)},${sql(p.price_band)},${sql(p.affiliate_url)},${sql(p.image_url)},${sql(p.why_useful)},${sql(p.best_for)},${sql(p.avoid_if)},${sql(p.affiliate_status)},${sql(p.approval_status)},${sql(p.created_at)});`);
}
const output = `${lines.join('\n')}\n`;
if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output);
  console.log(`exported ${products.length} products to ${outPath}`);
} else {
  process.stdout.write(output);
}
