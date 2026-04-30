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

No mass-sending function is implemented in this repository.

## Deployment / Infra

For Hostinger deployment and operations, use:
- `.github/workflows/deploy-hostinger.yml`
- `ops/hostinger/bootstrap-vps.sh`
- `ops/hostinger/ssh-hardening.sh`
- `ops/hostinger/configure-nginx-https.sh`
- `ops/hostinger/activate-release.sh`
- `ops/hostinger/rollback.sh`
- `docs/hostinger-deployment-runbook.md`

## Commands

```bash
npm test
npm start
```

## Local routes

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

## Compliance invariant

A campaign may remain in `draft` with incomplete checks, but any transition to `review`, `approved`, `scheduled`, `active`, or `sent` must pass:

1. suppression approval state is `approved`
2. compliance approval state is `approved`
3. all required suppression categories have been evaluated
4. no blocking suppression/compliance findings remain
5. approver identity and timestamp are present for both approval tracks

See `docs/compliance-operating-rules.md`, `docs/product-workflows-admin-ux.md`, `docs/admin-ux-acceptance-spec.md`, and `src/compliance/gates.js`.
