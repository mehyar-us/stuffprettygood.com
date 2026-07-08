# Telegram Report Templates

The 4 shapes the SPG tick can send. The main SKILL.md says "silent on no-op" — this file is the actual content of the messages that *do* get sent.

## Template 1 — Tick shipped a change

Use when phase 4 (build) actually modified source, phase 5 (deploy) succeeded, and phase 7 filed 0-N tickets.

```
SPG tick 47 · shipped: Gen Z dark mode toggle

Shipped:
• abc1234 — added data-theme="dark" + manual toggle in nav
• Deployed to production · CF version 8a3f9b2c

Tickets filed: 2
• t_a1b2c3 · Hero text wraps on 320px viewport → frontend
• t_d4e5f6 · signup-modal scroll-lock broken on iOS → frontend

Live now: https://stuffprettygood.com/?cb=1720453200
MEDIA:/path/to/dogfood-output/tick-047/home-dark-mode.png
```

Keep it under 12 lines. Screenshot is the headline.

## Template 2 — Tick filed tickets only

Use when phase 4 (build) didn't change anything (no-op on the lane), but phase 6 (browser QA) found issues and phase 7 filed them.

```
SPG tick 48 · filed 3 issues, no deploy

Tickets filed: 3
• t_e7f8a9 · AI bubble doesn't open on /gift-finder/ → frontend
• t_b1c2d3 · /under-50/ shows 12 products not 16 → data
• t_f4g5h6 · sitemap.xml missing /travel/ → seo

Next tick: Lane A (Gen Z vibe — pull-to-refresh on mobile)

Live: https://stuffprettygood.com/?cb=1720456800
MEDIA:/path/to/dogfood-output/tick-048/home-no-changes.png
```

## Template 3 — Tick unblocked stuck cards only

Use when phase 2 (triage unblock) resolved 1+ stuck cards but nothing else happened.

```
SPG tick 49 · unblocked 2 stuck cards

• t_08efaa44 (signup form symmetry) — verified live, closed
  curl: 3 fieldsets on /signup/, ✅
• t_18003621 (signup modal) — re-deployed to production, closed
  curl: 14 signup-modal hits on /, ✅

Next tick: Lane C (AI companion — voice input)

Live: https://stuffprettygood.com/?cb=1720460400
```

The "verified live, closed" with the curl proof is the new pattern — replaces the old "I deployed it" with "I deployed it AND I proved it's on production."

## Template 4 — Tick error

Use when the tick hit a hard error and couldn't complete. Always include the next-step plan so the user knows what's pending.

```
SPG tick 50 · error: wrangler deploy failed

Error: 403 from Cloudflare API
  CLOUDFLARE_API_TOKEN rejected. Last deploy was 14d ago, key may have rotated.

Pending:
• Re-check ~/.hermes/.env for current CLOUDFLARE_API_TOKEN
• If rotated, update the key in t_meta_cf_creds
• Re-run tick 50's deploy on next tick

No source changes were committed. Working tree clean.

Need: confirm the API key is current, or paste a new one
```

The "Need:" line is a soft ask for the user. The skill should NOT rotate the key itself — that requires the user to be in the loop.

## Common elements across all 4

- **Tick number** — increment from the last message. The cron job's session_id can supply this if you don't track it; the user just wants to know "this is tick N" so they can correlate with the kanban dashboard.
- **Lane picked** — only on shipped ticks. Format: `Lane A / B / C / D`.
- **Commit SHA** — short hash, from `git rev-parse --short HEAD`.
- **CF version ID** — from the wrangler deploy output, the long hex before the URL.
- **Ticket count** — and the count of new tickets. If 0, omit the section.
- **Live URL** — always with a cache-buster `?cb=$(date +%s)` so the user sees the new content.
- **MEDIA:path** — one screenshot. Telegram renders inline. The most important visual state of the tick (the new feature, the issue found, the unblocked card's proof).

## What NOT to send

- **No "tick X: all quiet" pings.** If the tick did nothing, send nothing.
- **No "I made progress on the roadmap" pings.** Progress is a kanban metric, not a Telegram metric.
- **No full commit logs.** The user has `git log`. Send the SHA, not the body.
- **No wall-time reports.** "Tick took 11m 23s" is noise. The 15-min budget is internal.
- **No apologies or hedging.** The user wants signal. "Deployed, verified, 2 tickets filed" is the shape.
- **No "let me know if you want me to do X."** If X is in scope, do it. If not, file a ticket. Don't ask in Telegram.

## Where the home channel is

The user's Telegram home channel. Use:

```python
send_message(
    target="telegram",
    message="<the report>"
)
```

If `send_message` fails or the user has not configured Telegram, fall back to the kanban: file a "TICK REPORT" comment on the most recent shipped card with the same content. The dashboard surfaces it.

## Frequency

Maximum once per tick. If a tick would send more than one report (e.g. deployed a change *and* unblocked a card *and* filed tickets), condense into Template 1 with the unblock and tickets as sub-bullets. The user does not want 3 pings per 15 minutes.

## Pitfalls

1. **Sending a report without a screenshot.** Telegram renders images inline; a text-only report is invisible in a busy chat. Always include one MEDIA: line.
2. **Sending a report that contains a fabricated commit SHA or deploy version.** The user checks `git log` and `wrangler pages deployment list` against the report. If the SHA doesn't match, trust is lost for the whole loop. Only include SHAs/IDs you can re-derive from the working tree in the same turn.
3. **Sending a report on a half-done tick.** "Deployed, verifying" is not a report — it's a status mid-flight. Wait until the verification (curl + browser) is done.
4. **Sending a report when the only thing that happened is a `git commit` with no deploy.** The skill only deploys after the commit. A commit without a deploy is just a draft; it's not news.
5. **Hedging with "should be live now" or "probably deployed."** State the proof: "Deployed. CF version 8a3f9b2c. curl STATUS=200, body contains the new fieldset markup."
