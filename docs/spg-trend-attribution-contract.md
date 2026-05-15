# StuffPrettyGood Trend Attribution API Contract

Source of truth: `/home/mehya/.hermes/projects/mehyar-media/PROJECT-001-CRM-COMMAND-CENTER.md`
Executable contract: `src/crm/spgTrendAttribution.js`
Tests: `test/spg-trend-attribution-contract.test.js`

## Scope

This contract connects the approved Google Trends → trend lane → reusable SEO page → signup hook → `/go` offer bridge loop to CRM attribution without enabling email/SMS activation, Amazon scraping, copied merchant content, provider push, raw exports, or raw PII logging.

## Event types

Accepted `eventType` values:

- `trend_page_viewed`
- `trend_lane_viewed`
- `trend_offer_clicked`
- `topic_preference`
- `disclosure_seen`

## Source categories

Accepted `sourceCategory` values:

- `google_trends`
- `trend_lane`
- `seo_page`
- `signup_hook`
- `go_bridge`
- `manual_source`
- `sponsor_source`
- `direct_navigation`
- `unknown`

## Offer types

Accepted `offerType` values:

- `amazon`
- `manual`
- `direct`
- `sponsor`
- `service`
- `referral`
- `none`

Amazon is restricted to manual/SiteStripe/search-link style links with visible disclosure and tag label `mehyarmedia-20`. The contract explicitly excludes Amazon PA-API scraping, merchant scraping, and copied Amazon prices/images/reviews/ratings/availability.

## API shape

### `POST /api/spg/attribution/events`

Public write endpoint, rate-limited. Intended for browser/server event capture.

Request fields:

- `eventType` — required, one of the accepted event types.
- `sourceCategory` — required/defaults to `unknown`.
- `sourceRoute` — path only; query strings are stripped.
- `trendLane` — required for `trend_lane_viewed`.
- `trendSeed` — optional Google Trends seed label.
- `offerType` — required for `trend_offer_clicked`.
- `goSlug` — required for `trend_offer_clicked`.
- `topicPreference` — required for `topic_preference` if no topic is inferred from lane.
- `disclosureSeen` — required before click attribution is accepted.
- `utm` — allowlisted keys only.
- `visitorSessionId` / `profileHash` — non-PII refs only.

Response fields:

- `status: accepted|blocked`
- `rawPiiPresent: false`
- `blockedPayloadStored: false`
- `blockerClasses[]`
- `auditEvent`

### `POST /api/spg/preferences/topic`

Public write endpoint, rate-limited, no send side effect.

Request fields:

- `topicPreferences[]`
- `sourceCategory`
- `sourceRoute`
- `trendLane`
- `frequency`
- `consentState: opted_in|preference_only|opted_out|unknown`
- `disclosureSeen`
- `identifierHash` / `profileHash` if contact identity exists

Response fields:

- `status: accepted|blocked`
- `liveSendEnabled: false`
- `providerPushEnabled: false`
- `rawPiiRendered: false`
- `rawPiiStoredInLog: false`
- `auditEvent`

Raw email/phone/name/address in this endpoint is blocked unless already hashed outside the attribution log contract.

### `GET /go/:slug`

Public tracked redirect/bridge route.

Required behavior:

1. Ensure visible affiliate/sponsor disclosure.
2. Write `disclosure_seen` or confirm prior disclosure state.
3. Write `trend_offer_clicked` with `sourceCategory=go_bridge`, `offerType`, and `goSlug`.
4. Redirect only if offer is approved and bridge validation passes.

Never log raw destination URL with PII-bearing query strings. Never store raw email/phone/name/address in click logs.

## SQL additions

`db/compliance_schema.sql` includes additive contract tables:

- `crm_spg_trend_attribution_events`
- `crm_spg_topic_preferences`
- `crm_spg_go_bridge_checks`

All are designed for backend migration wrapping; this task does not run production migrations.

## Invariants

- No raw PII in logs, docs, frontend event payloads, tests, or Kanban.
- No email/SMS activation from this trend loop.
- No Amazon scraping or copied Amazon content.
- `/go` clicks require disclosure-visible bridge validation.
- Offer source and type are explicit for attribution rollups.
