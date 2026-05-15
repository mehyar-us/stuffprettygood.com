# Mehyar Media CRM Command Center

Internal CRM foundation for lifecycle marketing operations.

Phase 1 priority: build the control room before any sending capability.

Current implemented workstreams:

- CRM core app shell with Node HTTP runtime and JSON API routes.
- Admin auth baseline: users, roles, password hashing, sessions, and session lookup.
- Dashboard health widgets for service, database readiness, auth, campaigns, suppressions, risks, and audit activity.
- Append-only audit-log foundation for auth, dashboard, and campaign transition decisions.
- Suppression/compliance gates and operating rules.
- List/segment builder safety evaluator with source/date/email/phone/geo/consent/unsubscribe filters, suppression-overlap counts, risk tiers, and bounded preview query plans.
- Command Center registry APIs for brands, domains, lists, campaigns, integrations, safe query templates, and legacy source inspection.
- Seeded first-brand operating records for `stuffprettygood.com` and CRM domain `mehyarmedia.mehyar.us`.
- Campaign state guard that prevents any campaign from moving beyond `draft` unless suppression and compliance approvals are both present.
- Suppression reason taxonomy covering global unsubscribe, brand unsubscribe, SMS STOP, complaints, bounces, legal suppression, and manual suppression.
- Product workflows and admin UX specification covering every Phase 1 module with owner-facing flows and acceptance checklists.
- Admin UX acceptance specification with screen-by-screen acceptance criteria and blocker list for each Phase 1 admin screen.
- Campaign Manager 2026 API/data contracts for offer catalog, preference engine, attribution ledger, readiness gates, simulator, risky-action audit blockers, and revenue dashboard rollups.
- A-to-Z reactivation command-center contracts for Contact War Room, tier classifier/quarantine, count-only Clean Segment Finder, Sponsor Pilot Manager, manual Gmail outreach, reactivation/preference/return-credit workflows, SMS Consent Vault, small-cohort approval, and scale/kill decisions.
- DevOps provider/outreach operations rails for dry-run provider readiness, manual Gmail sponsor outreach, scheduler/monitor tasks, SMS consent gating, kill switches, rollback, backups, and no-send proof.
- StuffPrettyGood public offer/sign-up surfaces, Google Trends powered daily offer lanes, Amazon Associates manual `/go` bridges, preference/unsubscribe/reactivation pages, and SEO-safe trend pages.

No mass-sending function is implemented in this repository. The simulator, small-cohort approval, SMS vault, risky-action contract, and DevOps ops rails explicitly keep send/export/provider-push/SMS blocked by default.

## Deployment / Infra

For Hostinger deployment and operations, use:

- `.github/workflows/deploy-hostinger.yml`
- `ops/hostinger/bootstrap-vps.sh`
- `ops/hostinger/ssh-hardening.sh`
- `ops/hostinger/configure-nginx-https.sh`
- `ops/hostinger/activate-release.sh`
- `ops/hostinger/rollback.sh`
- `docs/hostinger-deployment-runbook.md`
- `docs/github-repo-project-setup.md`
- `docs/private-repo-compensating-controls.md`
- `docs/production-route-map.md`

## Commands

```bash
npm test
npm start
npm run spg:trends:daily
```

## Runtime configuration

Server-only legacy source table configuration:

- `LEGACY_CONTACT_TABLE`: required SQL identifier used by the segment preview builder.
- `LEGACY_CONTACT_TABLE_ALLOWLIST`: optional comma-separated allowlist extension for deployment-specific safe identifiers.

Do not expose DB names, table names, or database credentials in frontend/public assets. The segment preview builder fails closed when table configuration is missing or not allowlisted.

## Local routes

Public production routing is defined in `docs/production-route-map.md`. Canonical live CRM health is `GET /crm/health`; compatibility alias `GET /crm-health` must return the same CRM health payload for monitors still using the original route.

- `GET /health`
- `GET /api/dashboard`
- `GET /api/auth/users`
- `POST /api/auth/users`
- `POST /api/auth/login`
- `GET /api/auth/session`
- `GET /api/audit`
- `GET /api/command-center`
- `GET|POST /api/brands`
- `GET|POST /api/domains`
- `GET|POST /api/lists`
- `GET|POST /api/campaigns`
- `GET|POST /api/integrations`
- `GET|POST /api/query-templates`
- `POST /api/legacy-source/inspect`
- `POST /api/campaigns/evaluate-transition`
- `POST /api/segments/evaluate`

The default seeded local admin is `admin@mehyarmedia.local` with password `change-me-before-production` for local foundation testing only. Replace before any deployment.

## StuffPrettyGood daily trend pipeline

```bash
npm run spg:trends:fetch
npm run spg:trends:update
npm run spg:trends:build
npm run spg:trends:daily
```

The daily pipeline queries Google Trends through SerpAPI, updates trend lanes, rebuilds SEO pages, and regenerates Amazon manual `/go` bridge pages using the approved Amazon Associates tag. It does not send email/SMS, push providers, scrape Amazon, copy Amazon prices/images/ratings/reviews/availability, or spend money.

## Compliance invariant

A campaign may remain in `draft` with incomplete checks, but any transition to `review`, `approved`, `scheduled`, `active`, or `sent` must pass:

1. suppression approval state is `approved`
2. compliance approval state is `approved`
3. all required suppression categories have been evaluated
4. no blocking suppression/compliance findings remain
5. approver identity and timestamp are present for both approval tracks

See `docs/compliance-operating-rules.md`, `docs/product-workflows-admin-ux.md`, `docs/admin-ux-acceptance-spec.md`, and `src/compliance/gates.js`.
