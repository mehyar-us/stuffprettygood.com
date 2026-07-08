# Kanban Stuck-Card Playbook

Detailed state machine for cards on the `stuffprettygood-com` board. The main SKILL.md covers the high-level rules; this file is the deep dive.

## Board state cheat sheet

| State | Visible to | What it means | What you do |
|---|---|---|---|
| `triage` | Operator + all | A human (or the orchestrator) needs to make a decision. Nothing has been claimed yet. | Pick it up or assign it. **Do not let it sit >24 h.** |
| `ready` | Dispatcher | The dispatcher will claim it on its next loop tick (~15 s). | Don't manually dispatch — the dispatcher races you. If you call `dispatch` and get "Spawned: 0," check `show` first to see if the card is already `running`. |
| `running` | Worker | A worker process is mid-task. Has a TTL (~15 min) before claim expires. | If thrashing, `reclaim`. If stuck, comment then reclaim. |
| `done` | All | Work shipped. Terminal state. | If you can prove the work didn't actually ship (curl proves it), re-open with a new comment. |
| `blocked` | Operator | Worker asked a question, can't proceed. | Operator answers the question, calls `unblock`, dispatcher re-dispatches. **Do not let blocked cards age >4 h without an answer.** |
| `archived` | History only | Removed from the active board. | Recoverable via `hermes kanban --board stuffprettygood-com unarchive <id>` if needed. |

## How to read worker heartbeats

Every `running` task has a heartbeat that the worker updates periodically. The kanban dashboard surfaces it; from the CLI:

```bash
hermes kanban --board stuffprettygood-com show <id>          # full body + comments
hermes kanban --board stuffprettygood-com tail <id>          # live tail of the worker's stdout
hermes kanban --board stuffprettygood-com log <id> --limit 100  # last 100 lines of output
hermes kanban --board stuffprettygood-com runs <id>          # run history (each spawn = one run)
```

A healthy running task has:
- A `last_heartbeat_at` within the last 5 minutes
- A `progress_token` that increments
- A comment from the worker in the last 10 minutes saying "still working on X" or "found Y, planning Z"

A stuck running task has:
- `last_heartbeat_at` > 10 minutes ago
- Same `progress_token` for the last 3 checks
- A last comment that was an error, not a plan

When stuck, `reclaim` is the right move, not `comment`. The worker is not going to wake itself up.

## The 3 currently-stuck cards (debt to clear)

These have been in `triage` for the entire session. Phase 2 of the tick resolves them in priority order.

### `t_08efaa44` — Make signup form visually symmetrical

**Body says:** "DONE in deploy commit… 3 fieldsets / 2-2-1 grids, 21/21 modal checks pass, validate green."

**Why it's actually stuck:** The dist/ in the working tree *does* have the 3-fieldset structure. But the body claims the deploy was done to a preview URL, not production. So the work shipped to git, the validator passed, but the **custom domain** is still serving the old form. The skill's job is to verify on production, and if the new form is there, close the card with a "verified on production" comment. If it's not, re-run the production deploy and close with proof.

**Verification command:**
```bash
curl -sS "https://stuffprettygood.com/signup/" | grep -c "fieldset"   # should be ≥3
curl -sS "https://stuffprettygood.com/signup/" | grep -c "form-grid"   # should be ≥1 (with new structure)
```

### `t_18003621` — Add exit-intent + timed popup signup modal

**Body says:** "DEPLOYED to https://3bb697a7.stuffprettygood.pages.dev. … Recommend: run wrangler pages deploy dist --branch production to push to the live custom domain."

**Why it's actually stuck:** The body itself admits the deploy was to preview, not production. The last sentence is the smoking gun — the writer knew the production deploy didn't happen. This is the textbook preview-vs-production trap.

**Verification command:**
```bash
curl -sS "https://stuffprettygood.com/" | grep -c "signup-modal"            # should be ≥1
curl -sS "https://stuffprettygood.com/" | grep -c "spg_signup_popup_dismissed"  # should be ≥1
curl -sS "https://stuffprettygood.com/privacy/" | grep -c "signup-modal"    # should be 0 (opt-out)
```

If the modal is on homepage but not privacy, deploy to production and close the card with the curl output as proof.

### `t_302ed7e4` — Re-verify all 4 signup state transitions after UI changes

**Body says:** "VERIFIED live on https://3bb697a7.stuffprettygood.pages.dev"

**Why it's actually stuck:** Same trap as t_18003621 — the verification was on the preview URL. To actually verify on production, the skill needs to:

1. Open `https://stuffprettygood.com/signup/` in the browser
2. Submit with empty fields → verify required-field validation fires
3. Submit with invalid email → verify email format validation
4. Submit with valid email + consent unchecked → verify the form blocks on the missing TCPA consent (this is the legal gate)
5. Submit with valid email + consent checked → verify the success state

All 4 transitions in the same browser session. If any fail, file a new ticket; if all pass, close this card with the browser_screenshot paths as evidence.

## When to reassign vs reclaim vs close

### Reassign (different profile, same task)

```bash
hermes kanban --board stuffprettygood-com reassign <id> <new-profile> --reclaim
```

Use when:
- The current assignee profile keeps crashing on this kind of work (wrong model, wrong skills, broken creds)
- A specialist is a better fit (e.g. a SEO ticket currently assigned to `frontend` should be `seo` or `data`)

Don't reassign more than once for the same card. After 2 reassigns, close the card and re-open with a clearer body — the original spec was probably ambiguous.

### Reclaim (same assignee, fresh start)

```bash
hermes kanban --board stuffprettygood-com reclaim <id>
```

Use when:
- The worker is thrashing (same error 3+ times, no progress)
- The worker is stuck on a misunderstanding that a comment would fix
- The worker's TTL expired and you want a clean re-dispatch

Reclaim resets the card to `ready`. The dispatcher will pick it up on the next loop tick. If you don't see a new spawn in 30 s, call `dispatch` explicitly.

### Close (mark done, even though it isn't)

```bash
hermes kanban --board stuffprettygood-com complete <id> --summary "<one-line>" \
  --metadata '{"forced_close_reason": "stuck >24h, no heartbeat, re-open if relevant"}'
```

Use ONLY when:
- The card has been in `triage` > 24 h with no assignee heartbeat
- A reassign was already tried once and the new assignee also has no heartbeat
- The work the card describes is no longer relevant (e.g. a refactor that was already done by another card)

**Always** include a `forced_close_reason` in the metadata so the audit trail shows the close was a cleanup, not a real "done."

## Pitfalls

1. **Reassigning to a profile that doesn't exist.** The dispatcher silently drops unknown assignees. Always `hermes profile list` first to confirm the profile name. On this machine: `default`, `ai`, `backend`, `ceo`, `coo`, `cto`, `data`, `devops`, `frontend`, `pm`, `product`, `tech-lead`, `vp-eng`, `vp-mktg` (plus any new ones the user has added). Most are stopped until a task wakes them.
2. **Forgetting `--board stuffprettygood-com` on the parent command.** The CLI's positional-arg parser treats `<id>` as a subcommand when no board is set, and returns silent failures. Always set the board on the parent: `hermes kanban --board stuffprettygood-com complete <id>`, not `hermes kanban complete <id> --board stuffprettygood-com`.
3. **Calling `dispatch` after `create` and getting "Spawned: 0."** The dispatcher may have already claimed the card between your create and dispatch. Check `show` first; if the card is `running`, the dispatch was redundant.
4. **Closing a card without `forced_close_reason` metadata.** The audit trail needs to distinguish "real done" from "cleanup close" so future you knows which is which.
5. **Re-opening a `done` card instead of creating a new one.** If a card was closed correctly but the work needs to be redone, create a new card linked to the old one (`hermes kanban --board stuffprettygood-com link <new-id> <old-id>`). Re-opening a `done` card confuses the metrics and the worker history.
