# Opportunity Finder daily collectors — DevOps runbook

Task: t_16f6064d
Owner: DevOps
Status: implementation-ready, internal collection only

## Scope

Daily collectors normalize public/read-only opportunity signals into local JSON artifacts for the CRM Opportunity Desk. They do not submit, apply, create accounts, message buyers, publish claims, or export raw PII.

## Source families covered

- SAM.gov contract opportunities via official API adapter.
- USAspending award intelligence via public read-only API.
- Grants.gov public opportunity search adapter.
- Registry-driven RSS/public posting collectors.
- Safe job/marketplace demand-signal RSS imports where source terms allow public access.

## Files

- `data/opportunity-source-registry.json` — source registry, guardrails, env key names, access method, rate/kill criteria.
- `scripts/collect-opportunity-finder.mjs` — idempotent daily collector runner and source adapters.
- `data/opportunity-desk/opportunity-source-runs.json` — generated source-run status, counts, skips, and sanitized errors.
- `data/opportunity-desk/opportunities.json` — generated normalized opportunity records.
- `test/opportunity-collectors.test.js` — registry/adapter/idempotency coverage.

## Env key inventory

Names only; never store values in Git, Kanban, logs, or docs.

- `SAM_GOV_API_KEY` — optional but required for the SAM.gov adapter to fetch live results. If absent, SAM.gov run is marked `skipped` with `missing_env:SAM_GOV_API_KEY`.

USAspending, Grants.gov, RSS, and posting adapters do not require credentials in this implementation.

## Commands

Local one-shot run:

```bash
npm run opportunities:collect
```

Direct script form:

```bash
node scripts/collect-opportunity-finder.mjs \
  data/opportunity-source-registry.json \
  data/opportunity-desk/opportunity-source-runs.json \
  data/opportunity-desk/opportunities.json
```

Tests:

```bash
npm test -- test/opportunity-collectors.test.js
npm test
```

## Idempotency model

- Each source run id is `YYYY-MM-DD-source_id`; reruns for the same day replace latest run state while keeping bounded history.
- Opportunities dedupe by `source_id + source_record_id/title/url` hashed into `dedupe_key`.
- Reruns update existing opportunity records instead of appending duplicates.
- Source errors are stored as sanitized status records; no tokens, raw PII, or secret values are written.

## Daily schedule proposal

Use a silent-on-success cron wrapper after the CRM backend/API is ready to consume the generated artifacts.

Suggested cadence:

- Schedule: once daily, early morning America/New_York.
- Command: `npm run opportunities:collect` from `/home/mehya/work/mehyarmedia`.
- Success behavior: no alert unless opportunity count changes materially or a source transitions to `blocked`/`error`.
- Alert behavior: source status `blocked`, repeated `error`, 403/429, schema change, or raw secret/PII scan failure.

## Rollback / kill switch

- Disable one source by setting `enabled: false` in `data/opportunity-source-registry.json`.
- Disable all automation by pausing/removing the cron job.
- Delete generated artifacts only if needed; they are rebuildable from public sources.
- Do not continue polling a source that returns 403/429, CAPTCHA/login wall, provider complaint, or ToS ambiguity.

## Compliance gates

Inherited gate: `t_370312f0`.

Allowed:

- Public/official API/RSS collection.
- Internal normalization, scoring, summarization, and read-only CRM evidence.
- Sanitized Kanban routing later, after LeadFS/API implementation.

Blocked without separate approval:

- SAM.gov/Grants.gov/bid/proposal submission.
- Vendor registration, representations/certifications, portal uploads, Q&A, quotes, pricing, or agency contact.
- Affiliate/sponsor outreach or account creation.
- Marketplace/job application, bidding, messaging, paid account, or ToS acceptance.
- Raw PII/secret export or third-party upload.

## Health checks

A healthy run has:

- `data/opportunity-desk/opportunity-source-runs.json` with `schema_version=opportunity_source_runs.v1`.
- One latest run per enabled source.
- `status` in `ok` or intentional `skipped` for missing optional credentials.
- `data/opportunity-desk/opportunities.json` with deduped records containing `evidence`, `source_snapshot_hash`, `score`, `gate_status=draft_only`, and `external_action_type=none`.

## Handoff to LeadFS/WebDev/ProductOps

LeadFS can replace JSON writes with database upserts against the Opportunity Desk tables. Preserve the same fields: `source_runs`, `opportunities`, `evidence`, score trace, source snapshot hash, status, and gate controls.

WebDev should render all generated opportunities as internal-only decision records. Any external-action button remains disabled unless a future gate changes `gate_status` to approved with expiry and reviewer evidence.
