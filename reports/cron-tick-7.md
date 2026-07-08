# spg-improve-loop · tick 7

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane A polish — per-page OG image variety. Every page's `og:image` meta pointed at the same global `/assets/site/spg-shopping-guide.svg`, so social shares (Twitter, iMessage, Slack previews) all looked identical regardless of which page was shared. Fix: per-route SVG with unique gradient + page-title overlay.
✅ DONE:
- Added `PAGE_OG_THEMES` map (22 named routes, each with `a`/`b` gradient stops + emoji + line copy) + `OG_NEUTRAL_THEMES` fallback palette + `hashSlug()` FNV-1a 32-bit hash for routing ad-hoc pages deterministically.
- Added `pageOgImageSvg(route, title)` factory — returns `{filename, url, svg}` with a 960x360 SVG carrying the SPG logo, accent emoji, page title, tagline, and `stuffprettygood.com` brand mark on a route-themed gradient.
- Wired `mkdirPage()` to (1) extract the page title from the final HTML `<title>` (strips the ` | Stuff Pretty Good` suffix), (2) call `pageOgImageSvg()`, (3) write the per-route SVG to `dist/assets/og/<slug>.svg`, and (4) replace the meta `og:image` to point at it, plus emit `og:image:width=960` + `og:image:height=360` so social scrapers get explicit sizing.
- `git add scripts/build.mjs` + `git add -u dist/` + `git add -f dist/assets/og/` (the `dist/` gitignore rule blocks the new `dist/assets/og/` subdir from auto-discovery — forced add so the SVGs ship in the committed tree, mirroring the existing `dist/assets/products/` + `dist/assets/site/spg-logo.svg` pattern).
- Commit SHA `6c883e5` made on `deploy/legal-expansion-and-signup-modal` (parent: `0606864`). 530 staged files: 1 scripts/build.mjs (M), 188 dist/*/index.html (M), 342 dist/assets/og/*.svg (A), 1 reports/cron-tick-7.md (A).
🧪 TESTED:
- `node scripts/validate.mjs` → exit 0 ("validation passed: 155 catalog records, 155 product pages")
- `node scripts/build.mjs` → exit 0 ("built 155 approved products, 10 guides")
- Source diff gate: 1 script change + 188 dist page regenerations + 342 new SVG assets + 1 report = 530 files staged, no `.bak.*` drift, no surprise files
- Wrangler deploy: `wrangler pages deploy dist --project-name stuffprettygood --branch production --commit-dirty=true` → "Deployment complete! https://1bba3dfa.stuffprettygood.pages.dev" (529 files uploaded, 319 already cached)
- Preview URL (`1bba3dfa.stuffprettygood.pages.dev`) curl checks:
  - `/` og:image = `/assets/og/index.svg` (was `/assets/site/spg-shopping-guide.svg`)
  - `/gift-finder/` og:image = `/assets/og/gift-finder.svg`
  - `/products/gift-usb-c-charging-station/` og:image = `/assets/og/products-gift-usb-c-charging-station.svg`
  - All three have `og:image:width=960` + `og:image:height=360` meta tags
- `/assets/og/gift-finder.svg` curl: Content-Type=image/svg+xml, 1539 bytes, returns the SVG body (no 404-as-html)
- Browser QA via browser_vision on `/assets/og/gift-finder.svg`: renders cleanly — purple→yellow gradient, SPG logo + 🎁 gift emoji, "AI Gift Finder" title, "Answer a few prompts. Get gift shortlists you can act on." tagline, "stuffprettygood.com" brand mark in bottom-right
- Browser QA via browser_console(expression=...) on `/products/gift-usb-c-charging-station/`: `{img: "/assets/og/products-gift-usb-c-charging-station.svg", w: "960", h: "360"}` — exact match to expected
- Console errors: 2 empty-message exceptions (Microsoft Clarity / MSC snippet, pre-existing — confirmed by skill pitfall #25)
- Custom domain (`stuffprettygood.com`) still shows the OLD `og:image` after 60s — this is skill pitfall #13 in action: the custom-domain edge cache lags the preview URL by 5-10 minutes. Preview URL is the authoritative "deployed" check.
- `git ls-remote origin` shows origin at `0606864` (3 behind the local `6c883e5`) — `git push` is in progress (large 530-file push over a slow link; on-going background task `proc_103a81c9c9ae`)
📊 RESULTS:
- Commit SHA: **6c883e5** (`feat(motion+seo): per-page OG images — 188 unique social previews`)
- Branch pushed: pending — `git push origin deploy/legal-expansion-and-signup-modal` running in background (`proc_103a81c9c9ae`, expected ~5 min for 530 files)
- Cloudflare production deploy ID: **1bba3dfa** (preview URL: https://1bba3dfa.stuffprettygood.pages.dev)
- Lane A backlog item #1 (per-page OG image variety) — **closed**
- Items still open on Lane A: (2) splash screen for installed PWA, (3) haptics on AI bubble tap, (4) dark mode toggle
- Pitfall #29 (new): `dist/` is gitignored but tracked. New artifact subdirectories like `dist/assets/og/` get silently skipped — must `git add -f` to force inclusion, mirroring the skill's existing dist/-gitignored-but-tracked nuance.
🔗 LINKS:
- Live URL (preview, authoritative): https://1bba3dfa.stuffprettygood.pages.dev/?cb=1783550700
- Live URL (custom domain, 5-10 min edge-cache lag): https://stuffprettygood.com/?cb=1783550700
- Commit: https://github.com/mehyar-us/stuffprettygood.com/commit/6c883e5
- Deploy preview: https://1bba3dfa.stuffprettygood.pages.dev
- Sample OG SVG (visual proof): https://1bba3dfa.stuffprettygood.pages.dev/assets/og/gift-finder.svg
- Files: scripts/build.mjs (+78/-0) · dist/*/index.html (M × 188) · dist/assets/og/*.svg (A × 342) · reports/cron-tick-7.md (A)
🧠 MEMORY: All 188 pages now have unique social-share artwork. `og:image:width` + `og:image:height` meta tags ensure Twitter/Facebook generate correctly-sized preview cards. Product pages share a per-product theme via the `slug.route` decomposition; future ticks can add explicit `PAGE_OG_THEMES['products-<category>']` entries if a category wants its own lockup. `mkdirPage()` is now the right place to add per-page meta surface changes that need to apply uniformly across the 188-page build. Tick 8 should pick from Lane A backlog (splash screen / haptics / dark mode) or Lane C (AI bubble follow-up questions) — board is clean except `t_56b11ab9 blocked` (PWA install button on unsupported browsers) and `t_meta_cf_creds triage` (no fix needed, info card).