# StuffPrettyGood.com — Best Deals Site Affiliate Growth Plan

Generated: 2026-05-16
Owner: Scout → Hot Zero → Boss
Site: https://stuffprettygood.com

## Executive call

StuffPrettyGood should become a trust-first, API/feed-first deals engine:

1. Amazon + Stay22 stay active as immediate monetization rails.
2. Add broad auto-affiliate coverage next: Sovrn Commerce and Skimlinks.
3. Add marketplace/refurb coverage: eBay Partner Network.
4. Add major affiliate networks: FlexOffers, Awin, ShareASale, Impact, CJ, Rakuten.
5. Add direct merchant/program targets after traffic proof: Walmart, Target, Etsy, AvantLink, Partnerize.

Do not turn SPG into a thin coupon spam site. The winning model is:

Trend discovery + authorized feeds + reusable offer cards + useful offer landing pages + redirect tracking + newsletter alerts + category/merchant hubs.

## Current monetization rails

- Amazon Associates: active via Store ID/tag `mehyarmedia-20`.
- Stay22: active via AID `mehyar`.
- Skimlinks: not active until valid client/publisher credentials exist.

## First 10 affiliate account targets

1. Sovrn Commerce / VigLink
   - Signup: https://www.sovrn.com/publishers/commerce/
   - Priority: very high
   - Why: broad automatic merchant link monetization; good for new editorial commerce sites.
   - Best SPG use: monetize outbound merchant links that are not Amazon/Stay22.
   - Required: website URL, publisher profile, promo methods, payment/tax later.
   - Stop gates: tax, bank, OTP, CAPTCHA, non-standard contract.

2. Skimlinks
   - Signup: https://skimlinks.com/publishers/
   - Priority: very high
   - Why: broad commerce monetization and merchant coverage.
   - Best SPG use: sitewide merchant link monetization, product/category guides, software/home/beauty/travel accessories.
   - Required: site URL, publisher info, payment/tax later, publisher ID/API credentials after approval.
   - Stop gates: tax, bank, OTP, CAPTCHA, audience claims.

3. eBay Partner Network
   - Signup: https://partnernetwork.ebay.com/
   - Priority: high
   - Why: strongest for refurbished, used, open-box, collectibles, parts, sneakers, gaming.
   - Best SPG use: refurbished laptops, used camera gear, open-box phones, collectibles, car parts.
   - Required: eBay account, website/app/social property, tax/payment later.
   - Stop gates: eBay login verification, tax, bank, OTP/CAPTCHA.

4. FlexOffers
   - Signup: https://www.flexoffers.com/affiliate-programs/
   - Priority: high
   - Why: broad retail/software/travel/finance app coverage; datafeeds and APIs possible.
   - Best SPG use: retail coupons, home improvement, electronics, software, education/course offers.
   - Required: site URL, promotional methods, content examples, payment/tax later.
   - Stop gates: tax/bank, unsupported traffic claims, compliance-heavy finance offers.

5. Awin
   - Signup: https://www.awin.com/us/publishers
   - Priority: high
   - Why: large merchant network, product feeds, deep links.
   - Best SPG use: DTC merchants, fashion/beauty/home, Etsy-type merchant coverage where available.
   - Required: publisher profile, website, payment/tax; possible verification deposit depending region.
   - Stop gates: payment/tax/deposit approval, OTP/CAPTCHA.

6. ShareASale
   - Signup: https://www.shareasale.com/info/affiliate-signup/
   - Priority: high
   - Why: many DTC/niche merchants; good for gift guides and small-brand deals.
   - Best SPG use: home decor, kitchen, pet, hobby/craft, subscriptions, apparel/accessories.
   - Required: website, description, promotional methods, payment/tax later.
   - Stop gates: tax/bank, individual merchant approval claims.

7. Impact.com Marketplace
   - Signup: https://impact.com/partnerships/
   - Priority: medium-high
   - Why: premium brands/SaaS/travel/retail; API/product catalogs where allowed.
   - Best SPG use: SaaS tools, creator tools, VPN/security, hosting/domain, retail marketplace brands.
   - Required: stronger publisher profile; some brand approvals separate.
   - Stop gates: legal contract complexity, tax/bank, inflated audience metrics.

8. CJ Affiliate
   - Signup: https://www.cj.com/publishers
   - Priority: medium-high
   - Why: major retailers/travel/software/telecom; strong catalog/deeplink tooling.
   - Best SPG use: merchant hubs, tech, travel, retail seasonal pages.
   - Required: site profile, traffic sources, publisher details, tax/payment later.
   - Stop gates: tax/bank, strict advertiser approvals.

9. Rakuten Advertising
   - Signup: https://rakutenadvertising.com/affiliate/publishers/
   - Priority: medium
   - Why: department stores, fashion, beauty, electronics, luxury retailers.
   - Best SPG use: department store sale pages, beauty/fashion/gift guides.
   - Required: publisher profile, website, payment/tax later.
   - Stop gates: tax/bank, advertiser manual approval.

10. Admitad or Digidip
   - Admitad: https://www.admitad.com/en/publishers/
   - Digidip: https://www.digidip.net/publisher
   - Priority: medium
   - Why: extra global merchant coverage and backup monetization.
   - Best SPG use: international marketplace deals, app/software promos, lifestyle retail.
   - Stop gates: tax/bank, payment verification, low-quality merchant risk.

## Secondary direct programs after first wave

- Walmart affiliates/creator: https://affiliates.walmart.com/ and https://creators.walmart.com/
- Target Partners: https://partners.target.com/
- Etsy Affiliates: https://www.etsy.com/affiliates
- AliExpress Portals: https://portals.aliexpress.com/
- AvantLink: https://www.avantlink.com/affiliate-marketing/
- Partnerize: https://partnerize.com/partners/
- Travelpayouts: https://www.travelpayouts.com/

## Site model to beat 2026 affiliate competitors

### 1. Homepage

- Hero: “Today’s best deals, verified and ranked.”
- Modules:
  - Today’s Top 10 Deals
  - Amazon Trend Wall
  - Hotel/Travel Finds via Stay22
  - Under $25
  - Tech
  - Home & Kitchen
  - Pets
  - Trending Now
  - Recently Verified
  - Newsletter capture

### 2. Offer cards

Each reusable offer card should include:

- Product/deal image from authorized feed/API/licensed/generated source.
- Short title and benefit.
- Merchant badge.
- Category chip.
- Price/current discount only when source terms allow.
- “Last checked” timestamp.
- Deal score.
- CTA: “See deal,” “Check price,” or “View offer.”
- Affiliate disclosure microcopy.
- Link to `/offers/<slug>.html`, never direct merchant from the card.

### 3. Offer landing pages

Each `/offers/<slug>.html` page should add value beyond redirect:

- Deal summary.
- Who it is for.
- Who should skip it.
- Why this is a good deal.
- Merchant/source notes.
- Coupon instructions where allowed.
- Related deals.
- Email alert signup.
- Clear affiliate disclosure.
- CTA to `/go/<slug>.html`.

### 4. Redirect layer

Keep:

`card → /offers/<slug>.html → /go/<slug>.html → merchant/affiliate destination`

Track:

- offer_id
- merchant
- source network
- category
- CTA variant
- referrer/source page
- device class
- timestamp
- anonymous session ID

### 5. Deal score

Suggested SPG Deal Score:

- Discount depth: 0–30
- Price history/source confidence: 0–25
- Merchant trust: 0–15
- Click velocity/popularity: 0–15
- Editorial usefulness: 0–10
- Coupon/stackability: 0–5

Labels:

- 90–100: Excellent Deal
- 75–89: Strong Deal
- 60–74: Good Deal
- Below 60: Standard Offer

Do not fake price history or popularity. If data is missing, score source confidence lower.

### 6. SEO/category hubs

Immediate hubs:

- Best Amazon deals today
- Best tech deals under $50
- Best home/kitchen deals
- Best smart home deals
- Best pet deals
- Best travel accessories
- Hotel deals / weekend getaways
- Refurbished laptop deals
- Open-box electronics deals
- Gift guides under $25 / $50 / $100

Seasonal hubs:

- Prime Day deals
- Black Friday deals
- Cyber Monday deals
- Back to School
- Holiday gifts
- Mother’s Day / Father’s Day
- Summer travel

### 7. Email capture

Build segmented lists:

- Daily Top 10 Deals
- Amazon Finds Under $25
- Tech Deals
- Home Deals
- Pet Deals
- Travel Deals
- Price-drop alerts

Do not mass-send dormant/cold audience until compliance/provider gates pass.

### 8. Long-term moat

- User accounts/watchlists
- Price-drop alerts
- Coupon verification/reporting
- Community saves/votes
- Browser extension MVP
- Merchant sponsorship inventory
- AI deal curator that explains why a deal matters

## Compliance guardrails

Allowed:

- Authorized affiliate links.
- Amazon links with Associates disclosure and compliant copy.
- Stay22 travel pages with AID.
- Merchant-provided/API/feed images when terms allow.
- Original/generated/licensed images.
- Original editorial summaries.

Blocked:

- Scraping Amazon/merchant images, prices, reviews, ratings, or availability without rights.
- Fake discount, fake scarcity, fake votes, fake traffic claims.
- Hiding affiliate relationships.
- Account signup with false audience metrics.
- Tax/bank/SSN/EIN submission without Boss approval.
- CAPTCHA/OTP bypass.
- Plaintext credentials in Git/docs/Kanban/logs/frontend.

## Signup runbook

1. Verify SPG pages are live:
   - homepage
   - affiliate disclosure
   - privacy
   - terms
   - contact/about if present

2. Use factual publisher description:

“StuffPrettyGood.com is an editorial deals and product-discovery site featuring curated offers, Amazon trend finds, travel/hotel offers, and consumer shopping guides. We monetize with disclosed affiliate links and route visitors through offer landing pages before merchant destinations.”

3. Promotional methods:

- Website/editorial content: yes.
- SEO: yes.
- Email newsletter: planned or only yes if active.
- Social: only yes if active.
- Paid search/social: no unless approved later.
- Coupon/cashback/browser extension: no unless explicitly implemented and allowed.

4. Stop and escalate if any form requests:

- tax form
- SSN/EIN
- bank/PayPal payout
- DOB/government ID
- phone OTP
- CAPTCHA
- legal representative certification
- audience metrics not backed by analytics
- claims about traffic/revenue/followers
- paid media/trademark bidding permissions

5. After approval, store only these in docs/tracker:

- network name
- login email key/name
- account ID/publisher ID
- approval status
- API credential key names
- allowed methods
- restrictions

Secrets go only to env/secret storage, never repo docs.

## First implementation wave

Wave A — Account factory

- Apply to Sovrn, Skimlinks, eBay Partner Network, FlexOffers, Awin, ShareASale, Impact, CJ, Rakuten, Admitad/Digidip.
- Record statuses in `data/spg-affiliate-account-tracker.json`.
- Stop on restricted gates.

Wave B — Site/product upgrades

- Add deal score to data model/cards.
- Add “last checked” and source confidence labels.
- Add category and merchant pages.
- Add newsletter preference modules.
- Add report-expired/report-bad-link action.
- Add redirect click tracking dashboard in CRM.

Wave C — Feed/API integrations

- Amazon PA-API if eligible/available.
- Sovrn/Skimlinks auto-linking or APIs after approval.
- eBay Browse/Buy APIs after EPN approval.
- FlexOffers/Awin/ShareASale feeds after approval.
- CJ/Impact/Rakuten feeds after approval.

Wave D — Best-deals moat

- Price snapshots.
- Deal score ranking.
- Watchlists and price alerts.
- Daily deal email.
- Seasonal hub publishing calendar.
- Browser extension MVP.

## Decision needed from Boss

To actually create accounts under `mrswelim@gmail.com`, Boss should approve/provide:

- legal name/business name to use
- business address
- phone number for OTP if needed
- whether standard affiliate clickwrap terms may be accepted
- whether email verification can be completed from the Gmail inbox
- approved password manager/credential storage path
- verified traffic statement: “new site / no traffic claim” unless analytics are available

Until then, Scout can prepare applications and trackers but should not submit forms that create legal/tax/security obligations.
