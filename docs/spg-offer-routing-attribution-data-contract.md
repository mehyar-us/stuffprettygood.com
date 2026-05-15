# SPG offer routing + click attribution data contract

Task: t_512923db
Owner: DataEng
Migration draft: `db/004_spg_offer_routing_attribution_schema.sql`
Status: additive DB/data-model artifact for LeadFS/WebDev/ComplyOps review before production execution.

## Reality

Parent directive: all StuffPrettyGood offer clicks must go card -> `/offers/<slug>` landing -> `/go/<slug>` tracked redirect. Public cards must not link directly to merchant/network URLs.

Existing pipeline artifacts (`db/003_spg_monetized_offer_pipeline_schema.sql` and `docs/spg-monetized-offer-pipeline-data-contract.md`) already define the approval, monetization, image-rights, disclosure, source, account, and safe public-feed gates. This task hardens the durable route identity, redirect destination handling, click/signup attribution, and Amazon migration/audit layer.

## Required row contract for every approved offer

Every approved/public offer must have these fields before WebDev generates `/offers/<slug>` or `/go/<slug>` pages:

- `offer_id`: internal UUID (`offer_candidates.id`). Never use merchant URL as identity.
- `canonical_slug`: stable public key, lowercase slug, unique.
- `public_landing_url`: derived path `/offers/<canonical_slug>`.
- `redirect_url`: derived path `/go/<canonical_slug>`.
- `destination_url_secret_or_sanitized`: exactly one of:
  - `destination_url_secret_ref` when the true network/deep link should stay in secret storage/runtime config.
  - `destination_url_sanitized` when the URL is safe for internal audit and contains no credentials/PII/secrets.
- `network`: merchant/network/account family, e.g. `Amazon Associates`.
- `account_id/ref`: internal account UUID plus safe account key/ref, e.g. `amazon-associates-manual`.
- `monetization_status`: must be `approved_monetized` or approved lead-magnet exception.
- `approval_status`: must be `approved` for public rows.
- `disclosure_text`: non-null and rendered on the landing page.
- `image_rights_status`: must be `approved` for public rows.
- `SEO/schema fields`: `seo_title`, `seo_description`, `seo_keywords`, `schema_org_type`, `schema_org_json`.
- `click_count`: aggregate no-PII count from `/go/<slug>` events.
- `signup_count`: aggregate no-PII count from signup attribution events.
- `last_verified_at`: latest account/source/link/route review timestamp.
- `redirect_health`: `ok`, `redirect_ok`, `manual_review`, `unknown`, `broken`, or `blocked`; public feed excludes `broken`/`blocked`.
- `source_attribution`: JSON object plus `source_attribution_text` showing source URL, source ID, ingest run, account key, and allowed-use policy.

## Tables / schema updates

### `offer_candidates` additions

Purpose: canonical public offer identity and landing-page metadata.

Added fields:
- `canonical_slug`
- `public_landing_path`
- `public_redirect_path`
- `seo_title`
- `seo_description`
- `seo_keywords`
- `schema_org_type`
- `schema_org_json`
- `source_attribution`
- `source_attribution_text`
- `source_retrieved_at`
- `source_license`
- `last_verified_at`
- `redirect_health`
- `click_count`
- `signup_count`

Gates:
- Slug must match `^[a-z0-9][a-z0-9-]{2,120}$`.
- Route paths must equal `/offers/<slug>` and `/go/<slug>`.
- Public publish decisions require slug, SEO metadata, non-empty source attribution, verification timestamp, and redirect health not `broken`/`blocked`.

### `affiliate_tracking` additions

Purpose: safe redirect resolution and network/account attribution.

Added fields:
- `offer_id`
- `canonical_slug`
- `public_landing_path`
- `public_redirect_path`
- `destination_url_mode`: `secret_ref` or `sanitized`
- `destination_url_secret_ref`
- `destination_url_sanitized`
- `network`
- `account_ref`
- `click_count`
- `signup_count`
- `last_verified_at`
- `redirect_health`
- `source_attribution`

Gates:
- Active tracking requires route paths, offer/account attribution, safe destination mode, non-empty source attribution, last verification timestamp, and healthy/non-blocked redirect status.
- `destination_url_secret_ref` is a reference label only; it must not contain raw tokens, passwords, API keys, private keys, or `secret=value` patterns.
- If `destination_url_mode = secret_ref`, `destination_url_sanitized` must be null to prevent accidental public leakage.

### `offer_click_events`

Purpose: click attribution for `/go/<slug>` without raw PII.

Key fields:
- `offer_id`
- `affiliate_tracking_id`
- `canonical_slug`
- `landing_path`
- `redirect_path`
- `surface`
- `source_channel`
- `attribution_ref_hash`
- `session_ref_hash`
- coarse browser/country fields only

PII guard:
- `raw_pii_present = false`
- `raw_ip_stored = false`
- `raw_user_agent_stored = false`

### `offer_signup_attribution_events`

Purpose: signup/preference attribution tied to offers without pushing providers or storing raw signup identifiers.

Key fields:
- `offer_id`
- `affiliate_tracking_id`
- `signup_event_id`
- `canonical_slug`
- `landing_path`
- `redirect_path`
- `attribution_ref_hash`
- `consent_state`

PII/send guard:
- `raw_pii_present = false`
- `provider_push_enabled = false`
- `live_send_enabled = false`

### `offer_performance_daily`

Purpose: daily rollup table for count dashboards and public/admin summaries.

Key fields:
- `offer_id`
- `affiliate_tracking_id`
- `canonical_slug`
- `metric_date`
- `click_count`
- `signup_count`
- `source_channel`
- `surface`

Unique grain:
- `(offer_id, metric_date, source_channel, surface)`

## Public view contract

Public route builders should consume:

`public_approved_offer_route_feed`

This view exposes only:
- approved monetized rows or approved lead-magnet exceptions;
- `/offers/<slug>` as `public_landing_url`;
- `/go/<slug>` as `redirect_url`;
- disclosure, SEO/schema, image, health, aggregate counts, and source attribution;
- destination URL only as either sanitized value or secret ref field based on `destination_url_mode`.

Public cards must link only to `public_landing_url`. Landing pages may show disclosure/source/SEO data and link only to `redirect_url`. `/go/<slug>` resolves server-side, logs `offer_click_events`, and then redirects to the approved destination.

Do not build public cards from raw `destination_url`, raw `affiliate_tracking`, hardcoded trend cards, or merchant URLs.

## Daily ingestion rule

Daily pipeline order:

1. Ingest candidates into DB first.
   - Source rows and ingest run are written before any page generation.
   - Candidate rows default to `publish_decision = do_not_publish` and `approval_status = pending`.
   - Candidate may contain source metadata and original SPG summary only; no copied merchant prices, reviews, ratings, availability, images, raw secrets, or raw PII.
2. Normalize route identity.
   - Generate deterministic `canonical_slug` from candidate key/title/category.
   - Reserve `/offers/<slug>` and `/go/<slug>` in DB with uniqueness checks.
3. Evaluate monetization/account readiness.
   - Network/account must be active or explicitly approved lead magnet.
   - Credential/destination handling must use safe refs or sanitized URLs.
4. Compliance/rights approval.
   - Require approval scopes for monetization, source terms, image rights, copy claims, and public publish.
   - Require disclosure text and SEO/schema fields.
5. Publish feed build.
   - WebDev generates landing/redirect pages only from `public_approved_offer_route_feed`.
   - Rows failing any gate stay internal and do not render publicly.
6. Attribution + health.
   - `/go/<slug>` inserts `offer_click_events` without raw PII.
   - Signup flows insert `offer_signup_attribution_events` without provider push/live send unless separately approved in a future gate.
   - Daily rollup refreshes `offer_performance_daily`, `offer_candidates.click_count/signup_count`, and `affiliate_tracking.click_count/signup_count`.
   - Broken/blocked redirect health removes the row from public eligibility.

## Existing Amazon link migration/audit approach

Scope: existing Amazon manual cards from `src/spg/trend-components.js` and seed rows in `data/spg-crm-offer-model-seed.json` / migration `003`.

Migration plan:

1. Inventory existing Amazon cards.
   - Count rows where `account_ref = amazon-associates-manual` or `destination_domain = amazon.com`.
   - Match to `offer_candidates.candidate_key` and `affiliate_tracking.tracking_key`.
2. Generate canonical slug.
   - Backfill from `candidate_key` using lowercase slug normalization.
   - Store `/offers/<slug>` and `/go/<slug>`; no public card should retain direct Amazon URL.
3. Classify destination.
   - Existing Amazon search URLs with the approved tag label are treated as `destination_url_mode = sanitized` for internal audit only.
   - If future network links include private/deep-link credentials, store only `destination_url_secret_ref` and resolve at runtime.
4. Verify policy-safe content.
   - Confirm no Amazon price, rating, review, availability, image, or copied merchant creative is stored.
   - Confirm disclosure text: `As an Amazon Associate, StuffPrettyGood may earn from qualifying purchases.`
5. Route/health audit.
   - Confirm every Amazon row has exactly one canonical landing and redirect route.
   - Set `redirect_health = manual_review` until DevOps/WebDev performs live redirect checks.
6. Public generation gate.
   - Only rows visible in `public_approved_offer_route_feed` may generate pages.
   - Any broken, blocked, missing disclosure, missing rights, or stale/unverified row is withheld.

Acceptance query for Amazon audit:

```sql
select count(*) as amazon_rows_missing_routes
from affiliate_tracking
where account_ref = 'amazon-associates-manual'
  and (canonical_slug is null or public_landing_path is null or public_redirect_path is null);
-- expect 0
```

## Acceptance queries

```sql
-- Public routes must expose only /offers/<slug> and /go/<slug>.
select count(*) as bad_public_routes
from public_approved_offer_route_feed
where public_landing_url <> '/offers/' || canonical_slug
   or redirect_url <> '/go/' || canonical_slug;
-- expect 0
```

```sql
-- Active tracking must use safe destination mode.
select count(*) as unsafe_destination_rows
from affiliate_tracking
where tracking_status = 'active'
  and not (
    (destination_url_mode = 'secret_ref' and destination_url_secret_ref is not null and destination_url_sanitized is null)
    or (destination_url_mode = 'sanitized' and destination_url_sanitized is not null)
  );
-- expect 0
```

```sql
-- Click events must never store raw PII/IP/UA.
select count(*) as unsafe_click_events
from offer_click_events
where raw_pii_present or raw_ip_stored or raw_user_agent_stored;
-- expect 0
```

```sql
-- Signup attribution remains no-send/no-PII by default.
select count(*) as unsafe_signup_attribution_events
from offer_signup_attribution_events
where raw_pii_present or provider_push_enabled or live_send_enabled;
-- expect 0
```

```sql
-- Approved public rows must carry disclosure, SEO/schema, source attribution, counts, verification, and healthy redirect state.
select count(*) as incomplete_public_offer_rows
from public_approved_offer_route_feed
where disclosure_text is null
   or seo_title is null
   or seo_description is null
   or schema_org_type is null
   or source_attribution = '{}'::jsonb
   or click_count < 0
   or signup_count < 0
   or last_verified_at is null
   or redirect_health in ('broken','blocked');
-- expect 0
```

## Privacy / PII / secret handling

- No raw PII is required for offer routing or attribution.
- Click/session attribution uses hashes/coarse metadata only.
- Destination secrets are represented as refs, not values.
- Public clients never receive raw credential refs unless an internal/admin route is explicitly authorized; public route builders should treat `destination_url_secret_ref` as server-only.
- Source attribution is metadata/rights evidence, not scraped merchant content.

## Confidence / missing data / failure modes

Confidence: 0.86 for data-model completeness. The contract covers every requested field and adds route/event/rollup gates, but production execution still needs LeadFS migration review and WebDev/DevOps runtime wiring.

Missing data:
- Final production DB runner and whether migrations are applied directly or through compatibility views.
- Final live redirect health-check implementation and cadence owner.
- Whether future private affiliate deep links should always be stored in Cloudflare secrets or another vault.

Failure modes:
- Sanitized destination URLs can still become stale if merchant/network terms change.
- Slug collisions must be resolved by deterministic suffixing before insert.
- Count rollups can lag if daily jobs fail; dashboards must show last rollup timestamp.
- A structurally approved offer can become non-compliant if image/source/account terms change after verification.

Refresh cadence:
- Daily candidate ingest and route/feed build.
- Daily click/signup aggregate rollup.
- Daily redirect health check for active offers until stable, then weekly plus immediate recheck on complaint/terms change.
- Weekly account/source/image-rights review for public inventory.

## Handoff contract

LeadFS:
- Review `db/004_spg_offer_routing_attribution_schema.sql` against production migration runner.
- Decide whether to physically alter current tables or expose compatibility views over existing `spg_*` tables.

WebDev:
- Public cards use `public_landing_url` only.
- Landing pages use `redirect_url` only.
- `/go/<slug>` logs a no-PII click event, resolves destination server-side, and redirects.

DevOps:
- Implement non-logging secret/destination resolver and redirect health checks.
- Never log destination secret values or raw click identifiers.

ComplyOps:
- Validate disclosure text, source attribution language, Amazon policy handling, and claim restrictions before production publish.
