# Opportunity Finder External-Action and AI-Decision Gate Matrix

Owner: ComplyOps
Applies to: Mehyar Media CRM Opportunity Desk / AI Decision Desk
Source of truth: `/home/mehya/.hermes/projects/mehyar-media/PROJECT-001-CRM-COMMAND-CENTER.md`
Related contract: `docs/opportunity-desk-api-contract.md`
Status: implementation gate artifact for LeadFS/WebDev

## 0. Ruling

Opportunity Finder may collect approved/public money signals, score them, generate internal decision support, draft internal route proposals, and prepare claim-safe drafts for human review.

Default for every external or reputation-risk action: BLOCKED until a scoped gate is approved.

Hard rules:
- No auto-submit.
- No outreach send by AI.
- No bid/proposal/grant/affiliate/sponsor/customer submission without human-approved final content and gate evidence.
- No invented certifications, past performance, case studies, customers, approvals, audience numbers, revenue metrics, deliverability metrics, testimonials, or guaranteed outcomes.
- No raw PII, secrets, tokens, tax/bank/KYC values, or private lead/contact data in CRM prompts, Kanban, Git, docs, logs, frontend, screenshots, public URLs, or generated static files.
- Disabled UI buttons are not security. API must independently enforce every gate and write audit events for both allowed and blocked attempts.

## 1. Universal Opportunity Finder API response shape

Every action endpoint that could affect scoring, routing, external action, account state, claims, spend, audience use, or public copy must return:

```json
{
  "allowed": false,
  "state": "blocked | review_required | watch | go | no_go",
  "gate_id": "GATE_OPP_*",
  "action_class": "read_only_collection",
  "externalActionsEnabled": false,
  "reasons": ["human-readable blocker"],
  "requiredApprovals": ["role-or-approval-id"],
  "caps": { "max_records": 0, "max_external_sends": 0, "max_spend_usd": 0 },
  "auditEventId": "audit_...",
  "nextSafeAction": "internal action the user can do now"
}
```

Minimum enforcement:
- Authenticated CRM route only.
- Role/scope check before action.
- Immutable audit event for allowed, blocked, and review-required outcomes.
- Idempotency key required for any endpoint that could later create external side effects.
- Secret and raw PII detector before prompt/model/Kanban/doc/log/frontend persistence.
- Gate approval must include exact destination, final content hash when content leaves the company, cap, owner, expiry, kill switch, and evidence refs.

## 2. Universal UI rules for LeadFS/WebDev

Opportunity Desk UI must show separate action groups:

Safe internal actions enabled by default:
- Collect approved source now
- Score internally
- Generate internal memo
- Draft Kanban route proposal
- Request ComplyOps review
- Mark pursue/watch/reject internally
- Attach sanitized evidence ref

External/high-risk actions disabled by default:
- Send sponsor outreach
- Submit affiliate application
- Submit bid/proposal
- Submit grant application
- Create external account
- Add payment/tax/bank/KYC
- Push email/SMS activation
- Publish public claim
- Export raw contacts or raw PII

Disabled button tooltip format:
`Blocked by <GATE_ID>: <reason>. Safe next action: <nextSafeAction>.`

No UI may show a green GO state for external action unless API returns `allowed:true`, approval is unexpired, audit event exists, cap/kill switch are visible, and final content/evidence refs are attached.

## 3. Action-class gate matrix

| Action class | Gate ID | Default | Allowed without escalation | Hard caps/rate limits | Allowed accounts/providers | Data boundaries | Required audit events | Success metric | Stop condition | Escalation threshold | Required UI state |
|---|---|---:|---|---|---|---|---|---|---|---|---|
| Read-only collection | `GATE_OPP_READ_ONLY_COLLECTION` | GO if approved source | Public/approved-source fetches; official API/RSS/manual source capture; source metadata normalization | Official API/RSS limits only; per-source `rate_limit`; no login scraping unless source account approved; no full private datasets | SAM.gov via `SAM_GOV_API_KEY`/`SAM_API_KEY`; USAspending public API; Grants.gov; approved state/local/RSS/job/affiliate/sponsor public pages; internal aggregate metrics | Store public org/opportunity data only; env-var credential refs only; no raw secrets; no private personal contact harvesting; no scraped prohibited merchant content | `opportunity_source_run_started`, `opportunity_collected`, `opportunity_record_rejected`, `source_rate_limited` | Source run completes with records normalized and unsafe records rejected | Terms/robots/API policy conflict, login wall, CAPTCHA, private data, raw PII/secrets, provider warning, unexpected high error rate | New auth-required source, scrape beyond public pages, private portals, or terms ambiguity | Enable “Collect source”; show source terms/rate/health; show “external actions disabled” |
| AI scoring | `GATE_OPP_AI_SCORING_INTERNAL` | GO internal only | Fit scoring, risk scoring, confidence, missing fields, recommendation band | Unlimited internal scoring; no external calls with raw PII/secrets; prompt input must use sanitized opportunity fields/evidence refs | Internal app scorer; approved model provider only if prompt redaction passes | Inputs: public org data, sanitized summaries, evidence refs. No raw PII/secrets/tokens/private contacts | `opportunity_scored`, `score_rejected_sensitive_input`, `score_version_created` | Score includes weights, confidence, missing fields, risk explanation, lower-is-better risk dimensions | Hallucination risk high without evidence, raw PII/secret detected, model output invents proof | Model/provider change, regulated/legal claim scoring, automated go/no-go affecting external action | Enable “Score”; show “internal decision support only” label |
| AI memo / decision support | `GATE_OPP_AI_MEMO_INTERNAL` | GO internal only | Go/No-Go memo, buyer pain, first-cash path, required proof, blockers, kill criteria | Unlimited internal memos; memo must be labeled `INTERNAL DECISION SUPPORT — NOT EXTERNAL COPY`; no auto-send | Internal memo engine or approved model provider after redaction | Evidence-ref based; no unredacted personal data; no secret values; no invented claims | `go_no_go_memo_generated`, `memo_sensitive_input_blocked`, `memo_human_review_status_set` | Memo has required sections, evidence refs, confidence, hallucination risk, review status | Generated memo includes unsupported claim, legal conclusion, private data, or external-ready copy without review | Memo for bid/proposal/grant/customer/public page or regulated category | Enable “Generate internal memo”; disable “Use externally” |
| Kanban routing | `GATE_OPP_KANBAN_ROUTING_SANITIZED` | GO internal only | Create sanitized route proposals or internal task drafts for workers | No raw PII/secrets; no external action authorization; one route proposal per opportunity/action unless status changes | Hermes Kanban internal board only | Sanitized evidence refs; no credentials; no raw contacts; no private attachment dumps | `kanban_route_proposed`, `kanban_route_created`, `kanban_route_blocked_sensitive_data` | Route draft includes assignee, outcome, constraints/gates, acceptance criteria, no-external-action statement | Draft contains secrets/PII, asks worker to submit/send/pay/sign, or lacks gate constraints | Actual task creation into board from CRM automation; cross-tenant routing; external-action task | Enable “Draft route”; show preview; “Create task” requires internal routing permission |
| Sponsor outreach | `GATE_OPP_SPONSOR_OUTREACH` | BLOCKED | Draft sponsor brief/pitch for review; compile proof packet from verified aggregate metrics | Manual pilot only after gate; default send cap 0; initial approved cap should be <=10 tailored B2B sends/day/account and <=20 total before review unless Boss sets otherwise | Approved Mehyar Media/StuffPrettyGood email/Gmail/manual outreach only; no ESP/list blast | Use company/org contact channels from public source; no scraped personal emails at scale; no audience data transfer; aggregate proof only | `sponsor_pitch_draft_saved`, `sponsor_outreach_attempt_blocked`, `sponsor_outreach_gate_approved`, `sponsor_send_logged` | Tailored sends logged, no complaint/provider issue, sponsor replies/meetings, no false audience claims | Any complaint, bounce/provider warning, false claim, request to sell/rent data, or cap exceeded | Any mass outreach, automated sequence, data-sharing term, contract, guarantee, paid placement promise | Disable “Send pitch”; enable “Draft pitch” and “Request outreach gate” |
| Affiliate/network application | `GATE_OPP_AFFILIATE_APPLICATION` | BLOCKED | Draft application answers; track requirements; prepare claim-safe site proof packet | Default submit cap 0; after gate: exact network/application only, one final reviewed submission per approval | No-cost affiliate/network portals only; existing approved accounts/status refs; no paid plan | Truthful site traffic/content/signup metrics only; no invented audience/revenue; credential refs only; no tax/bank/KYC unless separate gate | `affiliate_application_draft_saved`, `affiliate_application_attempt_blocked`, `affiliate_application_gate_approved`, `affiliate_application_submitted` | Application submitted exactly as approved; account status tracked; no false proof | Tax/bank/SSN/EIN, paid plan, OTP/CAPTCHA, irreversible legal terms, or required false metric | Any KYC/tax/payout step, paid subscription, contractual commitment, or broad network claim | Disable “Apply”; enable “Draft application”; show missing proof |
| Government bid/proposal | `GATE_OPP_GOV_BID_PROPOSAL` | BLOCKED | Read solicitation; extract requirements; draft outline/capability sections for review; partner watchlist | Default submit cap 0; no portal submission; no certifications claimed unless verified | SAM.gov/source portals read-only unless account approved; proposal docs internal only | No invented small-business status, NAICS fit, certifications, past performance, staff resumes, insurance/bonding, or agency relationship | `gov_requirement_extracted`, `proposal_outline_drafted`, `gov_submission_attempt_blocked`, `gov_bid_gate_approved` | Clear no-bid/bid recommendation with eligibility and proof requirements | Missing registration, mandatory certification, unrealistic fulfillment, legal terms, short deadline without capacity, false proof risk | Any actual proposal/bid/RFI response, SAM/portal account action, contract terms, reps/certs | Disable “Submit bid/proposal”; enable “Generate requirement memo” |
| Grants | `GATE_OPP_GRANT_APPLICATION` | BLOCKED | Grant eligibility review; draft concept note; list required docs; route to Arman/ProductOps | Default submit cap 0 | Grants.gov/state/local portals read-only unless approved account access | No invented nonprofit status, eligibility, budget, matching funds, outcomes, community proof, partners | `grant_eligibility_reviewed`, `grant_concept_drafted`, `grant_submission_attempt_blocked`, `grant_gate_approved` | Eligibility clarified; required docs and deadline known; pursue/watch/reject logged | Eligibility unsupported, fiscal/legal obligations unclear, budget/match required, partner signatures needed | Any grant submission, budget commitment, signature, partner representation | Disable “Submit grant”; enable “Draft concept” |
| Job-posting outreach / service lead | `GATE_OPP_JOB_POSTING_OUTREACH` | BLOCKED for outreach; GO for signal scoring | Convert public job posts into service-opportunity signals; draft tailored service angle | Collection respects source terms; outreach cap 0 until gate; after gate <=10 tailored manual contacts/day/account and stop on complaint/provider issue | Approved company website/contact form or manual email account only; no job-board ToS violation | Use org/company-level data; avoid harvesting personal applicant/recruiter data; no pretending to be applicant | `job_signal_collected`, `service_angle_drafted`, `job_outreach_attempt_blocked`, `job_outreach_gate_approved` | Clear service offer fit and manual target list; replies without complaints | Platform ToS forbids solicitation, personal data harvesting, deceptive applicant framing, provider warning | Any automated outreach, scraped emails, use of job application forms for sales | Disable “Contact company”; enable “Draft service angle” |
| Account creation | `GATE_OPP_ACCOUNT_CREATION_NO_COST` | REVIEW REQUIRED | Create/track no-cost source/account only if Boss has authorized class and platform terms allow truthful signup | No-cost only; cap one account per network/source; stop before CAPTCHA/OTP/tax/bank/KYC/paid/legal uncertainty | Approved Mehyar Media/StuffPrettyGood identity, approved email, password vault/secret store; credential refs only | Store account metadata and credential refs; never plaintext secret; no false traffic/audience/publisher claims | `source_account_planned`, `source_account_created_no_cost`, `credential_ref_saved`, `account_creation_blocked_human_required` | Account exists/status tracked without spend/KYC/false claims; credential ref saved | CAPTCHA, phone OTP, tax/bank/SSN/EIN, paid plan, irreversible terms, required false claim | Any payout/KYC/tax/spend/legal agreement or human-only verification | Disable “Create account” until approval; show “Track requirement” |
| Paid tools / spend | `GATE_OPP_PAID_TOOLS_SPEND` | BLOCKED | Free trials/no-cost research if no payment method and no legal risk | Spend cap $0 by default; no card entry; no subscription; no ad spend | None unless Boss-approved exact vendor/account/cap | No payment details in CRM; receipts/approvals refs only | `spend_attempt_blocked`, `paid_tool_gate_requested`, `paid_tool_gate_approved`, `receipt_ref_saved` | Spend remains $0 unless explicitly approved; value/cost tracked | Payment method request, auto-renewal, overage, trial requiring card, procurement term | Any charge, recurring plan, ad budget, paid API overage | Disable “Upgrade/buy”; enable “Request spend approval” |
| Tax / bank / KYC / payout | `GATE_OPP_TAX_BANK_KYC` | BLOCKED | Track required fields/status names only | Cap 0 submissions; no SSN/EIN/bank/tax values entered into CRM notes/logs | Human-controlled official portals only after Boss/legal/account owner approval | Field names/status only; no raw values; no screenshots containing values; no model prompts with values | `tax_kyc_step_blocked`, `payout_setup_blocked`, `kyc_gate_requested`, `kyc_gate_approved` | Human knows exact field/action needed without sensitive values exposed | Any request for SSN/EIN, W-9/W-8, bank, address proof, ID, phone OTP, beneficial owner data | Always Boss/account-owner approval before proceeding | Disable form fields; show “human required: field names only” |
| Email activation | `GATE_OPP_EMAIL_ACTIVATION` | BLOCKED | Internal campaign simulation, draft re-permission copy, count-only eligible segment estimate | Default send cap 0; future scoped test only after separate send gate; no Opportunity Finder auto-send | Approved ESP/provider only after domain/provider readiness; CRM/admin domain never used for marketing sends | Suppression-cleaned, consent/source classified, unsubscribe/List-Unsubscribe, complaint/bounce monitoring; no raw exports | `email_activation_attempt_blocked`, `campaign_simulated`, `suppression_overlap_checked`, `email_send_gate_requested` | Simulation identifies eligible count, risk, cap, kill criteria; no live send occurred | Unknown consent/source included, unsubscribe missing, provider readiness absent, complaint/bounce not integrated | Any live send/export/provider push, cohort over cap, mass activation | Disable “Send email”; enable “Simulate” |
| SMS activation | `GATE_OPP_SMS_ACTIVATION` | BLOCKED | SMS consent inventory/status review; draft YES/STOP workflow only | SMS cap 0 unless documented written marketing consent + provider/STOP gate + Boss approval | Approved SMS provider only after separate gate | Documented sender/use-case consent required; STOP suppression immediate; no SHAFT/high-risk categories over SMS | `sms_activation_attempt_blocked`, `sms_consent_reviewed`, `sms_stop_suppressed`, `sms_gate_requested` | SMS remains quarantined unless evidence says eligible; no texts sent | Missing/ambiguous written marketing consent, STOP missing, high-risk category, provider issue | Any SMS/MMS/RCS send/provider import/re-permission text | Disable all SMS send controls; show consent blocker |
| Public claims / public copy | `GATE_OPP_PUBLIC_CLAIMS` | BLOCKED for publish; GO for internal draft | Draft claim-safe copy with evidence placeholders and disclaimers | Publish cap 0 until claim review; no guarantees; no fabricated metrics | Owned public sites/docs only after WebDev/ProductOps/ComplyOps approval | Evidence required for every concrete claim; aggregate metrics only when verified; no private customer/list info | `public_claim_draft_saved`, `claim_validation_failed`, `claim_evidence_attached`, `claim_approved`, `publish_attempt_blocked` | Copy is factual, supportable, and approved for exact surface | Unsupported audience/performance/customer/certification/past-performance claim; regulated guarantee | Any public page, sponsor deck, proposal, application, sales email, case study | Disable “Publish/use externally”; enable “Request claim review” |
| Raw PII export / data transfer | `GATE_OPP_RAW_PII_EXPORT_TRANSFER` | BLOCKED | Count-only previews, masked samples, aggregate proof packets | Raw export cap 0; masked preview <=100 rows if approved role; count-only unlimited within query caps | Internal CRM only; no third-party transfer by Opportunity Finder | No list sale/rental, no consent transfer, no raw emails/phones/names/addresses in docs/Kanban/prompts/logs | `raw_export_attempt_blocked`, `count_preview_run`, `masked_preview_run`, `data_transfer_blocked` | Useful aggregate proof without exposing raw PII | Raw identifiers appear in response/log/Kanban/export, or third-party asks for list/data | Any raw export, sponsor/network data share, partner transfer, or provider sync | Disable “Export raw”; enable “Count-only proof packet” |

## 4. Decision buttons and state transitions

Allowed internal transitions:
- `new -> scored`
- `new/scored -> watch`
- `new/scored -> reject`
- `new/scored -> needs_partner`
- `new/scored -> needs_approval`
- `new/scored/watch -> routed` when route is sanitized and internal-only

Blocked without gate:
- Any transition to `submitted`, `sent`, `published`, `paid`, `account_created`, `kyc_submitted`, `provider_pushed`, `email_sent`, `sms_sent`, or equivalent external side-effect state.

`pursue` is allowed only as an internal planning decision. If `pursue` implies an external action, API must return `403 blocked` unless the exact action gate is approved.

## 5. AI output contract

Every AI-generated recommendation must include:
- Label: `INTERNAL DECISION SUPPORT — NOT EXTERNAL COPY`.
- Evidence refs used.
- Confidence score.
- Missing fields.
- Hallucination/false-proof risk.
- Required approvals.
- Prohibited claims detected.
- Next safe internal action.
- Kill criteria.

AI must not:
- Mark external actions allowed by itself.
- Invent registrations, certifications, capabilities, customers, past performance, audience size, traffic, revenue, conversion, deliverability, or approval status.
- Generate final external content without human review status.
- Use raw PII/secrets in prompts or outputs.

## 6. Claim validation rules

Block or require review for any draft containing:
- Audience size claims unless tied to verified evidence and allowed surface. Use “legacy audience assets” or “owned audience proof metrics where verified” instead of unsupported numbers.
- Government/compliance claims like certified, registered, approved vendor, minority-owned, 8(a), HUBZone, SDVOSB, SOC 2, HIPAA, GDPR compliant unless verified.
- Past performance, customer names, testimonials, case studies, agency relationships, awards, or revenue/conversion metrics without evidence refs.
- Guaranteed outcomes: guaranteed leads, guaranteed conversions, guaranteed revenue, guaranteed deliverability, guaranteed inboxing, guaranteed win.
- Data transfer claims suggesting sale/rental/transfer of list or consent.

Safe phrasing examples:
- “Internal opportunity intelligence and campaign readiness system.”
- “Draft-only recommendation pending human review.”
- “Aggregate proof metrics available where verified in CRM.”
- “No list sale/rental or consent transfer.”
- “Controlled re-permission and preference capture only after compliance/provider gates.”

## 7. Audit event minimums

Every event must include:
- `id`, `created_at`, `actor_id`, `actor_role`, `session_id`, `request_id`
- `action`, `action_class`, `resource_type`, `resource_id`
- `decision`: `allowed | blocked | review_required | watch | go | no_go`
- `gate_id`
- `reasons`
- `caps_snapshot`
- `approval_ref` when applicable
- `approval_expires_at` when applicable
- `evidence_refs`
- `input_hash` / `final_content_hash` for externally used content
- `metadata_sanitized: true`

Audit metadata must not include raw PII, secrets, tokens, tax/bank/KYC values, full private destination URLs, or unredacted generated prompts.

## 8. UI copy library

Use these exact warnings/tooltips where practical:

- Read-only collection: “Collection is allowed only from approved/public sources under source rate limits. External actions remain disabled.”
- AI scoring: “AI score is internal decision support, not approval to submit, send, publish, or spend.”
- Kanban routing: “Kanban route is sanitized internal work only. It authorizes no outreach, submission, payment, or public claim.”
- Sponsor outreach: “Sponsor outreach is blocked until final copy, destination, cap, and proof packet are approved.”
- Affiliate application: “Application submit is blocked until claim-safe answers and account requirements are reviewed. Stop at tax/bank/KYC/paid/OTP/CAPTCHA.”
- Government bid/proposal: “Submission blocked. Draft requirements and proof checklist only.”
- Grant: “Grant submission blocked. Draft concept and eligibility review only.”
- Job-posting outreach: “Do not contact or use application forms for sales without outreach gate.”
- Account creation: “No-cost account setup requires truthful identity and stops at human-only, tax/bank/KYC, paid, OTP, CAPTCHA, or legal terms.”
- Paid tools: “Spend cap is $0 until Boss-approved vendor, cap, owner, and stop-loss exist.”
- Tax/bank/KYC: “Human required. Store field names/status only, never values.”
- Email activation: “No live send/export/provider push. Use simulation/count-only preview.”
- SMS activation: “SMS blocked without documented written marketing consent, STOP handling, provider gate, and Boss approval.”
- Public claims: “Public use blocked until every claim has evidence and ComplyOps approval.”
- Raw PII export: “Raw export/transfer blocked. Use count-only or masked proof packet.”

## 9. QA checklist

LeadFS/WebDev QA must report GO/NO-GO separately for:
- Authenticated-only Opportunity Desk routes.
- Read-only collection allowed only for approved source classes.
- Env-var-only credential references.
- Sensitive payload rejection before storage, AI prompt, Kanban route, docs, logs, and frontend rendering.
- AI scoring/memos labeled internal-only and evidence-referenced.
- Kanban routing sanitized and no-external-action by default.
- Every external action class blocked by API and disabled in UI by default.
- Audit events written for blocked attempts and allowed internal actions.
- Approval object contains exact action, destination, content hash, cap, owner, expiry, kill switch, and evidence refs.
- Claim validator blocks unsupported claims.
- No raw PII/secrets in generated artifacts.
- No auto-submit path exists.

A feature does not pass if the UI disables a button but the API action succeeds, or if the API blocks without writing an audit event.
