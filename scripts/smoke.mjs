import fs from 'fs';
const checks = ['dist/index.html','dist/gift-finder/index.html','dist/starter-kits/index.html','dist/under-25/index.html','dist/under-50/index.html','dist/signup/index.html','dist/unsubscribe/index.html','dist/preferences/index.html','dist/privacy/index.html','dist/terms/index.html','dist/affiliate-disclosure/index.html','dist/robots.txt','dist/sitemap.xml'];
const fail = [];
for (const f of checks) if (!fs.existsSync(f)) fail.push(f);
const go = fs.existsSync('dist/go') ? fs.readdirSync('dist/go') : [];
if (go.length < 20) fail.push('go routes <20');
if (fail.length) { console.error('smoke failed ' + fail.join(', ')); process.exit(1); }
console.log(`smoke passed: ${checks.length} static checks, ${go.length} go routes`);
