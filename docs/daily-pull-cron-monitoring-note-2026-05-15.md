# Mehyar Media daily pull cron monitoring note

Task: t_d2734673
Owner: DevOps
Date: 2026-05-15

## Reality

Cron `cfbd07755c27` is configured to run the Mehyar Media daily pull at `0 6 * * *` with next fire time `2026-05-16T06:00:00-04:00` (America/New_York / ET). The job is enabled, uses a repo lockfile, writes run logs into `.ops-logs/`, and is distinct from the paused daily opportunity digest cron.

## What changed

This note records the verified cron schedule, logging path, lock behavior, paused-digest non-duplication check, failure signal, and recovery steps.

## Evidence

### Cron status

Source: `/home/mehya/.hermes/cron/jobs.json`

- Job id: `cfbd07755c27`
- Name: `Mehyar Media daily pull everything`
- Script: `mehyar-media-daily-pull-everything.sh`
- Schedule: `0 6 * * *`
- Enabled: `true`
- State: `scheduled`
- Next run at: `2026-05-16T06:00:00-04:00`
- Deliver mode: `origin`

### Logging and lockfile

Source: `/home/mehya/.hermes/scripts/mehyar-media-daily-pull-everything.sh`

The script sets:

- repo root: `/home/mehya/work/mehyarmedia`
- log directory: `/home/mehya/work/mehyarmedia/.ops-logs`
- log naming: `.ops-logs/daily-pull-everything-<UTC stamp>.log`
- lockfile: `/home/mehya/work/mehyarmedia/.ops-logs/daily-pull-everything.lock`

Lock behavior is explicit:

- opens fd 9 on the lockfile
- runs `flock -n 9`
- on contention, prints `Mehyar Media daily pull already running; skipping duplicate tick.` and exits `0`

This prevents overlapping duplicate ticks for the same daily-pull job.

### Latest run artifact

Verified files:

- Log: `/home/mehya/work/mehyarmedia/.ops-logs/daily-pull-everything-20260515T175810Z.log`
- Lockfile: `/home/mehya/work/mehyarmedia/.ops-logs/daily-pull-everything.lock`
- Summary artifact: `/home/mehya/work/mehyarmedia/data/daily-pull/latest.json`

Latest summary shows:

- `status: ok`
- `deploy_status: deployed`
- `counts.opportunities: 157`
- `counts.opportunity_source_runs: 6`
- `opportunity_source_health.ok: 4`
- `opportunity_source_health.warning: 1`
- `opportunity_source_health.skipped: 1`
- `log_file: /home/mehya/work/mehyarmedia/.ops-logs/daily-pull-everything-20260515T175810Z.log`

### Paused opportunity digest is not duplicating the pull

Source: `/home/mehya/.hermes/cron/jobs.json`

The separate digest job is:

- Job id: `b70f6df31e67`
- Name: `Mehyar Media daily opportunity digest`
- Script: `mehyar-opportunity-daily-digest.sh`
- Schedule: `0 7 * * *`
- Enabled: `false`
- State: `paused`
- Paused at: `2026-05-15T13:58:38.863099-04:00`

Conclusion:

- the 6 AM pull job and 7 AM digest job are separate cron entries
- the digest is paused, so it is not duplicating output right now
- the pull job itself also has lockfile protection against overlap

### Failure signal clarity

Source: `/home/mehya/.hermes/scripts/mehyar-media-daily-pull-everything.sh`

Failure path is explicit:

- if `npm run spg:daily` fails, script marks `error_step=spg_daily`
- if `npm run opportunities:collect` fails, script marks `error_step=opportunities_collect`
- on failure it prints:
  - `⚠️ Mehyar Media daily pull everything failed at <error_step>. Review log: <log_file>`
- exits with status `1`

This is clear enough for cron/operator recovery because it names both the failing stage and the exact log file.

### Observed ops warning

Latest successful log contains repeated nginx warnings during reload:

- `conflicting server name "mehyarmedia.mehyar.us" on 187.124.147.49:443, ignored`
- `conflicting server name "stuffprettygood.com" on 187.124.147.49:443, ignored`
- `conflicting server name "www.stuffprettygood.com" on 187.124.147.49:443, ignored`

Nginx syntax still passed and reload completed, so this is not a hard failure for the daily pull, but it is recovery debt worth cleaning up in the VPS config.

### Live smoke gap

The latest log shows the smoke script passed in local static mode and included this note:

- `Set SPG_LIVE_BASE_URL or pass --base-url=https://domain to run live smoke.`

So the current job verifies local build + deploy path, but live URL smoke depends on `SPG_LIVE_BASE_URL` being present.

## Recovery steps

### If the 6 AM pull does not run

1. Check cron metadata in `/home/mehya/.hermes/cron/jobs.json` for job `cfbd07755c27`:
   - `enabled`
   - `state`
   - `next_run_at`
   - `last_status`
   - `last_error`
2. Confirm the script still exists at `/home/mehya/.hermes/scripts/mehyar-media-daily-pull-everything.sh`.
3. Confirm repo log directory exists: `/home/mehya/work/mehyarmedia/.ops-logs`.
4. Run the repo command manually from `/home/mehya/work/mehyarmedia`:
   - `npm run daily:pull:everything`
5. Review the newest `.ops-logs/daily-pull-everything-*.log` file.

### If cron says the job is already running / duplicate tick skipped

1. Inspect whether a prior run is legitimately still working by checking the newest `.ops-logs/daily-pull-everything-*.log` timestamp.
2. If no active run exists, remove only the stale lock after verifying no running process owns it:
   - stale file path: `/home/mehya/work/mehyarmedia/.ops-logs/daily-pull-everything.lock`
3. Re-run manually with `npm run daily:pull:everything`.

### If the script fails at `spg_daily`

1. Read the failing log file named in the terminal output.
2. Re-run the failing chain locally:
   - `npm run spg:daily`
3. Narrow to substeps if needed:
   - `npm run spg:ingest:daily`
   - `npm run spg:trends:build`
   - `npm run spg:qa:offers`
   - `npm test`
4. If deploy happened before failure suspicion, compare generated public files and rerun smoke before any further release action.

### If the script fails at `opportunities_collect`

1. Read the failing log file named in the terminal output.
2. Re-run:
   - `npm run opportunities:collect`
3. Inspect generated artifacts:
   - `data/opportunity-desk/opportunity-source-runs.json`
   - `data/opportunity-desk/opportunities.json`
4. Check for expected optional-skip behavior, especially missing env-name cases like `SAM_GOV_API_KEY`, versus true adapter failure.

### If deploy/Hostinger reload becomes the blocker

1. Review the same daily-pull log for these stages:
   - `Hostinger backup`
   - `Hostinger rsync public`
   - `Hostinger nginx reload`
2. If nginx warnings escalate to syntax failure, fix VPS site config before re-running deploy.
3. Use the backup tarball generated by the script under `/var/backups/mehyarmedia/` on the VPS as rollback source.

### If live smoke is required but missing

1. Set env key name `SPG_LIVE_BASE_URL` to the approved live domain base URL in the operator environment.
2. Re-run:
   - `npm run spg:smoke`
3. Confirm the smoke output is no longer `local_static_smoke_only` and includes live-route checks.

## Risk

- Medium: job is scheduled and logging correctly, but last-run cron evidence is still pending because the first scheduled 6 AM tick has not fired yet.
- Medium: live smoke is conditional on `SPG_LIVE_BASE_URL`; without it, the job proves local static smoke only.
- Low/medium: nginx duplicate server-name warnings should be cleaned before they become a deploy incident.

## Next action

1. Let the first scheduled 6 AM ET tick fire.
2. After that run, record `last_run_at` / `last_status` evidence for cron `cfbd07755c27`.
3. Optionally add `SPG_LIVE_BASE_URL` so daily smoke verifies the live domain, not just local static output.
4. Open a follow-up infra cleanup for duplicate nginx server-name warnings if they persist.
