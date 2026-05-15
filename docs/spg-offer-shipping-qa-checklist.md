# StuffPrettyGood Offer Shipping QA Checklist

Purpose: no StuffPrettyGood offer, article embed, daily source item, homepage card, trend card, RSS item, sponsor placement, Amazon item, affiliate-network item, or owned service offer ships unless it passes the owned landing + disclosure + redirect gate.

Applies to: Scout, ProductOps, WebDev, LeadFS, DataEng, ComplyOps, DevOps, Arman.

Canonical click path:

public card / rail / embed -> /offers/<slug>.html -> /go/<slug>.html -> approved destination

Hard rule: no public offer card may link directly to Amazon, Skimlinks, Stay22, affiliate networks, merchants, sponsor URLs, referral URLs, checkout URLs, or /go/<slug>. Public cards link to /offers/<slug>.html only.

## 1. Scout / Source Intake Checklist

Before Scout or any sourcing agent marks an offer candidate ready:

- [ ] Offer benefits StuffPrettyGood commercially: Amazon Associates, affiliate commission, referral credit, sponsor placement, owned MehyarSoft lead, paid/network offer, or explicitly approved lead magnet.
- [ ] Offer is not free filler, unpaid promotion, or unknown monetization.
- [ ] Offer has a unique canonical slug.
- [ ] Offer has a category/lane and one-sentence why-click value proposition.
- [ ] Source/network/account is recorded by name and safe reference only.
- [ ] No raw API key, account password, token, payout info, or private credential appears in Kanban, docs, Git, frontend, screenshots, URLs, or logs.
- [ ] If Amazon: no PA-API assumption, no Amazon scraping, no copied Amazon price/image/rating/review/availability/listing copy.
- [ ] Image plan is owned/generated/licensed/approved, not copied from Amazon or a merchant unless rights are explicit.
- [ ] Destination is marked as approved, pending, blocked, or needs account approval.

Blocked if any answer is missing or unknown.

## 2. DataEng / DB Checklist

Before an offer can be publishable, the durable offer record must include:

- [ ] offer_id
- [ ] canonical_slug
- [ ] title
- [ ] category
- [ ] public_landing_url = /offers/<slug>.html
- [ ] redirect_url = /go/<slug>.html
- [ ] offer_type: amazon_manual, affiliate_network, direct_merchant, sponsor, referral, owned_offer, or approved_lead_magnet
- [ ] monetization_status = approved, not free_unpaid/unknown
- [ ] approval_status = approved_for_public
- [ ] disclosure_text
- [ ] image_url or image_asset_ref
- [ ] image_rights_status = owned/generated/licensed/approved
- [ ] destination_host or destination_ref
- [ ] network/account ref, never raw secret
- [ ] SEO title/meta description/canonical fields
- [ ] schema eligibility fields
- [ ] redirect_health status
- [ ] last_verified_at

Publish filter must fail closed if public_landing_url, redirect_url, disclosure_text, monetization_status, approval_status, image_rights_status, or redirect_health is missing/bad.

## 3. LeadFS / Implementation Checklist

Before backend/API/build contract handoff:

- [ ] Approved public feed excludes free_unpaid, unknown, blocked, unapproved, unhealthy, or rights-unsafe offers.
- [ ] Approved public feed exposes public_landing_url and redirect_url, not raw destination secrets.
- [ ] Offer cards consume public_landing_url only.
- [ ] Landing pages consume redirect_url only for outbound CTA.
- [ ] /go route or static bridge is the only layer allowed to know/use the final destination.
- [ ] Redirect path records safe attribution: offer_id, slug, referrer/UTM/session-safe data, network/account ref, timestamp.
- [ ] No raw PII is logged; hash or aggregate where needed.
- [ ] Redirect fails closed when unapproved, missing destination, blocked risk, missing secret, or health failure.

## 4. WebDev Checklist

Every visible offer card/rail/embed must pass:

- [ ] Card primary link points to /offers/<slug>.html.
- [ ] Card has no direct /go/<slug> link.
- [ ] Card has no direct external offer href.
- [ ] Card uses approved image asset with alt text.
- [ ] Card has title, category/lane, short claim-safe value copy, and disclosure hint.
- [ ] Shared landing component is used for /offers/<slug>.html.
- [ ] Landing page renders without JavaScript.
- [ ] Landing page includes image, title, category, why-click copy, disclosure before CTA, signup/preference block, related offers, privacy, terms, affiliate disclosure, preferences, and unsubscribe links.
- [ ] Landing page outbound CTA points only to /go/<slug>.html.
- [ ] Related offers point to /offers/<related-slug>.html.
- [ ] Page has title/meta description/canonical/OpenGraph/Twitter metadata.
- [ ] Page has safe JSON-LD.
- [ ] Mobile, tablet, and desktop layouts are checked in light and dark theme.
- [ ] No console errors or broken assets on key offer pages.

## 5. ComplyOps Checklist

Before public approval:

- [ ] Affiliate/sponsor disclosure appears before outbound CTA on landing page.
- [ ] Footer has affiliate disclosure, privacy, terms, preferences, and unsubscribe links.
- [ ] Amazon offers do not display copied Amazon prices, ratings, reviews, availability, badges, listing copy, or images unless an approved right/source explicitly exists.
- [ ] Claims avoid “best,” “#1,” “guaranteed,” fabricated savings, invented reviews, fake urgency, fake scarcity, and unverified performance claims.
- [ ] SMS/email activation language is not present unless separately approved by campaign gates.
- [ ] Attribution/source links, if any, are not styled as offer CTAs and do not carry affiliate/referral params unless routed through /go.
- [ ] Sensitive/high-risk categories are blocked or escalated.

## 6. DevOps / Release Gate Checklist

Before deploy:

- [ ] Run npm run spg:qa:offers.
- [ ] Run npm test.
- [ ] Confirm sitemap includes approved /offers/<slug>.html pages.
- [ ] Confirm homepage and generated public pages have zero direct external offer-card links.
- [ ] Confirm every /offers page has disclosure, preferences, unsubscribe, and /go CTA.
- [ ] Confirm every /go page has disclosure/bridge copy and the correct slug.
- [ ] Live-smoke after deploy: homepage, at least three /offers pages, at least three /go pages, preferences, unsubscribe, affiliate disclosure, sitemap, robots.
- [ ] If any route fails, rollback or block deploy; do not ship partial offer cards.

Required command:

npm run spg:qa:offers
npm test

## 7. ProductOps / Screenshot QA Checklist

Before final acceptance:

- [ ] Compare homepage offer density and visual hierarchy against leading affiliate/offer/media sites.
- [ ] Verify signup, preferences, unsubscribe, privacy, terms, and affiliate disclosure are visible from public paths.
- [ ] Verify the user journey: card -> offer landing -> disclosure -> /go bridge.
- [ ] Screenshot check at mobile, tablet, desktop, light theme, dark theme.
- [ ] Confirm cards look image-led and monetized, not like CRM/admin placeholders.
- [ ] Confirm no “Save pick” or non-commercial filler language unless intentionally used inside signup/preference capture.

## 8. Arman Final Acceptance

Arman may mark the wave accepted only when all of these are true:

- [ ] All automated checks passed.
- [ ] All ComplyOps disclosure/image/claims gates passed.
- [ ] All public offer cards route to /offers first.
- [ ] All landing pages disclose before CTA and route to /go only.
- [ ] Daily ingestion/population cannot publish an offer that fails the same rules.
- [ ] Site is money-first: no free/unpaid offers unless explicitly approved as signup-intent lead magnets.
- [ ] No raw secrets, raw PII, or private account credentials appear in public or Git/Kanban/docs/logs.

If any box fails, block the task with evidence and assign the fix to the responsible lane. Do not approve by vibes.
