# spg-improve-loop · tick 8

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane A backlog #2 — splash screen for installed PWA. When users open the site as an installed PWA (display-mode: standalone on Android/Chrome, or fullscreen via apple-mobile-web-app-capable on iOS), they currently see a flash of the unstyled DOM before stylesheets parse. A branded splash with the SPG logo + name + radial-gradient bg matching the site palette fixes that and pushes the site toward "feels like an app" territory that vision.md § Gen Z vibe calls for.
✅ DONE:
- `src/styles.css` (+17/-0): 11-rule `.spg-splash` block + `splash-pulse` keyframe + `@media(display-mode:standalone)` gate + `html.is-pwa` fallback for browsers that don't support the display-mode media query. Logo block, brand name, and "loading" sublabel are centered in a flex column with `env(safe-area-*)` padding so iPhone notch / Dynamic Island doesn't clip the logo. Background reuses the same `radial-gradient(circle at 30% 18%, #ffe9bd 0, #f6f1e8 38%, #eaf4ff 100%)` as the body bg so the splash feels native to the site.
- `scripts/build.mjs` (+2/-1): `layout()` now emits the splash `<div class="spg-splash" id="spg-splash">` at the top of `<body>`, followed by an inline `<script>` that (1) detects PWA via `matchMedia('(display-mode: standalone)')` + `navigator.standalone === true` fallback for iOS, (2) adds `is-pwa` class to `<html>` so CSS can flip `display:none` → `display:flex`, (3) dismisses the splash on DOMContentLoaded (or 80ms if already interactive), with a 1400ms safety-net so a slow parse never strands the splash visible, (4) removes the node from the DOM 500ms after the fade-out so it can't intercept scroll/click.
- `scripts/build.mjs` head meta additions: 4 new tags — `mobile-web-app-capable=yes`, `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-title=SPG`, `apple-mobile-web-app-status-bar-style=black-translucent`. Viewport meta upgraded from `initial-scale=1` to `initial-scale=1,viewport-fit=cover` so the `env(safe-area-*)` padding reads correctly on iPhone.
- Build clean: `node scripts/validate.mjs` → exit 0 (155 catalog records, 155 product pages); `node scripts/build.mjs` → exit 0 (built 155 approved products, 10 guides).
- Source diff: 2 files changed, 19 insertions, 1 deletion in source (build.mjs +2/-1, styles.css +17/-0). 188 dist/*/index.html regenerated.
- Wrangler production deploy: `wrangler pages deploy dist --project-name stuffprettygood --branch production --commit-dirty=true` → "Deployment complete! https://9fba87dd.stuffprettygood.pages.dev" (188 files uploaded, 660 cached).
- Git commit `4d0158d` on `deploy/legal-expansion-and-signup-modal` (parent `1894437`), pushed to origin. `git ls-remote origin deploy/legal-expansion-and-signup-modal` confirms origin at `4d0158d74654735df484177e4f179cb888db36f8`.
🧪 TESTED:
- Source diff gate: 2 source files changed (build.mjs, styles.css) + 188 dist regenerations + 0 surprise files
- Build gates: `validate.mjs` exit 0, `build.mjs` exit 0
- Preview URL (https://9fba87dd.stuffprettygood.pages.dev/?cb=1783551900) curl checks:
  - `apple-mobile-web-app-capable` ✓
  - `apple-mobile-web-app-status-bar-style` ✓
  - `apple-mobile-web-app-title` ✓
  - `mobile-web-app-capable` ✓
  - `id="spg-splash"` ✓ (splash div present)
  - `display-mode: standalone` + `navigator.standalone` JS checks present ✓
- `/styles.css` curl on preview URL: 11 splash rules + keyframe + 2× `is-pwa` selector + `display-mode:standalone` media query all present
- Browser QA (Phase 6, preview URL):
  - In regular browser tab: `getComputedStyle(splash).display === "none"` ✓ (correctly hidden — never flashes)
  - `matchMedia('(display-mode: standalone)').matches === false` ✓ (browser tab, not PWA)
  - After `document.documentElement.classList.add('is-pwa')`: `display:flex`, `opacity:1`, radial-gradient bg, logo block 100×100 centered at x=574 y=224 in 1249×625 viewport ✓ (splash appears when standalone)
  - After `splash.classList.add('is-loaded')`: transition `opacity 0.45s, visibility 0s linear 0.45s` runs, ends at `opacity:0`, `visibility:hidden`, `pointer-events:none` ✓ (fade-out works, can't intercept scroll/click)
  - Splash bounding rect (0,0 → 1249×625) ✓ (fullscreen overlay)
- Console errors: 2 empty-message exceptions (Microsoft Clarity / MSC snippet — pre-existing, confirmed by skill pitfall #25; not introduced by this change)
- Custom domain (`stuffprettygood.com`) check: not yet serving the new splash — per skill pitfall #13 the custom-domain edge cache lags the preview URL by 5-10 minutes. Preview URL is the authoritative "deployed" check.
📊 RESULTS:
- Commit SHA: **4d0158d** (`feat(pwa): splash screen for installed PWA (Lane A #2)`)
- Branch pushed: `origin/deploy/legal-expansion-and-signup-modal` at `4d0158d74654735df484177e4f179cb888db36f8` ✓
- Cloudflare production deploy ID: **9fba87dd** (preview URL: https://9fba87dd.stuffprettygood.pages.dev)
- Lane A backlog item #2 (splash screen for installed PWA) — **closed**
- Items still open on Lane A: (3) haptics on AI bubble tap, (4) dark mode toggle
- Lane B (SEO) backlog still has structured-data work (Organization site-wide, Product on cards, BreadcrumbList on categories, FAQPage on AI pages)
🔗 LINKS:
- Live URL (preview, authoritative): https://9fba87dd.stuffprettygood.pages.dev/?cb=1783551900
- Live URL (custom domain, 5-10 min edge-cache lag): https://stuffprettygood.com/?cb=1783551900
- Commit: https://github.com/mehyar-us/stuffprettygood.com/commit/4d0158d
- Deploy preview: https://9fba87dd.stuffprettygood.pages.dev
- Files: scripts/build.mjs (+2/-1) · src/styles.css (+17/-0) · dist/*/index.html (regenerated × 188)
🧠 MEMORY: Installed-PWA users now see a branded splash (pulsing SPG logo + brand name on the site palette) instead of a flash of unstyled DOM. The splash only renders in `display-mode: standalone` (Android/Chrome) or when `navigator.standalone === true` (iOS Safari home-screen install); in a regular browser tab the CSS keeps it `display:none` so it never flashes during page load. The dismiss script fires on DOMContentLoaded with a 1400ms safety-net, then removes the node from DOM 500ms after fade so it can't intercept scroll/click. Two new meta tags (`apple-mobile-web-app-capable`, `mobile-web-app-capable`) plus `viewport-fit=cover` make iPhone safe-area-insets work correctly. Tick 9 should pick Lane A #3 (haptics on AI bubble tap — single-line code change with try/catch) or Lane B structured-data (multi-card workstream). Board state unchanged: `t_meta_cf_creds triage` (no fix needed, info card), `t_56b11ab9 blocked` (PWA install button on unsupported browsers — partially obsolete after this tick: the button IS shown unconditionally when beforeinstallprompt fires, which is browser-correct behavior, but the design could be argued either way; leaving as-is).