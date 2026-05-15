# StuffPrettyGood Daily Trend Proof Packet Metrics Contract

Owner: DataEng
Brand: StuffPrettyGood
Source loop: Google Trends -> trend lane -> reusable SEO page -> signup hook -> /go offer bridge
Privacy posture: aggregate-only proof. No raw PII, secrets, raw IPs, raw user agents, Amazon scrape data, copied merchant prices/images/reviews/ratings/availability, or outbound email/SMS activation.

## 1. Business question

This packet proves whether StuffPrettyGood is building enough fresh audience and intent signals to support:

- Scout affiliate/network applications
- sponsor/merchant conversations
- trend lane prioritization
- CRM revenue simulation
- compliance evidence for no-send audience building

It does not prove conversions unless a merchant/network later supplies conversion data. It does not authorize legacy email/SMS activation.

## 2. Grain

Daily packet grain:

- one row per brand + date + optional trend lane + optional offer source
- all identifiers are aggregate buckets
- no visitor-level or contact-level exports

Recommended materialized packet key:

`brand + packet_date + trend_snapshot_id + lane_slug + offer_source`

## 3. Required event contract

| Event | Purpose | Required aggregate dimensions | Raw PII allowed? |
|---|---|---|---|
| `trend_page_view` | Trend hub/page demand | route, surface, device_class, source_medium, trend_updated_at | No |
| `trend_lane_view` | Lane-level interest | lane_slug, topic_category, route, device_class, source_medium | No |
| `signup_started` | Signup intent before submit | signup_surface, lane_slug, topic_category, consent_copy_version | No |
| `topic_preference_saved` | Preference intent | topic_category, lane_slug, preference_source, consent_state bucket | No |
| `disclosure_seen` | Affiliate disclosure exposure | route, lane_slug, offer_source, disclosure_version | No |
| `go_click` | Outbound offer click | go_slug, lane_slug, offer_source, disclosure_seen, approval_status | No |

Note: Signup completion can be tracked in a separate consent/preference profile system with hashes/refs. This proof packet only receives aggregate counts.

## 4. Required dimensions

- `brand`: fixed `StuffPrettyGood`
- `packet_date`
- `period_start`, `period_end`
- `trend_updated_at`
- `trend_snapshot_id`
- `lane_slug`
- `lane_title`
- `topic_category`
- `route`
- `surface`: `trend_hub`, `trend_lane`, `signup_hook`, `go_bridge`
- `offer_source`: `amazon_manual`, `direct_merchant`, `saas_referral`, `sponsor_slot`, `mehyarsoft_in_house`, `public_feed_allowed`, `template_or_lead_magnet`, `unknown`
- `device_class`: `desktop`, `tablet`, `mobile`, `unknown`
- `source_medium`: normalized UTM/source bucket only; strip raw querystrings and raw referrers
- `disclosure_version`
- `offer_approval_status`: `approved`, `review`, `pending`, `paused`, `rejected`

## 5. Required metrics

| Metric | Definition | Network-readiness use |
|---|---|---|
| `page_views` | Count of `trend_page_view` | Traffic proof |
| `lane_views` | Count of `trend_lane_view` | Category intent proof |
| `signup_starts` | Count of `signup_started` | Audience-building proof |
| `topic_preferences` | Count of `topic_preference_saved` | Interest taxonomy proof |
| `go_clicks` | Count of `go_click` | Offer click-out proof |
| `disclosure_seen` | Count of `disclosure_seen` | Affiliate compliance proof |
| `disclosure_seen_rate` | disclosure_seen / (page_views + lane_views + go_clicks) | Must be high before applications |
| `signup_start_rate` | signup_starts / (page_views + lane_views) | Signup hook quality |
| `go_click_rate` | go_clicks / (page_views + lane_views) | Offer relevance |
| `trend_source_age_hours` | period_end - trend_updated_at | Source freshness |
| `unique_topic_categories` | Distinct topic categories with preference saves | Breadth of audience proof |
| `approved_offer_sources` | Distinct approved offer sources with clicks | Merchant/network readiness |

## 6. Network application readiness score

Default score is 0-100 and intentionally conservative.

| Input | Target | Weight |
|---|---:|---:|
| content pages live | 20 | 15 |
| trend lanes live | 10 | 10 |
| 7-day page views | 1,000 | 20 |
| 7-day /go clicks | 100 | 15 |
| 7-day signup starts | 50 | 15 |
| preference categories observed | 5 | 10 |
| disclosure_seen_rate | 95% | 10 |
| compliance pages live | true | 5 |

Status logic:

- `NO-GO`: any hard blocker exists
- `WATCH`: no blocker but score < 75
- `READY_FOR_APPLICATION`: no blocker and score >= 75

Hard blockers:

- missing privacy/terms/disclosure/unsubscribe pages
- Amazon PA-API assumption or Amazon scraping in source path
- copied Amazon prices/images/reviews/ratings/availability
- live email/SMS activation from the trend loop
- disclosure_seen_rate below 95%
- raw PII/secrets in event logs or proof packet

## 7. Confidence and missing data

Confidence is 0-1 and must be shown beside every readiness score.

Confidence reducers:

- missing traffic source buckets
- missing /go click tracking
- missing signup-start tracking
- missing topic-preference tracking
- stale `trend_updated_at`
- incomplete disclosure_seen instrumentation
- bot filtering not implemented
- offer approval statuses not joined

False-positive risks:

- bot or duplicate sessions inflating page/lane views
- signup starts that never become verified opt-ins
- /go clicks that do not become conversions
- Google Trends demand not matching offer quality or availability
- Amazon manual links being changed without disclosure review

## 8. SQL rollup contract

Tables should be additive and aggregate-safe:

- `spg_trend_snapshots`
- `spg_trend_lanes`
- `spg_trend_proof_events`
- `spg_daily_trend_proof_packets`
- `spg_network_readiness_snapshots`

See `db/compliance_schema.sql` section `StuffPrettyGood daily trend proof packet schema`.

## 9. Privacy / compliance handling

Allowed:

- aggregate counts
- normalized route/surface/lane/topic buckets
- hashed/session-scoped upstream IDs only if needed before aggregation
- approved Amazon tag label `mehyarmedia-20` in disclosure-visible manual links

Blocked:

- raw emails, phones, names, IPs, full user agents, raw referrer querystrings
- raw secrets/API keys/env values
- Amazon scraping or copied product prices/images/reviews/ratings/availability
- outbound email/SMS activation from this loop
- public claims that imply conversions, list size, merchant approval, or guaranteed results before verified

## 10. Refresh cadence

- Daily: fetch/rebuild Google Trends snapshot, lanes, pages, /go bridges, event rollups, proof packet
- Weekly: network readiness review and Scout application backlog update
- Monthly: recalibrate score targets against actual traffic/signup/click baselines

## 11. Handoff consumers

- Scout: network/merchant/sponsor application proof
- WebDev: instrument missing surfaces and disclosure visibility
- LeadFS: API/event ingestion and CRM dashboard integration
- ComplyOps: verify hard blockers, disclosure, and no-send posture
- Arman/Hot Zero: commercial go/watch/no-go decisions
