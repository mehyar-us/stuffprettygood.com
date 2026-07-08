# Telegram Report Templates

Every tick delivers to Telegram. No silent no-op ticks. The first line of every message MUST be `spg-improve-loop · tick N` so the user always knows which cron is running. The same content gets written to `reports/cron-tick-{N}.md` in git BEFORE the Telegram send, so a Telegram failure never loses the report.

## The 5-section format (mandatory, in this order)

Every Telegram report uses these sections, in this order, with these exact emoji labels:

```
spg-improve-loop · tick <N> · <one-line summary>

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: <one line — what the tick proposed to do>
✅ DONE: <bullets — every committed change + every kanban action>
🧪 TESTED: <bullets — validate, build, deploy, browser QA, anything that passed/failed>
📊 RESULTS: <bullets — what changed, ticket IDs, SHA, CF deploy version, success state>
🔗 LINKS: <bullets — live URL with cache-buster, commit SHA, deploy URL, ticket IDs, screenshot path>
🧠 MEMORY: <one line — what next-tick-Hermes should know>

Live now: https://stuffprettygood.com/?cb=<ts>
MEDIA:<screenshot-path>
```

If a section is empty (e.g. no tickets filed), write "none" rather than omitting. Empty sections are confusing.

## Variant 1 — Tick shipped a change (the common case)

When phase 4 (build) actually modified source, phase 5 (deploy) succeeded, and phase 7 filed 0-N tickets.

```
spg-improve-loop · tick 47 · shipped: Gen Z dark mode toggle

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane A — add data-theme="dark" + manual toggle in nav
✅ DONE: src/styles.css adds .theme-dark variants, dist/index.html wires toggle, dist/*/index.html regenerated
🧪 TESTED: validate.mjs ✅, build.mjs ✅, wrangler deploy ✅ (v8a3f9b2c), curl /dark=on returns 200, browser QA — toggle works, dark mode renders
📊 RESULTS: commit abc1234, CF deploy 8a3f9b2c, 2 tickets filed (t_a1b2c3 hero-320px, t_d4e5f6 modal-scroll-ios)
🔗 LINKS: https://stuffprettygood.com/?cb=1720453200 · commit abc1234 · deploy https://6bba7a54.stuffprettygood.pages.dev · t_a1b2c3 · t_d4e5f6
🧠 MEMORY: dark mode toggle is the highest-leverage Lane A win for Gen Z install rate

Live now: https://stuffprettygood.com/?cb=1720453200
MEDIA:dogfood-output/tick-047/home-dark-mode.png
```

## Variant 2 — Tick filed tickets only (no build, QA found issues)

When phase 4 (build) didn't change anything, but phase 6 (browser QA) found issues and phase 7 filed them.

```
spg-improve-loop · tick 48 · filed 3 issues, no deploy

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane D — opportunistic QA pass
✅ DONE: 3 tickets filed (t_e7f8a9, t_b1c2d3, t_f4g5h6), no source changes
🧪 TESTED: browser QA walked 5 pages, found 3 issues
📊 RESULTS: no deploy, no commit
🔗 LINKS: t_e7f8a9 · t_b1c2d3 · t_f4g5h6
🧠 MEMORY: AI bubble doesn't open on /gift-finder/ — fix lands in next Lane C tick

Live: https://stuffprettygood.com/?cb=1720456800
MEDIA:dogfood-output/tick-048/qa-no-changes.png
```

## Variant 3 — Tick unblocked stuck cards only

When phase 2 (triage unblock) resolved 1+ stuck cards but nothing else happened.

```
spg-improve-loop · tick 49 · unblocked 2 stuck cards

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Phase 2 — clean the 3 preview-URL cards
✅ DONE: t_08efaa44 verified live, closed. t_18003621 re-deployed, closed. t_302ed7e4 verified, closed.
🧪 TESTED: curl /signup/ ✅ (3 fieldsets), curl /privacy/ ✅ (no modal, TCPA present)
📊 RESULTS: 3 cards closed, 0 remaining in triage
🔗 LINKS: t_08efaa44 · t_18003621 · t_302ed7e4 · https://stuffprettyground.com/signup/?cb=1720460400
🧠 MEMORY: board is clean, next tick can pivot to a fresh lane

Live: https://stuffprettygood.com/?cb=1720460400
```

## Variant 4 — Tick error

When the tick hit a hard error and couldn't complete. Always include the next-step plan.

```
spg-improve-loop · tick 50 · error: wrangler deploy failed

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane A — dark mode toggle
✅ DONE: 0 (build failed before commit)
🧪 TESTED: validate.mjs ✅, build.mjs ✅, wrangler pages deploy ❌ (403 from Cloudflare API)
📊 RESULTS: CLOUDFLARE_API_TOKEN rejected, source changes uncommitted
🔗 LINKS: working tree state: git status shows modified src/styles.css
🧠 MEMORY: cloudflare creds may have rotated; check ~/.hermes/.env on next tick

Need: confirm the API key is current, or paste a new one
```

## Variant 5 — Tick NO-OP (1 line, every quiet tick)

When the tick did nothing — board is clean, no QA issues, no deploy. This is STILL a Telegram ping (1 line, no full structure), because the user wants every-tick visibility.

```
spg-improve-loop · tick 51 · no-op, all clear · 0 tickets, 0 deploys, 0 unblocks
```

## Common elements across all 5 variants

- **First line** is always `spg-improve-loop · tick N · <summary>`. The cron job name is non-negotiable — the user reads this to identify which loop is running.
- **Tick number** counts from `reports/cron-tick-*.md` (max existing + 1). If you can't determine N, use the current minute-of-day as a fallback identifier.
- **Commit SHA** — short hash, from `git rev-parse --short HEAD`. Only include SHAs you can re-derive from the working tree in the same turn.
- **CF version ID** — from the wrangler deploy output, the long hex before the URL.
- **Live URL** — always with a cache-buster `?cb=$(date +%s)` so the user sees the new content.
- **MEDIA:path** — one screenshot when there's a visual. Telegram renders inline. The most important visual state of the tick.

## Watchdog rule — resend previous tick on send failure

If `send_message` raises an exception in this tick, the next tick's report opens with:

```
🚨 spg-improve-loop · previous tick's Telegram send failed. Resending tick N's report:

<full previous tick's report body here>
```

This makes Telegram delivery failures visible on the next ping instead of silently dropping them. If the resend also fails, file a kanban card titled `tick N+1 missed telegram ping` and the user can audit manually.

## How to send

Use the home channel:

```
send_message(
    target="telegram",
    message="<the report content>"
)
```

If `send_message` is unavailable or the user has not configured Telegram, fall back to: write the report to `reports/cron-tick-{N}.md`, commit it, and let the user read it from the repo.

## Pitfalls

1. **Sending a report without a screenshot.** Telegram renders images inline; a text-only report is invisible in a busy chat. Always include one MEDIA: line for shipped/filed variants. No-op variants can skip it.
2. **Sending a report that contains a fabricated commit SHA or deploy version.** The user checks `git log` and `wrangler pages deployment list` against the report. If the SHA doesn't match, trust is lost for the whole loop. Only include SHAs/IDs you can re-derive from the working tree in the same turn.
3. **Sending a report on a half-done tick.** "Deployed, verifying" is not a report — it's a status mid-flight. Wait until the verification (curl + browser) is done.
4. **Sending a report when the only thing that happened is a `git commit` with no deploy.** The skill only deploys after the commit. A commit without a deploy is just a draft; it's not news.
5. **Hedging with "should be live now" or "probably deployed."** State the proof: "Deployed. CF version 8a3f9b2c. curl STATUS=200, body contains the new fieldset markup."
6. **Forgetting the `spg-improve-loop · tick N` first line.** The user reads Telegram on their phone and uses the first line to identify which loop is running. Every report, every variant, no exceptions.
