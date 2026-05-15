# WebDev handoff — StuffPrettyGood reactivation/preference/admin UX

Task: t_c930dd03
Date: 2026-05-15
Source of truth: `/home/mehya/.hermes/projects/mehyar-media/PROJECT-001-CRM-COMMAND-CENTER.md`
Parent PRD: `/home/mehya/.hermes/kanban/boards/mehyar-media/workspaces/t_37b02023/A-TO-Z-SPG-REACTIVATION-CRM-MASTER-PRD-BACKLOG.md`

Safety posture: no raw PII, subscriber samples, secrets, payment data, or live-send authorization are included. All public and admin UX keeps no-send/no-SMS/no-export/provider-push blocked by default.

## Reality

Repo access allowed implementation of static public/admin UX prototypes and tests. The current codebase is static Node-generated HTML plus CRM contract modules, not a full browser CRM app yet, so the admin deliverable is an operator UX prototype/spec page plus route/event/test coverage.

## What changed

Implemented/generated these route surfaces:

- `/reactivation.html` — preference-first return-credit hub with five clear user choices: claim return credit, private drops, AI/business offers, StuffPrettyGood updates, unsubscribe everything.
- `/thank-you.html` — safe preference-saved confirmation page with next steps to quiz, preferences, or unsubscribe.
- `/crm-command-center-ux.html` — admin UX prototype/spec for Contact War Room, tier status, Sponsor Pilot Manager, Offer Manager, Test Simulator, Metrics Dashboard, and clear blocked states.
- Existing `/preferences.html`, `/unsubscribe.html`, `/privacy.html`, `/terms.html`, and `/affiliate-disclosure.html` remain linked from every generated surface.

Updated implementation artifacts:

- `src/spg/public-surfaces.js`
  - Added CRM event maps for reactivation, thank-you, and admin UX.
  - Added public surface registry entries for reactivation, thank-you, and CRM command center UX.
- `scripts/generate-spg-static.js`
  - Added primary nav links for Return Credit and CRM UX.
  - Generates the new static pages.
  - Adds visible `NO-SEND`, `NO-SMS`, `NO-GO`, `WATCH`, `BLOCKED`, and `TERMS REVIEW` status badges.
- `test/spg-public-surfaces.test.js`
  - Requires the new routes to exist.
  - Verifies reactivation options, admin modules, and blocked-state labels are present.
- `scripts/qa-spg-responsive.py`
  - Expands screenshot-led QA from home-only to home, reactivation, preferences, unsubscribe, and admin UX.
  - Captures mobile/tablet/desktop in light/dark.
  - Asserts no horizontal overflow and required disclosure/unsubscribe footer visibility.

## UX decisions

Public reactivation page:

- Dominant action: choose whether StuffPrettyGood should be useful again.
- Primary CTA: `Claim return credit`.
- Exit path: visible `Unsubscribe everything` CTA above the form and footer unsubscribe on every page.
- Claim-safe copy: return credit is a placeholder only; no guaranteed reward, savings, income, sponsor result, or SMS consent.
- Consent-safe data: form asks for topic/channel/preferences only; email is labeled as prototype-redacted and production must write server-side audit/suppression/preference events.

Preference center:

- Keeps simple topics, role, business type, channel, frequency, brand opt-out, and global opt-out.
- Clear opt-out controls remain present and test-covered.

Admin UX prototype:

- Contact War Room card: aggregate source/tier intelligence, masked refs, quarantine queues, evidence links.
- Tier Status card: clean/dormant/quarantine/no-SMS states; Tier 3 and Tier 4 remain quarantined.
- Sponsor Pilot card: proof packet, no-data-transfer evidence, aggregate reporting only, contract/payment blocked.
- Offer Manager card: terms/disclosure/risk review and /go readiness for return credit/private drops/AI business/Amazon manual/SaaS referrals.
- Test Simulator card: GO/WATCH/NO-GO, RP1000, CP1000, complaint risk, provider readiness blocker.
- Metrics Dashboard card: separates audience growth, sponsor pipeline, on-site intent, outbound readiness, SMS readiness; live send disabled.

## Screenshot-led QA evidence

Command run:

```bash
PATH=/home/mehya/.local/nodejs/node-v22.12.0-linux-x64/bin:$PATH node scripts/generate-spg-static.js
PATH=/home/mehya/.local/nodejs/node-v22.12.0-linux-x64/bin:$PATH npm test
python3 -m http.server 4174 --directory public
python3 scripts/qa-spg-responsive.py
```

Generated screenshots under `qa/screenshots/`:

- `spg-home-{mobile,tablet,desktop}-{light,dark}.png`
- `spg-reactivation-{mobile,tablet,desktop}-{light,dark}.png`
- `spg-preferences-{mobile,tablet,desktop}-{light,dark}.png`
- `spg-unsubscribe-{mobile,tablet,desktop}-{light,dark}.png`
- `spg-admin-ux-{mobile,tablet,desktop}-{light,dark}.png`

QA assertions passed for every page/viewport/theme:

- no horizontal overflow
- disclosure visible
- footer includes Affiliate disclosure, Privacy, Terms, Preferences, Unsubscribe
- mobile/tablet show menu toggle; desktop shows expanded nav
- light/dark color-scheme renders coherent body/text colors
- reactivation displays `NO-SEND`
- admin UX displays `WATCH`, `NO-SMS`, `BLOCKED`, `TERMS REVIEW`, `NO-GO`, `NO-SEND`

## Test evidence

`npm test` with local Linux Node v22.12.0:

- 26/26 passing.
- Includes public surface route existence, disclosure/privacy/preferences/unsubscribe links, reactivation/admin blocked-state coverage, frontend PII redaction, CRM readiness gates, no-send proof, campaign simulator, and risky-action blocking tests.

Note: a first `npm test` accidentally resolved to Windows npm from WSL and ran the wrong Windows-side node test discovery. The valid test run prepended `/home/mehya/.local/nodejs/node-v22.12.0-linux-x64/bin` and passed correctly.

## GO/NO-GO by requested lane

- Reactivation preference/return-credit page: GO for local prototype/build; public launch still needs normal public deploy gate.
- Signup/preference center: GO for static prototype; production write path must persist preference/suppression/audit events.
- Thank-you pages: GO for static prototype.
- Affiliate disclosure/privacy/unsubscribe surfaces: GO for static prototype and linked from all required pages.
- CRM admin UX: GO as implemented prototype/spec; full app integration is LeadFS scope.
- Outbound email readiness: NO-GO.
- SMS readiness: NO-GO.
- Provider push/export/live send/payment/sponsor contract: NO-GO until scoped class gates pass.

## Risks / blockers

- Full CRM integration requires LeadFS API/data-layer implementation; this task did not wire production form submissions.
- Public deployment/live launch requires deploy gate and ComplyOps/public-page review.
- Existing workspace contains many untracked/modified files from prior/parallel work, so changes should be reviewed carefully before any commit/merge.

## Next action

LeadFS should wire these surfaces to production preference/suppression/audit endpoints and keep dangerous actions hard-disabled. ComplyOps should review public copy before any live public deploy or outbound use.
