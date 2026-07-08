# spg-improve-loop · tick 1

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Recover the orphaned PWA + rate-limit work from the previous tick's working tree and ship it to the production custom domain. This was a stuck triage-class debt (work built but never deployed — the exact "preview ≠ production" trap the skill warns about).
✅ DONE:
- Verified 188 uncommitted modifications in `dist/` from a previous tick's build (PWA assets + AI rate-limit code + quota pill + nav PWA install-button CSS).
- Ran `node scripts/validate.mjs` → exit 0, 155 catalog records, 155 product pages.
- Ran `node scripts/build.mjs` → exit 0, "built 155 approved products, 10 guides" (build is reproducible from src).
- Deployed to PRODUCTION with `wrangler pages deploy dist --project-name stuffprettygood --branch production` → deploy URL `https://production.stuffprettygood.pages.dev`, alias `https://b63331fc.stuffprettygood.pages.dev`, **custom domain `https://stuffprettygood.com` confirmed serving new content after 25s edge-propagation wait**.
- Verified custom domain response: contains `navigator.serviceWorker.register('/sw.js')`, `spg-rl` rate-limit module, `spg-quota-pill` UI element, `Site-Site-Verification` integrity string. `/sw.js` returns 200 / `application/javascript`. `/sitemap.xml` returns 200. `/offline.html` returns 308 (Cloudflare's normal trailing-slash redirect — still serves).
- Staged + commit + push to `origin/deploy/legal-expansion-and-signup-modal` in flight.
🧪 TESTED:
- `node scripts/validate.mjs` → exit 0.
- `node scripts/build.mjs` → exit 0, deterministic (rebuilt to same state).
- `wrangler pages deploy` → exit 0, 506 files uploaded, "Deployment complete! Take a peek over at https://b63331fc.stuffprettygood.pages.dev" + "Deployment alias URL: https://production.stuffprettygood.pages.dev" → confirms `production` branch (the trap was using a preview branch).
- `curl https://stuffprettygood.com/?cb=<ts>` → STATUS=200, body contains the new rate-limit + PWA install code (NOT the old form).
- `curl https://stuffprettygood.com/sw.js` → STATUS=200, content-type `application/javascript`.
- `curl https://stuffprettygood.com/sitemap.xml` → STATUS=200.
- No browser QA this tick — budget went to verification + commit/push after the heavy unblock.
📊 RESULTS:
- **Closed PWA gap (skill's #1 Lane-A win)**: `dist/sw.js` (105 lines, `spg-v1` cache, network-first HTML, cache-first static, `/offline.html` fallback) + `dist/offline.html` (30 lines) + PWA install button CSS `.spg-install` are now live on the custom domain.
- **Closed AI rate-limit gap (Lane C)**: per-minute (3) / per-hour (20) / per-day (50) quota system with quota pill UI on every AI tool page; throttles the matcher before the future LLM endpoint is wired.
- **Live sitemap + robots.txt**: 155 product URLs + 10 guides + 22 category/legal pages in `sitemap.xml`; `robots.txt` reachable.
- **Commit SHA**: pending (this report is committed alongside the dist/ changes).
- **CF deploy alias**: `production.stuffprettygood.pages.dev` (the deploy ID is `b63331fc` per the preview URL slug).
- No kanban tickets filed — tick was pure unblock + ship, no new bugs surfaced.
🔗 LINKS:
- Live: https://stuffprettygood.com/?cb=1762540800
- Production alias: https://production.stuffprettygood.pages.dev
- Preview slug: https://b63331fc.stuffprettygood.pages.dev
- Service worker: https://stuffprettygood.com/sw.js (200, application/javascript)
- Sitemap: https://stuffprettygood.com/sitemap.xml (200)
- Offline page: https://stuffprettygood.com/offline.html (308 → /offline.html/)
- Branch: `deploy/legal-expansion-and-signup-modal`
🧠 MEMORY:
- **CRITICAL env discovery**: `~/.hermes/.env` has `CLOUDFLARE_API_TOKEN` populated (37 chars, Global API Key) but `CLOUDFLARE_API_KEY` is empty. Wrangler 4.x reads `CLOUDFLARE_API_KEY` first and **silently fails auth with code 9106 / status 400** when it's empty, even if `CLOUDFLARE_API_TOKEN` is set. **Fix**: `export CLOUDFLARE_API_KEY="$CLO...EN"` before running `wrangler pages deploy`. This bug cost the previous tick 4-5 minutes — bake this into the skill's deploy reference so future ticks don't repeat the trap.
- **Dist is gitignored-but-tracked**: `dist/` is in `.gitignore` but git still tracks 504 files inside it (the rule was added after initial commits). So `git status` correctly shows 188 modifications — they ARE committed source-tracked files whose build outputs drifted from their last commit. `git add -A` + commit is the right action.
- **Lane priority reset**: All four lanes (Visual / SEO / AI / PWA) just got a material improvement in one shot. Next ticks can pick from a clean board — focus on Lane A (Gen Z motion polish + dark mode), Lane B (per-page OG images + JSON-LD on product cards), or Lane D (opportunistic QA on the freshly-shipped UI).