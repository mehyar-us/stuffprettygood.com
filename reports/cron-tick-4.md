# spg-improve-loop · tick 4

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane A — Gen Z vibe via scroll-reveal motion. Add tasteful IntersectionObserver-driven fade-up across cards/story/magazine/panel surfaces, honouring `prefers-reduced-motion`, with a 1.2s safety-net so cached/offline pages still render.

⚠️ TICK 4 ITERATION-CAP FAILURE — RESOLVED IN TICK 5
Tick 4 hit the iteration budget at phase 8 (Telegram delivery), so the source change went out and the report stub was written, but commit + push + Telegram ping never landed. Tick 5 closed this: validated the source was already shipped to the production preview URL `91021f86.stuffprettygood.pages.dev`, re-deployed as `0b9cbe47`, committed tick-4 source + this report together in SHA `2d33a24`, and pushed. The original deployment was real — the iteration cap killed the contract, not the build. See `reports/cron-tick-5.md` for the full closure log.

✅ DONE (tick 4 work, finalized in tick 5):
- Added `scrollRevealScript()` to `scripts/build.mjs`: inlined IIFE with `prefers-reduced-motion` short-circuit, IntersectionObserver (`rootMargin: '0px 0px -10% 0px'`, `threshold: 0.08`), 1.2s safety-net that flips remaining `.spg-reveal` to `.spg-reveal-in`. Targets `.card, .story-card, .magazine-card, .recommendation, .panel, .signup-band, .lanes a, .guide-list a, .hero-stack, .hero-card, .hero-copy, .decision-boxes div, .visual-proof`.
- Added `@keyframes spg-reveal-up` + `.spg-reveal` / `.spg-reveal-in` classes to `src/styles.css`. Mobile-fast variant under `max-width: 560px`. Respects `prefers-reduced-motion` (JS short-circuits before these apply).
- Built + deployed to production. The scroll-reveal is live on `https://0b9cbe47.stuffprettygood.pages.dev/` (the new deploy ID; old `91021f86` deploy is also live).
- Pushed the orphaned tick-3 repair commit `b75cdbd` to origin (resolved the ahead-by-N warning that was a stale `refs/remotes/origin/...` cache; remote was already at `b75cdbd69...` per `git ls-remote`; ran `git update-ref` to refresh local cache so future `git status` calls are honest).

🧪 TESTED:
- Browser QA on `91021f86.stuffprettygood.pages.dev`: `browser_console(expression=...)` showed `revealInClass: 30` after page load → script ran cleanly. 2 empty-message `exception` errors were from PRIOR scripts (Microsoft Clarity, MSC snippet), not the scroll-reveal IIFE.
- `node scripts/validate.mjs` → exit 0 (re-run in tick 5 for closure).

📊 RESULTS:
- Source change shipped: scroll-reveal fade-up via IntersectionObserver + `prefers-reduced-motion` short-circuit + 1.2s safety-net, inlined into every page.
- Deploy: wrangler ID `0b9cbe47` (re-deploy in tick 5); tick 4's deploy ID was `91021f86` — same content. Alias `https://production.stuffprettygood.pages.dev`.
- Commit (closed in tick 5): `2d33a24` on `deploy/legal-expansion-and-signup-modal`. Pushed to origin (verified via `git ls-remote`).
- Follow-up filed (tick 5): `t_98bc242f` (Medium, Visual, lane-a) — 87 of 117 candidate cards miss the reveal class because the IIFE captures `nodes` once before live-picks JS fetchers inject `<article class="card">`s.

🔗 LINKS:
- Live (eventual): https://stuffprettygood.com/?cb=$(date +%s) (custom domain may lag preview URL by 5-10 min)
- Authoritative: https://0b9cbe47.stuffprettygood.pages.dev/?cb=$(date +%s)
- Tick-5 closure log: `reports/cron-tick-5.md`
- Commit: https://github.com/mehyar-us/stuffprettygood.com/commit/2d33a24
- Ticket: kanban `t_98bc242f`

🧠 MEMORY:
- **Iteration budget can fail at the very end of a tick** (phase 8 Telegram). The skill's "durable report FIRST" pitfall #18 only helps if you actually commit the report. Tick 4 wrote the stub but never committed it, leaving it as a dangling untracked file. Tick 5's fix: write the report, then `git add reports/...` in the SAME `git add -A` that includes the source change, then a single commit. Don't split into two commits — single-commit avoids the "report committed but source not yet pushed" state.
- `pitfall #18` is now proven in both directions: writing the report first DID help tick 4 (the user got to see what tick 4 was trying to do) but it didn't help enough — committing the report FIRST is the full fix. Pattern: source change + report in same `git add -A`, single commit.
- Tick 4's deploy DID ship — the silent script failure diagnosis was wrong on closer inspection. The script ran fine (30 of 117 cards got `.spg-reveal-in`). The 87 missing cards are a separate issue (the IIFE captures nodes before live-picks fetchers inject cards) — filed as `t_98bc242f` for next Lane A tick.