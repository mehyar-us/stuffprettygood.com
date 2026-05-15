# StuffPrettyGood 2026 Visual Benchmark + Cartoonist Design System Brief

Date: 2026-05-15 UTC
Task: t_9bcf9559
Scope: design direction only. No deploy. No implementation.

## 1. Executive reality

StuffPrettyGood currently has the right compliance posture and a cleaner editorial foundation than the earlier CRM-looking version, but it still does not yet feel like a dense, image-led public consumer affiliate/offers/media brand.

The current homepage reads as a restrained MVP guide index: trustworthy, clear, text-heavy, sparse above the fold, and light on product merchandising. The 2026 target should be a modern minimalist + cartoonist commerce magazine: warm, weird enough to remember, image-led enough to shop, dense enough to monetize, and transparent enough to pass affiliate/compliance review.

Primary directive: keep the no-fake-proof and no-Amazon-scraping rules, but make the site feel like a consumer destination with daily utility, playful art direction, strong offer cards, and visible owned-audience capture.

## 2. Evidence screenshots

Current SPG:
- `docs/artifacts/spg-visual-benchmark-2026/screenshots/spg-home-current.png`

Benchmarks captured:
- `docs/artifacts/spg-visual-benchmark-2026/screenshots/wirecutter-home.png`
- `docs/artifacts/spg-visual-benchmark-2026/screenshots/slickdeals-home.png`
- `docs/artifacts/spg-visual-benchmark-2026/screenshots/techradar-deals.png`
- `docs/artifacts/spg-visual-benchmark-2026/screenshots/strategist-home.png`

RetailMeNot was attempted but blocked by Cloudflare security verification in the browser session, so it was not used as visual evidence.

## 3. Current live site critique

URL inspected: `https://stuffprettygood.com/`
Current title: `Useful finds, guides, and offers | StuffPrettyGood`

What works now:
- Clear positioning: useful finds, updated daily.
- Primary CTA exists: `See today's picks`; secondary CTA exists: `Get weekly picks`.
- Strong trust path: no fake reviews, affiliate disclosure, no sensitive data required.
- Footer exposes affiliate disclosure, privacy, terms, preferences, unsubscribe.
- Trend/RSS source language is compliance-aware and avoids overclaiming.
- Light/dark theme support exists in CSS and nav.
- Semantic structure is better than a CRM/admin shell.

What is still wrong for the target brand:
- Above-the-fold has no visible product/editorial imagery.
- The page feels more like a text directory than a high-energy consumer offers/media homepage.
- Cards use similar treatments, so hierarchy is too flat.
- No mascot/illustration/sticker system, so the requested cartoonist/vibe-heavy character is absent.
- There is not enough deal density above the fold: no hero product collage, no hot lane, no popular rail, no utility/tool module visible near the top.
- The current `Today's signal strip` is useful but feels analytical, not merchandised.
- The `What this is` card still explains the business instead of selling the user into discovery.
- Current daily RSS cards are honest but too raw-looking for consumer homepage prominence.
- The current visual vocabulary is premium-safe but not memorable.

Bottom line: keep the compliance/trust architecture; rebuild the consumer affordance, density, imagery, and brand personality.

## 4. Benchmark pattern extraction

### Wirecutter
Relevant observed patterns:
- Editorial trust first: bylines, dates, researched framing, plain affiliate disclosure.
- Dense homepage taxonomy with category sections and repeated templates.
- Above-fold lead story uses large image plus related links.
- Daily deals rail appears high on page without making the entire site feel like a coupon board.
- Homepage doubles as an SEO directory into evergreen buying guides.

Use for SPG:
- Add editorial authority modules: `Why we picked it`, `Updated`, `Source checked`, `Pretty Good because`.
- Use dense category blocks for Home, Work, Travel, Wellness, Budget, Tools, Gifts.
- Put a daily deals/offers rail above fold or immediately after hero.

Do not copy:
- NYT/Wirecutter visual identity, editorial claims of testing, or institutional authority SPG does not yet have.

### Slickdeals
Relevant observed patterns:
- Very dense deal grid.
- Prominent search.
- Community proof: votes/heat, comments, saves, merchant labels.
- Category nav and personalization/deal-alert prompts.
- Price-first cards and active deal feed.
- Disclosure that deals may be monetized/promoted.

Use for SPG:
- Borrow the density and scannability pattern, not the exact community system.
- Create SPG-safe substitutes for proof: `source signal`, `editorial fit`, `manual link`, `last checked`, `category`, `risk`.
- Add `save this lane`, `weekly alerts`, and category preference capture.

Do not copy:
- Amazon prices/images/reviews/ratings, merchant data without permission, or unearned community metrics.

### TechRadar Deals
Relevant observed patterns:
- Commerce hub page with top category tiles.
- Trending strip routes users to high-value articles.
- Latest deal feed uses image, category, headline, byline/time, summary.
- Newsletter/sidebar capture is contextual to deals.
- Sponsored content and ads are visibly labeled.
- SEO footer sends users to evergreen best pages.

Use for SPG:
- Add compact `Explore deals` category tile cluster.
- Add a `Trending now` strip with high-value lanes.
- Use article/list rows for daily deal/news pages.
- Keep newsletter capture visible with consent language.

Do not copy:
- TechRadar masthead, category styling, ad density, or unsupported discount claims.

### The Strategist
Relevant observed patterns:
- Distinctive playful editorial-commerce brand.
- Commission disclosure sits near top, not buried.
- Product imagery and commerce CTAs appear throughout but within magazine-like storytelling.
- Gift Scout/tool module converts fuzzy intent into shopping discovery.
- Micro-sales and product rails feel curated rather than cheap.
- Dense affiliate rails: most read, top saved, sales, celebrity-style/personality shopping, gift guides.

Use for SPG:
- This is the closest vibe benchmark for `minimalist + cartoonist + affiliate/media`.
- Add a weird-but-useful tool module: `Find me something pretty good for...`.
- Use sticker labels: `Pretty Good`, `Weirdly Useful`, `Low-Regret`, `Starter Kit`, `No-Hype Pick`.
- Create playful editorial modules without fake reviews/testimonials.

Do not copy:
- Strategist logo/type identity, exact module names, direct `obsessive editors` proof unless SPG supports that claim.

## 5. New visual system direction

Working theme name: `Pretty Good 2026: useful little internet gremlin`.

Brand posture:
- Not luxury. Not coupon spam. Not generic SaaS.
- A useful, funny, consumer-friendly shopping/media guide that helps people find stuff before feeds get loud.
- Visual personality: minimalist structure with cartoonist overlays, product/image cards, sticker labels, soft shadows, and gentle motion.

Visual principles:
1. Dense, but not chaotic.
2. Image-led, but rights-safe.
3. Playful, but not childish.
4. Trust-first, but not boring.
5. Monetizable, but not deceptive.

Core layout vocabulary:
- Editorial commerce shell.
- Above-fold hero with image collage and immediate `today's finds` rail.
- Dense offer-card grid with product/category imagery.
- Horizontal trend ticker/strip.
- Intent/category tile cluster.
- Gift/tool finder module.
- Newsletter/preferences card always reachable.
- Disclosure band near top and footer.

## 6. Design tokens

### Color

Light theme:
- Canvas: `#fff8ee` warm paper, not plain white.
- Surface: `#fffdf7`.
- Ink: `#171412`.
- Muted ink: `#70675f`.
- Border: `#e6dccd`.
- Mint accent: `#2f8f7d`.
- Electric grape: `#7c5cff`.
- Sticker yellow: `#ffd86b`.
- Tomato/coral: `#ff6b57`.
- Sky: `#8ed8ff`.
- Safe green: `#2f7a4b`.

Dark theme:
- Canvas: `#08090a`.
- Surface: `#111315`.
- Elevated: `#171a1d`.
- Ink: `#f8f2e7`.
- Muted ink: `#b9aea4`.
- Border: `#2b3036`.
- Mint accent: `#8ee6d1`.
- Electric grape: `#a78bfa`.
- Sticker yellow: `#ffd86b` with dark text.
- Coral: `#ff8a75`.

Color rules:
- One bright accent per module.
- CTA uses mint in both themes.
- Cartoon/sticker labels may use yellow/coral/grape but never all at once in one card.
- Status/risk labels must not imply endorsement or guaranteed savings.

### Type

Recommended stack:
- UI/body: Inter, Geist, or system sans.
- Headlines: Fraunces, Newsreader, or a display serif for magazine/cartoon contrast.
- Utility labels: Inter/Geist uppercase, 700-850 weight.
- Mono optional for source metadata: Geist Mono or ui-monospace.

Type rules:
- H1: 64-92 desktop, 44-56 tablet, 38-44 mobile.
- Section H2: 32-44 desktop, 28-34 tablet, 24-30 mobile.
- Cards: title 18-24, metadata 12-13 uppercase.
- Body line length max 70ch.

### Shape / shadow

- Outer cards: 24-32px radius.
- Product image wells: 18-24px radius.
- Stickers: pill or irregular notched shape, 10-14px radius.
- Primary shadow: `0 20px 70px rgba(39,29,16,.10)` light, `0 24px 80px rgba(0,0,0,.40)` dark.
- Hover shadow increases 10-18%, with translateY(-2px), not bounce.

### Cartoonist language

Use rights-safe illustrated assets and decorative CSS/SVG:
- Small gremlin/blob mascot holding a magnifying glass or shopping basket.
- Hand-drawn underline beneath key words.
- Sticker badges: `pretty good`, `low-regret`, `starter kit`, `source signal`, `human note`.
- Doodle arrows pointing to `why this is useful` and `check the source`.
- Pattern backgrounds: tiny stars, receipt scraps, product-tag outlines.

Do not use fake avatars, fake reviewers, fake customer photos, or AI-generated product images that could imply a real product unless clearly generic/decorative.

### Motion

Allowed:
- Card hover lift: 120-180ms ease-out.
- Sticker wiggle on hover: max 1-2deg rotation.
- Trend strip slow marquee only if pauseable and respects reduced motion.
- Image reveal fade/scale: 160-220ms.
- Theme toggle transition: color only, no layout shift.

Required:
- `prefers-reduced-motion` disables nonessential motion.
- No flashing, bouncing CTA spam, or auto-advancing carousels without controls.

## 7. Component system

### A. Site masthead

Must include:
- Brand logo/wordmark.
- Search input or search button visible on desktop.
- Nav links: Today, Deals, Guides, Tools, Daily Signals.
- Persistent `Weekly Picks` CTA.
- Theme toggle.
- Mobile menu button.

Design target:
- Feels like a magazine/shopping guide, not a CRM admin nav.
- Can support a small cartoon mark.

### B. Disclosure band

Placement:
- Near top, under masthead or hero eyebrow.
- Footer disclosure remains mandatory.

Copy direction:
- `Affiliate disclosure: we may earn commission from some links. We use original notes and public trend/source signals; we do not copy Amazon prices, ratings, reviews, images, or availability.`

Acceptance:
- Visible without scrolling on desktop or within first viewport on mobile.
- Plain language, not legal sludge.

### C. Hero

Required modules:
- H1: one direct promise.
- Subcopy: daily finds across tools, gear, home, travel, wellness, work.
- Primary CTA: `Browse today's finds`.
- Secondary CTA: `Set my weekly picks`.
- Visual: rights-safe collage of product-category illustrations/cards.
- Trust chips: affiliate disclosure, no fake reviews, no sensitive data required.

Hero should not:
- Explain internal CRM.
- Lead with infrastructure, feeds, or database language.
- Be image-free.

### D. Today rail

Above or immediately below hero.

Card anatomy:
- Image/illustration well.
- Category label.
- Title.
- One-sentence usefulness note.
- Source/last-checked metadata.
- CTA: `Read guide`, `Check source`, or `Save lane`.
- Compliance-safe badges: `manual link`, `source signal`, `low-claim`, `starter kit`.

No copied Amazon price/rating/review/image/availability.

### E. Offer card

Required fields:
- Image or generic illustration.
- Category.
- Offer/guide title.
- `Why it's pretty good` one-liner.
- Merchant/source label if authorized.
- Disclosure marker if affiliate/sponsored.
- CTA.
- Last updated or source checked timestamp where available.

Optional fields:
- Price only from permitted/manual/authorized data.
- Savings only from permitted/manual/authorized data.
- Editor note.
- Risk/claim class.

### F. Dense category tiles

Use TechRadar/Slickdeals pattern, SPG-styled:
- AI tools
- Home upgrades
- Travel tech
- Wellness routines
- Budget under $50
- Pet tech
- Small-space office
- Weekend projects
- Gifts
- Smart home
- Meal prep
- Sleep/beauty

Acceptance:
- 8-14 tiles visible without overwhelming desktop.
- Mobile wraps into 2-column or horizontal scroll with accessible labels.

### G. Utility/tool module

Working module:
- `Find me something pretty good for...`

Inputs:
- free text prompt or chips: `a small apartment`, `a remote worker`, `a tired parent`, `a weekend hobby`, `under $50`.

Output route:
- Goes to quiz/finder/search results.
- If persistence is unavailable, clearly states preview/manual mode.

### H. Newsletter/preferences module

Must be visible on:
- Homepage.
- Deals page.
- Guide pages.
- Footer.

Required UX:
- Email field.
- Topic preferences.
- Consent checkbox.
- Unsubscribe/preference links adjacent or one click away.
- Legal line with privacy/terms.

No sending/provider push unless CRM gates approve in separate task.

### I. Article/guide page template

Required sections:
- SEO title/H1.
- Updated date.
- Disclosure note.
- Quick answer / top picks.
- Who this is for.
- How to choose.
- Offer cards or related guides.
- Sources/signals used.
- Claim/risk caveat.
- Preferences/signup CTA.
- Related guides.
- JSON-LD where appropriate: Article, BreadcrumbList, ItemList only when valid.

### J. Daily signals page

Should not look like a raw feed dump.

Required treatment:
- `Signals are not endorsements` banner.
- Filter chips by category/source.
- Cards grouped by lane.
- Clear `source signal` CTA.
- Editorial next-step CTA: `Turn this into a guide`, `Watch this category`, `Get weekly picks`.

## 8. Homepage information architecture

Recommended order:

1. Masthead with search/nav/theme/Weekly Picks.
2. Disclosure mini-band.
3. Hero: promise + CTAs + playful collage.
4. `Today's Pretty Good Finds` rail: 6-8 cards.
5. `Explore by intent` dense category tiles.
6. Utility module: `Find me something pretty good for...`.
7. `Fresh guides` editorial grid.
8. `Deal/source signals` module with compliance-safe language.
9. `Starter kits` or `Low-regret upgrades` rail.
10. Newsletter/preferences capture.
11. SEO footer with categories, disclosure, privacy, terms, preferences, unsubscribe.

## 9. Responsive behavior

Desktop >= 1180px:
- 12-column grid.
- Hero split 7/5 or 6/6 with collage.
- Today rail: 4 cards visible + horizontal overflow or 3x2 grid.
- Offer grid: 3-4 columns depending density.
- Sidebar allowed for newsletter/latest if content pages.

Tablet 768-1179px:
- Hero stacks or 6/6 with smaller type.
- Category tiles wrap to 3 columns.
- Offer cards 2 columns.
- Search can collapse to icon but must remain accessible.
- Newsletter card full width after first content block.

Mobile <= 767px:
- Single-column hero.
- H1 <= 44px and no clipped text.
- Sticky nav not taller than 72px closed.
- Category tiles 2-column or accessible horizontal chips.
- Offer cards include image, title, one-liner, CTA above fold of each card.
- Weekly Picks CTA visible in menu and in-body.
- Preferences/unsubscribe visible in footer and newsletter module.

## 10. SEO/content requirements

Every indexable page must include:
- Unique title and meta description.
- Canonical URL.
- OG/Twitter metadata.
- H1 exactly once.
- Semantic article/section/card markup.
- Internal links to categories and related guides.
- Affiliate disclosure when commerce links appear.
- `rel="nofollow sponsored noopener"` where appropriate for paid/affiliate outbound links.
- Sitemap entry.

Structured data allowed only when truthful:
- WebSite with SearchAction.
- Article for editorial pages.
- BreadcrumbList.
- ItemList for lists of SPG pages/offers, not copied third-party product data.

Do not add Product/Review/AggregateRating schema unless SPG has compliant first-party data and approval.

## 11. Data/content ingestion design requirements

The visual system must support daily ingestion without legal/compliance drift.

Allowed source uses:
- Public RSS/trend/source signals as discovery inputs.
- Licensed/authorized affiliate feeds.
- Manually curated merchant links.
- SPG original notes and summaries.
- Generic/owned/stock/illustrated imagery.

Forbidden:
- No Amazon scraping.
- No copied Amazon prices.
- No copied Amazon images.
- No copied Amazon ratings/reviews/review counts.
- No copied Amazon availability.
- No fake deal scores, fake testimonials, fake staff testing, fake popularity.
- No email/SMS blast or provider push from this surface.

DB/durable content display needs:
- `source_type`
- `source_name`
- `source_url`
- `ingested_at`
- `lane/category`
- `claim_risk`
- `affiliate_status`
- `image_rights_status`
- `manual_review_status`
- `expires_at` if known and authorized

## 12. Exact acceptance criteria for implementation

### Visual acceptance

- [ ] Homepage above fold includes at least one image/collage/illustration block.
- [ ] Homepage above fold includes at least 4 commerce/media entry points, not just 2 CTAs.
- [ ] At least 8 offer/guide cards on homepage use image wells or illustrated placeholders.
- [ ] Cards have distinct hierarchy: hero card, rail card, compact source card, article card.
- [ ] Cartoonist elements exist in at least 3 places: mascot/mark, stickers, doodle/underline/pattern.
- [ ] Light and dark themes both preserve contrast and brand character.
- [ ] Hover/focus states are visible and tasteful.
- [ ] `prefers-reduced-motion` disables decorative motion.

### Conversion acceptance

- [ ] Primary CTA appears in hero: `Browse today's finds` or equivalent.
- [ ] Weekly signup/preferences capture appears in hero area or first half of homepage.
- [ ] Footer includes Affiliate disclosure, Privacy, Terms, Preferences, Unsubscribe.
- [ ] Preference/unsubscribe links are visible without needing account login.
- [ ] Search or finder entry exists on homepage.
- [ ] Category/intent tiles route users to monetizable guide/deal lanes.

### Trust/compliance acceptance

- [ ] Affiliate disclosure appears near top and footer.
- [ ] No fake reviews, testimonials, client logos, testing claims, ratings, or popularity metrics.
- [ ] No copied Amazon price/image/rating/review/availability content.
- [ ] Sponsored/affiliate outbound cards are labeled.
- [ ] Source-signal modules say signals are not endorsements.
- [ ] Newsletter form includes consent language and unsubscribe expectation.
- [ ] No provider push/send/export functionality is triggered by public UI.

### SEO acceptance

- [ ] Each page has unique title/description/canonical/OG tags.
- [ ] Valid sitemap updated.
- [ ] Index pages use clear H1/H2 hierarchy.
- [ ] Guide pages include Article/BreadcrumbList schema where truthful.
- [ ] Internal links connect homepage, today, deals, guides, categories, preference/unsubscribe pages.

### Responsive/accessibility acceptance

- [ ] Keyboard navigation reaches nav, search/finder, cards, forms, theme toggle, footer links.
- [ ] All images have descriptive alt text or empty alt if decorative.
- [ ] Form inputs have labels.
- [ ] Focus ring visible in both themes.
- [ ] Mobile screenshot shows no horizontal overflow at 360px.
- [ ] Tablet screenshot shows 2-column card behavior without cramped text.
- [ ] Desktop screenshot shows dense but legible grid.
- [ ] Color contrast meets WCAG AA for text and controls.

### Performance acceptance

- [ ] Homepage loads critical CSS without huge JS dependency.
- [ ] Images are optimized, sized, lazy-loaded below fold.
- [ ] No layout shift from lazy cards.
- [ ] Animation cost stays compositor-friendly: transform/opacity only.
- [ ] No third-party scripts added without explicit approval.

## 13. Implementation handoff notes for next WebDev/LeadFS task

Recommended first implementation wave:
1. Create reusable components/classes: masthead, disclosure band, hero collage, offer card, sticker, category tile, trend strip, finder module, newsletter module.
2. Refactor `public/index.html` first; preserve existing legal/footer links and theme toggle.
3. Upgrade `public/styles.css` into organized sections/tokens. Avoid monolithic minified one-line CSS for maintainability.
4. Add rights-safe placeholder illustration system via inline SVG/CSS gradients until licensed product images exist.
5. Keep current daily/RSS copy but redesign it as a consumer module, not raw feed cards.
6. Add screenshot QA for desktop, tablet, mobile, light/dark before any deploy request.

Recommended follow-up owner split:
- WebDev: implement visual system and responsive QA.
- LeadFS: DB/durable ingestion contract and rendering API if moving beyond static generation.
- ComplyOps: approve disclosure wording, affiliate/sponsored labeling, Amazon Associates constraints.
- DevOps: deploy/live-test only after class gate.

## 14. Non-goals for this task

- No deploy.
- No provider/email/SMS push.
- No Amazon scraping or copied Amazon commerce data.
- No implementation beyond this design brief artifact.
- No public claim that SPG tested/reviewed products unless separately evidenced and approved.
