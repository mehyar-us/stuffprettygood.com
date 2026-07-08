---
name: spg-improve-loop
description: Use when running the recurring 15-minute improvement loop for the StuffPrettyGood.com project. Drives the site's visual polish, SEO surface, AI companion, and PWA quality while keeping the kanban board unblocked, committing + pushing to GitHub after every successful new thing, and posting a Telegram report to the home channel on EVERY tick (shipped / filed / unblocked / quiet) with the cron job title `spg-improve-loop` in the header. Reads vision.md, picks the next lane (visual / SEO / AI companion / PWA), builds, deploys to the production custom domain, runs browser QA, files tickets, never blocks on a stuck card.
version: 1.0.0
author: Stuff Pretty Good + Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [spg, stuffprettygood, improve-loop, pwa, gen-z, seo, ai-companion, cron]
    related_skills: [dogfood, kanban-orchestrator, orient-to-unfamiliar-project, requesting-code-review]
---

# SPG Improve Loop

The 15-minute tick that keeps stuffprettygood.com moving. Each tick is opinionated: it reads `vision.md` for direction, picks a lane, builds, deploys to the **production** custom domain (not a preview URL — the existing kanban cards tripped on that), runs the live site through the browser, files tickets for anything broken, **commits + pushes to GitHub after every successful new thing**, and pings Telegram on EVERY tick (shipped / filed / unblocked / quiet) with the cron job title `spg-improve-loop` in the header so the user always knows what is running.

**Tick contract — non-negotiable:**
- Every tick commits + pushes to `deploy/legal-expansion-and-signup-modal` if it touched any source file
- Every tick writes a report to `reports/cron-tick-{N}.md` (committed to git) as the durable record
- Every tick attempts to send that report to the Telegram home channel via `send_message`
- The Telegram message ALWAYS includes `spg-improve-loop · tick N` in the first line
- On Telegram send failure, the next tick resends the previous tick's report and pings a 🚨

## Project grounding (read this first)

- **Repo root:** `~/OneDrive/Documents/GitHub/stuffprettygood.com`
- **Branch in flight:** `deploy/legal-expansion-and-signup-modal` (the kanban cards reference this; do not switch)
- **Build:** `node scripts/build.mjs` regenerates `dist/`. `node scripts/validate.mjs` is the test script — must pass before any commit
- **Deploy (production):** `wrangler pages deploy dist --project-name stuffprettygood --branch production` — this hits the custom domain `https://stuffprettygood.com`, not a `*.stuffprettygood.pages.dev` preview. The 3 currently-stuck triage cards used the preview URL and called it "deployed" — that is the trap to avoid
- **Push:** `git add -A && git commit -m "<type>: <msg>" && git push origin deploy/legal-expansion-and-signup-modal`
- **Kanban board:** `stuffprettygood-com` (9 other boards exist; always pass `--board stuffprettygood-com` on operator CLI calls, see the kanban-orchestrator skill pitfall about positional-arg parser)
- **Telegram:** your home channel; `send_message` with `target="telegram"` for the home channel
- **Cloudflare creds:** per `t_meta_cf_creds` on the board, stored in `~/.hermes/.env` — `CLOUDFLARE_API_TOKEN` (the misnomer key is actually a 37-char Global API Key) and `CLOUDFLARE_ACCOUNT_ID` = `621600637337cc1c9ecb7095508bc732`

## When to use this skill

- The cron job `spg-improve-loop` fires every 15 minutes and loads this skill — that is the primary trigger
- The user says "run a tick" / "advance the site" / "what's next for stuffprettygood"
- The user wants to know why a stuck kanban card is still in `triage`
- After any manual code change, before claiming "done" — run a tick to verify the live site

## The 8-phase tick (≈15 minutes)

### Phase 1 — Orient (30 s)

Run these in parallel, take the first 30 seconds of the tick:

```bash
cd ~/OneDrive/Documents/GitHub/stuffprettygood.com
git status                                                    # must be on deploy/legal-expansion-and-signup-modal, clean or only-ours
git log --oneline -5                                          # recent history, don't repeat a commit message
hermes kanban --board stuffprettygood-com list                # current board state
hermes kanban --board stuffprettygood-com list --status triage --json 2>/dev/null | head -40
```

Read `vision.md` only if the *theme* of the tick calls for it (e.g. starting a new lane). The whole file is 650 lines — do not re-read it every tick. Cache the "what is the site for" answer in working memory for the session.

### Phase 2 — Triage unblock (60 s)

The 3 currently-stuck triage cards (`t_08efaa44`, `t_18003621`, `t_302ed7e4`) all reference `https://3bb697a7.stuffprettygood.pages.dev` — a **preview URL**, not the production custom domain. The work was deployed to a preview branch and called done. This is the loop's highest-priority debt and gets resolved in the first 3 ticks (one card per tick):

1. Pick the oldest `triage` card.
2. `hermes kanban --board stuffprettygood-com show <id>` to read the body and the comment thread.
3. If the work is already in the working tree (e.g. `git log` shows the commit), run the production deploy yourself right now and comment on the card: "Pushed to production. Live: https://stuffprettygood.com/<path>. Verifying…"
4. If the work is *not* in the working tree, comment: "Preview deploy ≠ production deploy. Re-running with --branch production. Will update." then continue the lane that the card describes.
5. If the card is older than 48 h and the assignee has no heartbeat, `hermes kanban --board stuffprettygood-com reassign <id> <new-profile> --reclaim` to an idle profile from the roster. Check `hermes profile list` first — the dispatcher silently drops unknown names. Idle profiles on this machine include `frontend`, `devops`, `ui-dev`, `qa`, `seo`, `data`, `pm`, `product` (most are stopped until a task wakes them).

**Never claim a card is "deployed" unless the curl + production URL check passed in this tick.**

### Phase 3 — Pick next lane (30 s)

Four lanes, picked by rotation. Track which lane you picked last tick in a local counter (a file at `.claude/skills/spg-improve-loop/.last-lane` if you want to persist it; otherwise keep in conversation memory).

| Lane | Files it touches | What "done" looks like |
|---|---|---|
| **A — Visual / Gen Z vibe / PWA polish** | `src/styles.css`, `dist/site.webmanifest`, `dist/sw.js` (currently missing — see PWA gap below), `dist/manifest.json` | Commit that changes the look, validate, deploy, browser-screenshot. PWA-specific: add `sw.js` with cache-first for `dist/`, install prompt, splash, offline page. Gen Z vibe: bigger type, motion, micro-interactions, gradient meshes, dark mode toggle, glass surfaces — the existing design is warm-cream + dark hero; that is the right *base*, not the *ceiling* |
| **B — SEO + content surface** | `<head>` meta in each `dist/*/index.html`, sitemap, structured data (JSON-LD for `Product`, `Organization`, `BreadcrumbList`, `FAQPage` on the AI pages), OG image (`dist/assets/site/spg-shopping-guide.svg` exists but check sizes), `robots.txt`, internal link graph | Commit that adds structured data or meta to a real page, validate, deploy. **Sitemap freshness** is the recurring check — products land every curation run; the sitemap should regenerate with each build (check `scripts/build.mjs`) |
| **C — AI companion** | The `ai-bubble` markup + `data-ai-catalog` JSON in `dist/index.html`; the AI page(s) under `/gift-finder/`, `/starter-kits/`, etc.; the suggestion chips | Commit that improves the AI helper. vision.md § 3 names 4 features: AI Gift Finder, AI Starter Kit Builder, Pretty Good or Not?, Finds Under Budget. The current bubble is a thin client-side matcher. Worth adding: better suggestions, follow-up questions, voice input (Web Speech API), shareable result URLs, "compare two picks" mode, a "show me cheaper" rerank, a "Pretty Good or Not?" entry point that takes a product URL or description and gives a verdict with affiliate alternatives |
| **D — Opportunistic** | Whatever the browser QA found last tick | If phase 6 surfaces something, the skill files a ticket and then the next tick's lane picks up the fix |

Lane priority when a stale card from Phase 2 is in the same domain as a lane (e.g. a card about the AI modal belongs to Lane C), promote that lane this tick.

### Phase 4 — Build (3–5 min)

1. `cd ~/OneDrive/Documents/GitHub/stuffprettygood.com`
2. Make the change in source — `src/`, page templates in `scripts/build.mjs`, or in `dist/` directly if it's a static-only tweak (e.g. adding a JSON-LD block to a single page).
3. `node scripts/validate.mjs` — must pass before moving on. If it fails, **fix or revert**, do not proceed to deploy. The user has been bitten by "validated locally but shipped broken" before.
4. `node scripts/build.mjs` — regenerates `dist/` from source.
5. `git status` to confirm only the files you intended changed. If `git status` shows surprise files (a stray build artifact, a `*.bak.1782943721` file that wasn't ignored), `git restore` them. The repo has a `build.mjs.bak.1782943721` already — that's drift, not your problem to fix in a tick.

### Phase 5 — Deploy + push (90 s)

The canonical deploy is production. **Not** a preview URL. The trap is that `wrangler pages deploy` defaults to whatever branch you pass, and the existing triage cards all used `--branch <preview-branch>` and called the resulting `*.stuffprettygood.pages.dev` URL "deployed." The custom domain only serves the **production** branch.

```bash
cd ~/OneDrive/Documents/GitHub/stuffprettygood.com
wrangler pages deploy dist --project-name stuffprettygood --branch production --commit-dirty=true 2>&1 | tee /tmp/spg-deploy.log
# Wait 15-30s for edge propagation
sleep 20
# Verify
curl -sS -w "\nSTATUS=%{http_code}\n" "https://stuffprettygood.com/?cb=$(date +%s)" | tail -20
```

If the curl returns the new content, the deploy is live. If it returns the old form (e.g. the old flat 5-field signup form, not the new 3-fieldset structure), the deploy didn't reach production — re-run and check the wrangler output for the production branch confirmation.

Then commit and push:

```bash
git add -A
git commit -m "<type>(<scope>): <subject>

<body — what changed and why in 1-3 lines>"
git push origin deploy/legal-expansion-and-signup-modal
```

Capture the commit SHA (`git rev-parse --short HEAD`) and the Cloudflare deployment ID (from the `wrangler` output) — both go in the Telegram report.

### Phase 6 — Live QA via browser (2–3 min)

Open the **production URL** in the browser. Not the preview URL.

Pages to visit each tick (rotate which ones; always cover homepage + one AI page):

- `https://stuffprettygood.com/` — hero, story strip, AI bubble, footer
- `https://stuffprettygood.com/signup/` — the 3-fieldset form should be live (it is in `dist/`; verify it is what serves)
- `https://stuffprettygood.com/gift-finder/` — AI Gift Finder
- `https://stuffprettygood.com/starter-kits/` — AI Starter Kit Builder
- `https://stuffprettygood.com/stories/` — story lists
- `https://stuffprettygood.com/under-50/` — under-$50 grid
- `https://stuffprettygood.com/privacy/` — verify TCPA opt-out is on the form, not on the modal
- Mobile viewport: `375 × 812` (iPhone-ish) — `browser_vision` can resize; use `annotate=true` for the first mobile check each tick

For each page, follow the `dogfood` skill's protocol:

1. `browser_navigate`
2. `browser_console(clear=true)` — silent JS errors are the highest-value findings
3. `browser_snapshot` — DOM structure
4. `browser_vision(question="...", annotate=false)` — save screenshot, look for visual regressions
5. `browser_scroll(direction="down")` then `browser_console` again — content below the fold can have its own errors

Test the AI bubble: open it, send a question, verify the response, dismiss it. Test the signup form: verify all 3 fieldsets render, verify TCPA checkbox is opt-in (not pre-checked), submit invalid email and verify the validation message, then submit a real email and verify the success state.

Test the signup modal: it should NOT auto-open on the privacy page (that was the design call). It SHOULD be present on the homepage (lazy-loaded after 8s, exit-intent on desktop, immediate on second visit). Verify dismissal sticks (localStorage `spg_signup_popup_dismissed`).

Classify findings using the `dogfood` skill's issue taxonomy: severity (Critical / High / Medium / Low), category (Functional / Visual / Accessibility / Console / UX / Content). Save screenshot evidence to `dogfood-output/tick-<n>/`.

### Phase 7 — Ticket findings (60 s)

Every real issue from phase 6 becomes a kanban card. The skill does NOT fix issues itself — it dispatches them and moves on. The next tick's lane picks up the highest-priority unassigned card from `triage` or `ready`.

```bash
hermes kanban --board stuffprettygood-com create \
  --title "<concise issue title>" \
  --body "$(cat <<EOF
URL: <page where observed>
Severity: <Critical|High|Medium|Low>
Category: <Functional|Visual|Accessibility|Console|UX|Content>
Repro:
1. <step>
2. <step>
Expected: <what should happen>
Actual: <what happens>
Screenshot: <path under dogfood-output/tick-N/>
Console: <error text if any>

Why this matters: <one line — Gen Z users bounce on first broken interaction /
SEO penalty for missing structured data / TCPA risk if pre-checked consent /
PWA install prompt missing means no home-screen install / etc.>

Repro commands:
\`\`\`bash
curl -sS https://stuffprettygood.com/<path>?cb=\$(date +%s) | grep -E "<expected text>"
\`\`\`
EOF
)" \
  --assignee <profile-from-idle-roster> \
  --tags <spg-qa,visual,console,etc>
```

Pick the assignee by category:

| Category | Preferred profile |
|---|---|
| Visual / CSS / layout | `frontend` |
| Functional / JS | `frontend` |
| SEO / meta / structured data | `seo` (if present) or `data` or `pm` |
| Accessibility | `frontend` |
| Console / PWA / service worker | `devops` |
| Content / copy | `content` or `pm` |
| Cross-cutting / unsure | `qa` |

Verify the assignees exist on this machine: `hermes profile list`. The dispatcher silently drops unknown names.

### Phase 8 — Telegram report (15 s, EVERY tick — never silent)

**EVERY tick delivers to Telegram.** No-op ticks get a 1-line ⚪ ping. Shipped / filed / unblocked ticks get the full 5-section report. The user wants to see *every* tick land on their phone, with the cron job title `spg-improve-loop · tick N` in the header so they know which cron is running.

**First, commit the durable report to git.** This is the fallback if Telegram send fails. Run BEFORE attempting the send:

```bash
mkdir -p reports
NEXT_N=$(($(ls reports/ 2>/dev/null | grep -oE 'cron-tick-[0-9]+' | sort -t- -k3 -n | tail -1 | grep -oE '[0-9]+' || echo 0) + 1))
cat > reports/cron-tick-${NEXT_N}.md <<'EOF'
# spg-improve-loop · tick <N>

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: <one line — what the tick proposed to do>
✅ DONE: <bullets — every committed change + every kanban action>
🧪 TESTED: <bullets — validate, build, deploy, browser QA, anything that passed/failed>
📊 RESULTS: <bullets — what changed, ticket IDs, SHA, CF deploy version, success state>
🔗 LINKS: <bullets — live URL with cache-buster, commit SHA, deploy URL, ticket IDs, screenshot path>
🧠 MEMORY: <one line — what next-tick-Hermes should know>
EOF
git add reports/cron-tick-${NEXT_N}.md
git commit -m "chore(reports): spg-improve-loop · tick <N> — <one-line summary>"
```

**Then, send the same content to Telegram.** Use the home channel via `send_message(target="telegram", message=...)`. Wrap the first line in the cron title so the user always sees `spg-improve-loop · tick N`. On send failure, log the error and continue — the durable report in git is the source of truth.

```
spg-improve-loop · tick <N> · <one-line summary>

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: <one line>
✅ DONE: <bullets>
🧪 TESTED: <bullets>
📊 RESULTS: <bullets>
🔗 LINKS: <bullets — live URL with cache-buster, commit SHA, deploy URL, ticket IDs>
🧠 MEMORY: <one line>

Live now: https://stuffprettygood.com/?cb=<ts>
MEDIA:<screenshot-path>
```

The 5 sections (PROJECT / SUGGESTED / DONE / TESTED / RESULTS / LINKS / MEMORY) are non-negotiable. The user reads Telegram on their phone and the structure lets them scan in 2 seconds. If a section is empty (e.g. no tickets filed), write "none" rather than omitting — empty sections are confusing.

On `send_message` failure, the next tick's report opens with: `🚨 spg-improve-loop · previous tick's Telegram send failed. Resending: <report>` and includes the previous tick's report body in full. This is the watchdog: if Telegram delivery ever silently breaks again, the next tick surfaces it.

## PWA gap to fix in the first 2 ticks

The `dist/site.webmanifest` is real (PWA shell exists, `display: standalone`, `theme_color: #111827`) but **no service worker** is shipped. `ls dist/sw.js` returns nothing. Without `sw.js` the site is not installable as a PWA — Chrome and Safari will not fire the install prompt. This is the single highest-leverage Lane A win and should be one of the first ticks:

- Cache-first for `dist/*` (JS, CSS, fonts, images) — namespaced under `spg-v1`
- Network-first for HTML (so updates ship)
- Offline fallback page (`/offline.html` or a minimal in-SW response) that links back to homepage
- `beforeinstallprompt` capture and a custom install button (the design system has `.btn` and `.btn.ghost`; add `.btn.pwa-install` in the nav)

The PWA install prompt alone is the kind of "feels like an app" Gen Z surface the vision.md is asking for. Do this early; it compounds with every other lane.

## Stuck-ticket rules

| State | Action |
|---|---|
| `triage`, no comment in 6 h | Skill posts a comment asking assignee to ship or unblock with what's needed |
| `triage`, no comment in 12 h, still no heartbeat | `hermes kanban --board stuffprettygood-com reassign <id> <new-idle-profile> --reclaim` |
| `triage`, no comment in 24 h, reassign already tried once | Mark the card `done` with a comment: "Closing as stale — no heartbeat in 24h, will re-open if it becomes relevant. See tick N for re-discovery." |
| `ready`, worker crashed | `hermes kanban --board stuffprettygood-com reclaim <id>` to reset to `ready` and re-dispatch |
| `running`, worker thrashing | `hermes kanban --board stuffprettygood-com reclaim <id>` and re-dispatch to a different profile |
| `done` but skill can prove the work didn't ship | Re-open the card with a comment showing the proof (curl, missing file, etc.) |

Always pass `--board stuffprettygood-com` on the parent command — see the kanban-orchestrator skill's positional-arg-parser pitfall.

## "Always test after work" — what testing means here

For stuffprettygood.com specifically, "testing" is the browser QA in phase 6 plus the project's own `node scripts/validate.mjs`. There is no separate test suite to run. The 4-tier gate on every commit:

1. `node scripts/validate.mjs` — exit 0
2. `git diff --stat` — only the files you intended changed
3. Production deploy — `wrangler` reports the new version
4. `curl https://stuffprettygood.com/?cb=<ts>` — returns the new content, not the cached old version

If any of the 4 fails, the commit is not done. Revert and try again, or open a card and move on.

## Gen Z vibe specifics (Lane A's north star)

The vision.md says "revolutionary, not existing before — observational/intimate over form-filling or feature parity." For a Gen Z-facing PWA that means:

- **Motion is mandatory, not optional.** A 200ms fade on page load, a 150ms slide on the AI bubble appearing, a 250ms ease-out on hover. `prefers-reduced-motion` respected, but on by default. The current CSS has zero `@keyframes` — that's a 5-tick Lane A backlog right there
- **Type hierarchy does the heavy lifting.** `clamp(44px, 7vw, 82px)` hero is good; the body type at `1.12rem` could go to `1.18rem` with a tighter line-height. Gen Z reads on phones, line length matters
- **Glass surfaces, soft shadows, gradient meshes** — already there in the CSS tokens (`--shadow`, `--soft-shadow`, the `radial-gradient` body bg). The opportunity is to push them into the cards, not just the hero
- **Dark mode toggle** that respects `prefers-color-scheme` AND has a manual override. The current `--bg: #f6f1e8` is light-only. Add a `data-theme="dark"` root variant with `#0b1220` body and inverted cards
- **Haptics on iOS** via `navigator.vibrate(10)` on the AI bubble tap (with a `try/catch` — desktop browsers throw)
- **Haptic-feeling click targets** — 48 × 48 minimum on every interactive element, not just the nav
- **Pull-to-refresh on mobile** if the PWA is in standalone mode (custom JS, since the browser default only works on `<body>` scroll)
- **Story lists as TikTok-style vertical cards** instead of horizontal scroll. vision.md calls out "AI story lists" — make them feel native to vertical-scroll content

## SEO specifics (Lane B's north star)

- **Per-page `<title>` and `<meta description>`** — currently the homepage has both, but `/gift-finder/`, `/starter-kits/`, `/under-50/`, `/stories/` need a quick audit. Each should have a unique title with the category name and "Stuff Pretty Good"
- **JSON-LD on every page** — at minimum `Organization` site-wide, `Product` on individual product cards, `BreadcrumbList` on category pages, `FAQPage` on `/gift-finder/` and `/starter-kits/` (the AI features are FAQ-shaped)
- **OG image variety** — every page should have a distinct OG image, not all pointing to the same `spg-shopping-guide.svg`. Generate per-page images as SVG with the page title overlaid
- **Sitemap** — check `scripts/build.mjs` emits one; if not, add it. Should include all category pages and the most recent 50 products
- **Canonical URLs** — `<link rel="canonical">` on every page, set to the `https://stuffprettygood.com/<path>` form (not the www variant, not trailing slash)
- **Internal linking** — every product card should link to at least one category page; every category page should link to at least 3 other category pages. The current nav has 6 links; the footer can have 20
- **robots.txt** — should exist at `dist/robots.txt` and allow all + point at the sitemap
- **Page speed** — `dist/styles.css` is inlined, that's good. Check for render-blocking JS; the AI bubble script is at the bottom of `<body>`, that's good. The `data-ai-catalog` JSON block is large (~50 KB); consider splitting it into a per-page fetch or lazy-loading it after first interaction

## AI companion specifics (Lane C's north star)

The current `ai-bubble` is a thin client-side matcher. vision.md § 3 names 4 features. Build them in this order:

1. **Better suggestion chips** — the 4 current chips ("gift under $25", "travel kit", "desk setup", "pet problem") are static. Make them dynamic based on the page the user is on (on `/kitchen/`, suggest "weeknight cooking under $25")
2. **Follow-up questions** — after a response, the AI should suggest 1-2 follow-ups ("show me cheaper", "show me more premium", "what about for a beginner?")
3. **Voice input** — Web Speech API, `SpeechRecognition`, with a microphone button on the input. Feature-detect, hide button on unsupported browsers
4. **"Pretty Good or Not?" entry point** — a separate input mode (or a chip that toggles modes) where the user pastes a product URL or types a product name and gets a verdict + 3 affiliate alternatives from the approved catalog
5. **Shareable result URLs** — when the AI returns picks, the URL should update with `?q=<encoded-prompt>&picks=<ids>` so the user can share or bookmark
6. **"Compare two picks" mode** — pick 2 products from the catalog, generate a side-by-side comparison
7. **Real LLM call** — this is the long-term play. The catalog is already approved-affiliate-only, the prompts are constrained, the system prompt is in `vision.md` § "Technical architecture". Add a Cloudflare Worker endpoint that calls OpenAI/Anthropic with the approved catalog as grounding data. The skill should NOT build this in a tick — file a card, get the user to greenlight the LLM call separately (cost, latency, prompt-injection risk)

## Cron shape

This skill is meant to be driven by a cron job, not invoked by hand. The cron job name is `spg-improve-loop` and it MUST appear in the first line of every Telegram report so the user always knows which loop is running.

```
name:     spg-improve-loop
schedule: every 15m
prompt:   "Run one tick of the spg-improve-loop. Project root: C:/Users/mehya/OneDrive/Documents/GitHub/stuffprettygood.com. Board: stuffprettygood-com. Telegram home channel for the report — ping on EVERY tick, no exceptions. The first line of every Telegram message MUST be: spg-improve-loop · tick N. Read vision.md at least once per session for theme. Stay under 15 minutes of real work per tick — measure tool-call count, not wall time. Commit + push to origin/deploy/legal-expansion-and-signup-modal after every successful source change. Write the durable report to reports/cron-tick-{N}.md before attempting the Telegram send."
skills:   [spg-improve-loop, dogfood, kanban-orchestrator]
workdir:  C:/Users/mehya/OneDrive/Documents/GitHub/stuffprettygood.com
```

The cron prompt must be self-contained — the cron job runs in a fresh session with no current-chat context. Include the project path, the board name, the Telegram target, the **mandatory every-tick delivery rule**, the **report header format**, the **commit + push rule**, the **durable report path**, and the time budget. Do NOT tell the cron job to "keep improving" — that's what this skill is for.

## Common pitfalls

1. **Deploying to a preview URL and calling it done.** The 3 currently-stuck triage cards all did this. The custom domain only serves the **production** branch. Always `wrangler pages deploy dist --project-name stuffprettygood --branch production`, then curl the **custom domain** with a cache-buster, then verify the new content.
2. **Committing a `*.bak` file.** The repo already has a `scripts/build.mjs.bak.1782943721` drift. Don't add more. If you back up a file, put the backup in `/tmp/`, not in the repo.
3. **Skipping `node scripts/validate.mjs`.** The user has been bitten by "validated locally but shipped broken" before. The validator is the project's only automated gate. Run it, paste the exit code in the report.
4. **Filing a ticket without proof.** A kanban card with "the signup form is broken" is useless. Every card needs a URL, repro steps, expected vs actual, screenshot path, and ideally a `curl` command that reproduces the failure. If you can't reproduce it in 2 minutes, it's not a real ticket — close the finding in conversation memory instead.
5. **Filing a ticket and then fixing it in the same tick.** The skill's job is to find and dispatch, not to fix. Fixes happen in *next* tick's lane, when the assignee reports back. This is the orchestrator/worker separation.
6. **Going silent on a no-op tick.** The user has asked 3 times for every-tick delivery. Every tick pings Telegram with `spg-improve-loop · tick N` in the header, even if the tick was a 1-line "all clear." Silent ticks = broken loop. If you forgot to ping, file a one-line kanban card titled `tick N missed telegram ping` so the user can audit.
7. **Using `kanban_create` from inside a worker-spawned tick.** If the cron fires a worker that runs this skill, the worker has the `kanban_*` toolset but a narrower scope. Use the operator CLI (`hermes kanban --board stuffprettygood-com ...`) for cross-process visibility. The kanban-orchestrator skill covers the difference.
8. **Re-reading `vision.md` every tick.** It's 650 lines. Read it once per session for theme, then reference the lane-specific sections in this skill (which are pre-quoted).
9. **Trying to add a real LLM call to the AI companion in a single tick.** The catalog grounding, system prompt, prompt-injection guard, cost, latency, and Workers-AI vs OpenAI choice are all a multi-card workstream. File a "research: LLM call shape" card, get the user to greenlight, then build.
10. **Switching branches mid-tick.** The branch in flight is `deploy/legal-expansion-and-signup-modal`. All the kanban work, all the wrangler deploys, all the pushes are on this branch. Switching loses history.

## Verification checklist (per tick)

- [ ] `git status` shows only the files you intended to change
- [ ] `node scripts/validate.mjs` exits 0
- [ ] `wrangler pages deploy dist --project-name stuffprettygood --branch production` reports a new version
- [ ] `curl -sS "https://stuffprettygood.com/?cb=$(date +%s)"` returns the new content, not cached
- [ ] `git push origin deploy/legal-expansion-and-signup-modal` shows the new commit on origin
- [ ] Browser QA covered at least homepage + one AI page + one category page
- [ ] `browser_console` was clean (or any errors are filed as tickets)
- [ ] Every finding from phase 6 has a kanban card with URL, repro, severity, and assignee
- [ ] Source changes committed + pushed to `origin/deploy/legal-expansion-and-signup-modal` (this is mandatory, not optional)
- [ ] Durable report written to `reports/cron-tick-{N}.md` and committed
- [ ] Telegram report sent with `spg-improve-loop · tick N` in the first line, all 5 sections present, MEDIA: screenshot if any
- [ ] If Telegram send failed, the failure is logged and a kanban card titled `tick N missed telegram ping` exists

## Companion files

- `references/kanban-stuck-card-playbook.md` — detailed triage state machine, what to do for each stuck-card duration, how to read worker heartbeats, when to reassign vs reclaim vs close
- `references/production-deploy-checklist.md` — exact `wrangler` command, edge propagation timing, custom-domain DNS gotchas, the `CLOUDFLARE_API_TOKEN` env var that is actually a Global API Key, account ID `621600637337cc1c9ecb7095508bc732`
- `references/browser-qa-page-rotation.md` — which pages to visit each tick, what to look for on each, mobile viewport protocol, screenshot save path
- `references/telegram-report-templates.md` — the 4 report shapes (tick shipped, tick filed-only, tick unblocked-cards-only, tick error) and what each looks like
