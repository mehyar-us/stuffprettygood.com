# Opportunity Source-Family Apply/Pursue Playbooks

Owner: ComplyOps
Task: t_10faec86
Applies to: Opportunity Desk pursue/apply motions for affiliate applications, sponsor outreach, government bid/no-bid, state/local quick RFPs, subcontract teaming, and job-posting service leads.
Related gates: `docs/opportunity-finder-external-action-ai-decision-gates.md`
Related API contract: `docs/opportunity-desk-api-contract.md`
Status: class-gate playbook artifact; external actions remain blocked unless the exact approval gate below is satisfied.

## 0. Universal ruling

Opportunity Desk may prepare, score, draft, and route opportunities internally. It may not submit, send, publish, sign, pay, create payout/KYC records, claim status/certifications, export raw PII, or contact third parties without the exact class gate approval.

Universal safe lane:
- Collect and normalize approved public/source data under source rate limits.
- Generate internal score, go/no-go memo, proof checklist, missing-fields list, and claim-safe draft snippets.
- Create sanitized Kanban route proposals with evidence refs and no external-action authorization.
- Track approval requirements and blocked action reasons.

Universal blocked lane:
- Auto-submit or auto-send anything externally.
- Enter tax/bank/KYC/SSN/EIN/payment/beneficial-owner values into any app, prompt, Kanban card, doc, log, screenshot, or Git file.
- Invent certifications, registrations, legal status, small-business status, client proof, past performance, audience metrics, deliverability metrics, revenue/conversion metrics, testimonials, case studies, staff resumes, insurance/bonding, or guaranteed outcomes.
- Use scraped personal emails/phones at scale, use job application forms for sales, sell/rent/share list data, or transfer consent.
- Proceed through CAPTCHA, OTP, phone verification, paid plan, NDA, legal terms uncertainty, or provider warning without human approval.

Universal approval object minimum:
- `gate_id`, `action_class`, exact opportunity/source, exact destination/account/provider, owner, cap, expiry, kill switch, required proof/evidence refs, final content hash for external copy, approved sender/account, data boundary, and escalation contact.
- Approval must be stored as metadata/audit ref, not in free-text with secrets or raw PII.

Universal audit event minimum:
- `action_requested`, `decision`, `gate_id`, `resource_id`, `actor_role`, `approval_ref`, `caps_snapshot`, `evidence_refs`, `final_content_hash` when applicable, `reasons`, `metadata_sanitized:true`.
- Write audit events for allowed, blocked, review-required, and stopped actions.

Universal stop conditions:
- Complaint, bounce/provider warning, ToS/robots/API ambiguity, CAPTCHA/OTP, login wall not approved, payment/tax/bank/KYC request, false/unsupported claim, raw PII/secret detected, cap exceeded, legal terms/NDA/signature, certification/eligibility uncertainty, or request to share/sell/rent audience/list data.

## 1. Family matrix

| Source family / motion | Default state | Gate ID | Initial cap after gate | Approved operators | Allowed accounts/providers | Data boundary | Escalation threshold |
|---|---:|---|---:|---|---|---|---|
| Affiliate application | BLOCKED for submit | `GATE_OPP_AFFILIATE_APPLICATION` + `GATE_OPP_TAX_BANK_KYC` if payout setup appears | 1 reviewed application per exact approval; 0 payout/KYC submissions | ProductOps/Arman with ComplyOps review; Boss for payout/KYC | No-cost affiliate/network portals; approved SPG/Mehyar Media identity; env-var credential refs only | Truthful site/content/traffic proof only; aggregate metrics; no tax/bank/KYC values in internal systems | Any KYC/tax/bank/paid plan/legal commitment, false metric, broad network claim, account suspension risk |
| Sponsor outreach | BLOCKED for send | `GATE_OPP_SPONSOR_OUTREACH` + `GATE_OPP_PUBLIC_CLAIMS` | <=10 tailored manual sends/day/account and <=20 total before review unless Boss sets lower/higher | Arman/ProductOps; ComplyOps for claims; Boss for contracts/data sharing | Approved Mehyar Media/SPG email or contact form; no ESP/list blast by default | Company/org contact channels only; no raw audience export; aggregate proof only | Mass outreach, automated sequence, complaint, provider warning, paid-placement guarantee, contract/data-sharing term |
| Federal government bid/no-bid | BLOCKED for bid/portal submission | `GATE_OPP_GOV_BID_PROPOSAL` | 0 submissions; internal bid/no-bid memo only until Boss/legal approval | Scout/ProductOps draft; ComplyOps review; Boss/legal for submit/sign | SAM.gov/read-only public sources unless account action separately approved | Public solicitation info and internal capability proof only; no invented reps/certs/past performance | Any proposal/RFI/RFQ/RFP response, SAM/portal account action, reps/certs, signature, contract terms |
| State/local quick RFP | BLOCKED for submit | `GATE_OPP_STATE_LOCAL_QUICK_RFP` (inherits `GATE_OPP_GOV_BID_PROPOSAL`) | 0 submissions; quick screen memo within 24h if source is public | Scout/ProductOps draft; ComplyOps review; Boss/legal for submit/sign | Official city/county/state portals/RSS/email bulletins; no paid bid service without spend gate | Public RFP data only; no vendor-registration secrets; no certificate/insurance/bond claims unless verified | Deadline <72h, vendor registration, insurance/bonding, notarization, public-record legal terms, required site visit |
| Subcontract teaming / prime portal | BLOCKED for outreach/registration | `GATE_OPP_SUBCONTRACT_TEAMING` + account/NDA gates as needed | 0 external sends/registrations; internal partner fit brief only | Arman/ProductOps; Boss/legal for NDA/teaming/MOU | Public prime supplier pages, approved direct email only after gate; no portal account creation by default | Company-level fit and capability summary only; no clearance/cert claims or private partner data | NDA, teaming agreement, exclusivity, clearance/cert requirement, past performance request, subcontract terms |
| Job-posting service lead | GO for signal scoring; BLOCKED for outreach | `GATE_OPP_JOB_POSTING_OUTREACH` | <=10 tailored manual contacts/day/account after gate; 0 job-application-form sales | Scout finds; Arman/ProductOps drafts; ComplyOps claim/outreach review | Company website contact form or approved manual email; no job board ToS violation | Org/job-post metadata only; avoid raw recruiter/applicant data; no pretending to be applicant | Platform ToS conflict, scraped personal contacts, applicant-form misuse, automated sequence, complaint/provider warning |

## 2. Playbook: affiliate application

Purpose: pursue SPG/Mehyar Media affiliate programs where approval can unlock fast monetization without spend or false proof.

Required info before gate request:
- Program/network name, URL, merchant/category, commission/EPC if public, cookie/window if public, prohibited traffic methods, disclosure requirements, payout/KYC requirements, and account/payment prerequisites.
- Exact site/app to represent, exact applicant entity/name/email, approved credential-ref location if account exists, and whether the application is free.
- Proof packet: public site URL, content category fit, current disclosed affiliate posture, aggregate traffic/click/conversion proxies if verified, sample pages, privacy/disclosure pages, and missing proof list.
- Draft application answers with evidence refs for every numeric or concrete claim.

Approval gate:
- ComplyOps approves claim-safe answers and confirms no payout/KYC/paid/legal commitment is in scope.
- ProductOps/Arman confirms business fit and exact program to pursue.
- Boss/account owner approval required before tax/bank/KYC, payout setup, legal agreement, paid plan, or phone/OTP/CAPTCHA action.

Blocked actions:
- Submitting application, creating account, accepting paid terms, completing payout setup, entering tax/bank/KYC values, claiming traffic/revenue/audience/case-study proof without evidence, or using hidden/noncompliant affiliate links.

Legal/compliance risks:
- FTC affiliate disclosure, network terms, prohibited incentive/traffic methods, trademark bidding restrictions, inaccurate publisher claims, payout tax/KYC obligations, privacy-policy mismatch, account suspension.

AI may safely draft:
- Application answer drafts marked `INTERNAL DRAFT — HUMAN REVIEW REQUIRED`.
- Missing-field checklist, claim/evidence map, disclosure checklist, program comparison, and Kanban route proposal.
- AI must not submit, fill portal forms, choose unsupported numbers, or handle credentials/tax/bank/KYC.

Audit log:
- `affiliate_application_draft_saved`, `claim_evidence_attached`, `affiliate_application_attempt_blocked`, `affiliate_application_gate_approved`, `affiliate_application_submitted`, `tax_kyc_step_blocked`.

Success metric:
- Application submitted exactly as approved, account status tracked, no false proof, no undisclosed payout/KYC leakage, and approval/denial reason captured.

Stop condition:
- Any payout/KYC/tax/bank/paid/OTP/CAPTCHA/legal-term step, unsupported metric, disclosure gap, or program terms conflict.

## 3. Playbook: sponsor outreach

Purpose: convert verified SPG/Mehyar Media assets into tailored sponsor conversations without burning sender reputation or making unsupported audience claims.

Required info before gate request:
- Sponsor/company, target contact channel, offer angle, proposed placement/campaign concept, exact send account, exact final copy, final content hash, proof packet refs, cap, expiry, kill switch, and follow-up count.
- Verified aggregate proof only: site/page fit, content categories, engagement/click/conversion proxies where verified, examples of relevant surfaces, and disclosure/placement boundaries.
- Suppression/do-not-contact check for target org/contact where available.

Approval gate:
- ComplyOps approves claims and proof packet.
- Arman/ProductOps approves business fit and pricing/ask language.
- Boss approval required for contract, guarantee, audience/data sharing, paid placement terms, list transfer, or any mass/automated sequence.

Blocked actions:
- Live send before approval, ESP/list blast, scraping personal emails at scale, multiple follow-ups beyond cap, guarantee of revenue/leads/deliverability, sharing raw audience/list data, or signing/accepting sponsor terms.

Legal/compliance risks:
- CAN-SPAM/business-email opt-out, sender/domain reputation, false advertising, endorsement/disclosure rules, privacy/data-transfer issues, contract/indemnity terms, brand safety.

AI may safely draft:
- Tailored sponsor brief, first-touch email, one follow-up, proof-packet outline, objection-handling notes, and internal pricing hypothesis.
- AI must label copy as draft and must not send, schedule, enrich contacts at scale, or fabricate proof.

Audit log:
- `sponsor_pitch_draft_saved`, `claim_validation_failed`, `sponsor_outreach_attempt_blocked`, `sponsor_outreach_gate_approved`, `sponsor_send_logged`, `complaint_or_provider_warning_logged`.

Success metric:
- Manual sends within cap, no complaint/provider warning, replies/meetings logged, opt-outs respected, and no unsupported claim used.

Stop condition:
- Complaint, opt-out, bounce/provider warning, proof challenge, cap exceeded, request for data transfer/list rental, or contract/guarantee discussion.

## 4. Playbook: federal government bid/no-bid

Purpose: screen federal opportunities for realistic fit while preventing false reps/certs, premature legal commitments, and wasted bid labor.

Required info before gate request:
- Solicitation URL/source, agency, NAICS/PSC, set-aside/certification requirements, due date/timezone, submission method, incumbent/award context if public, budget/ceiling if public, required registrations, mandatory attachments, evaluation criteria, compliance clauses, insurance/bonding/security requirements, past-performance/staffing requirements, and Q&A deadlines.
- Internal capability fit: products/services available now, fulfillment owner, gaps, partner needs, proof/evidence refs, and no-bid reasons.

Approval gate:
- Read/extract/draft is allowed internally.
- Any portal account action, question submission, RFI/RFQ/RFP response, proposal, certification representation, SAM/reps-certs update, signature, or contract acceptance requires Boss/legal/account-owner approval.

Blocked actions:
- Submitting bids/proposals/questions, claiming registered vendor status/certification/past performance/clearance/insurance, binding price/terms, creating portal accounts, signing reps/certs, or using agency logos/relationship claims.

Legal/compliance risks:
- False Claims Act exposure, procurement integrity, reps/certs accuracy, debarment/suspension risk, cybersecurity/insurance clauses, labor/compliance clauses, public-record submissions, bid protest/ethics issues.

AI may safely draft:
- Requirement extraction, compliance matrix, no-bid/bid memo, capability-section draft with placeholders, question list, partner-needed brief, and missing-proof checklist.
- AI must not decide final eligibility, certify status, price a binding proposal, or submit/modify portal data.

Audit log:
- `gov_requirement_extracted`, `gov_no_bid_memo_saved`, `proposal_outline_drafted`, `gov_submission_attempt_blocked`, `gov_bid_gate_approved`, `gov_submission_logged`.

Success metric:
- Clear bid/no-bid recommendation with eligibility blockers, proof needs, estimated effort, deadline feasibility, and route owner; no external submission unless separately approved.

Stop condition:
- Mandatory certification/registration missing, due date too short for review, required legal/insurance/security clause unclear, partner/past-performance gap, portal account action, or signature/reps-certs requirement.

## 5. Playbook: state/local quick RFP

Purpose: quickly triage local/state procurement that may be simpler/faster than federal work while still treating submissions as legal/public commitments.

Required info before gate request:
- Jurisdiction, official source URL, RFP/RFQ number, due date/timezone, Q&A/site-visit deadlines, submission channel, vendor registration requirements, insurance/bonding/local preference/certification requirements, scope, budget, evaluation criteria, public-record terms, and required forms.
- Fit screen: deliverable match, fulfillment timeline, required local licenses/certifications, references/past performance required, and whether a smaller quote/micro-project path exists.

Approval gate:
- Internal quick-screen memo may be drafted immediately from public sources.
- Any registration, question, quote, bid, proposal, insurance certificate, W-9, notarized form, signature, or portal upload requires Boss/legal/account-owner approval.

Blocked actions:
- Vendor registration, bid/quote submission, form upload, site-visit RSVP if it implies commitment, claiming local/preferred/certified status, attaching tax/insurance docs, or agreeing to public-contract terms.

Legal/compliance risks:
- Public-record disclosure, local procurement ethics/lobbying rules, false local/cert status, insurance/bond requirements, payment terms, indemnity, mandatory wage/labor clauses, tax forms.

AI may safely draft:
- 24-hour quick-screen memo, compliance checklist, go/no-go recommendation, sanitized Q&A draft, capability outline with placeholders, and required-doc list.
- AI must not register vendor, submit questions/proposals, sign forms, or insert tax/insurance values.

Audit log:
- `state_local_rfp_screened`, `state_local_quick_memo_saved`, `state_local_submission_attempt_blocked`, `state_local_gate_approved`, `state_local_submission_logged`.

Success metric:
- Pursue/watch/reject decision within 24 hours of discovery; evidence refs complete; legal/credential steps isolated from AI systems.

Stop condition:
- Deadline under 72 hours without approved capacity, required certification/insurance/bonding, unclear public terms, registration requiring sensitive values, or mandatory site visit/human attendance.

## 6. Playbook: subcontract teaming / prime portal

Purpose: identify partner/team opportunities that may let MehyarSoft/SPG participate without prime-bid burden, while avoiding unsupported capability, clearance, or past-performance claims.

Required info before gate request:
- Prime/vendor/partner name, public portal or supplier page URL, target opportunity/agency if known, capability fit, required certifications/clearance, NDA/teaming/MOU requirements, registration requirements, contact channel, and requested proof.
- Internal partner thesis: why we fit, what we can deliver now, what proof exists, what must be partnered, revenue model, and no-go blockers.

Approval gate:
- Internal partner fit brief and capability draft are allowed.
- Any outreach, supplier registration, NDA, MOU/teaming agreement, subcontract term, exclusivity, data room access, or representation about status/capability requires Boss/legal/ComplyOps approval.

Blocked actions:
- Registering supplier, accepting NDA/legal terms, claiming clearance/certification/past performance, sending capability statement externally, sharing private audience/customer data, or agreeing exclusivity/teaming terms.

Legal/compliance risks:
- NDA/confidentiality, teaming agreement obligations, exclusivity, procurement integrity, false capability/certification statements, flow-down clauses, subcontract payment terms, data/security requirements.

AI may safely draft:
- Partner fit brief, sanitized capability statement draft with evidence placeholders, partner question list, risk memo, and proof-gap matrix.
- AI must not send capability statement, register in portals, accept NDA, or represent certifications/clearances.

Audit log:
- `subcontract_partner_fit_drafted`, `capability_statement_draft_saved`, `subcontract_outreach_attempt_blocked`, `subcontract_gate_approved`, `nda_or_teaming_step_blocked`.

Success metric:
- Partner-ready internal packet with evidence-backed capabilities, blockers, and next human action; no NDA/registration/outreach without approval.

Stop condition:
- NDA/portal registration, clearance/certification required, partner asks for past performance/customer details, exclusivity/teaming terms, or any legal document appears.

## 7. Playbook: job-posting service lead

Purpose: convert public hiring demand into service-offer intelligence for MehyarSoft without misusing job boards, applicant forms, or personal recruiter data.

Required info before gate request:
- Job/company URL, source terms, role/function, pain signal, company website/contact channel, org-level metadata, public budget/salary if relevant, service angle, contact plan, approved sender/account, suppression/do-not-contact status, and final copy hash.
- Evidence that contact route is for business inquiries and does not misuse a job application workflow.

Approval gate:
- Signal scoring and service-angle drafting are allowed internally.
- Manual contact requires outreach gate approval with exact destination, sender, copy, cap, opt-out language where email is used, and stop condition.
- Boss approval required for automated sequences, use of paid/enrichment tools, raw contact export, or contract/guarantee terms.

Blocked actions:
- Applying to jobs as sales tactic, using application forms for sales, scraping recruiter emails/phones at scale, automated outreach, circumventing job-board terms, impersonating applicants, or using raw personal data in prompts/Kanban/docs.

Legal/compliance risks:
- Job-board ToS, CAN-SPAM/business-email rules, deceptive practices, privacy/personal-data handling, sender reputation, discrimination/employment sensitivity if messaging is poorly framed.

AI may safely draft:
- Service angle, internal account brief, one tailored email/contact-form draft, missing-info checklist, and Kanban route proposal.
- AI must not submit forms, send email, enrich contacts, or pretend to be an applicant.

Audit log:
- `job_signal_collected`, `service_angle_drafted`, `job_outreach_attempt_blocked`, `job_outreach_gate_approved`, `job_outreach_logged`, `source_tos_stop_logged`.

Success metric:
- Qualified service lead packet with ToS-safe contact path, no personal-data leakage, manual outreach logged within cap, and no complaint/provider warning.

Stop condition:
- ToS forbids solicitation, only application-form path exists, raw personal contact required, complaint/opt-out/provider warning, or any automation/enrichment request beyond gate.

## 8. AI draft safety labels

All AI outputs for these playbooks must include one of these labels:
- `INTERNAL DECISION SUPPORT — NOT EXTERNAL COPY` for memos, score explanations, bid/no-bid, and partner fit briefs.
- `DRAFT EXTERNAL COPY — HUMAN REVIEW AND GATE APPROVAL REQUIRED` for emails, application answers, capability statements, and proposal snippets.
- `BLOCKED ACTION SUMMARY — DO NOT SUBMIT/SEND/PUBLISH` for workflows that hit stop conditions.

AI outputs must include:
- Evidence refs used.
- Missing fields.
- Unsupported/prohibited claims detected.
- Required approvals.
- Data boundary note.
- Next safe internal action.
- Kill criteria.

## 9. Implementation notes for Opportunity Desk UI/API

- Show `Draft` buttons for all families; keep `Submit`, `Send`, `Register`, `Sign`, `Pay`, `Export`, and `Publish` disabled until the exact gate returns `allowed:true`.
- Disabled tooltip: `Blocked by <GATE_ID>: external action requires exact approved destination, final content hash, cap, owner, expiry, kill switch, and evidence refs. Safe next action: draft internal packet.`
- API must enforce gates independently of UI and return the universal gate response shape from `docs/opportunity-finder-external-action-ai-decision-gates.md`.
- `pursue` means internal planning only. If it implies external action, return blocked/review-required.
- Approval expiry default: 7 days for outreach/application copy; 24 hours for deadline-sensitive RFP/government actions unless Boss/ComplyOps sets another value.
- Store content hashes and evidence refs, not raw private attachments or sensitive values.

## 10. Acceptance checklist

- [ ] Each source-family packet has required info, gate, cap, operator, provider/account, data boundary, audit events, success metric, stop condition, and escalation threshold.
- [ ] AI output is labeled draft/internal-only and evidence-referenced.
- [ ] Unsupported public claims are blocked or replaced with proof-placeholder language.
- [ ] No raw secrets, raw PII, tax/bank/KYC values, private credentials, or sensitive screenshots appear in docs/Kanban/logs/Git/frontend/prompts.
- [ ] External-action buttons/API states remain blocked by default.
- [ ] Every allowed or blocked attempt writes a sanitized audit event.
