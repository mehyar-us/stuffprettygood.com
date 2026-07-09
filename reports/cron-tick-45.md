# spg-improve-loop · tick 45

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane B "HTML meta extension" pattern family #2 — site-wide `<meta name="format-detection">` to suppress iOS Safari auto-linking phone numbers / emails / dates / addresses.
✅ DONE:
- Added `<meta name="format-detection" content="telephone=no,email=no,address=no,date=no">` to the layout template at scripts/build.mjs:1047 (single-line head template).
- One-line diff: +1 / -0 in scripts/build.mjs; 188 non-/go/ dist HTML files now carry the tag.
- Validated: `node --check scripts/build.mjs` exit 0; `node scripts/validate.mjs` → 155 catalog records, 155 product pages; `node scripts/build.mjs` → built 155 approved products, 10 guides.
🧪 TESTED:
- Python walker: 188/188 non-/go/ pages have `name="format-detection"`, 0 missing.
- Live preview `https://8808be03.stuffprettygood.pages.dev/` returns exactly one `<meta name="format-detection" content="telephone=no,email=no,address=no,date=no">` line in the served HTML.
📊 RESULTS:
- Commit SHA: c6d774d (push verified per pitfall #47 ground-truth recipe: `git ls-remote` SHA == `git rev-parse HEAD` SHA)
- CF deploy: 8808be03.stuffprettygood.pages.dev (production alias: production.stuffprettygood.pages.dev)
- Diff size: 191 files / +212/-190 (scripts/build.mjs + 188 dist/index.html under non-/go/ routes — every static page regenerated; per pitfall #52 used `git add -f dist/`).
- 2nd entry in the Lane B "HTML meta extension" pattern family (after Twitter Card metadata tick 44). Pattern index at end of report.
🔗 LINKS:
- Live custom-domain (cache-busted): https://stuffprettygood.com/?cb=$(date +%s)
- Preview URL (authoritative per pitfall #33/#72/#76): https://8808be03.stuffprettygood.pages.dev/
- Commit: c6d774d (https://github.com/mehyar-us/stuffprettygood.com/commit/c6d774d)
- Deploy: https://8808be03.stuffprettygood.pages.dev
🧠 MEMORY: Lane B pattern family extends with `format-detection` (1 line in the layout template at scripts/build.mjs:1047 — same place as theme-color/mobile-web-app-capable block). Diff is intentionally minimal (+1/-0). Future Lane B candidates: `apple-itunes-app` (skipped — no iOS app yet), `article:author` / `article:published_time` (would need per-page threading), per-page `theme-color` overrides. Browser QA was a no-op (format-detection only surfaces in iOS Safari Mobile Safari Mail-style contexts).
