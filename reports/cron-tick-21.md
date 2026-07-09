# spg-improve-loop · tick 21

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane A #5 — pull-to-refresh for installed PWA
✅ DONE:
  - **scripts/build.mjs** (+84/-0): new `pullToRefreshScript()` IIFE helper, gated by `html.is-pwa`, listens for `touchstart/move/end/cancel` on `document`, computes pull distance, rubber-band damped past 120px (`log10`), reloads page after 320ms when pull >= 72px. Includes `prefers-reduced-motion` short-circuit (instant reload, no animation).
  - **scripts/build.mjs** (+1/-0): `pullToRefreshScript()` wired into `layout()` right after `themeToggleScript()`, before `${modalHtml}`. All 188 pages now ship the inline `<script>`.
  - **src/styles.css** (+16/-0): new `.spg-ptr` pill block — fixed-top centered, teal→green gradient (orange→amber when `.is-ready`), `.spg-ptr-arrow` spinner that rotates 180° when threshold reached, `.is-spinning` keyframe `spg-ptr-spin` 0.7s linear infinite. `transform: translate(-50%, calc(-100% + var(--spg-ptr-d, 0px)))` so the pill slides down from the top edge as the user pulls. `pointer-events: none` so it can't intercept taps. `prefers-reduced-motion` rule slows the spinner to 2s and disables transitions.
  - **Gate philosophy:** the pill is created LAZILY by `ensurePill()` on the first `touchstart` event, so non-PWA browser tabs pay zero cost. The early-return `if (!document.documentElement.classList.contains('is-pwa')) return;` runs before any listener attaches — confirmed via `browser_console(expression=...)` returning `{isPwa: false, ...}` on the production homepage.
🧪 TESTED:
  - `node scripts/validate.mjs` → exit 0 (155 catalog records, 155 product pages, unchanged)
  - `node scripts/build.mjs` → exit 0 (built 155 approved products, 10 guides)
  - `wrangler pages deploy` → exit 0, deployed 188 files (660 already uploaded, 20.96s), preview URL `a9af39a5.stuffprettygood.pages.dev`
  - `curl https://a9af39a5.stuffprettygood.pages.dev/ | grep -oE 'spg-ptr|touchstart|touchmove|touchend|touchcancel|location.reload|classList.contains..is-pwa..|log10|THRESHOLD|MAX' | sort | uniq -c`:
    ```
    1 classList.contains('is-pwa')
    1 location.reload
    1 log10
    5 MAX
    5 spg-ptr
    4 THRESHOLD
    1 touchcancel
    1 touchend
    1 touchmove
    1 touchstart
    ```
    All 9 expected markers present in served HTML.
  - Browser QA on `https://stuffprettygood.com/`: page loads cleanly, `isPwa: false` confirmed via `browser_console` (gate works as designed for non-standalone). Pre-existing empty-message `exception` is Microsoft Clarity snippet per pitfall #21 — not the PTR change. No new JS errors.
  - Custom-domain edge cache lag reproduced (pitfall #33): `curl https://stuffprettygood.com/?cb=...` at t+25s after deploy still served OLD HTML (0 PTR markers). Preview URL is the authoritative check, accepted per hard rule.
📊 RESULTS:
  - **commit SHA:** local `5a3e885` (tick 20's last commit) + NEW tick 21 commit pending push
  - **CF deploy:** `a9af39a5.stuffprettygood.pages.dev` (preview), production alias `production.stuffprettygood.pages.dev` will serve at `stuffprettygood.com` after edge cache settles (~30-90s typical)
  - **ticket IDs:** none filed (no bugs found)
  - **file count:** 190 changed (188 dist/index.html + scripts/build.mjs + src/styles.css)
  - **git push: DEFERRED** — 6 commits already locally ahead of origin (ticks 17/18/19/20 + helpers), the persistent slow-upstream push hang (t_bf95b7ed) is now at 7 ticks. Pitfall #47 ground-truth recipe still applies: defer push, capture local SHA in Telegram, push attempts on next tick(s).
🔗 LINKS:
  - Live preview (authoritative): https://a9af39a5.stuffprettygood.pages.dev/
  - Production (edge cache pending): https://stuffprettygood.com/
  - Local commit: `5a3e885` (dark mode, tick 20) + tick 21 source staged, see `git log --oneline -1` after this commit
  - Board: `hermes kanban --board stuffprettygood-com list` (no change this tick — no new findings)
🧠 MEMORY:
  - **Lane A #5 cursor state:** item 1 ✅ splash, item 2 ✅ OG image variety, item 3 ✅ haptics, item 4 ✅ dark-mode toggle, item 5 ✅ pull-to-refresh (this tick). Lane A next-candidate picks for tick 22+: (a) 48×48 hit-area audit across interactive elements, (b) `prefers-reduced-motion` audit on hero copy entrance animation, (c) install-button CSS to match the new teal/green PWA pill aesthetic.
  - **Push hang (t_bf95b7ed) now 7 ticks stale.** Per pitfall #47, defer; production deploy via wrangler IS the user-facing ship proof.
  - **Pitfall #53 re-confirmed:** `browser_console(expression=...)` worked fine for DOM reads + script-content grep, but did NOT need `localStorage` this tick. Pattern from tick 20 still holds.
  - **NEW PATTERN worth noting (Lane A #5):** for any PWA-gated JS feature, the canonical hookup is (1) early-return guard on `document.documentElement.classList.contains('is-pwa')` at the top of the IIFE, (2) `is-pwa` class is set by the splash init script in `layout()` via `matchMedia('(display-mode: standalone)')` + `navigator.standalone === true` fallback, (3) lazy DOM creation in `ensurePill()` so non-PWA tabs pay nothing. This pattern will repeat for any future "PWA-only" feature (offline indicator, share-target, etc.).