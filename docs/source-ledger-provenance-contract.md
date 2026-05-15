# Source Ledger provenance data contract

Task: t_258ebd86
Owner: DataEng
Status: implementation contract for LeadFS/WebDev/ProductOps/ComplyOps review
Executable contract: `src/core/source-ledger.js`
Tests: `test/source-ledger-contract.test.js`
Migration draft: `db/006_source_ledger_provenance_schema.sql`
Canonical vision: `docs/crm-2026-truth-first-revenue-os-vision.md`

## Reality

The CRM must become truth-first: no fake production seed rows, no invented lists/segments/campaigns/opportunities, and no production count/action without provenance. Empty but honest beats populated but false.

This contract creates a shared provenance layer for:

- opportunities
- SPG offers
- jobs/source runs
- campaign prerequisites

It stores source proof, run deltas, state, blockers, missing data, and production visibility without raw PII or raw secrets.

## Canonical provenance states

Every production-facing record, count, queue item, and action must carry exactly one state:

- `verified`: loaded from a real source artifact, live service, DB query, or audited operator entry and passed freshness/health checks.
- `pending`: source or artifact exists, but freshness, health, consent, suppression, or reviewer validation has not passed yet.
- `simulated`: prototype/test-only fixture. Must be hidden from production revenue views and action queues.
- `blocked`: source/action exists, but a compliance, credential, health, suppression, consent, or authority gate prevents use.
- `missing`: no real data exists yet. Show next action instead of fake rows.

Production revenue/action views use only:

```sql
provenance_state = 'verified'
and production_visible = true
and suppression_status in ('not_applicable', 'verified_clear')
and no_raw_pii_asserted = true
and no_raw_secret_asserted = true
```

Any broader internal operator/debug view must still exclude simulated rows by default unless explicitly in test/prototype mode.

## Source artifacts

Minimum source artifact fields:

- `artifact_ref`: durable internal ref, e.g. `artifact:opportunities:run-001`
- `source_id`
- `source_name`
- `source_class`: `SPG offer feed`, `public opportunity feed`, `job posting`, `RSS`, `government`, `affiliate/network`, `legacy audience`, `operator entry`, or `system job`
- `artifact_type`: JSON snapshot, DB table, screenshot ref, run output, decision memo, compliance gate, etc.
- `artifact_uri`: internal path/table/ref only; do not include raw secret-bearing URLs
- `artifact_hash`: optional digest, not a secret
- `produced_by_run_id`
- `observed_at`
- `source_updated_at`
- `source_age_hours`
- `freshness_sla_hours`
- `freshness_state`: `fresh`, `stale`, or `unknown`
- `credential_ref_env`: environment/secret key name only, e.g. `env:SAM_GOV_API_KEY`; never the value
- `no_raw_pii_asserted`
- `no_raw_secret_asserted`

## Run deltas

Each collector/job run should write a safe delta:

- `run_id`
- `source_id`
- `status`: `queued`, `running`, `ok`, `warning`, `error`, `blocked`, `skipped`
- `started_at`
- `finished_at`
- `records_seen`
- `records_added`
- `records_updated`
- `records_rejected`
- `records_blocked`
- `rejection_rate`
- `artifacts_written`
- `top_errors`: sanitized summaries only
- `delta_state`: `verified`, `pending`, `blocked`, or `missing`
- `safe_log_preview_ref`: optional internal ref, sanitized before UI
- `no_raw_pii_asserted`
- `no_raw_secret_asserted`

No raw logs, tokens, emails, phone numbers, contact exports, or provider payloads belong in the ledger.

## Entity records

Shared fields for `opportunity`, `spg_offer`, `job`, and `campaign_prerequisite`:

- `contract_version = source-ledger-provenance-v1`
- `entity_type`
- `entity_id`
- `display_name`
- `provenance_state`
- `source_ref`
- `artifact_refs`
- `latest_run_delta` / `latest_run_id`
- `source_age_hours`
- `suppression_status`: `not_applicable`, `verified_clear`, `pending`, `blocked`, or `unknown`
- `consent_state`
- `gate_status`
- `owner_profile`
- `route_owner_profile`
- `next_action`
- `missing_data`
- `blocker_classes`
- `confidence_score`
- `production_visible`
- `actionable`
- `no_raw_pii_asserted`
- `no_raw_secret_asserted`

### Entity rules

Opportunities:
- Actionable only when `verified`, source/artifact proof exists, freshness is acceptable, and suppression is `not_applicable` or `verified_clear`.
- Pending opportunities may appear in internal Source Ledger/Opportunity Desk with missing proof clearly shown, but not in revenue-action counts.

SPG offers:
- Simulated/test fixtures stay `simulated` and hidden from production revenue views.
- Public offer/feed eligibility still requires existing SPG gates: approved account/source/disclosure/image/tracking/go-link proof.
- Non-Amazon or unapproved account candidates remain `pending` or `blocked` until account/credential proof passes.

Jobs/source runs:
- Running/queued jobs are `pending`.
- Completed healthy jobs with artifacts are `verified`.
- Failed/gated jobs are `blocked` or `pending` depending on blocker class and retry path.
- Skipped/no artifact jobs are `missing` with a next action.

Campaign prerequisites:
- Legacy audience, segment, suppression, consent, provider readiness, DNS, unsubscribe/preference path, and approval prerequisites must be represented as records.
- Unknown legacy audience defaults to `blocked` or `missing`; it must not contribute to eligible/actionable counts.
- Any list/segment/campaign prerequisite requires `suppression_status=verified_clear` before eligibility counts.

## No-PII/no-secret schema boundary

Allowed:
- source/artifact IDs
- internal refs
- env/secret key names only
- count-only audience metrics
- masked/hash references
- public organization-level metadata
- sanitized errors and blocker classes

Prohibited:
- raw emails, phones, names tied to contacts, addresses, SSNs, or contact exports
- API keys, tokens, passwords, bearer strings, OAuth payloads, private keys
- raw provider responses or raw logs containing either class
- secret-bearing URLs
- invented proof, fake source artifacts, fake revenue counts, fake eligible audience counts

## Migration path

Additive only. No destructive statements.

1. Create shared tables/views from `db/006_source_ledger_provenance_schema.sql`.
2. Add or map shared provenance fields onto existing modules:
   - `opportunities`: derive from existing `source_id`, `latest_source_run_id`, `evidence_refs_json`, `gate_status`, and `suppression_status`; default missing proof rows to `missing`.
   - `spg_offers`: map offer candidates/accounts/tracking/publish decisions into ledger rows; existing fixtures or hardcoded samples are `simulated`; approved public feed rows are `verified` only after source/account/disclosure/tracking proof.
   - `jobs`: map Jobs Control runs into `source_ledger_runs`; only healthy runs with artifacts become `verified`.
   - `campaign_prerequisites`: create explicit rows for source, consent, suppression, provider/domain readiness, unsubscribe/preference path, and approval proof; default unknown legacy audience to `blocked`/`missing`.
3. Update production queries to use `production_provenance_records` or equivalent filter.
4. Update UI empty states to show `next_action` for `missing` and blocker class for `blocked`.
5. Add fixture/test mode switch before displaying `simulated` rows anywhere.

## API contract

LeadFS can expose this as a shared internal API envelope on CRM modules:

```json
{
  "contract_version": "source-ledger-provenance-v1",
  "record": {
    "entity_type": "opportunity",
    "entity_id": "opp-001",
    "provenance_state": "verified",
    "source_ref": "sam_gov_public_opportunities",
    "artifact_refs": ["artifact:opportunities:run-001"],
    "suppression_status": "not_applicable",
    "production_visible": true,
    "actionable": true,
    "next_action": null,
    "missing_data": [],
    "blocker_classes": [],
    "no_raw_pii_asserted": true,
    "no_raw_secret_asserted": true
  }
}
```

List endpoints should return a summary envelope:

```json
{
  "contract_version": "source-ledger-provenance-v1",
  "counts": {
    "verified": 1,
    "pending": 0,
    "simulated": 0,
    "blocked": 0,
    "missing": 0
  },
  "production_visible": 1,
  "actionable": 1,
  "blocked": [],
  "missing": []
}
```

## Acceptance checks

Executable tests cover:

- all five provenance states
- all four entity classes
- source artifacts with env-key-only credential refs
- run delta added/updated/rejected counts
- no-PII/no-secret rejection
- production filter excluding simulated/pending/blocked/missing and suppression-unknown records
- migration path for opportunities, SPG offers, jobs, and campaign prerequisites
- additive SQL with production/non-simulated views

Run:

```bash
node --test test/source-ledger-contract.test.js
```

## Confidence / missing data / failure modes

Confidence: 0.86. The contract is executable and test-covered, but needs LeadFS integration into actual API routes/stores and ComplyOps review on final consent/suppression state labels.

Missing data:
- Final LeadFS migration runner convention for production DB.
- Final table names for SPG offer rows if current unprefixed/prefixed model changes.
- Final UI route names for Source Ledger and Jobs Control modules.

False-positive risks:
- A record can be structurally verified while the underlying source terms change after review.
- `no_raw_pii_asserted` and `no_raw_secret_asserted` are assertions; ingestion scanners must still reject unsafe payloads before persistence.
- `verified_clear` suppression status can become stale if suppression source refresh fails.

Refresh cadence:
- Source artifacts: per collector/job run.
- Opportunity/SPG/job ledger summaries: every daily pull and manual rerun.
- Campaign prerequisites: refresh before any dry-run or approval gate; never reused for broad activation without a fresh gate.

## Downstream handoff

LeadFS:
- Wrap module API responses with the shared provenance envelope.
- Add migration/backfill using additive SQL only.
- Block production actionable state unless the shared production filter passes.

WebDev:
- Display provenance badges everywhere production-facing records/counts/actions appear.
- Hide simulated rows by default.
- Render `missing.next_action` and `blocked.blocker_classes` instead of fake rows.

ProductOps:
- Treat Source Ledger and Evidence Vault as the proof backbone for IA.
- No module should imply readiness without `verified` provenance.

ComplyOps:
- Review consent/suppression labels and verify that legacy audience defaults stay blocked/quarantined.
