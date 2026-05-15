# CRM Recovery Hard Gates and Prohibited-Action Matrix

Owner: ComplyOps
Applies to: authenticated Mehyar Media CRM at `https://mehyarmedia.mehyar.us/`
Source of truth: `/home/mehya/.hermes/projects/mehyar-media/PROJECT-001-CRM-COMMAND-CENTER.md`
Status: implementation/QA gate artifact

## 0. Ruling

The CRM may be useful, populated, and operational, but it must remain a control room until scoped approvals exist.

Public rule: unauthenticated CRM stays login-only.
Authenticated rule: users may create/edit records, run simulations, view aggregate/count-only previews, manage approvals, and inspect audit evidence.
Hard block rule: no mass send, no SMS, no provider push, no raw PII export, no spend/account tax/bank/KYC, no external submission, no public/bid/customer claim, no prohibited merchant-content use, and no raw PII leakage unless an explicit scoped gate approves the exact action.

Default state for every risky action: `blocked`.

## 1. Universal API acceptance criteria

Every authenticated API endpoint must enforce these baseline controls before module-specific logic:

- Authentication required: unauthenticated requests return `401` or redirect to login; no CRM data in public HTML/JS.
- Authorization required: requests must check actor role/scope; missing scope returns `403`.
- Audit required: every create/update/delete/action/simulation/export-attempt/provider-attempt/submission-attempt writes an audit event before returning success or blocked status.
- Safe response shape: API responses must not include raw secrets, credential values, provider API keys, tax/bank/KYC values, raw PII in list views, or unmasked recipient/contact exports.
- Gate response shape for risky actions:
  - `allowed`: boolean
  - `state`: `allowed | blocked | review_required | no_go | watch | go`
  - `gate`: stable gate id from this document
  - `reasons`: array of human-readable blockers
  - `requiredApprovals`: array of approval ids/roles required
  - `auditEventId`: id of the audit event written
  - `nextSafeAction`: one safe next step, e.g. `run_count_only_preview`, `request_compliance_review`, `fix_unsubscribe_url`
- Idempotency: action endpoints that could create external or high-risk side effects must require an idempotency key and still remain blocked unless approved.
- Rate/cap fields: any preview/simulation/test must include a configured cap; endpoints must reject missing/over-cap values.
- No destructive legacy queries: IONOS/legacy data endpoints must reject write SQL, DDL/DML, full-table pulls, unbounded queries, and direct raw connection details in responses.

## 2. Universal UI acceptance criteria

Every authenticated CRM module must show:

- Current gate state: `GO`, `WATCH`, `NO-GO`, or `BLOCKED` with exact reasons.
- Disabled risky controls by default with tooltip/callout explaining the required gate.
- Safe next action button(s), not dead empty states.
- Audit/evidence panel showing recent relevant events without raw secrets/PII.
- Role/approval state and owner.
- Suppression/consent/source status where contacts, segments, lists, campaigns, journeys, providers, or exports are involved.
- Explicit “No live send/export/provider push/SMS/submission authorized” banner on modules with risky downstream actions until approved.

UI must not show enabled buttons labeled or wired as `Send`, `Export raw contacts`, `Push to provider`, `Text`, `Submit bid`, `Charge`, `Connect payout`, or equivalent unless the matching scoped approval exists and the API independently rechecks the gate.

## 3. Required audit event schema

Minimum fields for every audit event:

- `id`
- `created_at`
- `actor_id`
- `actor_role`
- `action`
- `resource_type`
- `resource_id`
- `decision`: `allowed | blocked | review_required | no_go | watch | go`
- `gate_id`
- `reasons`
- `request_id`
- `session_id`
- `ip_hash` or server-side request fingerprint where available; do not store raw IP in public docs/logs
- `user_agent_hash` where available
- `metadata`: sanitized only; no raw secrets, raw PII, tokens, tax/bank/KYC values, or full destination URLs with private tokens
- `before_state_hash` and/or `after_state_hash` when changing durable records

Audit events must be immutable append-only from the application perspective. Corrections are new events, not edits to old events.

## 4. Prohibited-action matrix

| Gate ID | Prohibited action | Default API result | UI requirement | Required approval before unlock | Audit action(s) |
|---|---|---|---|---|---|
| `GATE_NO_MASS_SEND` | Any email/newsletter/journey live send to legacy or fresh audience | `403 blocked` unless scoped send gate exists | Send buttons absent/disabled; simulator only | ComplyOps + Arman/Boss scoped cohort approval; provider/domain readiness; suppression applied; unsubscribe live; complaint/bounce monitoring; cap and kill switch | `send_attempt_blocked`, `send_gate_requested`, `send_gate_approved`, `send_gate_denied` |
| `GATE_NO_SMS` | Any SMS/MMS/RCS send, test, import-to-SMS-provider, or SMS re-permission send | `403 blocked` | SMS controls disabled with “documented written marketing consent required” | Documented SMS marketing consent for sender/use case + STOP handling + provider approval + ComplyOps/Boss approval | `sms_attempt_blocked`, `sms_consent_reviewed`, `sms_gate_approved` |
| `GATE_NO_PROVIDER_PUSH` | Pushing contacts, lists, segments, campaigns, templates, or automations to ESP/SMS/affiliate/provider platforms | `403 blocked` | Provider sync/push buttons disabled; dry-run validation allowed | Provider account approved; DNS/readiness green; suppression and consent checks complete; scoped object/cap approved | `provider_push_attempt_blocked`, `provider_dry_run_completed`, `provider_push_gate_approved` |
| `GATE_NO_RAW_PII_EXPORT` | Export/download/API return of raw emails, phones, names, addresses, or full contact rows | `403 blocked` | Export raw disabled; count-only and masked preview available | Role-based export approval, field allowlist, masking policy, retention/deletion rule, purpose, cap, ComplyOps approval | `export_attempt_blocked`, `count_preview_run`, `masked_export_created`, `raw_export_gate_requested` |
| `GATE_NO_EXTERNAL_SUBMISSION` | Bid, grant, sponsor pitch, affiliate application, merchant/network application, proposal, external form submission | `403 blocked` for submit; draft/save allowed | Submit/apply/send disabled; draft memo allowed | Arman/Boss or assigned owner approval; claims review; eligibility proof; no false proof; no tax/bank/KYC unless separately approved | `external_submission_attempt_blocked`, `application_draft_saved`, `submission_gate_approved` |
| `GATE_NO_SPEND_TAX_BANK_KYC` | Paid plan, purchase, ad spend, account upgrade, SSN/EIN, tax form, bank/payout setup, KYC, irreversible contract terms | `403 blocked` | Payment/KYC fields hidden or read-only status-only; block message names human-needed field | Boss approval for spend/account/tax/bank/KYC; legal/account owner review | `spend_attempt_blocked`, `tax_kyc_step_blocked`, `payout_setup_blocked` |
| `GATE_NO_FALSE_AUDIENCE_CLAIMS` | Claims of audience size, engagement, deliverability, approvals, customers, case studies, certifications, guaranteed performance, or past results without evidence | `422 validation_error` or `403 blocked` | Claim checker blocks publish/submission until evidence attached | Evidence record with source/ref/hash + ComplyOps approval for public/external use | `claim_validation_failed`, `claim_evidence_attached`, `claim_approved` |
| `GATE_NO_PROHIBITED_MERCHANT_CONTENT` | Scraping/copying/republishing prohibited merchant content, Amazon prices/images/ratings/reviews/availability, or private/terms-restricted data | `403 blocked` | Content/source candidates show rights status; publish disabled if rights unknown/prohibited | Rights/source approval; allowed feed/API/manual/original/generated/owned content only; ComplyOps review for uncertain terms | `merchant_content_blocked`, `source_rights_reviewed`, `content_publish_gate_approved` |
| `GATE_NO_RAW_PII_LEAKAGE` | Raw PII/secrets in frontend, logs, docs, Kanban, screenshots, prompts, public URLs, generated static files | `500/blocked` if detected before write; CI/QA fail | UI masks by default; reveal requires role and reason, never in screenshots | No general unlock; only masked/redacted display and secret-reference storage allowed | `pii_leak_prevented`, `secret_reference_saved`, `redaction_applied` |

## 5. Module-specific gates and acceptance criteria

### 5.1 Admin Auth / RBAC

API acceptance:
- `GET /crm/*` requires login; public returns login-only shell.
- `GET /api/crm/me` returns actor id/role/scopes only, no secrets.
- Role checks required for every module action.
- Session creation, logout, failed login, role change, and permission denial write audit events.

UI acceptance:
- Login-only public state.
- Authenticated user can see role/scope and current environment.
- Admin-only controls hidden/disabled for non-admin users.

Audit actions:
- `auth_login_success`, `auth_login_failed`, `auth_logout`, `rbac_denied`, `role_changed`, `session_revoked`.

### 5.2 Contact War Room / Audience Intelligence

Allowed:
- Aggregate inventory, source classification, tiering, count-only previews, masked samples, suppression overlap, eligibility scoring.

Blocked:
- Raw full-table pulls, raw exports, unbounded legacy queries, direct send-ready list creation without suppression/consent.

API acceptance:
- Preview endpoints enforce `LIMIT <= 100` and mask raw contact fields by default.
- Count endpoints return aggregate counts by source/tier/consent/suppression/risk, not raw rows.
- Tier classifier defaults unknown provenance to quarantine.
- Tier 4 SMS without documented written marketing consent is ineligible for SMS.
- Segment eligibility response includes `eligible_count`, `suppressed_count`, `quarantined_count`, `unknown_consent_count`, `sms_ineligible_count`, `risk_tier`, and `gate_state`.

UI acceptance:
- Shows tiers: clean money, dormant usable email, unknown provenance quarantine, SMS no documented consent quarantine.
- “Create send list” is not available; “Create draft segment/simulation” allowed.
- Raw contact reveal disabled unless separately approved and audited.

Audit actions:
- `source_inventory_viewed`, `tier_classification_run`, `count_preview_run`, `masked_preview_run`, `segment_draft_created`, `raw_pii_reveal_blocked`, `raw_export_attempt_blocked`.

### 5.3 Query Builder / Legacy IONOS Data Explorer

Allowed:
- Schema inspect, safe SELECT count, limited preview, saved queries, metadata mapping, queued count jobs.

Blocked:
- DDL/DML, destructive SQL, unbounded SELECT, `SELECT *` full-table exports, direct credential exposure.

API acceptance:
- SQL parser/guard rejects `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `COPY`, `GRANT`, `REVOKE`, multi-statement queries, and missing limit for preview.
- Preview cap `<=100` rows; count-only preferred for large tables.
- Query timeout and row cap enforced server-side.
- Saved query stores purpose, owner, source, fields used, and risk label.

UI acceptance:
- Shows read-only badge and row/timeout caps.
- Preview displays masked fields.
- Export button disabled or routes to approved masked export workflow only.

Audit actions:
- `legacy_schema_inspected`, `safe_query_validated`, `safe_query_rejected`, `query_preview_run`, `saved_query_created`, `query_job_queued`.

### 5.4 Lists / Segments

Allowed:
- Draft segments, eligibility scoring, suppression overlap, simulator inputs, count-only proof packets.

Blocked:
- Send-ready or provider-sync-ready list status without gates.
- Lists containing unknown consent/source records unless clearly quarantined/non-contactable.

API acceptance:
- Segment create/update requires source classification, consent state, channel eligibility, suppression status, acquisition age band, and risk tier.
- Unknown consent/source records excluded by default from any eligible count.
- Segment cannot transition to `approved_for_test` without suppression applied, unsubscribe path live, provider readiness status, audit enabled, cap, owner, and ComplyOps approval.

UI acceptance:
- Shows usable vs blocked counts.
- “Use in campaign simulator” allowed; “export/send/sync” disabled.

Audit actions:
- `segment_created`, `segment_updated`, `segment_eligibility_scored`, `suppression_overlap_checked`, `segment_transition_blocked`, `segment_test_gate_approved`.

### 5.5 Suppression Manager

Allowed:
- Manage global email unsubscribe, brand unsubscribe, SMS STOP, complaints, bounces, legal/manual suppressions, invalid contacts, source holds, provider warning holds.

Blocked:
- Removing suppression without high-authority review.
- Any campaign approval missing suppression categories.

API acceptance:
- Suppression categories must include: `global_unsubscribe`, `brand_unsubscribe`, `sms_stop`, `spam_complaint`, `hard_bounce`, `soft_bounce_cooldown`, `legal_suppression`, `manual_suppression`, `invalid_contact_point`, `source_hold`, `prohibited_source`, `provider_warning_hold`.
- Suppression writes are append-only events; resolved/overridden states require reason and approver.
- Every segment/campaign readiness check must include suppression overlap result.

UI acceptance:
- Category coverage dashboard.
- “Override suppression” disabled except approved role, reason, and dual review.

Audit actions:
- `suppression_added`, `suppression_imported`, `suppression_overlap_checked`, `suppression_override_blocked`, `suppression_override_approved`, `complaint_suppressed`, `bounce_suppressed`, `sms_stop_suppressed`.

### 5.6 Campaign Manager / Journey Builder

Allowed:
- Draft campaigns, copy review, offer insertion, preview, simulation, seed-test planning, approval workflow, dry-run state.

Blocked:
- Live send, SMS send, provider push, unapproved export, deceptive subject/header, missing unsubscribe/preference path, missing complaint/bounce monitoring.

API acceptance:
- Campaign status enum must not include a live-send state until approved by a later scoped implementation. Current safe states: `draft`, `review`, `remediation`, `future_pilot_approved`, `paused`, `cancelled`.
- `future_pilot_approved` cannot authorize send/export/provider push in Phase 1.
- Simulation response includes expected CTR/CVR/EPC/revenue, complaint risk, unsubscribe risk, confidence, failed gates, required approvals, cap, kill switch, and `liveActionsEnabled:false` unless scoped gate exists.
- Copy validation blocks false claims, guaranteed results, deceptive identity, missing disclosure, missing unsubscribe for email, and prohibited categories.

UI acceptance:
- “Send” is absent or disabled; “Simulate”, “Request review”, and “Create remediation task” are safe actions.
- Approval timeline visible.
- Kill criteria visible for any future pilot.

Audit actions:
- `campaign_draft_created`, `campaign_copy_validated`, `campaign_simulated`, `campaign_transition_allowed`, `campaign_transition_blocked`, `send_attempt_blocked`, `journey_draft_created`, `journey_activation_blocked`.

### 5.7 Provider / Deliverability Command Center

Allowed:
- Provider records, config schema, credential reference status, DNS/SPF/DKIM/DMARC checks, webhook health, dry-run capability checks, bounce/complaint normalization.

Blocked:
- Contact/list/campaign/template push, live send, warmup traffic, DNS changes from CRM without DevOps gate, exposing provider secrets.

API acceptance:
- Provider credentials stored only as secret references, never plaintext values.
- Provider readiness states: `not_configured`, `credentials_reference_present`, `dns_pending`, `webhooks_pending`, `dry_run`, `approved_controlled`, `paused`, `revoked`.
- `approved_controlled` requires DNS green, webhooks verified, suppression integration, unsubscribe/List-Unsubscribe readiness, complaint/bounce intake, provider policy notes, cap, and owner approval.
- Push endpoint returns blocked unless scoped provider-push gate exists.

UI acceptance:
- Shows provider capability flags and readiness blockers.
- Dry-run validation is separate from live send/push.
- Secret values are never displayed.

Audit actions:
- `provider_record_created`, `provider_secret_ref_saved`, `dns_readiness_checked`, `webhook_verified`, `provider_dry_run_completed`, `provider_push_attempt_blocked`, `provider_status_changed`.

### 5.8 Opportunity Desk / External Applications / Sponsor Manager

Allowed:
- Public/approved-source collection, scoring, memos, draft applications, sponsor lead tracking, Kanban routing suggestions.

Blocked:
- Bid/grant/sponsor/affiliate/network submission, customer promise, outreach send, legal commitment, false proof, tax/bank/KYC.

API acceptance:
- Opportunity source records must include source URL, allowed access method, collected timestamp, evidence reference/hash, eligibility requirements, deadline, claims needed, and risk flags.
- Draft assist must output `draft_only:true` and require approval before external use.
- Submit/apply/send endpoints are blocked unless submission gate includes approver, exact destination, final text hash, claim evidence, required attachments, and no tax/bank/KYC blocker.

UI acceptance:
- Shows pursue/watch/reject/needs-partner/needs-approval.
- Submit/apply buttons disabled until approval.
- Claim warnings visible near generated drafts.

Audit actions:
- `opportunity_collected`, `opportunity_scored`, `go_no_go_memo_generated`, `application_draft_created`, `external_submission_attempt_blocked`, `submission_gate_approved`, `claim_validation_failed`.

### 5.9 Offer Intelligence / StuffPrettyGood Monetized Source Pipeline

Allowed:
- Monetized offer records, approved source ingestion, Amazon manual/SiteStripe/deep-link workflow, Skimlinks/Stay22 server-side sanitized records, direct/referral/sponsor/owned offer candidates, approval/publish filters.

Blocked:
- Free/unpaid filler by default, unknown monetization status, direct external hrefs from public cards, prohibited Amazon scraping/merchant-content copying, unapproved offer publication.

API acceptance:
- Offer record requires: slug, vendor, category, program/source, monetization_status, payout_model, account_status, approval_status, image_rights_status, disclosure_required, risk_tier, source_url, public_landing_url, redirect_url, destination reference/sanitized URL, last_reviewed_at, owner.
- Publish filter allows only `approval_status=approved` and monetization_status in `affiliate`, `referral`, `amazon_manual`, `manual_sponsor`, `owned_offer`, `paid_network`, `approved_lead_magnet`.
- Blocks `unknown` and `free_unpaid` unless ProductOps/Arman strategic approval is attached.
- Amazon no-PA-API rule: no copied/scraped Amazon prices, images, ratings, reviews, availability, Prime badges, or listing copy.
- Public offer click path must be card -> `/offers/<slug>` -> disclosure -> `/go/<slug>`.

UI acceptance:
- Candidate rows show monetization, rights, disclosure, and publish blockers.
- Approval UI prevents publish until landing and redirect are approved.
- External destination details are not exposed in homepage cards.

Audit actions:
- `offer_candidate_ingested`, `offer_candidate_blocked`, `offer_rights_reviewed`, `offer_approved`, `offer_publish_blocked`, `offer_published`, `go_click_recorded`, `merchant_content_blocked`.

### 5.10 Signup / Preference / Unsubscribe

Allowed:
- Public signup/preference capture in no-send mode, double-opt-in capable email verification, unsubscribe/global opt-out, preference center, audit-safe records.

Blocked:
- Automatic welcome/send enrollment, SMS activation, provider push, logging raw PII.

API acceptance:
- Signup writes source, consent copy/version, timestamp, page/UTM, preference topics, audit event, and server-side masked/hashed identifiers where practical.
- Unsubscribe supports brand-level and global opt-out and writes suppression immediately.
- Preference update never implies SMS consent unless explicit written SMS marketing consent is captured with compliant language.
- No-send mode returns `enrolledForSending:false`.

UI acceptance:
- Signup, preferences, unsubscribe, privacy, terms, and disclosure visible.
- Confirmation copy says preferences saved/no-send if provider gate is not active.

Audit actions:
- `signup_captured_no_send`, `preference_updated`, `double_opt_in_requested`, `unsubscribe_global_saved`, `unsubscribe_brand_saved`, `sms_consent_declined_or_missing`, `suppression_added`.

### 5.11 Account Factory / Affiliate Network Accounts

Allowed:
- No-cost account planning and status tracking with truthful Mehyar Media/StuffPrettyGood details; credential references only.

Blocked:
- Paid subscriptions, false traffic/audience claims, tax forms, SSN/EIN, bank/payout setup, phone OTP/CAPTCHA bypass, irreversible terms without approval.

API acceptance:
- Account record includes network/source name, login URL, account email, owner, approval status, payout terms, tax/KYC status, tracking ID label, credential_ref, created_at, last_verified_at, next action.
- If setup requests SSN/EIN/bank/tax/paid plan/OTP/CAPTCHA/legal agreement, status becomes `blocked_human_required` with field names only, not values.

UI acceptance:
- Shows account status and next blocker.
- Credential values hidden; only reference/status visible.
- No false audience claim fields auto-filled.

Audit actions:
- `source_account_planned`, `source_account_created_no_cost`, `credential_ref_saved`, `account_creation_blocked_human_required`, `tax_kyc_step_blocked`, `account_claim_validation_failed`.

### 5.12 Revenue Intelligence / Reporting

Allowed:
- Aggregate dashboards for clicks, conversions, revenue, EPC, RPM, source/persona/offer/campaign/segment/risk rollups.

Blocked:
- Unverified performance claims, customer-facing guarantees, fabricated conversions/revenue.

API acceptance:
- Dashboard labels estimated/imported/unverified metrics distinctly.
- Public/external claim export requires claim evidence gate.
- No raw contact-level event dump by default.

UI acceptance:
- Shows confidence/source of each metric.
- Public-copy/export buttons blocked until claims approval.

Audit actions:
- `revenue_dashboard_viewed`, `metric_imported`, `metric_marked_unverified`, `claim_export_blocked`, `claim_approved`.

### 5.13 Compliance Evidence Vault / Audit Log

Allowed:
- Evidence references, source snapshots, consent/source proof, suppression proof, provider/readiness proof, approval records, immutable decision timeline.

Blocked:
- Raw PII/secrets/tokens in evidence notes, screenshots, prompts, public URLs, docs, Kanban, frontend.

API acceptance:
- Evidence upload/reference requires classification and redaction status.
- Raw secret/PII detector blocks or quarantines unsafe text before durable save.
- Audit search supports filters without revealing raw sensitive values.

UI acceptance:
- Evidence records show type, owner, hash/ref, redaction status, approval state.
- Raw sensitive evidence cannot be rendered to normal users.

Audit actions:
- `evidence_reference_created`, `evidence_redaction_required`, `evidence_approved`, `audit_event_viewed`, `pii_leak_prevented`, `secret_leak_prevented`.

### 5.14 Operations Center / Jobs / Queues

Allowed:
- Job monitoring, dry-run jobs, ingestion status, retry/dead-letter views, incident log, rollback, kill switches.

Blocked:
- Job types that send/export/push/submit/spend without gate.

API acceptance:
- Job definition includes `risk_class`, `side_effect_class`, `dry_run_default`, `cap`, `kill_switch`, `owner`, and `audit_required`.
- Risky jobs cannot transition to active unless class gate exists.
- Kill switch can pause provider push/send/export/submission job classes globally.

UI acceptance:
- Shows queue health and risk class.
- Risky job run buttons disabled by default.
- Kill switches visible and auditable.

Audit actions:
- `job_defined`, `job_dry_run_started`, `job_run_blocked`, `job_completed`, `job_failed`, `kill_switch_enabled`, `kill_switch_disabled`, `rollback_started`.

## 6. Caps and rate limits for safe lanes

These caps are maximums for implementation and QA unless a later task sets stricter values:

- Legacy preview: `LIMIT <= 100` masked rows per request.
- Count-only cohort preview: no raw rows; aggregate only.
- Export: raw export max `0` by default; masked export only after approval and field allowlist.
- Campaign simulator: unlimited safe local simulations, but no live action side effects.
- Future email pilot placeholder: not authorized by this artifact; requires separate scoped approval with cohort cap, seed test, provider gate, and kill criteria.
- SMS: cap `0` until documented written marketing consent + SMS provider/STOP gate.
- Provider push: cap `0` until scoped provider-push gate.
- External submissions/applications: cap `0` until exact destination/content approval.
- Spend/tax/bank/KYC: cap `$0` and no data submission until Boss approval.
- Account creation: no-cost only; stop at CAPTCHA/OTP/tax/bank/SSN/EIN/paid plan/legal uncertainty.

## 7. Stop conditions and escalation thresholds

Stop immediately and set affected module to `blocked` if:

- Any raw PII/secret appears in frontend, public file, docs, logs, screenshots, Kanban, prompt, or URL.
- Complaint/bounce/provider warning data appears without suppression write.
- Unknown-source/unknown-consent records appear in eligible send/SMS counts.
- SMS consent is missing or ambiguous.
- Provider push/send/export endpoint succeeds without matching approval.
- Public/external claim lacks evidence.
- Merchant/source terms are unknown or prohibit the planned content use.
- Any workflow asks for spend, paid plan, SSN/EIN, tax, bank, KYC, CAPTCHA, phone OTP, or irreversible legal terms.

Escalate to Boss/Arman/ComplyOps before proceeding on the exact item.

## 8. QA checklist for implementation workers

Final QA must verify these as separate GO/NO-GO lines:

- Public CRM login-only: GO/NO-GO.
- Authenticated CRM useful modules/forms/actions: GO/NO-GO.
- No-send enforcement: GO/NO-GO.
- No-SMS enforcement: GO/NO-GO.
- No-provider-push enforcement: GO/NO-GO.
- No-raw-PII-export enforcement: GO/NO-GO.
- No external bid/application/submission enforcement: GO/NO-GO.
- No spend/tax/bank/KYC enforcement: GO/NO-GO.
- Claim truth/evidence gate: GO/NO-GO.
- Merchant content rights gate: GO/NO-GO.
- Raw PII/secret leakage prevention: GO/NO-GO.
- Audit event presence for every allowed and blocked risky action: GO/NO-GO.
- UI disabled states/tooltips/blocker reasons match API decisions: GO/NO-GO.

A module does not pass if the UI is safe but the API action succeeds, or if the API blocks but no audit event is written.
