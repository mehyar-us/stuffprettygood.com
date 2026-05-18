
import fs from 'fs';import path from 'path';
const data=JSON.parse(fs.readFileSync('data/products.json','utf8')).products;let bad=[];
for(const p of data){if(p.affiliate_status==='approved'&&!p.affiliate_url.includes('tag=mehyarmedia-20'))bad.push(`${p.id}: missing amazon tag`);if(p.affiliate_status!=='approved'&&p.affiliate_url)bad.push(`${p.id}: unapproved has url`)}
if(!fs.existsSync('dist/index.html')) bad.push('dist missing; run build first');
if(fs.existsSync('dist/index.html')){const html=fs.readFileSync('dist/index.html','utf8');for(const must of ['AI finds useful stuff worth buying','Approved links only','As an Amazon Associate']) if(!html.includes(must)) bad.push('homepage missing '+must)}
const productPages=fs.existsSync('dist/products')?fs.readdirSync('dist/products').length:0;if(productPages<20)bad.push('expected at least 20 product pages');
if(bad.length){console.error(bad.join('\n'));process.exit(1)}console.log(`validation passed: ${data.length} catalog records, ${productPages} product pages`);
