# Project 001 Executive Workstream Board

Owner: Arman Voss, CEO / executive coordinator
Mission: hire enough execution capacity to build the Mehyar Media CRM Command Center fast without creating management bloat.

## Reality Check

The CRM is the control room. It must govern brands, domains, campaigns, lists, legacy signup data, suppressions, integrations, compliance state, and sender readiness before any campaign dispatch capability exists.

No mass sending is authorized in Phase 1. Every workstream below is scoped to command-center foundations, safe data access, auditability, suppression/compliance controls, and first-brand launch readiness.

## Hires / Owners

| # | Agent | Role | Week-1 concrete deliverable |
|---|---|---|---|
| 1 | Maya Chen | Lead Full-Stack Engineer | Own CRM application shell, backend/frontend coordination, auth, local schema integration, and module cohesion. |
| 2 | Noah Brooks | DevOps / Infrastructure Engineer | Own Hostinger VPS deployment path, SSH bootstrap plan, CI/CD, HTTPS, backup, monitoring, rollback, and health checks. |
| 3 | Owen Brooks | DevOps / Infrastructure Engineer | Secondary infrastructure execution/recovery owner for VPS hardening and deployment runbooks. |
| 4 | Liam Patel | Data Engineer | Own IONOS PostgreSQL connection plan, schema inspection, safe previews, batch pull guardrails, mapping, and segmentation inputs. |
| 5 | Nadia Patel | Data Engineer | Implement safe legacy-source explorer contracts and bounded schema/table inspection. |
| 6 | Sofia Rivera | Deliverability / Compliance Operator | Own suppression taxonomy, unsubscribe logic, STOP handling, complaint/bounce/legal suppression gates, and approval rules. |
| 7 | Victor Hale | Deliverability / Compliance Operator | Implement sender-readiness and no-send compliance guardrails. |
| 8 | Ethan Walsh | Product / Ops Designer | Own admin CRM workflows, UX flow specs, and acceptance criteria for phase-1 modules. |
| 9 | Lena Ortiz | Product / Ops Designer | Own frontend/admin console usability, screen-level acceptance, and operator workflows. |
| 10 | Priya Raman | Backend API Engineer | Own API contracts, RBAC touchpoints, service boundaries, and audit-backed mutations. |
| 11 | Rhea Singh | Backend Engineer | Own backend implementation support for command-center modules and validation. |
| 12 | Theo Grant | Database Architect | Own local PostgreSQL schema, migrations, audit models, and data integrity checks. |
| 13 | Owen Hart | Frontend Dashboard Engineer | Own dashboard/module screens and read-only operator views. |
| 14 | Pia Romero | Integration Engineer | Own integration manager and provider readiness registry without storing secrets in code. |
| 15 | Zara Haddad | Integrations Engineer | Secondary integrations owner for provider validation and readiness states. |
| 16 | Caleb Stone | Lists and Segments Engineer | Own list manager, segment builder, bounded preview logic, and risk tiers. |
| 17 | Iris Kim | Brand and Domain Systems Engineer | Own brand/domain managers, DNS/SSL readiness states, and CRM vs sending-domain separation. |
| 18 | Samir Khan | Security Engineer | Own secrets policy, auth review, hardening checks, and no-secret exposure review. |
| 19 | Iris Cole | QA Engineer | Own acceptance harness, smoke checks, and regression coverage. |
| 20 | Miles Grant | QA / Security Reviewer | Secondary QA/security review for release confidence. |
| 21 | June Park | Project Coordinator | Own blocker board, cadence, issue hygiene, and 14-hour execution clock. |
| 22 | Cal West | Growth / Affiliate Strategist | Own Stuffprettygood launch plan and low-risk reactivation positioning. |

Paperclip roster currently exceeds the requested 13-agent minimum and maps agents to concrete execution lanes.

## Workstream Status

| Workstream | Owner | Paperclip issues | Deliverables | Deadline | Acceptance criteria | Blockers |
|---|---|---|---|---|---|---|
| Infrastructure | Noah Brooks / Owen Brooks | MEHAA-4, MEHAA-5 | VPS bootstrap, SSH hardening, CI/CD, HTTPS, rollback, backups, monitoring, health target | T+24h | Commands documented, no secrets exposed, deploy workflow ready, health target defined | Operator-controlled VPS/DNS secret access for final live bootstrap |
| CRM Core App | Maya Chen / Priya Raman / Rhea Singh | MEHAA-3, MEHAA-14, MEHAA-17 | Node app shell, API foundation, module registry, auth integration | T+14h | App starts, routes respond, API contracts validated, no send capability | Production env not finalized |
| Local PostgreSQL Database | Theo Grant | MEHAA-6, MEHAA-19 | CRM schema, migrations, users, roles, audit logs, brands/domains/campaigns/lists/suppressions/integrations/query metadata | T+14h | Schema tests pass and destructive legacy imports are absent | Hostinger DB provisioning depends on controlled VPS access |
| Legacy IONOS Data Interface | Liam Patel / Nadia Patel | MEHAA-7, MEHAA-20 | Read-only connection plan, schema explorer, safe preview, field mapping, query templates | T+14h | Read-only, limited, paginated previews; no full-table pulls | IONOS credentials must remain secret and operator-controlled |
| Brand/Domain Management | Iris Kim / Owen Hart | MEHAA-13, MEHAA-18 | Brand and domain manager records, CRM domain separation, DNS/SSL readiness states | T+14h | CRM domain is not a sending domain; Stuffprettygood seeded | Final DNS ownership/action |
| List/Segment Management | Caleb Stone | MEHAA-3, MEHAA-14 | Segment filters, suppression overlap counts, risk tiering, bounded preview plans | T+14h | Segment tests pass; no unrestricted legacy pulls | Real legacy schema unavailable until IONOS inspect step |
| Suppression/Compliance | Sofia Rivera / Victor Hale | MEHAA-8, MEHAA-22 | Global/brand unsubscribe, SMS STOP, complaints, bounces, legal/manual suppression, approval gates | T+14h | Campaigns cannot advance past draft without suppression and compliance approvals | Legal review for final sending policies |
| Campaign Drafting | Maya Chen / Victor Hale | MEHAA-3, MEHAA-8, MEHAA-22 | Draft-only campaigns, copy/segment/sender fields, approval status, compliance status | T+14h | No schedule/send/dispatch function exists | Final compliance approval workflow after Phase 1 |
| Integrations | Pia Romero / Zara Haddad | MEHAA-12, MEHAA-23 | Provider readiness registry for email, SMS, affiliate, DNS/registrar, validation, tracking | T+14h | Secrets externalized, readiness states tracked, no provider dispatch | Provider credentials and account selection |
| First Brand Launch Planning | Cal West | MEHAA-15, MEHAA-26 | Stuffprettygood positioning, low-risk reactivation plan, brand records, launch checklist | T+14h | Broad savings/deals positioning, no adult/dating/crypto/aggressive-finance first | Domain/DNS and compliance pages before traffic |
| Coordination Board | June Park / Arman Voss | MEHAA-2, MEHAA-16, MEHAA-27 | Owners, deadlines, acceptance criteria, blockers, cadence, recovery hygiene | Immediate then ongoing | No vague ownership; every lane has named owner and deliverable | Stale Paperclip resume artifacts can reopen completed work |

## Risks

- Stale Paperclip execution/resume artifacts have repeatedly reopened already-verified work. Mitigation: verify source issue state, post evidence, clear locks, and close recovery artifacts.
- VPS/DNS/IONOS credentials are sensitive and must not appear in logs, commits, frontend code, screenshots, or comments.
- Legacy list scale is dangerous if mishandled. Phase 1 only permits read-only inspection, pagination, limited previews, and cached summaries.
- Marketing dispatch before compliance gates would create legal/reputation risk. Phase 1 intentionally has no send-now, blast, provider dispatch, or production scheduling capability.

## Decisions Needed

1. Confirm operator-controlled access window for Hostinger VPS bootstrap and DNS records.
2. Confirm whether `mehyarmedia.mehyar.us` remains the CRM domain or whether a purchased company domain replaces it later.
3. Confirm final email/SMS providers only after suppression/compliance foundation is verified.

## Next 48 Hours

1. Keep the issue board moving: finish in-progress workstreams, close stale recovery artifacts, and keep owners accountable.
2. Live-bootstrap Hostinger only through controlled secret handling.
3. Validate CRM foundation locally, then run live health checks after deployment.
4. Prepare Stuffprettygood launch assets only after command-center compliance controls are operational.
