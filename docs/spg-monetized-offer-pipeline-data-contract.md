# SPG monetized offer pipeline data contract

Task: t_6eab4df0
Owner: DataEng
Migration draft: `db/003_spg_monetized_offer_pipeline_schema.sql`
Status: additive schema/design artifact for LeadFS/WebDev/ComplyOps review before production execution.

## Reality

Boss directive from parent task: StuffPrettyGood public inventory must not publish free/unpaid offer postings by default. Public site consumption is limited to approved monetized rows or explicitly approved lead magnets. Account creation may proceed only with secret-safe DB/account records; no raw secrets or raw PII in artifacts.

This contract adds a durable CRM-side monetized offer pipeline around the existing SPG source/offer/article work. It is built as explicit tables plus a single safe public feed view.

## Tables / entities

### `account_credentials_refs`

Purpose: store opaque references to secret locations, never raw secrets.

Required safety fields:
- `credential_ref`: e.g. `env:SPG_AMAZON_ASSOCIATES_TAG`; reference only.
- `secret_store`: `env`, `cloudflare_secret`, `vault`, `1password`, `other`.
- `secret_key_label`: environment/secret name only.
- `rotation_status`, `last_rotated_at`, `next_rotation_due_at`.

Guardrail:
- Check constraint rejects obvious raw key/value secret patterns.

### `offer_accounts`

Purpose: monetization/account registry for Amazon Associates, affiliate networks, direct sponsors, owned offers, and approved lead magnets.

Required fields covered:
- `monetization_status`
- `payout_model`
- `account_status`
- `credential_ref`
- `disclosure_required`
- `risk_tier`

Core gate:
- Active non-lead-magnet accounts require a `credential_ref`.
- Active accounts require `approved_monetized` or `approved_lead_magnet`.
- Blocked risk tier cannot be active.

### `offer_sources`

Purpose: source registry for trend feeds, RSS, editorial/manual sources, network terms pages, and owned catalogs.

Required fields covered:
- `source_url`
- `risk_tier`
- `source_status`
- `allowed_use`
- `source_quality_score`

Core gate:
- Approved source requires `terms_url`, non-blocked allowed use, and non-blocked risk tier.

### `daily_ingest_runs`

Purpose: audit each daily/manual ingest/build/health pass.

Required fields covered:
- run status and counts
- safety assertions: `no_raw_pii_asserted`, `no_raw_secret_asserted`, `no_scrape_asserted`
- blocker classes and error summary

Core gate:
- Failed/blocked runs must explain why.
- Safety assertions must remain true.

### `offer_candidates`

Purpose: candidate offer/work item before public publication.

Required fields covered:
- `monetization_status`
- `payout_model`
- `account_status`
- `approval_status`
- `image_rights_status`
- `disclosure_required`
- `source_url`
- `risk_tier`
- `publish_decision`

Scoring fields:
- `candidate_score`
- `candidate_confidence`
- `scoring_inputs`
- `scoring_weights`
- `missing_data`
- `false_positive_risks`
- `source_age_hours`
- `privacy_pii_handling`
- `refresh_cadence`

Default scoring weights:
- monetization fit: 0.35
- source quality: 0.20
- trend fit: 0.15
- rights readiness: 0.15
- risk penalty: 0.15

Core gate:
- `publish_monetized` requires approved candidate, approved image rights, disclosure text, non-blocked risk, `approved_monetized`, and payout model not `none`.
- `publish_lead_magnet` requires approved candidate, approved image rights, disclosure text, non-blocked risk, `approved_lead_magnet`, and payout model `lead_magnet`.

### `offer_images`

Purpose: rights-safe image registry for candidates.

Required fields covered:
- `source_url`
- `image_rights_status`
- `risk_tier`
- license/credit fields

Core gate:
- Approved images cannot be blocked and must render required credit.

### `offer_approvals`

Purpose: appendable approval evidence per candidate and review scope.

Required fields covered:
- `approval_status`
- `risk_tier`
- `approval_scope`
- `reviewer_role`
- `requirements_checked`
- `missing_data`

Scopes:
- monetization
- source terms
- image rights
- copy claims
- public publish
- account credentials
- lead magnet

### `affiliate_tracking`

Purpose: bridge/go-link and tracking metadata without raw click PII.

Required fields covered:
- `monetization_status`
- `payout_model`
- `disclosure_required`
- approval/tracking status
- health status

Core gate:
- Active tracking requires approved status, disclosure version, healthy link, non-blocked risk, and either approved monetized payout or approved lead magnet.

### `publish_decisions`

Purpose: explicit public publication decision ledger.

Required fields covered:
- `publish_decision`
- `approval_status`
- `risk_tier`
- route/surface
- decision role/reason

Core gate:
- Public decisions require approval, non-blocked risk, and route path.

### `signup_intent_events`

Purpose: no-send signup/preference intent event logging.

PII handling:
- Use `profile_ref_hash` / `identifier_hash` only.
- Raw email/phone/name must not be stored in this table.
- `raw_pii_present`, `provider_push_enabled`, `live_send_enabled`, and `blocked_payload_stored` must all remain false by default.

Core gate:
- Constraint prevents raw-PII/default-send unsafe rows.

## Public site consumption rule

Public WebDev surfaces should consume:

`public_approved_offer_feed`

Do not consume raw `offer_candidates`, `offer_accounts`, or `affiliate_tracking` directly in public route builders.

The view only returns rows where:
- candidate approval is approved
- candidate risk is not blocked
- image rights are approved
- disclosure is required and present
- publish decision is approved
- publish decision is `publish_monetized` or `publish_lead_magnet`
- affiliate tracking is active and approved
- monetized rows have `approved_monetized` and payout model not `none`
- lead magnets have `approved_lead_magnet` and payout model `lead_magnet`

## Sample seed rows

Migration includes safe seed records for:
- Amazon Associates manual bridge account with `env:SPG_AMAZON_ASSOCIATES_TAG` credential reference.
- MehyarSoft owned audit offer with `cloudflare_secret:MEHYARSOFT_AUDIT_CHECKOUT` credential reference.
- StuffPrettyGood free checklist as an explicitly approved lead magnet.
- Google Trends US daily source.
- Manual SPG editorial source.

No seed row contains raw secrets or raw PII.

## Acceptance queries

Run these after applying the draft migration in a review database.

```sql
-- Public rows must be monetized or approved lead magnets only.
select count(*) as bad_public_rows
from public_approved_offer_feed
where not (
  (publish_decision = 'publish_monetized' and monetization_status = 'approved_monetized' and payout_model <> 'none')
  or (publish_decision = 'publish_lead_magnet' and monetization_status = 'approved_lead_magnet' and payout_model = 'lead_magnet')
);
-- expect 0
```

```sql
-- Active accounts must not expose raw credential values.
select account_key, credential_ref
from offer_accounts
where account_status = 'active'
  and credential_ref ~* '(secret|token|password|api[_-]?key)=[^& ]+';
-- expect 0 rows
```

```sql
-- Signup events remain no-send/no-PII by default.
select count(*) as unsafe_signup_events
from signup_intent_events
where raw_pii_present
   or provider_push_enabled
   or live_send_enabled
   or blocked_payload_stored;
-- expect 0
```

```sql
-- Publishable candidates have approvals/disclosure/image rights.
select candidate_key
from offer_candidates
where publish_decision in ('publish_monetized','publish_lead_magnet')
  and not (
    approval_status = 'approved'
    and image_rights_status = 'approved'
    and disclosure_required
    and disclosure_text is not null
    and risk_tier <> 'blocked'
  );
-- expect 0 rows
```

## Confidence / missing data / failure modes

Confidence: 0.82 for schema/data-contract completeness. The design covers the required entities and public gate, but still needs LeadFS production migration review and WebDev integration.

Missing data:
- Final production DB flavor/version and migration runner convention.
- Whether existing `spg_*` tables should be backfilled into these exact unprefixed CRM tables or mapped through compatibility views.
- Final owner names for each approval role.

False-positive risks:
- A row can be structurally approved while underlying merchant terms changed after review.
- Opaque credential refs can point to missing/incorrect runtime secrets; DevOps health checks must validate presence without logging values.
- Source quality scores can overstate source safety if terms/robots change.

Refresh cadence:
- Daily ingest/build run writes `daily_ingest_runs`.
- Weekly account/source/image rights review for active public inventory.
- Immediate re-review on merchant/network terms changes, broken link health, complaint, or ComplyOps blocker.

## Hand-off contract

LeadFS:
- Review DDL for production migration runner compatibility.
- Decide whether to keep exact unprefixed table names or bridge from existing `spg_*` tables.

WebDev:
- Public route builders should use `public_approved_offer_feed` only.
- Do not expose credential refs beyond internal admin surfaces.

ComplyOps:
- Validate approval scopes, disclosure rules, claim restrictions, and lead-magnet exception language.

DevOps:
- Confirm secret reference naming convention and add non-logging health check for required environment/Cloudflare secrets.
