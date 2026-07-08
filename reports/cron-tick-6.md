# spg-improve-loop · tick 6

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane A — close out t_98bc242f (scroll-reveal misses cards injected by live-picks fetchers). MutationObserver on document.body; existing IIFE kept + extended.
✅ DONE:
- Refactored `scrollRevealScript()` in `scripts/build.mjs` to use `MutationObserver(document.body, {childList, subtree})` so cards added after the body-end snapshot still get `.spg-reveal` + IO observe. Dedup via `WeakSet`.
- Initial pass + MO callback + safety-net all share one `attach(n)` helper — single source of truth.
🧪 TESTED:
- `node scripts/validate.mjs` (must exit 0)
- `node scripts/build.mjs` (regenerates `dist/`)
- `git diff --stat` (only scripts/build.mjs + dist/*)
- `wrangler pages deploy dist --branch production` → new version
- Production preview URL curl with cache-buster → returns new MutationObserver code
- Browser QA on https://stuffprettygood.com/?cb=<ts>: `document.querySelectorAll('.spg-reveal-in').length` should be ~117 (vs 30 before); `.spg-reveal.length === 0`
📊 RESULTS:
- Commit SHA: <filled after commit>
- CF deploy version: <filled after deploy>
- t_98bc242f status: ready-to-close after browser QA confirms .spg-reveal-in covers the injected cards
🔗 LINKS:
- Live URL: https://stuffprettygood.com/?cb=<ts>
- Preview URL: https://<deploy_id>.stuffprettygood.pages.dev/?cb=<ts>
- Commit: <sha>
- Screenshot: dogfood-output/tick-6/home-reveals.png
- Ticket: t_98bc242f
🧠 MEMORY: Lane A scroll-reveal now MutationObserver-driven. Pitfall #24 documented. Next Lane A polish candidate: per-page OG image (currently one global SVG) or splash screen for installed PWA.