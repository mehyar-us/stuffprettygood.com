# Admin UX Acceptance Specification

Owner: Product / Ops Designer — Lena Ortiz
Issue: MEHAA-21
Status: Phase 1 acceptance baseline

This document converts the workflow map in `docs/product-workflows-admin-ux.md` into screen-by-screen acceptance criteria for the CRM Command Center admin experience.

## Non-negotiable Phase 1 guardrails

- No mass sending, blasting, send-now, provider dispatch, or production scheduling control exists.
- CRM domain `mehyarmedia.mehyar.us` is never treated as a marketing sending domain.
- Legacy IONOS data access is read-only, limited, paginated, and inspected before use.
- Secrets are never displayed in the frontend, logs, screenshots, or committed files.
- Every material admin action is attributable to an actor and audit event.

## Screen acceptance criteria

### 1. Login / Admin Auth

User goal: authenticate known operators and keep every privileged action traceable.

Acceptance criteria:

- Screen provides email/password login.
- Invalid credentials return a safe error without leaking whether an account exists.
- Successful login creates a session and exposes only safe user metadata.
- Admin can view users, roles, and active sessions.
- Role choices are explicit: owner, admin, operator, reviewer, read_only.
- Default local admin credentials are labeled local-only and must be replaced before production.
- User creation, login success, login failure, and session lookup produce audit events.

Blockers:

- Production password/session policy still needs final security owner approval.
- Component library choice remains open.

### 2. Dashboard

User goal: understand operational readiness and highest risks in under one minute.

Acceptance criteria:

- Screen shows API health, local database readiness, legacy IONOS status, audit status, and deployment/CI status.
- Screen shows Stuff Pretty Good pilot readiness: segment status, suppression status, compliance status, sender/domain readiness, approval status, and blocked send/export/provider-push states.
- Screen shows counts for brands, domains, lists, campaigns, suppressions, integrations, and safe query templates.
- Risk alerts appear above routine metrics.
- Alerts include missing compliance URLs, unverified DNS/SSL, blocked sending readiness, high suppression overlap, legacy source failures, and campaigns blocked by approvals.
- Metric cards link to their owner modules.
- Dashboard states that mass sending is disabled in Phase 1.
- Recent audit activity is visible.

Blockers:

- Live production health checks depend on DevOps deployment path and Hostinger environment readiness.

### 3. Legacy IONOS Data Explorer

User goal: safely inspect legacy PostgreSQL structure and preview limited data.

Acceptance criteria:

- Screen shows connection status without exposing credentials.
- Test Connection action exists and records success/failure metadata.
- Schema/table browser is populated only after inspection.
- Table rows can be previewed only with a bounded limit, default max 100 rows.
- Preview UI supports pagination/offset, not full-table pull.
- Field mapping exists for email, phone, signup date, source, geography, consent, unsubscribe, and suppression indicators.
- Save Mapping and Save Query Template actions exist.
- Raw destructive SQL and full imports are blocked by visible safety rails.

Blockers:

- Requires Data Engineer confirmation of legacy schema and read-only account behavior.

### 4. Query + Segment Builder

User goal: define safe audience segments with clear risk and suppression overlap before list creation.

Acceptance criteria:

- Builder supports source filters, date filters, email presence, phone presence, geography, consent fields, unsubscribe fields, and channel-specific constraints.
- Builder calculates candidate count, usable count, suppression overlap, and risk tier.
- Risk tiers are visible: low, medium, high, blocked.
- Builder produces a read-only preview query plan with bounded row limit.
- Unsafe broad imports are blocked when source/date/suppression constraints are missing.
- Segment can be saved with source evidence and risk metadata.
- Segment can be sent to List Manager only after safety metadata exists.

Blockers:

- Exact risk-tier thresholds need Compliance Operator approval after initial data profiling.

### 5. Brand Manager

User goal: manage brands and their compliance readiness before they are used by lists or campaigns.

Acceptance criteria:

- Brand table shows name, domain, vertical, type, status, sender identity, and risk/compliance state.
- Brand detail supports compliance URLs: privacy, terms, unsubscribe/preference where applicable.
- Stuff Pretty Good exists as first affiliate brand with planning status.
- CRM/internal brand exists separately from affiliate/sending brands.
- Missing compliance URLs create dashboard risk alerts.
- Related domains, lists, and campaign drafts are visible from brand detail.
- Brand changes are auditable.

Blockers:

- Final public compliance URLs depend on site launch and legal/compliance review.

### 6. Domain Manager

User goal: keep CRM, landing, sending, and tracking domains separate with DNS/SSL/readiness visibility.

Acceptance criteria:

- Domain inventory supports domain types: crm, landing, sending, tracking.
- Domain detail shows DNS status, SSL status, linked brand, deployment target, and sender readiness.
- `mehyarmedia.mehyar.us` is marked as CRM domain and not a sending domain.
- `stuffprettygood.com` is marked as landing/brand domain.
- Any sending domain remains blocked until deliverability and compliance approvals exist.
- DNS/SSL failures create risk alerts.
- Domain changes are auditable.

Blockers:

- Live DNS/SSL checks require Hostinger and DNS deployment completion.

### 7. List Manager

User goal: create auditable, channel-specific lists from safe segments only.

Acceptance criteria:

- List creation starts from a saved safe query or segment.
- List records include name, source, channel, brand/list context, usable count, suppression count, risk level, and status.
- Channel must be email or SMS.
- Suppression count is visible before any campaign can select the list.
- Lists have states: draft, review, approved, blocked.
- Lists cannot be created from arbitrary full imports in Phase 1.
- List changes are auditable.

Blockers:

- Requires Data Engineering to validate counts from legacy data without large imports.

### 8. Suppression Manager

User goal: make opt-out, complaint, bounce, legal, and manual suppression state mandatory before campaign approvals.

Acceptance criteria:

- Suppression taxonomy includes global email unsubscribe, brand unsubscribe, SMS STOP, spam complaints, bounces, legal suppression, and manual suppression.
- Manual suppression workflow captures actor, reason, channel, scope, and timestamp.
- Batch suppression import shows metadata only and never leaks secrets.
- List/campaign overlap check identifies blocking findings.
- Campaign approval is blocked until required suppression categories are checked.
- Suppression changes and checks are auditable.

Blockers:

- Exact suppression source locations need Data Engineer mapping after legacy schema inspection.

### 9. Campaign Draft Manager

User goal: draft campaign concepts while preventing unsafe activation or sending.

Acceptance criteria:

- Campaign creation includes brand, channel, target segment/list, copy, sender identity, owner, suppression status, compliance status, and approval status.
- Campaigns are created as drafts by default.
- Suppression approval and compliance approval are separate visible gates.
- Campaign cannot transition beyond draft/review without both approval tracks passing.
- Approval timeline records approver identity and timestamp.
- UI contains no send-now, blast, production schedule, provider dispatch, or send-provider credential action.
- Campaign changes are auditable.

Blockers:

- Final review states may need legal/compliance naming approval, but guardrail behavior is defined.

### 10. Integration Manager

User goal: track provider readiness without exposing secrets or enabling unsafe campaign dispatch.

Acceptance criteria:

- Integration catalog supports email providers, SMS providers, affiliate networks, DNS/registrars, validation tools, and tracking systems.
- Integration detail shows provider name, kind, status, last checked time, configured/not configured state, and externally stored secret indicator.
- Secret values are never displayed.
- Blocked/degraded integrations are visibly unavailable to dependent workflows.
- Validation checks record safe metadata only.
- Integration changes are auditable.

Blockers:

- Provider selection and credentials depend on executive/vendor decisions.

### 11. Audit Log

User goal: review evidence of who changed what, when, and why.

Acceptance criteria:

- Audit log lists actor, action, resource type, resource id, timestamp, and safe metadata.
- Audit log can be filtered by module/resource where supported.
- Security, campaign, suppression, list, domain, brand, and integration actions produce audit entries.
- Audit metadata excludes secrets and raw sensitive data.
- Audit feed is linked from dashboard and module detail pages.

Blockers:

- Long-term retention policy needs Ops/Compliance decision.

## Screen inventory

- `/login` — admin login and session creation.
- `/dashboard` — health, metrics, risks, audit feed.
- `/legacy` — legacy source connection, schema browser, preview, field mapping.
- `/segments` — filter builder, bounded preview, risk and suppression overlap.
- `/brands` — brand inventory/detail and compliance URL readiness.
- `/domains` — DNS/SSL/readiness by CRM/landing/sending/tracking domain type.
- `/lists` — list inventory and create-from-safe-segment wizard.
- `/suppressions` — taxonomy, manual suppression, overlap checks.
- `/campaigns` — draft-only campaign inventory/editor and approval gates.
- `/integrations` — provider metadata, validation status, external-secret status.
- `/audit` — event search and evidence trail.
- `/settings/users` — users, roles, and sessions.

## Week-1 deliverable

The week-1 Product/Ops deliverable is accepted when:

- `docs/product-workflows-admin-ux.md` defines the owner-facing workflow for every Phase 1 module.
- This document defines screen-by-screen acceptance criteria and blockers.
- Automated tests verify that the UX specification covers Phase 1 modules and guardrails.
- README links the UX and acceptance specs.
- No Phase 1 spec or UI acceptance criterion introduces mass sending.
