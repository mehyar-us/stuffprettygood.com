# StuffPrettyGood Amazon/manual trend offer acceptance matrix

Task: t_460e1c9d
Owner: ComplyOps
Source of truth: `/home/mehya/.hermes/projects/mehyar-media/PROJECT-001-CRM-COMMAND-CENTER.md`
Status: CONDITIONAL GO for no-outbound public trend/offer population; NO-GO for email/SMS activation, Amazon scraping, copied merchant content, unsupported claims, raw PII exposure, provider push, or live send.

## Scope

Approved loop: daily Google Trends signal -> curated trend lane -> reusable SEO page -> explicit signup/preference hook -> disclosure-visible `/go` offer bridge -> aggregate CRM attribution.

This matrix authorizes only on-site/public MVP motion and internal Scout source discovery. It does not authorize outbound email, SMS, list export, provider push, legacy audience activation, paid traffic spend, customer charges, or public performance guarantees.

## Non-negotiable hard blocks

- No Amazon scraping.
- No Amazon Product Advertising API use unless separately approved and credentialed.
- No copied Amazon or merchant prices, images, reviews, ratings, availability, product descriptions, or private data.
- No raw secrets or raw PII in docs, Kanban, Git, logs, screenshots, frontend code, public URLs, prompts, or third-party systems.
- No email/SMS activation from this loop.
- No 100M email / 20M SMS legacy activation without Contact War Room tiering, consent/source classification, suppression, unsubscribe, provider readiness, complaint/bounce monitoring, audit logging, and Boss approval.
- No claim that trends prove product quality, ranking, savings, results, income, health benefit, safety, availability, price, discount, or endorsement.
- No sponsored placement, lead transfer, customer charge, contract, or merchant/network application claim without a separate approved gate.

## Class-level acceptance matrix

| Lane | Current decision | Allowed action | Caps / rate limits | Required controls | Audit log / evidence | Success metric | Stop condition | Escalation threshold |
|---|---|---|---|---|---|---|---|---|
| Google Trends sourcing | GO | Use SerpAPI/Google Trends as demand signal for U.S. trend discovery and editorial lane refresh. | 1 scheduled daily run by default; manual re-run allowed for QA; no key exposure. | Use approved seed categories; store only trend metadata; no raw PII; no scraping of merchant sites through this lane. | `data/google-trends-snapshot.json`, run timestamp, seeds, selected lane changes, guardrails. | Fresh trend snapshot and at least one usable lane/page update when trends change. | API error, malformed snapshot, missing key, copied merchant content, or high-risk category selected. | New data source, new geography, high-risk regulated vertical, or source terms ambiguity. |
| Trend lane curation | GO | Convert trend signals into original StuffPrettyGood editorial lanes, SEO metadata, and signup preferences. | Keep launch lanes manageable: current 10-20 lanes; add more only after page QA and content review capacity. | Original copy only; no guaranteed/best/#1 claims; mark risk tier; exclude high-risk finance/debt/loans/crypto/adult/cannabis/SHAFT-over-SMS from launch. | Lane slug, source seed, related searches, risk tier, owner/date reviewed. | Pages are useful, claim-safe, and link to preference/unsubscribe/privacy/disclosure surfaces. | Unsupported ranking/result/savings/health/safety claim; sensitive vertical; misleading urgency. | Any regulated category, health/safety claim, children/minors targeting, or public claim needing substantiation. |
| SEO trend pages | CONDITIONAL GO | Publish reusable public trend pages with original explanatory copy, preference/signup hook, affiliate disclosure, compliance links, and schema metadata. | Public page generation allowed after tests; no paid amplification without separate spend gate. | Affiliate disclosure visible; privacy/terms/preferences/unsubscribe links present; no hidden raw PII logging; no deceptive SEO cloaking. | Generated `public/trends.html` and `public/trends/*.html`; test evidence; content review date. | Page returns 200, has disclosure, contains signup/preference path, and avoids prohibited claims/content. | Missing disclosure/compliance links; raw PII in events/logs; merchant content copied; broken page. | Public launch to new domains, paid traffic, media/PR, or high-risk category page. |
| Signup/preference hook | CONDITIONAL GO, NO-SEND | Collect explicit on-site preference intent in dry-run/no-send mode; production backend must store consent/audit safely before sends. | No autonomous sends; no provider push; no list export. Use frontend redaction and server-side audit before activation. | Clear consent checkbox; unsubscribe anytime language; preference center; raw email/phone redacted from browser events/logs where practical; suppression state respected. | Consent text/version, source page, timestamp, preference category, suppression writes, audit event; store raw identifiers only in approved backend fields, never public artifacts. | Preference capture works and generates audit-safe records/events without sending. | Raw PII appears in logs/frontend/Kanban/Git; missing consent text; unsubscribe path broken. | Any email/SMS send, double-opt-in/welcome campaign, export, provider sync, or legacy audience use. |
| Amazon manual links | CONDITIONAL GO | Use manual Amazon SiteStripe/search/deep links through disclosure-visible `/go/amazon-*.html` bridge pages. | Amazon-first manual linking only; no automated Amazon scraping; no PA-API. Manual/agent review required before each new Amazon bridge is activated. | StoreID/tag must be `mehyarmedia-20`; disclosure must be visible before click-out; link uses `rel="sponsored nofollow noopener"`; copy says check current details on Amazon; no price/image/review/rating/availability copying. | Offer slug, Amazon query/link shape, tag check, disclosure_seen event, referring surface, last reviewed date, reviewer. | `/go` bridge exists, disclosure visible, tag present, no copied merchant content. | Wrong/missing tag; undisclosed affiliate link; copied Amazon content; direct auto-redirect without disclosure/audit; broken link. | Any new Amazon account/tag, PA-API use, product image/price/rating display, auto-link generation at scale, or Amazon policy uncertainty. |
| Affiliate disclosure | GO, required | Use clear disclosure on every page containing affiliate/referral/sponsored links. | 100% coverage: hub, lane pages, `/go` pages, deal pages, quiz results, and offer cards. | Disclosure must be near offer context or footer and not hidden; Amazon wording: “As an Amazon Associate, we may earn from qualifying purchases” or equivalent. | Test or manual review showing disclosure on each public route; `disclosure_seen` / `affiliate_disclosure_seen` event where applicable. | User can see financial relationship before or at click decision. | Missing/hidden disclosure; sponsored link not labeled; disclosure only after outbound click. | New sponsor formats, advertorials, paid placements, influencer-style endorsements, or lead-gen transfer. |
| Merchant/referral/direct offers | WATCH / conditional | Use public referral programs, direct SaaS/merchant programs, sponsor placeholders, MehyarSoft audit/setup offers, and templates as original recommendations. | Only approved/pending offer records; pending offers cannot claim payout, approval, discount, or partnership. | Verify program terms; use original copy; do not imply partnership unless approved; no guaranteed results/savings/income. | Offer catalog fields: vendor, program type, URL, approval status, claim restrictions, allowed surfaces, risk tier, last reviewed date, owner, `/go` status. | Offer can be routed with accurate status and disclosure. | Unverified partnership/payout/discount claim; term conflict; lead transfer without consent. | Sponsor contract, paid placement, lead sale/transfer, customer charge, or network application representation. |
| Source discovery / Scout cadence | GO for research | Scout may maintain source/application tracker and discover Amazon categories, public referral programs, direct merchant programs, sponsor candidates, and network-readiness metrics. | Research-only; no credentialed application/submission using unverified claims; no raw PII exports. | Respect source terms/robots; record source URL and rights notes; do not scrape prohibited merchant content; keep outputs aggregate. | Source registry: source URL, terms notes, allowed use, risk tier, owner, next review, application status. | Pipeline of compliant source candidates and proof metrics for later applications. | Source terms prohibit use; private/paywalled data; copied content; high-risk vertical. | Actual network application, sponsor outreach with claims, contract/pricing, or use of audience proof externally. |
| CRM attribution/events | CONDITIONAL GO | Track aggregate proof metrics: page views, lane views, signup starts, topic preferences, `/go` clicks, disclosure_seen, offer-source category. | Aggregate-first; no raw PII in frontend/browser events; no third-party pixel expansion without privacy review. | Event names must avoid raw identifiers; server receives raw contact data only through approved consent endpoint; retention/access controls required. | Event schema, aggregate dashboard, audit IDs, no raw PII evidence. | Metrics support network-readiness without exposing user data. | Raw email/phone/name/payment/secret in event payload, console log, URL, screenshot, or third-party tool. | New analytics provider, ad pixel, cross-site tracking, data sharing, or conversion import with identifiers. |
| Outbound email activation | HARD NO-GO | None from this loop. Drafts/simulations only. | 0 sends, 0 provider pushes, 0 exports, 0 warmup traffic. | Contact War Room tiering, suppression, consent/source, unsubscribe, provider readiness, DNS, complaint/bounce, seed tests, and approval not bypassable. | Approval record must name segment, cap, provider, sender domain, suppression proof, owner, kill switch. | Not applicable until separate controlled test gate. | Any attempt to send/export/sync contacts. | Any live email, including “small test,” requires ComplyOps + Boss scoped approval. |
| Outbound SMS activation | HARD NO-GO | None from this loop. | 0 SMS; 0 SMS provider pushes; 0 re-permission texts unless separately approved and documented written marketing consent exists. | SMS consent vault and STOP handling required; Tier 4 quarantined. | Written marketing consent evidence, STOP audit, provider readiness, approved template. | Not applicable until separate SMS gate. | Any phone export/text/provider sync without documented consent. | Any SMS use requires documented consent + ComplyOps + Boss approval. |

## Copy acceptance rules

Allowed:
- “Google Trends signals help us decide which topics to cover.”
- “Check current options on Amazon.”
- “StuffPrettyGood may earn a commission or referral credit if you use some links.”
- “Recommendations are practical starting points, not guarantees, rankings, or professional advice.”
- “Prices and availability can change; check the merchant site for current details.”

Blocked unless separately substantiated and approved:
- “Best,” “#1,” “proven,” “guaranteed,” “lowest price,” “doctor recommended,” “safe for everyone,” “will save you X,” “will make you money,” “limited-time deal” without current proof, “official partner” without approval, or any claim of verified results/case studies.

## Minimum implementation acceptance checks

Before a daily trend/offer run is accepted:

1. Fresh trend snapshot exists: `data/google-trends-snapshot.json`.
2. Trend lanes are generated from approved seeds and original copy: `src/spg/trending-offers.js`.
3. Public trend hub and lane pages are regenerated: `public/trends.html`, `public/trends/*.html`.
4. Amazon bridges are disclosure-visible and use `mehyarmedia-20`: `public/go/amazon-*.html`.
5. Each public offer/signup surface has affiliate disclosure, privacy, preferences, and unsubscribe links.
6. No generated file contains raw secrets, raw PII, copied Amazon/merchant prices, reviews, ratings, images, or availability claims.
7. `npm test` passes after generation.
8. Any failed check keeps the run in NO-GO until fixed and re-tested.

## Authority decision

- Public no-outbound trend/offer pages: CONDITIONAL GO inside this matrix.
- Amazon manual `/go` bridges: CONDITIONAL GO only with visible disclosure, `mehyarmedia-20`, manual review, and no copied Amazon content.
- Scout ongoing source discovery: GO for internal research and aggregate proof tracking; WATCH for source terms and claim status.
- Signup/preference capture: CONDITIONAL GO in dry-run/no-send mode only; production storage must remain audit-safe and suppression-aware.
- Email/SMS activation: HARD NO-GO from this task.
- Mass legacy activation: HARD NO-GO until separate tiered gates and Boss approval.
