# StuffPrettyGood /offers Conversion Audit

Date: 2026-05-15
Scope: current production /offers pages and local generated HTML in /home/mehya/work/mehyarmedia/public/offers.

## Verification run

- `npm run spg:qa:offers` passed: 113 offer cards and 65 offer landing pages verified.
- Live fetch passed for homepage and sample offer pages.
- Playwright screenshots captured under `qa/screenshots/offers-audit/`.
- Static audit covered 65 `/offers/*.html` pages.

## Architecture status

PASS: owned-link rule is working.

Current route chain:
- Homepage/trend card -> `/offers/<slug>.html`
- Offer page -> `/go/<slug>.html`
- Go bridge -> Amazon/merchant destination

The problem is not routing anymore. The problem is conversion quality.

## Top conversion blockers, prioritized

### P0 — Offer pages are too thin and generic

Evidence:
- 65/65 pages have short/generic meta descriptions.
- Most pages reuse copy like: “Original StuffPrettyGood note…” and “Compare current merchant details before buying.”
- Hero pages explain why routing exists instead of selling why this offer is worth clicking.

Why it hurts:
The required landing page adds an extra click. If the page does not add buyer value, it becomes friction.

Fix:
Upgrade the shared offer landing component so every page includes:
- “Best for” use case
- 3 practical reasons to compare
- 3 things to avoid/check
- category-specific buyer checklist
- monetization/source badge
- stronger first-screen reason to click

### P0 — No real curated offer options on offer pages

Evidence:
- Pages mostly have one CTA: `/go/<slug>.html`.
- Amazon pages route to broad Amazon search URLs, not multiple curated offer blocks.

Why it hurts:
Money pages should create multiple qualified click paths. A single broad “check options” CTA is weaker than offer cards like budget / premium / travel / small desk / starter kit.

Fix:
Add reusable “offer option rows” to each landing page:
- Best budget option
- Best practical/starter option
- Best premium/pro option
- Best related accessory/bundle
Each still routes through approved `/go/<slug>` bridges.

### P1 — CTA copy is generic

Evidence:
- 62/65 pages use generic CTA language like “Check current options →”.

Why it hurts:
CTA does not reinforce category intent or expected outcome.

Fix:
Generate category-specific CTAs:
- “Compare AI voice recorders on Amazon”
- “See current portable power station options”
- “Check walking pad sizes and current deals”
- “Compare air purifier filter options”

### P1 — Compliance language is crowding the sell

Evidence:
- Above the fold contains “No copied prices/reviews,” “not guarantees,” “not professional advice,” and routing/disclosure explanation near CTA.

Why it hurts:
Compliance is required, but current placement makes the page feel defensive instead of useful.

Fix:
Keep a short disclosure near CTA:
“Affiliate disclosure: we may earn if you click/buy. Check merchant details.”
Move detailed defensive copy lower into a compliance/disclosure block.

### P1 — Signup/preference flow competes with the money click

Evidence:
- “Save this lane,” “Set preferences,” and a full weekly picks form appear on every offer page.
- Forms are preview/static and do not yet persist real CRM consent.

Why it hurts:
It distracts high-intent visitors from affiliate click revenue and can waste signup intent.

Fix:
Until LeadFS persistence is production-ready:
- Keep only a small secondary “Get weekly picks” capture below the first merchant CTA.
- Move unsubscribe to footer/legal only.
- Make merchant click the dominant above-fold conversion.
- Wire real backend storage before making signup prominent again.

### P1 — Related offers are text-only and low-converting

Evidence:
- 64/65 related offer sections are text-only cards.

Why it hurts:
Related offers should recover exits and increase page depth. Text-only cards look unfinished.

Fix:
Use the same image-card component for related offers with:
- thumbnail
- category
- “best for” mini-label
- CTA text

### P2 — Image presentation is branded but not product-convincing

Evidence:
- Hero art is original/generated, which is good for compliance, but the art is generic SPG-cartoon instead of showing recognizable product category cues.

Why it hurts:
Visitors need to instantly understand what they are comparing. The current art is cute, but not enough like a real offer/product surface.

Fix:
Generate/license category-specific images with product silhouettes and use-case scenes:
- voice recorder on meeting table
- portable power station during outage/camping
- walking pad under desk
- air purifier in bedroom

### P2 — SEO schema is too generic

Evidence:
- Product JSON-LD exists but lacks an `offers` object because real merchant product data is unavailable.

Why it hurts:
Weak rich-result eligibility and possible mismatch between page intent and schema.

Fix:
Use `CollectionPage` or `ItemList` schema for broad Amazon search/category pages. Use `Product` only when we have a real compliant product record.

### P2 — CLS/performance polish risk

Evidence:
- 65/65 hero images have no explicit width/height attributes.

Why it hurts:
Can create layout shift and lower quality score.

Fix:
Add width/height or CSS aspect ratio plus explicit dimensions in generated image tags.

## Recommended implementation order

1. Rebuild shared offer landing component copy model: buyer guidance first, compliance shorter and lower.
2. Add category-specific CTA generator.
3. Add reusable offer option rows with 3–4 monetized click choices per page.
4. Replace related offers with image cards.
5. Wire/quiet signup until CRM persistence is real.
6. Switch schema to CollectionPage/ItemList for broad category pages.
7. Add image dimensions and category-specific art prompts/assets.

## Conversion priority summary

Highest leverage fix:
Make `/offers` pages feel like useful buying guides, not compliance bridges.

Second highest leverage:
Add multiple monetized click opportunities per offer page.

Third highest leverage:
Stop letting signup/static preference UI compete with affiliate clicks until it actually stores production consent.
