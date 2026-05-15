# A-to-Z Reactivation + Sponsor Pilot CRM Contracts

Source of truth: `/home/mehya/.hermes/projects/mehyar-media/PROJECT-001-CRM-COMMAND-CENTER.md`
Parent PRD/backlog: `/home/mehya/.hermes/kanban/boards/mehyar-media/workspaces/t_37b02023/A-TO-Z-SPG-REACTIVATION-CRM-MASTER-PRD-BACKLOG.md`

## Safety doctrine

This implementation is a command-center/control-plane contract. It does not add live sending, provider push, raw export, SMS activation, payments, public claims, or sponsor data transfer.

Hard defaults:

- No raw PII in returned admin contract payloads; contact fields are refs/hashes/masked flags only.
- Clean Segment Finder is count-only by default.
- Sponsor pilots are placement/reporting only; no list sale/rental/consent transfer.
- SMS stays `NO-GO` unless documented written marketing consent, evidence review, STOP/HELP/YES readiness, provider gate, and approval exist.
- Small-cohort approval records still return `liveSendEnabled: false` and `providerPushEnabled: false` in this build.
- Scale/kill decisions are audit-required and block/kill on complaints, provider warnings, missing proof, or unsafe categories.

## Implemented executable contract

`src/crm/reactivationCommandCenter.js` exports pure functions for backend route wrapping:

- `createContactSourceRecord(input)`
- `createFieldMapping(input)`
- `classifyContactTier(input)`
- `buildCleanSegmentPreview(input)`
- `createSponsorPilot(input)`
- `logManualSponsorOutreach(input)`
- `createReactivationWorkflow(input)`
- `createSmsConsentRecord(input)`
- `evaluateSmallCohortApproval(input)`
- `summarizeScaleKillDashboard(rows)`

The tests in `test/reactivation-command-center.test.js` are the executable API contract.

## Module mapping

### Contact War Room

Database additions:

- `crm_contact_sources`
- `crm_source_field_maps`
- `crm_contact_tier_snapshots`

Contract coverage:

- source system/table refs, owner brand, collected-under brand, channel, relationship, estimated counts, source quality, required field presence, approval flags
- canonical field map for brand/source/consent/engagement/interest/location/suppression/revenue/evidence
- audit events for source inspection and field map save
- `rawPiiRendered: false` invariant

### Tier classifier and quarantine

Contract coverage:

- Tier 1 clean money
- Tier 2 dormant email re-permission only
- Tier 3 unknown provenance quarantine
- Tier 4 SMS no written consent
- email/SMS eligibility are separate fields
- suppression overrides eligibility
- classifier version and last-review timestamp included

### Clean Segment Finder

Database addition: `crm_clean_segment_previews`

Contract coverage:

- always returns `queryMode: count_only`
- candidate/suppression/unknown/SMS-no-consent/high-risk counts
- eligible count and suppression overlap rate
- GO/WATCH/NO-GO plus blocker classes
- proof packet says aggregate-only, no list sale/rental, no consent transfer, raw PII excluded
- default expiry is 24 hours

### Sponsor Pilot Manager + Gmail/manual outreach

Database additions:

- `crm_sponsor_pilots`
- `crm_sponsor_outreach_log`

Contract coverage:

- sponsor leads, category, source URL, manual Gmail route, outreach status, offer lane, package price, proof packet, contract/approval status
- boundary fields: no data transfer, exclusive placement, aggregate reporting, disclosure required
- blocked on raw-data/list-rental requests, high-risk categories, missing proof packet, or missing boundary acknowledgement
- manual Gmail logs cannot send to subscriber/audience lists

### Reactivation/preference/return-credit workflow objects

Database addition: `crm_reactivation_workflows`

Contract coverage:

- page types for preference reactivation, return credit, private drop, sponsor giveaway, thank-you, unsubscribe, disclosure/privacy
- required brand identity plus privacy/disclosure/unsubscribe links
- preference taxonomy and event contract
- blocks guaranteed reward/savings/income-style claims
- `liveSendEnabled: false`

### SMS Consent Vault/re-permission

Database addition: `crm_sms_consent_vault`

Contract coverage:

- phone hash/ref only, no raw phone rendering
- consent text ref, opt-in timestamp, source, evidence quality, written marketing consent, double opt-in, review status
- missing written marketing consent or evidence blocks SMS
- even eligible records only advance to provider-gate review; `liveSmsEnabled: false`

### Test-send simulator/small-cohort approval

Database addition: `crm_small_cohort_approvals`

Contract coverage:

- requires segment snapshot, copy version, seed/dry-run, provider gate, suppression, unsubscribe, Boss approval reference
- cap must be 1–10,000
- returns explicit blocker classes
- does not trigger live send/provider push

### Metrics + scale/kill dashboard

Database addition: `crm_scale_kill_decisions`

Contract coverage:

- computes RP1000, CP1000, profit per 1000
- complaint rate >= 0.10% downgrades scale to WATCH; >= 0.30% or provider warning kills
- blocker classes produce BLOCKED
- every row is audit-required and has no raw PII rendering

## SQL schema

`db/compliance_schema.sql` now includes additive tables only. The schema does not run a migration by itself and does not touch production.

## Verification

Run:

```bash
node --test test/*.test.js
```

Expected coverage includes prior compliance/provider/SPG tests plus A-to-Z command-center tests.
