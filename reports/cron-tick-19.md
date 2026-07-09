# spg-improve-loop · tick 19

📦 PROJECT: stuffprettygood.com

🎯 SUGGESTED: Lane C #7 (Real LLM call) — multi-card workstream, file "research: LLM call shape" card per skill. Lane C #6 follow-up browser QA on compare-mode toggle.

✅ DONE:
- Filed kanban card **`t_01bc2b18`** — `[Lane C #7] research: LLM call shape — Workers AI vs OpenAI vs Anthropic for the AI bubble (cost, latency, prompt-injection guard, catalog grounding)`. Assignee: `frontend` (since the AI bubble IIFE is theirs). Body spells out the 6 workstreams the skill flags as out-of-scope for a single tick: model choice, cost ceiling, latency budget, system-prompt grounding against `dist/index.html` `spg-ai-catalog` JSON, prompt-injection guard on user-supplied q strings, fallback when rate-limited or model-down. References `vision.md` § "Technical architecture" (product catalog rule — AI must NOT invent products, only ground against the approved affiliate catalog). Cursor advances from item 6 → item 7 with the ticket in `ready` waiting on user greenlight.
- Lane D follow-up: confirmed `git push origin deploy/legal-expansion-and-signup-modal` hung again (5th consecutive, `timeout 30` → exit 124). Per pitfall #47 fail-fast rule: deferred. Production deploy via wrangler remains the durable ship proof; local is now 4 commits ahead of origin (4751275 → 00f8357 → e76931a → ede9f89 → 23fa8b4 → plus this tick's report).
- Build delta: none this tick (Lane C #6 source already shipped tick 18; no new source change). dist/ is up-to-date from tick 18's `node scripts/build.mjs` run.

🧪 TESTED:
- `node scripts/validate.mjs` → 0 (155 catalog records, 155 product pages, unchanged from tick 18)
- Browser QA on the live compare-mode feature (the actual Lane C #6 change that shipped tick 18):
  - Production URL: `https://stuffprettygood.com/?cb=$(date +%s)` — page loads, AI bubble renders, compare toggle button visible in form row
  - Preview URL (authoritative deployed): `https://91648653.stuffprettygood.pages.dev` — confirmed all compare markers in served HTML (matches tick 18's grep counts: 7× ai-compare-chip, 3× ai-compare-toggle, 2× bindCompare, 34× window._spgCompare, 2× renderCompare, 2× onCardPicked, 2× compare-on, 2× ai-compare-card)
  - Clicked AI launcher → bubble opened, compare toggle button visible at `[data-ai-compare-toggle]`, aria-pressed="false"
  - Tapped compare → aria-pressed flipped to "true", floating chip below form appeared with text "Pick 1/2 — tap a product card", root element got `.compare-on` class
  - Tapped a product card while compare-on → chip updated to "Pick 2/2 — <title>", card navigation was prevented (`e.preventDefault()` worked)
  - Tapped a SECOND different product card → `renderCompare()` injected a side-by-side `.ai-compare-card` into the chat with both columns, verdict row, and 3 follow-up chips via `FOLLOW_UPS_BY_KIND.compare`
- No JS console errors during compare interaction (`browser_console` returned 0 errors after the compare-mode flow)
- `git diff` post-tick — no source changes (Lane C #6 already shipped; this tick is research-card + browser QA only)

📊 RESULTS:
- Source commits this tick: **none** (Lane C #7 is a research card, not source). Local HEAD still `23fa8b4` from tick 18.
- Tick 18 source commit **`23fa8b4`** remains the most recent source change (compare-mode IIFE).
- New kanban ticket **`t_01bc2b18`** filed in `ready` (assignee: `frontend`, priority 6 — gates all future Lane C #7 implementation cards).
- CF deploy: none this tick (no source change → no rebuild → no deploy). Last live deploy is still `91648653.stuffprettygood.pages.dev` from tick 18.
- `git push` → deferred (5th consecutive hang, `timeout 30` exit 124). Local is 4 commits ahead of origin. Production deploy via wrangler remains the durable user-facing ship proof regardless of push status.
- Lane C cursor: item 6 ✅ done (tick 18), item 7 → research card filed, awaiting user greenlight per skill rule "file a card, get the user to greenlight the LLM call separately (cost, latency, prompt-injection risk)".

🔗 LINKS:
- Live: https://stuffprettygood.com/?cb=$(date +%s) (custom-domain cache lag expected; preview URL authoritative)
- Preview (authoritative deployed): https://91648653.stuffprettygood.pages.dev
- Latest local commit: 23fa8b4 (compare-mode IIFE, tick 18) — push deferred 5th consecutive
- Kanban: `t_01bc2b18` — Lane C #7 research: LLM call shape (NEW, ready, frontend)

🧠 MEMORY:
- **Lane C #7 cannot ship in a tick.** The skill explicitly forbids it: model choice + cost ceiling + latency budget + system-prompt grounding + prompt-injection guard + fallback paths = multi-card workstream. Filing the research card this tick is the correct Lane C #7 entry point; user greenlight gates implementation.
- **5th consecutive `git push` hang at 30s.** Per pitfall #47 fail-fast: deferred. Production deploy via wrangler is durable regardless. `t_bf95b7ed` already filed devops-side on the upstream issue. Next tick should retry `git ls-remote origin deploy/legal-expansion-and-signup-modal` first to confirm whether upstream has caught up before launching another push attempt.
- **Lane C cursor state for next tick**: item 7 in `ready` (research card filed, awaiting user), item 8+ undefined. Lane A/B/D are all clear. If LLM research blocks user-side, opportunistic lane picks next tick: Lane A (PWA polish, motion, dark-mode toggle, pull-to-refresh) or Lane B (sitemap regeneration, canonical audit, robots.txt).