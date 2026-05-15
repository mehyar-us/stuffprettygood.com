# Campaign Manager CRM API/Data Contracts — 2026

Source of truth: `/home/mehya/.hermes/kanban/boards/mehyar-media/workspaces/t_0cba8054/PRODUCTOPS-2026-SPG-CAMPAIGN-MANAGER-PRD-BACKLOG.md`

## Doctrine

Campaign Manager is a control tower, not a send console.

- Fresh intent first; legacy audience later only after explicit gates.
- No mass activation from this module.
- No raw PII in frontend/event/dashboard defaults.
- Simulator never enables live send, export, or provider push.
- Risky action attempts write an audit event and return blocked state until a separate class gate and live activation implementation are approved.

## Implemented executable contract

`src/crm/campaignManager.js` exports pure contract functions that backend routes can wrap without changing the safety posture:

- `createOfferCatalogRecord(input)`
- `evaluateGoLinkActivation(offer)`
- `createPreferenceProfile(input)`
- `recordAttributionEvent(input)`
- `evaluateReadinessGates(input)`
- `simulateCampaign(input)`
- `attemptRiskyAction(input)`
- `summarizeRevenueDashboard(events)`

The tests in `test/campaign-manager-contracts.test.js` are the executable API contract.

## Offer Catalog

Required fields before `/go` activation:

- `vendor`
- `category`
- `offerName`
- `landingUrl`
- `approvalStatus: approved`
- `targetPersona`
- `riskTier`
- `disclosure`
- `claimRestrictions[]`

Blocked states:

- draft, rejected, paused, or missing approval
- missing landing URL
- missing disclosure
- missing risk tier
- missing persona
- missing claim restrictions/merchant terms notes

## Preference Engine

Supported fields:

- role/persona
- business type
- team size
- interests/tool interests
- quiz answers
- topics
- preferred channel/frequency
- source page/route/UTM/referrer
- consent state/basis/timestamp
- unsubscribe/suppression state

Raw email/phone are masked in returned payloads. Unknown consent is not permission; it returns `channelEligible: false` with exclusion reasons.

## Attribution Ledger

Supported events:

- `page_view`
- `quiz_started`
- `quiz_answered`
- `quiz_completed`
- `result_viewed`
- `preference_updated`
- `opt_in_submitted`
- `offer_impression`
- `go_clicked`
- `conversion_reported`
- `conversion_imported`
- `checklist_downloaded`
- `template_downloaded`
- `setup_requested`
- `unsubscribe`
- `complaint`
- `bounce`
- `suppression_written`

Default event payloads include identifiers and attribution dimensions only: surface, visitor session, lawful profile id, persona, source, UTM/referrer, affiliate id, offer, go slug, campaign, segment, cohort, risk, revenue, currency, confidence, disclosure seen, audit id. Raw PII is not returned.

## Campaign Simulator

Inputs:

- segment/audience eligibility
- offer
- channel
- assumptions: CTR, CVR, EPC, complaint risk, unsubscribe risk, confidence
- provider/domain readiness
- audit/monitoring/raw-PII controls

Outputs:

- eligible audience
- offer fit score
- compliance readiness score
- deliverability risk score
- projected clicks/conversions/revenue
- risk estimate
- confidence
- failed gates
- `GO`, `WATCH`, or `NO-GO`
- required approvals
- kill criteria
- visible assumptions
- `liveActionsEnabled: false`

`WATCH` is returned for low confidence, medium/high-risk offers, or elevated complaint/unsubscribe assumptions even when hard gates pass.

## Readiness Gate Engine

Hard blocks include:

- suppressed segment or suppressed records
- suppression not checked/applied
- missing unsubscribe/preference path for outbound/risky action classes
- source classification not `fresh_intent` or `opt_in`
- incomplete consent/source classification
- unapproved offer `/go` activation
- provider readiness not `approved_controlled` for outbound/provider push
- DNS not green for outbound/provider push
- complaint/bounce/unsubscribe webhooks missing
- audit disabled
- monitoring disabled
- raw PII masking/control disabled

## Risky Action Contract

`attemptRiskyAction({ action })` supports:

- `send`
- `export`
- `provider_push`

It always returns:

- `allowed: false`
- `state: blocked`
- `auditEvent.type: risky_action_attempted`
- `auditEvent.decision: blocked`

This is intentional. The current build is API-contract/control-plane only; live activation must be a separate approved implementation with class gates.

## Revenue Dashboard

`summarizeRevenueDashboard(events)` provides totals and rollups by:

- offer
- persona
- source page
- campaign
- segment
- risk tier

Metrics:

- views
- `/go` clicks
- conversions
- revenue
- EPC
- RPM

## Verification

Use WSL Node directly because this environment has a Windows `npm` earlier in PATH:

```bash
node --test test/campaign-manager-contracts.test.js test/compliance-gates.test.js
```

Current passing evidence: 13/13 tests.
