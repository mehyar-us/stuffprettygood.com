# ComplyOps Gate: SPG disclosure/direct-link policy for landing + redirect flow

Task: `t_0f7a7dfe`
Date: 2026-05-15
Reviewer: ComplyOps
Workspace: `/home/mehya/work/mehyarmedia`
Parent directive: all StuffPrettyGood offer clicks must route card -> `/offers/<slug>` landing -> `/go/<slug>` tracked redirect; no direct external merchant/network links from public cards.

## Decision

CONDITIONAL GO for StuffPrettyGood monetized offer routing only under this class gate:

- Public cards, tiles, article modules, widgets, email-preview mocks, and internal-generated offer surfaces must link only to local SPG landing pages: `/offers/<slug>` or another approved first-party disclosure surface.
- The landing page must clearly disclose affiliate/sponsored/referral/owned-offer relationship before the outbound CTA is actionable.
- The outbound action must go through an approved first-party `/go/<slug>` bridge or server redirect that preserves auditability, sanitation, disclosure evidence, and suppression/privacy boundaries.
- No direct merchant, network, affiliate, Amazon, Skimlinks, Stay22, sponsor, SaaS referral, or owned-offer payment links may appear in public offer cards.

This gate does NOT authorize mass email/SMS activation, new affiliate-network submissions with unverified claims, raw PII export, third-party conversion uploads, customer charges, silent redirect cloaking, Amazon PA-API use, merchant content scraping, or public claims of partnership/performance/results beyond verified facts.

## Scope

Approved routing pattern:

1. Discovery/card surface: `/`, `/trends/*`, `/deals`, quiz results, category pages, article cards, future newsletters-as-web-pages.
2. Required local handoff: card CTA -> `/offers/<slug>`.
3. Required disclosure surface: `/offers/<slug>` states financial relationship and any owned/sponsored/referral status before outbound CTA.
4. Required outbound layer: `/offers/<slug>` CTA -> `/go/<slug>`.
5. `/go/<slug>` either shows a final bridge page or performs a server-side redirect only after approved disclosure evidence exists and the destination is sanitized.

## Hard blocks / no-go conditions

- No direct external merchant/network/affiliate URLs in public cards, tiles, modules, or generated public HTML/JS data payloads.
- No hidden auto-redirect from card -> merchant. User must land on SPG-owned disclosure page before merchant click-out.
- No Amazon PA-API use, Amazon scraping, or copied Amazon price, rating, review count, availability, product image, product description, or offer terms unless a separate Amazon compliance review approves the exact implementation.
- No Skimlinks, Stay22, affiliate network, merchant API, or sponsor keys/tokens in frontend, Git, Kanban, docs, screenshots, logs, browser bundles, source maps, public URLs, or prompts.
- No raw email, phone, name, address, payment data, IP+identifier combinations, secrets, API keys, session tokens, or affiliate-account credentials in logs, analytics payloads, public URLs, docs, Kanban, Git, screenshots, or third-party tools.
- No claim of official partnership, sponsor endorsement, discount, payout, ranking, savings, health/safety result, income result, availability, limited-time urgency, or merchant approval unless verified and separately recorded.
- No outbound email/SMS/provider push/list export from this gate.

## Class-level gate matrix

| Lane | Decision | Allowed action | Caps / rate limits | Required controls | Audit log / evidence | Success metric | Stop condition | Escalation threshold |
|---|---|---|---|---|---|---|---|---|
| Public offer cards | GO under gate | Link only to first-party `/offers/<slug>` pages; use original copy and owned/generated images. | No direct external URLs; only approved offer records with `slug`, `status`, `source_attribution`, `risk_tier`. | Card CTA text must not imply partnership/discount unless verified; no merchant/network/affiliate hrefs. | Static scan of generated public HTML/JS; sample route screenshots; offer catalog record. | 100% of public cards route internally. | Any card contains `amazon.com`, `skimlinks`, `stay22`, merchant domain, affiliate network URL, or raw destination. | New card surface, public widget/embed, partner placement, or paid amplification. |
| `/offers/<slug>` landing | REQUIRED / GO | Explain the offer in original SPG language and disclose affiliate/sponsored/referral/owned relationship before outbound CTA. | One landing page per monetized slug; no bypass parameter allowing direct outbound. | Disclosure block above or adjacent to CTA; visible compliance links; claim-safe copy; source attribution. | HTML snapshot or test assertion for disclosure before CTA; route status; last reviewed date. | User can understand financial relationship before click-out. | Disclosure hidden, below only after CTA, absent, unreadable, or contradicted by CTA copy. | New sponsor format, advertorial, lead transfer, regulated claim, or paid placement. |
| `/go/<slug>` redirect/bridge | CONDITIONAL GO | Track aggregate click intent and route to sanitized destination. | User-initiated clicks only; no background/auto-prefetch click firing; aggregate-first event logging. | Destination allowlist; strip raw user identifiers; `rel="sponsored nofollow noopener"` for visible links; no secret exposure; no cloaking. | `go_slug`, timestamp, referrer surface, disclosure evidence marker, destination provider class; no raw PII. | Outbound route works without leaking PII/secrets and preserves disclosure evidence. | Raw PII in URL/log/event; unallowlisted destination; silent cloaking; missing disclosure evidence. | Third-party conversion upload, new analytics/pixel, cross-site identity sync, or provider terms ambiguity. |
| Amazon manual links | CONDITIONAL GO | Manual SiteStripe/search/deep links only after local disclosure; approved StoreID/tag only. | No PA-API; no scraping; manual/reviewed activation per new Amazon slug. | Amazon Associate disclosure; tag/account verification; no copied Amazon content; check-current-details wording. | Slug, query/link shape, tag, reviewer/date, disclosure check. | Amazon outbound links are tagged, disclosed, original, and claim-safe. | PA-API mention/use; wrong/missing tag; copied price/rating/review/image/availability; unreviewed automated link generation. | PA-API use, new Amazon account/tag, price/rating/product-data display, or policy uncertainty. |
| Skimlinks | WATCH / server-side only | Use only from backend/server-side redirect builder or approved link-generation job; expose only sanitized `/go/<slug>`. | No frontend token/key; no public raw network URL in cards; cap initial launch to reviewed slugs. | Token in env/secret manager only; destination allowlist; terms check; no PII passed to Skimlinks unless separately approved. | Env var name only, provider class, slug, sanitized outbound URL, review date; no raw token. | Monetized routing works while public surface remains first-party and disclosure-visible. | Skimlinks token/key in frontend/Git/logs/docs; raw network URL in cards; PII appended to destination. | New Skimlinks API integration, conversion reporting with identifiers, or terms uncertainty. |
| Stay22 | WATCH / server-side only | Use only for approved travel/hotel offer slugs via server-side sanitized routing after disclosure. | No frontend keys/tokens; no broad travel widgets until separate UX/privacy review. | Token in env/secret manager only; city/date/user identifiers not logged raw; visible sponsored/affiliate disclosure. | Slug, destination class, sanitized params, review date, provider terms note. | Travel outbound routes do not leak raw identifiers and remain disclosed. | Key/token exposure; raw personal itinerary data in URL/log/event; undisclosed sponsored route. | Widget embed, map/tracking scripts, conversion import, travel profile personalization, or data sharing. |
| Owned Mehyar/MehyarSoft offers | GO with clarity | Route to first-party offer/payment-interest page only after disclosure that offer is owned/operated by Boss Holdings/Mehyar entity. | No customer charge or Stripe live payment from this gate. | Do not imply third-party independence; no fake testimonials/case studies/results; terms/privacy visible. | Owned-offer flag, claim proof status, CTA destination, review date. | User can tell SPG may benefit directly from the offer. | Hidden ownership, fake proof, charge/payment flow, unsupported performance claim. | Live payment, contract, customer promise/SLA, refund terms, regulated service claim. |
| Source attribution | REQUIRED | Every offer record names source class and evidence without copying restricted content. | Source records required before publish; refresh before material claim changes. | Use original summaries; store source URL/title/date/terms notes; no paywalled/private data or prohibited scraping. | Offer source registry: URL, source class, rights/terms note, last reviewed, risk tier. | Each public offer can be traced to a lawful source and claim basis. | Missing source, copied merchant text/assets, source terms conflict, unsupported offer claim. | New source type, paywalled/private source, source terms ambiguity, regulated vertical. |
| Privacy / unsubscribe / terms visibility | REQUIRED | All offer/disclosure surfaces include visible Privacy, Terms, Affiliate Disclosure, Preferences, and Unsubscribe links. | 100% coverage on public offer, `/go`, deal, trend, quiz-result, preference, and footer surfaces. | Links must be accessible in nav/footer or near offer context; unsubscribe/preferences must not imply a send is authorized. | Static route scan; representative screenshots. | Compliance links visible on every monetized route. | Missing or broken privacy/terms/disclosure/preferences/unsubscribe link on monetized route. | Any outbound send, provider sync, legacy list use, or updated privacy/data-sharing practice. |
| Audit/logging | GO with minimization | Track aggregate routing metrics and compliance evidence. | No raw PII; no secrets; no full destination URL if it includes user identifiers. | Event allowlist; redaction; retention/access owner; aggregate-first dashboard. | Event schema and sample redacted events. | Metrics prove routing/disclosure without exposing users or credentials. | Raw PII/secret/destination identifier in logs, console, analytics, docs, Kanban, Git. | New analytics provider, ad pixel, conversion API, identity graph, or raw data export. |

## Required implementation controls

### 1. Route contract

Required fields for each monetized offer record:

- `slug`
- `title`
- `provider_class`: `amazon_manual`, `skimlinks`, `stay22`, `direct_merchant`, `owned_offer`, `sponsor_placeholder`, or `unmonetized_editorial`
- `source_url` or source note
- `source_attribution`
- `financial_relationship`: `affiliate`, `sponsored`, `referral`, `owned`, `none`, or `pending`
- `approval_status`: `draft`, `reviewed`, `approved`, `paused`, or `blocked`
- `risk_tier`
- `claim_restrictions`
- `offers_path`: `/offers/<slug>`
- `go_path`: `/go/<slug>`
- `last_reviewed_at`
- `reviewer`

Public card components may read only `offers_path`, never raw destination URL.

### 2. Disclosure minimum language

Every `/offers/<slug>` and `/go/<slug>` page with monetized routing must include clear language equivalent to:

> StuffPrettyGood may earn a commission, referral credit, sponsorship fee, or direct revenue if you use this link. We use original recommendations and practical starting points, not guarantees, rankings, or professional advice. Check the merchant site for current price, availability, terms, and details.

Amazon-specific pages must additionally include equivalent language:

> As an Amazon Associate, we may earn from qualifying purchases.

Owned-offer pages must additionally include equivalent language:

> This is an offer from a Boss Holdings / Mehyar-operated property, so we may benefit directly if you choose it.

### 3. Destination sanitation

The outbound layer must:

- Resolve destinations server-side or from a build-time allowlisted registry, not from user-supplied query parameters.
- Reject unknown slugs and unapproved provider classes.
- Strip or avoid raw user identifiers in outbound query strings unless a separate privacy/conversion gate approves a specific hashed/consented identifier flow.
- Never log raw keys/tokens or raw PII.
- Never expose affiliate/network credentials to the browser.
- Avoid deceptive cloaking: destination class and financial relationship must match the disclosure.

### 4. Source attribution rules

Allowed:

- Original SPG summaries based on public source signals.
- Source URL/title/date captured internally.
- Public merchant/program descriptions paraphrased without copying protected copy.
- `Prices/availability/terms can change; check the merchant site` disclaimers.

Blocked unless separately approved:

- Copying merchant product descriptions, product photos, price tables, star ratings, review counts, scarcity claims, coupon terms, or availability states.
- Claiming official partnership, sponsor status, exclusive deal, verified savings, or merchant endorsement without evidence.
- Using paywalled/private/provider data outside the provider's terms.

## Testable acceptance criteria

A build/release passes this gate only if all checks below pass:

1. Static direct-link scan: no public card/list/module source contains direct merchant/network/affiliate hrefs. Fail on public card hrefs matching `amazon.`, `amzn.to`, `skimlinks`, `stay22`, common affiliate-network domains, or non-SPG merchant domains except compliance/source citation links.
2. Route contract scan: every approved monetized offer has exactly one `/offers/<slug>` and one `/go/<slug>` route or an explicit `blocked/paused` status.
3. Disclosure-before-CTA check: every `/offers/<slug>` page contains affiliate/sponsored/referral/owned disclosure text before or adjacent to the outbound CTA in DOM order.
4. Compliance link check: every `/offers/<slug>` and `/go/<slug>` route has visible links to Affiliate Disclosure, Privacy, Terms, Preferences, and Unsubscribe.
5. Amazon guard check: repository/public output has 0 PA-API use/mentions for active implementation, 0 copied Amazon image URLs, 0 copied Amazon prices/ratings/reviews/availability, and Amazon outbound links use the approved tag/account only.
6. Provider credential check: no Skimlinks/Stay22/Amazon/network tokens or secret-like values appear in frontend bundles, public HTML, Git diff, Kanban comments, docs, screenshots, or logs. Use environment variable names only.
7. Destination allowlist check: `/go/<slug>` rejects unknown slugs and never accepts arbitrary outbound destination from query params.
8. Event/log check: click/disclosure events include only allowed aggregate fields such as `go_slug`, `offer_slug`, `provider_class`, `surface`, `timestamp`, `disclosure_seen`; no raw email/phone/name/address/payment/session secret/destination URL with identifiers.
9. Source attribution check: each approved slug has source URL/note, source class, last reviewed date, and claim restrictions.
10. Claim safety check: no approved public route uses blocked claim words in monetized context without proof record: `best`, `#1`, `guaranteed`, `proven`, `lowest price`, `official partner`, `doctor recommended`, `safe for everyone`, `limited time`, `will save`, `will make money`, `verified discount`.
11. UX path check: card -> `/offers/<slug>` -> `/go/<slug>` -> merchant works on desktop and mobile for at least one representative slug per provider class.
12. No-send check: no email/SMS/provider-push/export code path is invoked by offer routing, preference capture, or `/go` click tracking under this gate.

## Required blockers for implementers

Block the implementation/release if any of these are true:

- A public card needs a direct merchant/network/affiliate link to function.
- Disclosure cannot be placed before or next to the outbound CTA.
- The destination requires embedding a network token/key in frontend code.
- The implementation requires arbitrary user-supplied redirect URLs.
- A provider requires passing raw email/phone/name/address/session identifiers without a separate privacy/conversion gate.
- Amazon PA-API, scraping, or merchant-copied content is needed.
- Offer source, approval status, or financial relationship is unknown.
- Privacy, Terms, Preferences, Affiliate Disclosure, or Unsubscribe routes are missing/broken.
- A live email/SMS/export/provider sync is needed to test the flow.
- A public claim depends on unverified partnership, discount, savings, performance, health/safety, or income proof.

## Audit evidence required before public deploy

- Static scan output for direct external card links.
- Route inventory for `/offers/*` and `/go/*` monetized slugs.
- Disclosure-before-CTA evidence for representative pages or automated DOM assertions.
- Secret scan focused on provider/network credential patterns.
- Event schema sample showing no raw PII/secrets.
- Source registry sample for approved slugs.
- Mobile + desktop screenshot/QA sample for one representative route per provider class.
- Test command and pass/fail result.

## Success metric

100% of monetized public offer cards route first to local disclosure-visible `/offers/<slug>` pages, 100% of outbound CTAs route through approved sanitized `/go/<slug>` paths, 0 direct public card merchant/network/affiliate links, 0 missing disclosures, 0 raw secret/PII leaks, 0 unsupported claims, and 0 provider-policy violations.

## Stop condition

Immediate NO-GO / revert / pause if any direct external affiliate link appears in public cards, any disclosure is missing before outbound action, any provider credential or raw PII appears in public/frontend/Git/Kanban/docs/logs/screenshots, any Amazon PA-API/scrape/copied content is introduced, any redirect accepts arbitrary destinations, or any unsupported partnership/discount/result claim goes public.

## Escalation threshold

Escalate to Boss/Hot Zero/ComplyOps before:

- Mass audience activation, email/SMS send, list export, provider sync, or reactivation campaign.
- New affiliate network account submission or sponsor pitch using SPG proof/traffic claims.
- Skimlinks/Stay22 conversion reporting with identifiers, pixel/script embeds, or new data sharing.
- Amazon PA-API use, product data display, new Amazon tag/account, or any Amazon policy uncertainty.
- Live payment/customer charge, Stripe checkout, contract, lead sale/transfer, or owned-offer customer promise.
- Legal-sensitive/regulated vertical claims, health/financial/income claims, or public proof/testimonial/case-study use.

## Authority status

- Public card -> local landing route: GO under this gate.
- Landing disclosure -> `/go` outbound route: CONDITIONAL GO after acceptance checks pass.
- Direct public card -> merchant/network/affiliate route: HARD NO-GO.
- Amazon PA-API/scraping/copied content: HARD NO-GO without separate review.
- Skimlinks/Stay22: WATCH / server-side sanitized only.
- Email/SMS/mass reactivation/provider push: HARD NO-GO from this gate.
