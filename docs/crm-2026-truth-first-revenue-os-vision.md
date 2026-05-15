# Mehyar Media CRM 2026 Reset: Truth-First Revenue OS

Updated: 2026-05-15 15:12 EDT
Owner: Arman
Board: mehyar-media
Repo: mehyar-us/mehyarmedia

## Boss directive

The CRM currently contains false or assumed operating information. Refactor it completely into a truth-first revenue operating system.

No fake seed records. No invented lists. No pretend campaigns. No assumed usable audience counts. No UI module may imply a data source is real, configured, approved, or revenue-ready unless it is backed by a verified source artifact.

## Product vision

Mehyar Media CRM becomes the private command center that turns verified signals into monetizable action.

It should answer five questions for Boss every day:

1. What real data/source changed since the last pull?
2. What can make money now without new legal/deliverability risk?
3. What is blocked, and what exact action unblocks it?
4. Which opportunity should be pursued, watched, or rejected?
5. Which public StuffPrettyGood surface or internal sales motion should be created next?

## Core principle: truth over fullness

Empty but honest is better than populated but false.

Every CRM card, table, count, and recommendation must carry a provenance state:

- verified: loaded from a real source artifact, live service, DB query, or audited operator entry
- pending: source exists but has not passed freshness/health validation
- simulated: explicitly marked as prototype/test-only and hidden from production revenue views
- blocked: source/action exists but gate prevents use
- missing: no real data yet; show next action instead of fake rows

Production CRM default: hide simulated data.

## New CRM modules

### 1. Source Ledger

Single place to see every upstream source:

- source name
- source class: SPG offer feed, public opportunity feed, job posting, RSS, government, affiliate/network, legacy audience, operator entry
- credential readiness by key name only
- last pull time
- last success/failure
- records added/updated
- freshness SLA
- allowed actions
- risk/gate status
- artifact path or DB table

### 2. Jobs Control

Operator-safe rerun console:

- daily pull everything
- opportunity finder collect
- SPG offer ingest
- SPG build + QA
- full CRM/SPG tests
- source-specific reruns

Each run must show:

- status
- started/finished time
- source deltas
- top errors
- artifact paths
- no raw secrets
- no raw PII
- safe log preview

### 3. Opportunity Desk

Verified opportunities only.

For each opportunity:

- source + artifact proof
- title/entity
- money lane
- deadline/urgency
- fit score
- speed-to-cash score
- effort score
- risk score
- next internal action
- decision state: new, pursue, watch, reject, blocked, converted
- owner
- Kanban/task link

No opportunity may appear as actionable without source proof and freshness.

### 4. Revenue Action Queue

The daily operator view:

- top 10 money actions today
- why this action matters
- required next step
- owner
- block/unblock state
- expected revenue path
- proof status

This replaces generic vanity dashboards.

### 5. StuffPrettyGood Growth Console

SPG is public monetized offer/media brand. CRM should manage:

- offers with affiliate/source proof
- landing page status
- /go redirect status
- disclosure status
- click/intent metrics
- signup/preference intake metrics
- newsletter readiness
- merchant/network/account status
- content gaps
- top categories to publish next

No fake reviews, fake discounts, copied merchant claims, or unverified monetization claims.

### 6. Campaign Manager CRM

Campaign Manager is not a blast tool. It is a controlled action planner.

Allowed production states:

- draft
- evidence-needed
- compliance-review
- Boss-approval-needed
- ready-for-dry-run
- blocked

Sending/provider push remains disabled unless explicit gates pass.

Campaigns must be created from verified segments only. If no verified segment exists, show no segment and a next action.

### 7. Evidence Vault

Every money action links to evidence:

- source artifact
- screenshot or pull output
- compliance gate result
- disclosure proof
- test result
- deployment proof
- decision memo

## Dashboard redesign

Default home should show:

1. Today’s money queue
2. Source/job health
3. Opportunity delta since last pull
4. SPG monetization status
5. Blockers and unblock actions
6. Recent audited decisions

Remove or demote generic cards that do not drive action.

## Data rules

- No raw secrets in frontend, docs, Kanban, logs, Git, or screenshots.
- No raw PII in frontend, docs, Kanban, logs, Git, or prompts.
- Legacy audience data must stay count-only or masked unless explicit gate passes.
- Any seeded fixture must be marked test-only and excluded from production summaries.
- Production views must not display fabricated campaigns/lists/segments.

## Immediate refactor acceptance criteria

1. Production seed layer only creates structural records required to boot the CRM: CRM brand, SPG brand, CRM/landing/sending domain records, and legacy integration placeholder.
2. No fake lists, segments, campaigns, or query templates are auto-seeded into production.
3. Empty states are honest and include the next action.
4. Opportunity Desk displays only records from daily-pull artifacts or operator-created records with provenance.
5. Jobs Control can rerun allowlisted scraping/opportunity jobs and show status/delta.
6. Dashboard works on desktop, tablet, and mobile with no hidden unusable tables.
7. Tests prevent future unproven seed records from entering production summaries.
8. Live QA verifies root/login, dashboard, Opportunity Desk, Jobs Control, SPG console, and Campaign Manager after login.

## Implementation priority

P0: remove false production seed data and add provenance labels.
P1: rebuild dashboard around money queue + source health + blockers.
P2: wire Jobs Control run deltas into Opportunity Desk and SPG console.
P3: implement decision actions: pursue/watch/reject/create task/draft memo.
P4: screenshot QA desktop/tablet/mobile and deploy.
