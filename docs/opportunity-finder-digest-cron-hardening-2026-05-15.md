# Opportunity Finder daily digest cron hardening — 2026-05-15

Task: t_ca510523
Owner: DevOps

## Reality

The Opportunity Finder collectors and daily digest are operationalized for internal, read-only opportunity intelligence. The digest cron job `b70f6df31e67` is scheduled for `0 7 * * *` using script `mehyar-opportunity-daily-digest.sh` with no-agent delivery to origin.

## What changed

- Hardened `/home/mehya/.hermes/scripts/mehyar-opportunity-daily-digest.sh` with:
  - explicit WSL-safe PATH including `/home/mehya/.local/node/bin`
  - non-overlap lockfile: `.ops-logs/mehyar-opportunity-daily-digest.lock`
  - sanitized collector log: `.ops-logs/mehyar-opportunity-daily-digest-<UTC>.log`
  - source health validation for `blocked` / `error` source statuses
  - artifact schema validation for source runs and opportunity records
  - artifact guardrail validation: secret assignment patterns, `external_action_type=none`, `gate_status=draft_only`
  - env key inventory output by name only
- Re-enabled cron job `b70f6df31e67` in `/home/mehya/.hermes/cron/jobs.json`; preserved schedule, script, no-agent mode, repeat count, delivery, and next-run timestamp.

## Evidence

### Cron job `b70f6df31e67`

Source: `/home/mehya/.hermes/cron/jobs.json`

- Name: `Mehyar Media daily opportunity digest`
- Script: `mehyar-opportunity-daily-digest.sh`
- Schedule: `0 7 * * *`
- Enabled: `true`
- State: `scheduled`
- Next run at: `2026-05-16T07:00:00-04:00`
- Mode: `no_agent=true`
- Delivery: `origin`

### Collector command

Command run from `/home/mehya/work/mehyarmedia`:

```bash
npm run opportunities:collect
```

Result:

- `status=opportunity_collectors_complete`
- `run_count=6`
- `ok_count=5`
- `skipped_count=1`
- `error_count=0`
- output artifacts:
  - `data/opportunity-desk/opportunity-source-runs.json`
  - `data/opportunity-desk/opportunities.json`

### Daily digest script

Command run:

```bash
bash -n /home/mehya/.hermes/scripts/mehyar-opportunity-daily-digest.sh
bash /home/mehya/.hermes/scripts/mehyar-opportunity-daily-digest.sh
```

Result:

- Exit code: `0`
- Records tracked: `224`
- Latest source runs: `6`
- Source health: `ok=5`, `skipped=1`
- Family counts:
  - `sam_gov=25`
  - `usaspending=25`
  - `grants_gov=25`
  - `rss=40`
  - `postings=20`
  - `spg_proof=0`
- Artifact guardrails:
  - `secret_assignment_hits=0`
  - `external_action_type=none`
  - `gate_status=draft_only`

### Tests

Command run:

```bash
npm test -- test/opportunity-collectors.test.js
```

Result: `6/6` tests passed.

## Env key inventory by name only

- `SAM_GOV_API_KEY` — optional; when present, SAM.gov official API adapter fetches live results. When absent, SAM.gov run records a safe `missing_env:SAM_GOV_API_KEY` skip.
- USAspending adapter: no credential required.
- Grants.gov adapter: no credential required.
- RSS/postings adapters: no credential required.

No secret values were printed, documented, committed, or placed into Kanban.

## 403/429 kill behavior

Collector code maps source exceptions containing `HTTP 403` or `HTTP 429` to source-run status `blocked`. The hardened digest treats any `blocked` or `error` source-run status as a health alert and exits non-zero, causing the no-agent cron to deliver an error alert instead of silently continuing.

Operational kill switches:

1. Pause/remove cron job `b70f6df31e67` to stop the daily digest.
2. Pause/remove cron job `cfbd07755c27` to stop the broader 6 AM daily pull if needed.
3. Disable a single source by setting `enabled: false` in `data/opportunity-source-registry.json`.
4. Stop polling any source that returns 403/429, CAPTCHA/login wall, provider complaint, or ToS ambiguity.

## Source expansion boundary

Allowed source families remain official/public/read-only only:

- SAM.gov official API
- USAspending public API
- Grants.gov public opportunity search
- public RSS feeds
- public job postings / demand-signal feeds
- state/local source registry entries
- public affiliate/sponsor feeds where terms permit metadata-only review

No external bids, applications, outreach, paid actions, provider pushes, account creation, email/SMS, or public commitments are allowed from this collector/digest job.

## Production deployment path

- The daily digest itself runs through Hermes cron using `/home/mehya/.hermes/scripts/mehyar-opportunity-daily-digest.sh`.
- The broader production daily pull remains cron `cfbd07755c27`, script `mehyar-media-daily-pull-everything.sh`, schedule `0 6 * * *`, and includes the Opportunity Finder collect step before optional Hostinger deploy logic.
- Deployment rollback remains the Hostinger backup/rollback path documented in `docs/daily-pull-cron-monitoring-note-2026-05-15.md` and `docs/hostinger-deployment-runbook.md`.

## Risk

- Low/medium: `b70f6df31e67` was re-enabled after manual verification, but first autonomous 7 AM ET tick evidence is still pending.
- Low: digest re-runs `npm run opportunities:collect` one hour after the 6 AM daily pull, which is idempotent and lock-protected at the digest-script level.

## Next action

After the first scheduled tick, record `last_run_at`, `last_status`, and the latest sanitized digest log path for cron `b70f6df31e67`.
