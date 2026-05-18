# Opportunity Desk — AI Application Helper Memos Product Spec

Owner: ProductOps
Task: t_3b3255ea
Status: internal-prep specification
Applies to: CRM Opportunity Desk `memo_type=application_plan` and UI action copy

## Ruling

The AI application helper is an internal money-engine prep assistant. It helps Boss Holdings operators understand how an opportunity would be pursued, what is missing, what proof must be assembled, what package angle may convert, and which gates block external action.

It must not apply, submit, contact, publish, create accounts, enter spend, enter KYC/tax/bank details, make public claims, or imply approval to do any of those actions.

## Buyer / operator

Primary operator: Boss / Hot Zero / ProductOps / Arman reviewing monetizable opportunities in the CRM.

Internal buyer pain:
- Opportunities arrive as noisy signals without a clear path to money.
- Operators need fast clarity on “what would we do next?” without accidentally triggering compliance, reputation, account, spend, or public-claim risk.
- The desk needs a bridge from source evidence to a claim-safe package angle and sanitized Kanban prep task.

Promise:
- In one click, convert a raw/scored opportunity into an internal application/pursuit plan with evidence refs, missing info, package angle, compliance gates, and kill criteria.

Non-promise:
- It does not win the opportunity, send anything, submit anything, create external accounts, guarantee eligibility, or validate legal/compliance status.

## UI control confirmation

Approved button label:
- `AI application helper`

Approved detail panel heading:
- `How to apply / pursue safely`

Approved badge / microcopy:
- `AI prep only`
- `Internal AI helper — not an application/submission.`

Why this fits Boss’s 2026 money engine vision:
- Commercially direct: focuses each opportunity on first-cash path, proof, package angle, and next safe internal action.
- Execution-safe: produces internal prep and Kanban-ready checklists without authorizing risky side effects.
- Scales operator leverage: one assistant behavior works across affiliate programs, sponsor leads, grants, gov opportunities, job-posting/service leads, and marketplace opportunities.
- Truth-first: every action references source evidence and blocks unsupported claims.

## Backend memo contract

Endpoint:
- `POST /api/opportunity-desk/opportunities/:id/memos`

Request:
```json
{
  "memo_type": "application_plan"
}
```

Required response fields already required by the memo interface:
- `memo_type: application_plan`
- label: `INTERNAL DECISION SUPPORT — NOT EXTERNAL COPY`
- `input_evidence_refs`
- model/provider metadata
- prompt version
- confidence score
- hallucination risk
- human review status
- blocked external actions
- sanitized markdown body

Required memo sections for `application_plan`:
1. Internal-only banner.
2. AI application helper summary: opportunity title, buyer/org, score/confidence if available.
3. Apply path / pursue path:
   - verify source evidence, terms, deadline, eligibility;
   - identify official application/bid/contact surface from source refs only;
   - build internal requirements checklist;
   - draft claim-safe response/proposal outline;
   - request Boss/ComplyOps approval before any external action.
4. Likely package angle: source-backed first-cash/service/revenue angle.
5. Required info to collect.
6. Draft response outline.
7. Missing fields.
8. Compliance gates.
9. Evidence refs.
10. Recommendation.
11. Next safe internal action.
12. Kill criteria.

## AI helper behavior

The helper may:
- Summarize the opportunity and buyer/org-level pain from source evidence.
- Explain how an operator would pursue it internally.
- List missing info and proof requirements.
- Produce a claim-safe response outline for later human review.
- Suggest a package angle tied to Mehyar Media / MehyarSoft / Axial / StuffPrettyGood assets.
- Recommend a safe internal next action: watch, request more data, route Kanban prep, or request approval gate.
- Produce sanitized Kanban route inputs.

The helper must not:
- Click, submit, send, contact, publish, create account, pay, sign, accept legal terms, enter bank/tax/KYC values, export raw PII, or push provider actions.
- Say “approved,” “eligible,” “certified,” “registered,” “guaranteed,” or “ready to submit” unless that exact proof/gate exists.
- Invent customer proof, past performance, revenue, traffic, audience, deliverability, conversion, certification, affiliation, testimonials, or government/vendor status.
- Use raw PII, secrets, tax/bank/KYC values, private lead/contact data, or credentials in prompts, memos, docs, Kanban, logs, screenshots, frontend, or generated files.

## Missing info checklist

Minimum checklist returned or implied by the memo:
- Official source/evidence URL.
- Opportunity type and action class.
- Buyer/org name and public org-level context.
- Eligibility requirements.
- Deadline / due date / rolling status.
- Required docs/assets.
- Submission/contact channel, if public and source-backed.
- Account/registration requirements, if any.
- Tax/bank/KYC/paid/OTP/CAPTCHA/legal-terms blockers by field/status name only.
- Price/value/commission/budget basis.
- Required proof packet.
- Claim restrictions and disallowed traffic/use terms.
- Source terms/rate/privacy notes.
- Gate ID and approval owner.

## Source evidence requirements

Minimum evidence for useful memo:
- At least one official/public source ref or sanitized internal evidence ref.
- Source family and source health.
- Evidence age or last source run where available.
- Source terms/access method where available.
- Expected value basis if value is shown.
- Proof requirements tied to evidence, not invented assumptions.

If evidence is missing:
- Memo may still generate, but recommendation must be `request_more_data` or equivalent.
- Hallucination/false-proof risk must be visible.
- Next action must be evidence collection, not pursuit.

## Package angle rules

Package angle should translate the opportunity into a sellable internal offer or pursuit thesis:
- Sponsor/affiliate: audience/content fit, proof packet, placement/content package, compliance-safe application answers.
- Gov/procurement/grant: eligibility memo, requirement checklist, capability fit, partner/proof gaps, no-bid/bid recommendation.
- Job/service lead: public org pain, service angle, manual gate-required outreach prep only.
- Marketplace/partner: value hypothesis, requirements, proof, account/legal blockers.

Package angle must include:
- Buyer/payer.
- Pain.
- Proposed deliverable or response shape.
- Proof needed.
- First-cash path or reason cash path is blocked.
- Non-goals and kill criteria.

## Compliance gates

Always show or derive relevant gates from the ComplyOps matrix:
- `GATE_OPP_AI_MEMO_INTERNAL`
- `GATE_OPP_KANBAN_ROUTING_SANITIZED`
- `GATE_OPP_AFFILIATE_APPLICATION`
- `GATE_OPP_SPONSOR_OUTREACH`
- `GATE_OPP_GOV_BID_PROPOSAL`
- `GATE_OPP_GRANT_APPLICATION`
- `GATE_OPP_JOB_POSTING_OUTREACH`
- `GATE_OPP_ACCOUNT_CREATION_NO_COST`
- `GATE_OPP_PAID_TOOLS_SPEND`
- `GATE_OPP_TAX_BANK_KYC`
- `GATE_OPP_PUBLIC_CLAIMS`
- `GATE_OPP_RAW_PII_EXPORT_TRANSFER`

Default caps:
- Max external sends: 0.
- Max submissions/applications/bids/grants: 0.
- Max spend: $0.
- Max raw PII export/transfer: 0.
- Account/KYC/tax/bank actions: blocked pending explicit gate.

## Kill criteria

Kill or reject when any are true:
- No official/public source evidence can be attached.
- Eligibility requires a certification/status/capability Boss Holdings cannot truthfully prove.
- Required claims would invent audience, revenue, clients, past performance, certification, approval, or guaranteed outcomes.
- Source terms prohibit the planned channel/use.
- Opportunity requires raw PII export, list sale/rental, or consent transfer.
- Opportunity requires tax/bank/KYC/spend/account/legal commitment without approved gate.
- Deadline is too short for proof, review, and safe fulfillment.
- Expected value is unclear or too small relative to operator time/risk.
- Compliance or reputation risk exceeds first-cash upside.

## Acceptance criteria

Product acceptance:
- UI exposes `AI application helper` beside score/memo/route actions.
- UI separately shows `How to apply / pursue safely` with internal-only guidance before any generated memo.
- Calling memo endpoint with `memo_type=application_plan` stores and returns an application-plan memo.
- Memo body includes `AI application helper`, `Apply path`, evidence refs, missing fields, compliance gates, package angle, next safe internal action, and kill criteria.
- Memo explicitly says AI cannot submit/apply/contact/publish.
- External actions remain disabled by default and API-enforced.
- No raw PII/secrets/tax/bank/KYC values appear in output.
- Contract test covers the application-plan memo type and forbidden side-effect copy.

Business acceptance:
- The behavior accelerates monetization by converting opportunities into fast internal prep tasks.
- It preserves truth-first source evidence and avoids false proof.
- It creates a clear route to ComplyOps/Boss approval only when the opportunity survives evidence and kill gates.

## Kanban wave if further implementation is needed

1. WebDev/LeadFS: ensure `AI application helper` button sends `{ memo_type: "application_plan" }` and renders result in memo panel.
2. LeadFS: ensure memo generator uses application-plan sections and redaction before storage.
3. ComplyOps: verify copy against external-action gate matrix.
4. QA: run contract test and UI smoke proving no external action path is enabled.
5. ProductOps: review top opportunity examples and tune package-angle copy for first-cash clarity.
