# SPG offer landing + redirect PRD

Task: t_258cde21
Owner: ProductOps
Status: PRD / acceptance backlog for downstream WebDev, LeadFS, DataEng, DevOps, ComplyOps, and Arman review.
Source directive: `/home/mehya/.hermes/projects/mehyar-media/PROJECT-001-CRM-COMMAND-CENTER.md` section `2026-05-15 OWNER DIRECTIVE — ALL OFFER LINKS MUST USE SPG LANDING + REDIRECT`.

## 1. Reality

Boss corrected the StuffPrettyGood click architecture: public offer surfaces may not send users directly from a card to Amazon, Skimlinks, Stay22, affiliate networks, merchants, sponsors, referral URLs, or owned checkout pages. Every offer click must run through a StuffPrettyGood-owned landing page and then a Mehyar Media/SPG-owned tracked redirect.

Required public flow:

`public card / rail / article embed -> /offers/<slug> -> /go/<slug> -> sanitized approved destination`

Mehyar Media remains the CRM/control room. StuffPrettyGood is the public consumer affiliate/offers/media brand.

## 2. Commercial purpose

Buyer / audience:
- Public SPG visitor looking for useful products, tools, deals, or practical picks.
- Internal operators who need safe monetized publishing, attribution, and compliance controls.

Pain:
- Direct affiliate links from public cards reduce auditability, weaken disclosure, expose destinations too early, and make it harder to prove monetized-only publishing.
- Static Amazon-first pages currently expose Amazon destination URLs inside `/go/amazon-*.html` bridge pages and do not yet provide reusable `/offers/<slug>` landing pages.

Promise:
- Every monetized SPG offer gets a controlled explanation page with disclosure, signup/preference capture, related offers, SEO/schema, and then a tracked outbound route.

Deliverable:
- A reusable offer landing + redirect architecture covering homepage, daily, trend, article, generated pages, sitemap, QA audits, and CRM attribution.

Proof required:
- Automated audit shows zero prohibited direct external offer hrefs on public card/rail/embed surfaces.
- Existing Amazon-first offers map to `/offers/<slug>` pages with outbound CTA to `/go/<slug>`.
- Publish filter blocks any offer missing approved landing and approved redirect.

## 3. Scope

In scope:
- Reusable `/offers/<slug>` landing component.
- `/go/<slug>` tracked redirect route or server-side bridge.
- Homepage, daily, trends, article embeds, generated guide pages, sitemap, and RSS-rendered offer behavior.
- Monetized-only publish filter.
- Signup, preferences, unsubscribe, privacy, terms, and disclosure placement.
- SEO metadata and schema.org JSON-LD.
- CRM/data fields required for landing, redirect, compliance, and attribution.
- Direct-link audit and QA acceptance criteria.
- Mapping current Amazon-first offers into the new flow.

Non-goals:
- No live email/SMS activation.
- No provider push.
- No new paid account creation, tax/KYC, bank/payout setup, or irreversible legal commitment.
- No Amazon PA-API use unless separately approved.
- No scraped/copied Amazon images, prices, ratings, reviews, availability, coupons, badges, or listing copy.
- No fabricated reviews, rankings, testimonials, savings claims, outcome guarantees, or client proof.
- No public exposure of raw affiliate API keys, raw redirect tokens, raw PII, or credential values.

## 4. User and operator flow

### Public visitor flow

1. Visitor sees an SPG card on home, daily, trends, article, or generated guide page.
2. Card CTA points only to `/offers/<slug>`.
3. `/offers/<slug>` loads the shared offer landing component.
4. Landing page shows:
   - rights-safe image or generated/owned placeholder-safe art;
   - offer title and category;
   - plain-English why-click copy;
   - monetization disclosure before outbound CTA;
   - risk/claim-safe notes where needed;
   - signup/preference capture module;
   - related offers;
   - privacy, terms, affiliate disclosure, preferences, and unsubscribe links;
   - SEO metadata and schema.org JSON-LD.
5. Visitor clicks outbound CTA.
6. CTA points to `/go/<slug>` only.
7. `/go/<slug>` records safe click attribution and redirects to the sanitized approved destination.
8. If redirect is unhealthy or not approved, route fails closed to a safe SPG page explaining the offer is temporarily unavailable, with preferences/signup alternatives.

### Operator flow in Mehyar Media CRM

1. Ingestion creates/updates offer candidate in durable DB first.
2. Operator/source pipeline enriches required landing and redirect fields.
3. ComplyOps/DataEng gate verifies monetization, approval, image rights, disclosure, risk tier, and tracking health.
4. Publish decision allows public generation only if both landing and redirect are approved.
5. WebDev/static build consumes public approved feed, not raw candidate/account/tracking tables.
6. DevOps deploy gate runs direct-link audit, route existence audit, tests, and smoke checks.
7. CRM dashboard shows landing health, redirect health, click counts, signup counts, disclosure_seen counts, source/account status, and blockers.

## 5. Route contract

### `/offers/<slug>` public landing

Required behavior:
- Public, crawlable where approved.
- One shared component powers all offer types: Amazon manual search, affiliate network, direct merchant, sponsor, owned service, referral, approved lead magnet.
- No raw destination URL in visible card data or page source unless the destination is an allowed non-offer attribution URL. The outbound user CTA is `/go/<slug>`.
- Page must render even if JavaScript fails.
- If offer status becomes unapproved/unhealthy, page must display a safe unavailable state and no active outbound `/go` CTA.

Required UI blocks:
- Hero with title, category, offer image, source/account disclosure badge, and CTA to `/go/<slug>`.
- `Why this is worth checking` copy using claim-safe editorial language.
- `Before you click` disclosure block above outbound CTA.
- Signup/preference module: email optional only in no-send mode, topic/frequency/channel controls, explicit consent checkbox.
- Related offers from same category/lane, each pointing to `/offers/<related-slug>`.
- Footer compliance links: affiliate disclosure, privacy, terms, preferences, unsubscribe.

Required SEO/schema:
- `<title>` and meta description from offer SEO fields.
- Canonical URL `/offers/<slug>`.
- Open Graph/Twitter metadata with rights-safe image.
- JSON-LD using safe schema types:
  - `WebPage` for all offers;
  - `ItemList` for related offers;
  - `Offer` only when claim-safe fields are present and no prohibited Amazon/merchant dynamic content is copied.
- Sitemap includes only approved crawlable offer landing pages.

### `/go/<slug>` tracked redirect

Required behavior:
- Owned by SPG/Mehyar Media.
- Records click/referrer/UTM/offer_id/network/account/source/risk status where available.
- Stores no raw PII; use hashed/aggregate/session-safe attribution only.
- Redirects only if offer, publish decision, landing, redirect, disclosure, and destination health are approved.
- Raw API keys, account secrets, and destination tokens stay server-side only.
- If static bridge pages are used temporarily, they must be treated as redirect pages, not cards; public cards still point to `/offers/<slug>`.

Redirect fail-closed states:
- `unapproved_offer`: show safe SPG unavailable page.
- `missing_destination`: show safe SPG unavailable page.
- `blocked_risk`: show safe SPG unavailable page and log blocker.
- `redirect_health_failed`: show safe SPG unavailable page and notify operator.
- `network_secret_missing`: block in CRM; do not expose secret details.

## 6. Direct-link definitions

### Prohibited direct external offer link

A prohibited direct external offer link is any public card, rail item, article embed, generated guide item, homepage hero card, trend/daily card, sitemap-only offer entry, or RSS-rendered offer item that links directly to any outbound monetized destination instead of `/offers/<slug>`.

Prohibited destination examples:
- `amazon.com`, `amzn.to`, or any Amazon Associates URL/tagged search/deep link.
- Skimlinks, Stay22, Sovrn/VigLink, ShareASale, Impact, FlexOffers, eBay Partner Network, Walmart, Target, Etsy, AliExpress, or other affiliate/network URLs.
- Merchant product, merchant search, merchant cart, coupon, or checkout pages when used as the offer CTA.
- Sponsor landing pages or advertiser URLs.
- Referral URLs, invite URLs, discount URLs, affiliate tracking domains, subid URLs.
- Owned MehyarSoft checkout or paid booking links when the public element is an offer card.

### Allowed internal offer links

Allowed from public offer cards/rails/embeds:
- `/offers/<slug>` for the primary CTA.
- Related internal editorial/context pages only if not presented as the offer CTA.
- `/preferences.html`, `/unsubscribe.html`, `/privacy.html`, `/terms.html`, `/affiliate-disclosure.html`.

Allowed from `/offers/<slug>`:
- `/go/<slug>` for outbound CTA.
- Internal related `/offers/<related-slug>` links.
- Signup/preferences/unsubscribe/privacy/terms/disclosure links.

Allowed from `/go/<slug>`:
- Sanitized destination URL after required click logging and health/approval checks.

### Allowed non-offer source attribution

Allowed non-offer attribution links may point externally only when they are clearly source/credit/context links, not offer CTAs.

Allowed examples:
- Source article attribution for an editorial fact, trend source, or RSS item.
- Image credit/license source when required by license.
- Official terms/policy pages used for compliance evidence.
- Public Google Trends or source page citation used as evidence.

Rules for attribution links:
- Label as `Source`, `Image credit`, `Terms`, or `Context`, not `Buy`, `Shop`, `Get deal`, `Check price`, `Claim`, or `Open offer`.
- Use `rel="nofollow sponsored noopener"` when commercially relevant and `noopener` for all external links.
- Must not carry affiliate/referral/sponsor tracking params.
- Must not be styled as the primary offer CTA.
- Must not bypass `/offers/<slug>` for monetized action.

## 7. Data/API contract

Every public-approved offer record needs:

Core identity:
- `offer_id`
- `canonical_slug`
- `title`
- `category`
- `public_landing_url` = `/offers/<slug>`
- `redirect_url` = `/go/<slug>`
- `offer_type` = `amazon_manual | affiliate_network | direct_merchant | sponsor | referral | owned_offer | approved_lead_magnet`

Destination/tracking:
- `destination_url_secret_or_sanitized`
- `destination_host`
- `network`
- `account_id/reference`
- `tracking_id_ref`
- `subid_strategy`
- `redirect_health`
- `last_verified_at`

Monetization/approval:
- `monetization_status`
- `payout_model`
- `account_status`
- `approval_status`
- `publish_decision`
- `landing_approved_at`
- `redirect_approved_at`
- `approved_by_role`

Compliance:
- `disclosure_required`
- `disclosure_text`
- `risk_tier`
- `claim_review_status`
- `image_rights_status`
- `image_source_url`
- `image_credit_text`
- `privacy_pii_handling`

Landing content:
- `landing_headline`
- `why_click_copy`
- `cta_label`
- `seo_title`
- `seo_description`
- `schema_json`
- `related_offer_slugs`
- `signup_module_variant`

Metrics:
- `click_count`
- `signup_count`
- `disclosure_seen_count`
- `landing_view_count`
- `last_click_at`
- `last_signup_at`

Publish filter must return public offers only where:
- `approval_status=approved`;
- `publish_decision in publish_monetized, publish_lead_magnet`;
- `monetization_status in affiliate, referral, amazon, manual_sponsor, owned_offer, paid_network, approved_lead_magnet`;
- `image_rights_status=approved`;
- `risk_tier != blocked`;
- `public_landing_url` starts with `/offers/`;
- `redirect_url` starts with `/go/`;
- `landing_approved_at` and `redirect_approved_at` are present;
- `disclosure_text` is present when disclosure is required;
- `redirect_health=healthy` or explicitly `manual_review_passed` for launch.

## 8. Surface behavior requirements

Homepage:
- All offer wall cards link to `/offers/<slug>`.
- No homepage offer card may link to `/go/<slug>` directly unless it is a clearly labeled internal test/admin/debug surface excluded from public release.
- Signup/preferences/unsubscribe/disclosure visible above or near offer wall and in footer.

Daily page / weekly deals:
- Daily monetized finds link to `/offers/<slug>`.
- Newsletter/signup modules remain no-send until separate activation gate.
- Unpaid/free items blocked unless `approved_lead_magnet` or manually approved strategic audience-growth content.

Trend pages:
- Trend lanes may cite allowed trend/source attribution.
- Trend offer cards for Amazon/manual/affiliate items link to `/offers/<slug>`.
- Existing `trendOfferTargets` Amazon search targets map to landing pages.

Article cards / editorial embeds:
- Inline offer cards and aside cards link to `/offers/<slug>`.
- Editorial source links are allowed only as attribution, not offer CTAs.

Generated pages:
- Static generation must create both `/offers/<slug>` and `/go/<slug>` for every approved public offer.
- Sitemap includes approved `/offers/<slug>` pages; `/go/<slug>` may be `noindex` unless SEO/ComplyOps approves indexing.

## 9. Current Amazon-first mapping

Current active Amazon-first target source:
- `src/spg/trend-components.js` exports `trendOfferTargets` with Amazon manual search offer slugs.
- Current static public artifacts include `public/go/amazon-*.html` pages.
- Audit found 63 generated Amazon `/go/amazon-*.html` pages exposing Amazon search URLs with `tag=mehyarmedia-20` at line 37, plus Amazon URL builder references in `src/spg/trend-components.js` and `src/spg/durable-store.js`.

Migration rule:
- Every current `amazon-*` slug remains stable.
- Public cards change from any direct `/go/<slug>` or external Amazon URL to `/offers/<slug>`.
- New `/offers/amazon-*.html` page is generated for each current Amazon slug.
- Each landing page outbound CTA points to `/go/amazon-*.html` or server route `/go/amazon-*`.
- `/go/amazon-*` may continue to resolve to a sanitized Amazon Associates search URL server-side/static-bridge only after disclosure/health/approval checks.

Known current Amazon manual slugs from `trendOfferTargets`:

AI note takers:
- `amazon-ai-voice-recorders`
- `amazon-digital-notebooks-smart-pens`
- `amazon-usb-microphones-calls`

Portable power stations:
- `amazon-portable-power-stations`
- `amazon-solar-generator-kits`
- `amazon-power-outage-starter-kits`
- `amazon-portable-solar-panels`
- `amazon-car-inverter-backup-gear`
- `amazon-rechargeable-lanterns`

Home wellness gadgets:
- `amazon-red-light-therapy`
- `amazon-home-recovery-gadgets`
- `amazon-massage-guns-recovery`
- `amazon-heating-pads-wraps`
- `amazon-bedroom-humidifiers`
- `amazon-posture-stretch-helpers`

Air purifiers:
- `amazon-air-purifiers`
- `amazon-air-quality-monitors`
- `amazon-hepa-filter-replacements`
- `amazon-air-purifiers-smoke`
- `amazon-desktop-air-purifiers`
- `amazon-pet-odor-air-filters`

Walking pad desk:
- `amazon-walking-pads`
- `amazon-standing-desk-gear`
- `amazon-laptop-stands-risers`
- `amazon-monitor-arms`
- `amazon-desk-cable-management`
- `amazon-ergonomic-desk-chairs`

Meal prep starter kit:
- `amazon-meal-prep-containers`
- `amazon-protein-snack-storage`
- `amazon-glass-food-storage`
- `amazon-kitchen-scales-prep`
- `amazon-lunch-bags-ice-packs`
- `amazon-protein-shaker-bottles`

Pet tech safety:
- `amazon-dog-gps-trackers`
- `amazon-pet-cameras`
- `amazon-automatic-pet-feeders`
- `amazon-pet-water-fountains`
- `amazon-travel-dog-harnesses`
- `amazon-smart-litter-boxes`

Robot vacuums / smart home:
- `amazon-robot-vacuums`
- `amazon-smart-home-helpers`
- `amazon-smart-plugs-switches`
- `amazon-video-doorbells`
- `amazon-smart-bulbs-starter-kits`
- `amazon-cordless-stick-vacuums`

Travel tech:
- `amazon-travel-tech`
- `amazon-packing-cubes-organizers`
- `amazon-portable-luggage-scales`
- `amazon-universal-travel-adapters`
- `amazon-airtag-travel-holders`

Sleep and beauty:
- `amazon-sleep-bonnets`
- `amazon-sleep-beauty-routine`
- `amazon-white-noise-machines`
- `amazon-sunrise-alarm-clocks`
- `amazon-travel-sleep-masks`
- `amazon-heatless-curl-kits`

Weekend hobby kits:
- `amazon-indoor-garden-kits`
- `amazon-weekend-hobby-kits`
- `amazon-sourdough-starter-kits`
- `amazon-pickleball-starter-sets`
- `amazon-paint-by-number-kits`
- `amazon-adult-building-kits`

Non-Amazon direct/service targets to convert or gate:
- `ai-note-takers-software` currently points to `/ai-tool-stack-quiz.html`; keep internal if not monetized, or create `/offers/ai-note-takers-software` when it becomes an approved lead magnet/affiliate offer.
- `mehyarsoft-ai-audit` currently points to `/ai-readiness-score.html`; if presented as an owned service offer card, use `/offers/mehyarsoft-ai-audit` before any `/go` or checkout/booking.
- `travel-esim-watchlist` currently points to `/trends/travel-tech-esim.html#signup`; keep as internal signup context until referral program approval, then create `/offers/travel-esim-watchlist`.

## 10. Acceptance criteria

### Product / UX

- [ ] Shared `OfferLanding` component powers all `/offers/<slug>` pages.
- [ ] Landing includes image, title, category, why-click copy, disclosure before CTA, signup/preference module, related offers, and compliance footer links.
- [ ] Homepage/daily/trend/article/generator cards link to `/offers/<slug>` only for offer CTAs.
- [ ] `/offers/<slug>` CTA links to `/go/<slug>` only.
- [ ] Dark/light mobile/tablet/desktop layouts meet SPG 2026 minimalist cartoonist visual direction.
- [ ] Unapproved/unhealthy offers fail closed without outbound CTA.

### Data / backend

- [ ] Public approved feed includes `public_landing_url` and `redirect_url` for every public offer.
- [ ] Publish filter blocks offers missing approved landing or approved redirect.
- [ ] Destination URL and affiliate/network token handling is server-side/sanitized only.
- [ ] Click event records offer_id, slug, referrer/UTM, network/account reference, risk status, and disclosure_seen status without raw PII.
- [ ] Signup/preference event records consent/preference safely and remains no-send/no-provider-push.

### Compliance

- [ ] Affiliate/sponsor/owned-offer disclosure appears before outbound CTA.
- [ ] Amazon no-PA-API restriction is preserved: no copied Amazon images/prices/reviews/ratings/availability/listing text.
- [ ] Source attribution links are labeled and separated from offer CTAs.
- [ ] No raw secrets, raw PII, credential values, or private tokens in Git, frontend, generated public files, logs, docs, screenshots, or Kanban.
- [ ] Finance/health/legal/high-risk categories use conservative copy and no professional-advice claims.

### SEO

- [ ] Every approved `/offers/<slug>` has title, description, canonical, OG/Twitter metadata, and JSON-LD.
- [ ] Sitemap includes approved `/offers/<slug>` pages.
- [ ] `/go/<slug>` is noindex by default unless separately approved.
- [ ] No duplicate canonical conflicts between trend pages and offer landing pages.

### QA / deploy

- [ ] Automated direct-link audit scans generated public HTML and source card templates.
- [ ] Audit fails on prohibited external offer hrefs from cards/rails/article embeds.
- [ ] Audit permits allowed attribution links when labeled and non-affiliate.
- [ ] Audit verifies every public offer card target has a generated/served `/offers/<slug>` page.
- [ ] Audit verifies every approved landing outbound CTA has a generated/served `/go/<slug>` route.
- [ ] Smoke test covers homepage -> `/offers/<slug>` -> `/go/<slug>` for at least one Amazon manual offer and one non-Amazon approved offer/lead magnet.
- [ ] Smoke test covers signup, preferences, unsubscribe, privacy, terms, affiliate disclosure.
- [ ] Screenshot QA captures mobile/tablet/desktop and dark/light for homepage and at least one offer landing page.

## 11. Implementation backlog

### P0 — contract and blocker

Owner: LeadFS/DataEng with ComplyOps review.

1. Add/extend public offer contract fields.
   - Acceptance: public feed returns `public_landing_url`, `redirect_url`, approval/health/disclosure fields, SEO fields, image rights fields.

2. Implement publish filter gate.
   - Acceptance: offers missing approved landing or redirect are blocked from all public surfaces.

3. Build direct-link audit.
   - Acceptance: test fails when public cards/rails/article embeds contain external merchant/network/Amazon affiliate hrefs.
   - Acceptance: allowed attribution links pass only with source/credit labeling and no affiliate params.

### P1 — reusable landing route

Owner: WebDev.

4. Build shared `/offers/<slug>` landing component.
   - Acceptance: all required UI, disclosure, signup/preference, related offers, SEO/schema, and compliance links render from one component.

5. Generate landing pages for all current Amazon manual slugs.
   - Acceptance: each `amazon-*` current `/go` slug also has `/offers/amazon-*` page.

6. Convert public card CTAs to landing routes.
   - Acceptance: homepage, daily, trends, article embeds, generated guides use `/offers/<slug>` for offer CTAs.

### P2 — redirect hardening and attribution

Owner: LeadFS/DevOps.

7. Harden `/go/<slug>` route.
   - Acceptance: records safe attribution and redirects only when approved/healthy.

8. Add fail-closed redirect states.
   - Acceptance: blocked/unapproved/unhealthy routes show safe unavailable page and no destination leak.

9. Add CRM metrics/status rollup.
   - Acceptance: CRM exposes landing health, redirect health, disclosure_seen, click_count, signup_count, source/account/risk status.

### P3 — SEO, sitemap, and launch QA

Owner: WebDev/DevOps/Arman.

10. Add offer SEO/schema and sitemap integration.
    - Acceptance: approved `/offers` pages are indexed; `/go` is noindex by default.

11. Add deploy gate.
    - Acceptance: deploy blocks on direct-link audit failure, missing landing/redirect pairs, broken smoke, or forbidden secrets/PII patterns.

12. Visual and live QA.
    - Acceptance: screenshots prove homepage and landing page quality across mobile/tablet/desktop and light/dark; live smoke verifies routes after deploy when authorized.

## 12. Risk gates and kill criteria

Risk gates:
- Block public release if direct external offer hrefs remain on public card/rail/embed surfaces.
- Block public release if any Amazon image/price/rating/review/availability/listing copy is copied, scraped, cached, hotlinked, or screenshotted without approved rights.
- Block public release if `/go` exposes raw secret/token/API key or raw PII.
- Block monetized publishing if source/account approval is missing.
- Block live send/provider push; this task does not authorize email/SMS activation.

Kill criteria:
- Kill or revert architecture if direct-link audit cannot reliably distinguish offer CTAs from allowed attribution links before deploy.
- Kill any offer if landing health or redirect health fails twice without operator resolution.
- Kill any source/account if terms prohibit SPG use or require unavailable KYC/tax/payout/human agreement.
- Kill any public page variant if disclosure is below outbound CTA or hidden on mobile.
- Kill any free/unpaid offer unless explicitly approved as strategic audience-building lead magnet.

## 13. Evidence checklist for downstream completion

Downstream implementers must provide:
- Changed files list.
- Test command and pass/fail count.
- Direct-link audit output with zero prohibited public offer hrefs.
- List/count of generated `/offers/<slug>` pages and `/go/<slug>` routes.
- Mapping evidence for all current Amazon-first slugs.
- Screenshot paths for homepage and one offer landing page across mobile/tablet/desktop and dark/light.
- Smoke evidence for homepage -> landing -> redirect and signup/preferences/unsubscribe.
- Confirmation that no raw secrets, raw PII, or prohibited Amazon merchant content were introduced.
