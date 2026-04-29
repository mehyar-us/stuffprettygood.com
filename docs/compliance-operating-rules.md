# Suppression and Compliance Operating Rules

Owner role: Deliverability / Compliance Operator
Issue: MEH-11 — Build compliance gates and suppression operating rules

## Non-negotiable operating principle

No campaign can move beyond `draft` until suppression and compliance approval states are both explicitly approved.

The CRM is a command center, not a blasting tool. Suppression and approval gates must exist before any future email or SMS sending feature can be enabled.

## Campaign lifecycle gates

Allowed statuses:

- `draft`: editable campaign construction state; sending is impossible.
- `review`: internal review state after suppression/compliance checks pass.
- `approved`: ready for scheduling only after approvals.
- `scheduled`: queued for future send by an approved sender integration.
- `active`: actively executing through an approved provider.
- `sent`: completed campaign.
- `paused`: manually paused for investigation or operator control.
- `cancelled`: permanently stopped.

Gate rule:

- `draft` requires no approval.
- Every status beyond `draft` requires a complete gate decision.
- Missing approval data blocks transition.
- Any unresolved suppression/compliance finding blocks transition.

## Required suppression categories

Every campaign audience must be checked against:

1. `global_unsubscribe` — user opted out of all email communications.
2. `brand_unsubscribe` — user opted out of the specific brand.
3. `sms_stop` — user sent STOP or equivalent SMS opt-out.
4. `spam_complaint` — user complained through mailbox provider, SMS carrier, or manual report.
5. `hard_bounce` — address or number is known invalid/unreachable.
6. `legal_suppression` — user/entity is prohibited by legal, dispute, or settlement basis.
7. `manual_suppression` — operator-added exclusion.

## Approval record requirements

Suppression approval must include:

- `state: approved`
- approver id
- approval timestamp
- checked suppression categories
- blocked recipient count
- source list or segment id

Compliance approval must include:

- `state: approved`
- approver id
- approval timestamp
- legal basis or consent/risk basis
- unsubscribe URL status for email campaigns
- SMS STOP handling status for SMS campaigns
- sender identity status

## Blocking conditions

A campaign must stay in `draft` when any of these are true:

- suppression state is missing, pending, failed, rejected, or expired
- compliance state is missing, pending, failed, rejected, or expired
- any required suppression category has not been evaluated
- blocked recipient count is unknown
- unsubscribe handling is missing for email
- STOP handling is missing for SMS
- sender identity is missing or unapproved
- legal/manual suppression overlap is unresolved
- campaign copy lacks required identity/disclosure language

## Audit requirements

Every gate decision must record:

- campaign id
- target status requested
- decision: allowed or blocked
- blocking reasons
- suppression approval id/state
- compliance approval id/state
- actor id
- timestamp

## Implementation reference

The executable gate logic lives in `src/compliance/gates.js` with tests in `test/compliance-gates.test.js`.
