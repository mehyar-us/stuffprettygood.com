# Product Workflows and Admin UX Specification

Owner: Product / Ops Designer — Lena Ortiz
Scope: Phase 1 CRM Command Center owner-facing workflows and acceptance checklists.
Decision guardrail: the CRM controls campaigns before campaigns control the company. Phase 1 has no mass sending.

## UX principles

1. Control-room first: every screen answers what exists, what is risky, what is blocked, and what the next safe action is.
2. Compliance-visible: suppression, consent, approval, audit, and sender readiness states are visible before campaign copy is acted on.
3. Read-only legacy first: IONOS data exploration is inspection, preview, mapping, and saved limited queries only.
4. No secret exposure: secrets are represented as configured/not configured metadata only; values are never displayed.
5. Owner accountability: every workflow has an actor, required evidence, and an audit event.

## Global navigation

Primary sections:

- Dashboard
- Legacy Data Explorer
- Query + Segment Builder
- Brands
- Domains
- Lists
- Suppressions
- Campaign Drafts
- Integrations
- Audit Log
- Settings / Admin Auth

Persistent header:

- Environment badge: local, staging, production
- CRM domain: mehyarmedia.mehyar.us
- Mass sending status: Disabled in Phase 1
- Legacy source state: not configured, connected, degraded, blocked
- Global risk count

## Dashboard workflow

Owner-facing goal: see whether the CRM foundation is safe to operate today.

User flow:

1. Admin logs in and lands on Dashboard.
2. Dashboard loads system health, database readiness, legacy source state, brand count, domain count, list count, campaign draft count, suppression count, and active risk alerts.
3. Admin reviews red/yellow alerts first.
4. Admin clicks a metric card to navigate to the underlying module.
5. Admin records any operational decision through an auditable action.

Primary components:

- Health summary cards: API, local PostgreSQL, legacy IONOS, audit log, CI/CD/deployment state.
- Business object cards: brands, domains, lists, campaigns, suppressions, integrations.
- Risk alert panel: unapproved campaigns, missing compliance URLs, unverified DNS/SSL, legacy source errors, high-risk segment overlap.
- Recent audit feed.

Acceptance checklist:

- Dashboard exposes system health and database status.
- Dashboard shows lead/list/campaign/suppression summaries without exposing raw secrets.
- Risk alerts are visible above routine metrics.
- Each dashboard metric links to its owner module.
- Dashboard actions create or reference audit events.

## Admin Auth workflow

Owner-facing goal: restrict CRM access to known operators with traceable roles and sessions.

User flow:

1. Admin creates or reviews users.
2. Admin assigns role: owner, admin, operator, reviewer, read_only.
3. User logs in through secure login.
4. Session is created and visible for inspection/revocation.
5. Security-sensitive actions record actor, role, resource, and timestamp.

Primary components:

- Login screen.
- User management table.
- Role selector with permission explanations.
- Active sessions table.
- Audit event drawer.

Acceptance checklist:

- Secure login exists.
- Roles exist and are visible in admin UI.
- Sessions are created and inspectable.
- Security-sensitive actions write audit log entries.
- Default local credentials are clearly marked as non-production.

## Legacy IONOS Data Explorer workflow

Owner-facing goal: safely inspect source schemas and sample rows without destructive queries or bulk pulls.

User flow:

1. Admin opens Legacy Data Explorer.
2. Admin runs Test Connection.
3. If connection succeeds, the screen lists schemas and tables with estimated row counts.
4. Admin previews a limited row sample with default max 100 rows.
5. Admin maps fields to CRM concepts: email, phone, signup date, consent, unsubscribe, source, geography.
6. Admin saves the mapping or safe query template.

Primary components:

- Connection status card.
- Schema/table browser.
- Limited preview grid.
- Field mapping panel.
- Saved query templates list.
- Safety rail showing read-only, no destructive SQL, no full-table pulls.

Acceptance checklist:

- Test connection workflow exists.
- Schema/table inspection workflow exists before assumptions are made.
- Preview workflow is limited and paginated.
- Field mapping workflow exists.
- Saved query workflow exists.
- Destructive queries and full-table pulls are visibly blocked.

## Query + Segment Builder workflow

Owner-facing goal: create safe audience definitions and preview risk before lists are created.

User flow:

1. Admin chooses a legacy source table or saved query template.
2. Admin applies filters: source, date, email/phone presence, geography, consent, unsubscribe state.
3. Builder estimates reachable records and suppression overlap.
4. Builder assigns risk tier: low, medium, high, blocked.
5. Admin saves a segment definition or sends it to List Manager.
6. Audit log records the query template and risk outcome.

Primary components:

- Filter builder.
- Query safety summary.
- Estimated counts and preview row limit.
- Suppression overlap panel.
- Risk tier badge.
- Save segment / create list CTA.

Acceptance checklist:

- Source, date, email, phone, geography, consent, unsubscribe, suppression overlap, and risk-tier filters are represented.
- Preview query plan is bounded.
- Risk tier is visible before list creation.
- Saved segment records source and safety metadata.
- No workflow enables mass sending.

## Brand Manager workflow

Owner-facing goal: manage business brands and compliance readiness before domains, lists, or campaigns use them.

User flow:

1. Admin creates or reviews a brand.
2. Admin enters brand name, domain, vertical, type, status, sender identity, and compliance URLs.
3. Admin attaches domains and lists.
4. System flags missing privacy/unsubscribe/compliance URL requirements.
5. Admin advances brand status only when required readiness checks pass.

Primary components:

- Brand table with status and risk.
- Brand detail page.
- Compliance URL checklist.
- Sender identity status.
- Related domains/lists/campaigns panel.

Acceptance checklist:

- Brand fields include name, domain, vertical, type, status, sender identity, and compliance URLs.
- Stuff Pretty Good is represented as first affiliate brand.
- Missing compliance URLs produce risk alerts.
- Brand status is not vague; it reflects planning, active, paused, or blocked.
- Brand changes are auditable.

## Domain Manager workflow

Owner-facing goal: separate CRM, landing, sending, and tracking domains with DNS/SSL/sender readiness checks.

User flow:

1. Admin adds a domain and classifies it as CRM, landing, sending, or tracking.
2. Admin reviews DNS status, SSL status, and sender readiness.
3. CRM domain is explicitly marked not for marketing sends.
4. Sending domains stay blocked until deliverability and compliance approvals exist.
5. Admin links domains to brands and deployment records.

Primary components:

- Domain inventory table.
- Domain type badge.
- DNS/SSL status cards.
- Sender readiness gate.
- Linked brand/deployment panel.

Acceptance checklist:

- CRM, landing, sending, and tracking domain types exist.
- DNS status is visible.
- SSL status is visible.
- Sender readiness is visible and can be blocked.
- CRM domain is not treated as a sending domain.

## List Manager workflow

Owner-facing goal: create auditable, risk-rated lists from safe queries only.

User flow:

1. Admin starts from a saved query or segment.
2. Admin names list, chooses source, channel, and brand context.
3. System calculates usable count, suppression count, and risk level.
4. Admin reviews evidence and saves list as draft/approved/blocked.
5. List becomes selectable by campaign drafts only after required safety metadata exists.

Primary components:

- List inventory.
- Create-from-segment wizard.
- Count summary: total candidate, usable, suppressed.
- Channel badge: email or SMS.
- Risk level and source evidence.

Acceptance checklist:

- Lists are created from safe queries/segments, not arbitrary imports.
- Source, channel, usable count, suppression count, and risk level are visible.
- List status reflects draft, review, approved, or blocked.
- Suppression counts are calculated before campaign use.
- No full legacy import is offered.

## Suppression Manager workflow

Owner-facing goal: centralize all opt-out, complaint, bounce, legal, and manual suppression states before campaign approval.

User flow:

1. Admin reviews suppression categories and counts.
2. Admin imports or adds manual suppressions through controlled workflows.
3. System checks global email unsubscribe, brand unsubscribe, SMS STOP, complaints, bounces, legal suppression, and manual suppression.
4. Admin evaluates a list/campaign against suppression categories.
5. Campaign approval remains blocked until required categories pass.

Primary components:

- Suppression taxonomy dashboard.
- Manual suppression form.
- Batch import metadata card, without raw secret exposure.
- List/campaign suppression overlap evaluator.
- Blocking findings table.

Acceptance checklist:

- Required categories exist: global email unsubscribe, brand unsubscribe, SMS STOP, spam complaints, bounces, legal suppression, manual suppression.
- Suppression overlap can be evaluated for lists and campaigns.
- Blocking findings are visible.
- Campaign progression is blocked when required suppression checks are incomplete.
- Suppression actions are auditable.

## Campaign Draft Manager workflow

Owner-facing goal: allow planning and approval review without enabling mass sending.

User flow:

1. Admin creates campaign draft with brand, channel, target segment/list, copy, sender, and owner.
2. System shows suppression status, compliance status, and approval status.
3. Admin requests review.
4. Reviewers approve or block suppression and compliance tracks separately.
5. Campaign cannot move beyond draft/review unless all gates pass; Phase 1 still does not implement send/schedule execution.

Primary components:

- Draft campaign table.
- Campaign editor.
- Copy preview.
- Target segment/list selector.
- Suppression/compliance gate panel.
- Approval timeline.

Acceptance checklist:

- Campaigns are drafts only in Phase 1.
- Required fields include brand, channel, target segment, copy, sender, suppression status, compliance status, and approval status.
- Suppression and compliance approvals are separate and visible.
- Campaign state guard prevents unsafe transitions.
- No send, blast, schedule, or provider dispatch UI exists.

## Integration Manager workflow

Owner-facing goal: track provider readiness and validation status without leaking credentials or enabling unsafe sends.

User flow:

1. Admin creates integration metadata for email providers, SMS providers, affiliate networks, DNS/registrars, validation tools, or tracking systems.
2. Admin marks whether secrets are stored externally.
3. System shows status: planned, configured, degraded, blocked.
4. Admin runs safe validation checks where available.
5. Integrations become usable only by modules whose compliance gates are satisfied.

Primary components:

- Integration catalog.
- Provider detail page.
- Secret storage status badge.
- Last checked timestamp.
- Validation result panel.

Acceptance checklist:

- Email, SMS, affiliate, DNS/registrar, validation, and tracking integration types are represented.
- Secret values are never displayed.
- Integration status and last checked timestamp are visible.
- Blocked integrations cannot be used by campaign workflows.
- Integration changes are auditable.

## Data Explorer UX workflow

Owner-facing goal: let operators answer data questions safely without writing raw destructive SQL.

User flow:

1. Admin opens Data Explorer from dashboard or legacy module.
2. Admin selects source, schema, table, and approved query template.
3. Admin uses allowed filters and limit controls.
4. Admin sees preview rows with sensitive columns masked where appropriate.
5. Admin saves insight, mapping, or query template for repeat use.

Primary components:

- Source selector.
- Schema/table browser.
- Approved filters only.
- Preview grid with limit control.
- Save query/mapping controls.

Acceptance checklist:

- Explorer starts from inspected schema metadata.
- Operators can preview limited rows.
- Operators can save queries and mappings.
- Unsafe SQL patterns are blocked.
- Large pulls are queued or blocked, never performed inline.

## Phase 1 module ownership matrix

| Module | Primary owner | Supporting owner | Week 1 deliverable | Acceptance gate |
| --- | --- | --- | --- | --- |
| Admin Auth | Lead Full-Stack Engineer | Product / Ops Designer | Login, roles, sessions, audit events | Role-based admin access works locally |
| Dashboard | Product / Ops Designer | Lead Full-Stack Engineer | Control-room dashboard UX and API summary | Health, counts, and alerts visible |
| Legacy IONOS Data Explorer | Data Engineer | Product / Ops Designer | Read-only schema/preview workflow | No destructive/full-table operations |
| Query + Segment Builder | Data Engineer | Compliance Operator | Bounded query and risk-tier workflow | Suppression overlap visible before list creation |
| Brand Manager | Product / Ops Designer | Lead Full-Stack Engineer | Stuff Pretty Good and CRM brand records | Required brand fields and compliance URLs tracked |
| Domain Manager | DevOps / Infrastructure Engineer | Product / Ops Designer | CRM/landing/sending/tracking domain inventory | DNS/SSL/readiness states visible |
| List Manager | Data Engineer | Compliance Operator | Create lists from safe query templates | Usable/suppressed/risk counts recorded |
| Suppression Manager | Compliance Operator | Data Engineer | Suppression taxonomy and gate checks | Campaigns blocked on incomplete checks |
| Campaign Draft Manager | Product / Ops Designer | Compliance Operator | Draft-only campaign UX | No send/schedule UI exists |
| Integration Manager | Lead Full-Stack Engineer | DevOps / Infrastructure Engineer | Provider metadata catalog | Secrets external and statuses visible |

## Wireframe-level screen inventory

1. `/login` — local admin login.
2. `/dashboard` — command center summary, risk alerts, audit feed.
3. `/legacy` — IONOS connection, schemas, tables, previews, mappings.
4. `/segments` — filter builder, counts, risk tier, save segment.
5. `/brands` — brand inventory and detail.
6. `/domains` — domain inventory, DNS/SSL/sender readiness.
7. `/lists` — list inventory and create-from-segment wizard.
8. `/suppressions` — taxonomy, manual suppression, overlap checks.
9. `/campaigns` — draft inventory and draft editor.
10. `/integrations` — integration catalog and validation states.
11. `/audit` — event search and evidence trail.

## Blockers and design decisions

- Component library choice is still open; spec is component-library neutral.
- Production deployment must replace default local admin credentials before exposure.
- Legacy IONOS credentials must remain server-side/environment-backed only.
- Sending-domain readiness should remain blocked until a separate deliverability workstream approves it.
- Phase 1 UX must not contain blast, send now, schedule send, or provider dispatch actions.

## Definition of done for this workstream

- Every Phase 1 module has an owner-facing workflow.
- Every Phase 1 module has an acceptance checklist.
- Dashboard, brand/domain/list, campaign draft, risk alert, and data explorer UX are specified.
- Compliance and suppression guardrails are visible in the workflows.
- The spec aligns with current repository guardrails: draft-only campaigns, read-only legacy source, bounded previews, and externally stored secrets.
