# Opportunity Desk Backend/API Contract

Owner: LeadFS
Status: implementation contract — daily money engine schema v2
Task: t_44afcca7

## Release posture

Opportunity Desk is internal decision support only. The backend stores source evidence, normalized opportunity records, transparent scores, internal AI memo drafts, decisions, suppression checks, digest snapshots, and Kanban route proposals. It does not submit bids, grants, affiliate applications, sponsor outreach, public copy, provider pushes, paid/KYC/tax/bank workflows, or raw PII exports.

ComplyOps gate matrix: `docs/opportunity-finder-external-action-ai-decision-gates.md`. LeadFS/WebDev must use that artifact for action-class gate IDs, disabled-button copy, caps, audit events, stop conditions, and escalation thresholds.

Every API response exposes `externalActionsEnabled: false` or `blocked_external_actions` where relevant. External action state transitions are blocked unless `gate_status=approved`, an approval/gate reference exists, and the approval has not expired.

## Auth boundary

All Opportunity Desk routes are authenticated:

- Read routes require `records:read` or `dashboard:read` for `/dashboard`.
- Write routes require `records:write`.
- No public Opportunity Desk route exists.
- Credential fields accept environment variable references only: `env:VARNAME`. Secret values are rejected.
- Secret-like and raw PII-like payloads are rejected or redacted before memo/Kanban surfaces.

## API surface

Base path: `/api/opportunity-desk`

### Sources

- `GET /sources`
- `POST /sources`
- `PATCH /sources/:sourceId`

Source fields include `source_family`, `source_name`, `source_url`, `access_method`, `auth_required`, `credential_ref_env`, `refresh_cadence`, `rate_limit`, `kill_switch`, `source_health`, and privacy/contact policy metadata.

Allowed source families: `sam_gov`, `usaspending`, `grants_gov`, `state_local`, `local_smb`, `rss`, `affiliate`, `sponsor`, `job_board`, `postings`, `marketplace`, `subcontracting`, `prime_portal`, `internal_network`, `spg_proof`, `manual`.

Daily money engine source rows also expose `source_type`, `business_line`, `route_owner_profile`, `source_priority`, `source_health_reason`, `source_health_checked_at`, `source_risk`, `source_fit_dimensions`, `expected_value_basis`, `first_cash_window_days`, `collector_status`, and `kill_criteria`. Schema-only rows are allowed when disabled until the collector/API gate is approved.

### Source runs / ingestion

- `GET /source-runs`
- `POST /source-runs`

`POST /source-runs` accepts source-run metadata plus `records` or `opportunities`. Each record is normalized/upserted into `opportunities` by `source_id + external_id` or dedupe hash. Payloads with raw PII/secret-like content are rejected into `rejected_records` and are not stored.

### Opportunities

- `GET /opportunities`
- `POST /opportunities`
- `PATCH /opportunities/:id`

Normalized opportunity records include source/run refs, external/source refs, opportunity type, buyer/org-level metadata, fit tags, fit score dimensions, revenue model, expected value (`expected_value_usd`, basis, confidence), first-cash path/window, SPG proof signals, proof requirements, suppression status, gate status, route owner, and route state.

`GET /opportunities` supports local/internal filtering by `source_id`, source registry-derived `source_family`, source registry-derived `source_name`, `status`, `opportunity_type`, `buyer_domain`, `gate_status`, `suppression_status`, `owner_profile`, and `route_owner_profile`. Public opportunity responses must retain the rich detail fields needed by the CRM drawer: `source_id`, `source_name`, `source_family`, `buyer_org_name`, `expected_value_usd`, `expected_value_basis`, `due_at`/deadline, `eligibility`, `required_docs`, `evidence_refs`, and `blocked_external_actions`. Filters are read-only; they must not trigger outreach, applications, submissions, account creation, public publishing, raw PII export, spend, or provider-side actions.

### Scoring

- `POST /opportunities/:id/score`

Creates a versioned score using `opportunity-score-v1` unless overridden. Required score output fields:

- `raw_dimension_scores`
- `weights`
- `weighted_score`
- `confidence_score`
- `false_positive_risk`
- `missing_fields`
- `source_age_hours`
- `privacy_pii_handling`
- `refresh_cadence`
- `score_explanation`
- `recommendation_band`

Default money-engine weights: `speed_to_cash` 15, `expected_value` 14, `gross_margin` 10, `existing_asset_fit` 13, `audience_channel_fit` 10, `source_quality` 8, `evidence_strength` 8, `automation_potential` 10, `recurring_revenue_potential` 10, `deadline_urgency_fit` 4, `strategic_option_value` 10. Risk dimensions are lower-is-better and reduce final score: `compliance_risk` -12, `reputation_risk` -10, `operational_complexity` -8, `boss_attention_required` -10. Every score must return confidence, missing data, source age, source health, privacy/PII handling, false-positive risk, and refresh cadence.

### AI memo interface

- `POST /opportunities/:id/memos`

This is a memo generation/storage interface, not an external model dependency. Default memo output is deterministic internal decision support with required sections:

- Reality
- Fit
- Buyer pain
- First-cash path
- Required proof
- Missing fields
- Compliance gates
- Evidence refs
- Recommendation
- Next action
- Kill criteria

Supported memo types:

- `triage` / `go_no_go`: internal decision-support memo for pursue/watch/reject routing.
- `application_plan`: internal AI application helper memo. It explains how to apply/pursue safely, the missing-info checklist, official source evidence requirements, package angle, required approval gates, and kill criteria. It must include `AI application helper`, `Apply path`, and explicit copy that AI cannot submit/apply/contact/publish. ProductOps source spec: `docs/opportunity-desk-application-helper-memos-product-spec.md`.

Every memo includes the label `INTERNAL DECISION SUPPORT — NOT EXTERNAL COPY`, model/provider metadata, prompt version, evidence refs, confidence, hallucination risk, and human review status. Memo generation is blocked if raw PII/secrets are detected.

### Decisions

- `POST /opportunities/:id/decision`

Records immutable decision logs for pursue/watch/reject/route/request-more-data/duplicate/stale/archive decisions. External action decisions require a live approval gate.

### Kanban routing hook

- `POST /opportunities/:id/route-kanban`

Creates a sanitized route proposal and route ref. It does not directly call the Kanban tool or create an external side effect. Output includes:

- title
- assignee_profile
- route_type
- desired outcome
- evidence refs
- constraints/gates
- acceptance criteria
- blocker conditions
- no-external-action statement

Allowed route types: `product_brief`, `collector`, `backend_api`, `ui_build`, `comply_review`, `scout_research`, `sales_prep`, `devops_job`, `data_quality`, `review`.

### Digest and dashboard

- `GET /digest?date=&scope=`
- `GET /dashboard`

Digest snapshots include top opportunities, counts by status/source/type, source performance, stale kill list, and fast-cash/asset/strategic picks. Dashboard exposes executive queues: pursue, watch, risk, stale, source health, and Kanban bridge.

### Suppression checks

- `GET /suppression-checks`
- `POST /suppression-checks`

Suppression checks record source terms, do-not-contact, consent, jurisdiction, domain policy, or complaint state. They do not authorize outreach by themselves.


## Daily money engine source requirements

Required seed/source rows for v2:

- Local SMB public web/job-posting leads: schema-only until ToS-safe collector approved; route owner `arman`; first-cash target 7 days; no raw personal contact export.
- State/local procurement portals: schema-only official portals/RSS only; route owner `productops`; certification/deadline gates required.
- Prime/subcontracting portals: schema-only; account creation, NDA, clearance, and partner requirements stay gated.
- Affiliate/network/sponsor watchlist: schema-only public program pages; applications/outreach/KYC/tax/bank actions blocked until gate approval.
- StuffPrettyGood proof signals: active internal aggregate source; no raw visitor/user PII; used to support evidence strength, audience fit, and first-cash confidence.

API requirements for create/patch/ingest:

- Accept but never require `expected_value_usd`; require `expected_value_basis` when value is estimated.
- Accept `first_cash_window_days` and `first_cash_window_basis` separately from prose `first_cash_path`.
- Preserve `route_owner_profile` on both source and opportunity records so dashboard queues can route to Arman/ProductOps/Scout/DataEng without guessing.
- Persist source health per run through `source_health_after`, `source_health_reason`, and `opportunity_source_health_logs`.
- Decision logs snapshot `expected_value`, `first_cash_window`, `gate_status`, and `route_owner_profile` at decision time.
- All external action states remain blocked unless `gate_status=approved`, `approval_ref` exists, and approval is unexpired.

## Durable schema

SQL migration draft: `db/005_opportunity_desk_schema.sql`.

Runtime JSON store: `data/opportunity-desk-store.json` by default, with test injection support via `new OpportunityDeskStore({ path })`.

Core lifecycle:

`opportunity_source_registry → opportunity_source_runs → opportunities → opportunity_scores → opportunity_ai_memos → opportunity_decision_logs → opportunity_kanban_routing_refs → opportunity_daily_digest_snapshots`

Supporting tables:

`opportunity_evidence_refs`, `opportunity_suppression_checks`.

## Acceptance checklist

- Source registry supports approved source families and env-var-only credential refs.
- Source-run ingestion normalizes/upserts records and preserves rejected unsafe payloads as non-sensitive blocker metadata only.
- Scoring returns transparent dimensions, weights, score, confidence, missing fields, and risk explanation.
- AI memo contract is internal-only, evidence-referenced, model-attributed, and redaction-gated.
- Kanban routing exports sanitized internal work drafts only.
- Publish/commitment/external action blockers are enforced in patch/decision/route flows.
- Auth boundary protects all routes; no public Opportunity Desk endpoint exists.
