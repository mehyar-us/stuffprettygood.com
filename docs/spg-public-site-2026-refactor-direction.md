# StuffPrettyGood public site 2026 refactor direction

Scope inspected: `public/index.html`, `public/styles.css`, `scripts/build-spg-trend-pages.mjs`, `src/spg/trend-components.js`, plus supporting `public/app.js`, `src/spg/trending-offers.js`, `package.json`, and generated public pages.

## Current state

StuffPrettyGood is already separated at the domain/content layer, but the public experience still feels like a CRM/MVP instrumentation prototype:

- Homepage hero copy leads with internal positioning: "Fresh intent first" and "Practical utility before monetization".
- Navigation exposes too many experiment surfaces at once, including `CRM UX` and `Return Credit`, which pulls the brand back into Mehyar Media/admin territory.
- Cards are raw feature/program entries with visible `data-crm-events` semantics in the content structure rather than a polished offer publication architecture.
- Theme exists through CSS variables and `prefers-color-scheme`, but there is no explicit user theme toggle, no persisted choice, and no premium visual system beyond rounded cards and warm colors.
- Generated trend pages have decent compliance scaffolding and canonical/OG basics, but they read as operational proof pages: "Google Trends powered offer map", "CRM proof events", "future audience-proof metrics", "MehyarSoft setup lead".
- Daily trend automation exists via `npm run spg:trends:daily`, but content is generated as thin lane pages with repeated structure and limited editorial depth.

## Target brand direction

Position StuffPrettyGood as a standalone premium offer discovery brand:

"Minimal, trustworthy recommendations for useful tools, products, and practical upgrades — updated daily, with no fake reviews or dark patterns."

Design attributes:

- Premium minimalist, not dashboard/admin.
- Editorial commerce, not CRM prototype.
- Dark/light first-class theme with an explicit switcher.
- Broad offers/articles: AI tools, home, work, travel, wellness, pet tech, savings, kits, and seasonal intent.
- Conversion paths: newsletter/signup, topic preference saves, quizzes/finders, affiliate bridge clicks, and high-intent setup/audit handoffs where appropriate.
- Mehyar Media stays behind the scenes as CRM/compliance/attribution only; it should not appear as public IA or visible sales language except legal/operator references if required.

## Information architecture recommendation

Replace the current crowded homepage/nav with 5 public pillars:

1. Today
   - `/today.html` or homepage section for daily curated offer lanes.
   - Highest momentum picks, editor notes, and "why it is trending".

2. Guides
   - Buying guides and comparison explainers.
   - Examples: AI note takers, walking pads, travel eSIMs, robot vacuums, starter kits.

3. Tools
   - AI/workflow/software utility pages.
   - Keep quizzes and tools-by-job, but present as consumer-facing utility, not CRM lead capture.

4. Deals / Finds
   - Broad offer discovery index.
   - Safe affiliate cards, no copied merchant ratings/prices unless API-approved.

5. Weekly Picks
   - Newsletter/preference signup.
   - Topic choices, cadence, sample issue preview, unsubscribe/disclosure confidence.

Remove from primary nav:

- `CRM UX`
- `Return Credit`
- `Preferences` as a top-level nav item; keep in footer/account/preference center.
- Internal wording like "fresh intent", "surface", "proof events", "activation", "provider gates".

Suggested primary nav:

- Today
- Guides
- Tools
- Deals
- Weekly Picks
- Search icon or compact "Pick my stack" CTA

## Homepage refactor

Recommended homepage sections, in order:

1. Premium hero
   - H1: "Find useful stuff before everyone is yelling about it."
   - Subcopy: "Daily practical picks across tools, gear, home, travel, wellness, and work — curated from trend signals and checked for common-sense usefulness."
   - CTAs: "See today's picks" and "Get weekly picks".
   - Trust line: "No fake reviews. Clear affiliate disclosure. No sensitive data required."

2. Today's signal strip
   - 4-6 compact trend cards with topic, audience, momentum badge, and one plain-language reason.
   - Pull from `trendOfferLanes` but hide raw Google/CRM language.

3. Browse by intent
   - Work smarter
   - Upgrade home
   - Travel lighter
   - Save money
   - Wellness routines
   - Gifts/weekend projects

4. Featured guide layout
   - One large editorial card, two medium cards, 3 small cards.
   - Each card has category, updated date, reading time, disclosure badge if monetized.

5. Interactive utility block
   - "Not sure what to try?" with AI tool stack quiz, savings finder, readiness score.
   - Use conversion copy but avoid over-collecting data.

6. Newsletter/preference signup
   - Topic chips + email + explicit consent.
   - Include sample topics and unsubscribe promise.

7. Disclosure/footer
   - Keep affiliate disclosure visible and plain.

## Design system notes

Use CSS custom properties but formalize them into tokens:

Color tokens:

- `--color-bg`: near-white / near-black
- `--color-surface`: elevated card surface
- `--color-surface-2`: muted alternate section
- `--color-text`: primary
- `--color-muted`: secondary
- `--color-border`: subtle line
- `--color-accent`: premium electric/soft accent
- `--color-accent-contrast`
- `--color-success`, `--color-warning`, `--color-disclosure`

Recommended palette direction:

Light:
- Background: `#f7f4ee` or `#f6f3ed`
- Surface: `#fffdf8`
- Text: `#171717`
- Muted: `#66615a`
- Border: `#ded8cd`
- Accent: `#2f6f68` or `#6f5cff`

Dark:
- Background: `#08090a`
- Surface: `#111315`
- Surface 2: `#171a1d`
- Text: `#f5f2eb`
- Muted: `#aaa39a`
- Border: `#2a2e33`
- Accent: `#8ee6d1` or `#a78bfa`

Typography:

- Keep system sans for performance, but define scale.
- H1 should be less compressed than current `.92` line-height / `-.07em`; use premium editorial spacing: line-height `.96-1.02`, letter spacing `-.05em` max.
- Add article typography: `.prose`, readable widths, h2/h3 rhythm, list spacing.

Layout:

- Use `--container: 1180px`, `--radius-lg: 28px`, `--radius-md: 18px`, `--space-*` scale.
- Reduce giant shadows; use subtle borders, gradients, and stateful hover transforms.
- Add reusable section classes: `.section`, `.section-header`, `.card-grid`, `.feature-grid`, `.offer-card`, `.guide-card`, `.signup-band`.

Theme:

- Add a visible theme toggle in nav.
- Store choice in `localStorage` as `spg-theme`.
- Apply `data-theme="light|dark"` on `<html>`.
- Keep `prefers-color-scheme` as default if no choice exists.
- Add `<meta name="color-scheme" content="light dark">` and theme-color variants or JS update.

Motion/accessibility:

- Add focus-visible styles.
- Respect `prefers-reduced-motion`.
- Ensure contrast on CTA text: current `.button.primary` uses `color: var(--bg)`, which can be risky with mixed themes.
- Mobile nav should trap/close reasonably and not push a long menu over content.

## Conversion sections and instrumentation

Public conversion should feel like user value first; CRM events should stay as invisible attributes and use public naming internally where possible.

Reusable conversion components:

1. Newsletter signup
   - Topic chips, email, consent checkbox, sample cadence.
   - Events: `newsletter_signup_started`, `topic_preference_saved`, `newsletter_signup_completed`.

2. Offer card
   - Category, use case, "why consider it", risk/disclosure badge, CTA.
   - Events: `offer_card_viewed`, `offer_click`, `disclosure_seen`.

3. Buying-guide CTA
   - "Compare current options", "Save this guide", "Get weekly updates".

4. Utility quiz CTA
   - Keep quiz and savings finder, but copy should say "Get matched" not "lead/audit interest".

5. Partner/setup handoff
   - If in-house service is relevant, label neutrally: "Get help setting it up".
   - Only reveal Mehyar/MehyarSoft after explicit service-interest consent or on a dedicated handoff page.

## SEO requirements

Site-wide:

- Add canonical tags to all public pages, not only generated trend pages.
- Add Open Graph and Twitter card tags to all index/guide pages.
- Add `og:image` with a reusable branded share image per section or dynamic generated images.
- Add `robots.txt` and `sitemap.xml`; include generated trend pages and updated dates.
- Add `Article`, `CollectionPage`, `ItemList`, `BreadcrumbList`, and `WebSite/SearchAction` JSON-LD where appropriate.
- Add `dateModified`/`datePublished` to guide/article JSON-LD.
- Keep affiliate disclosure visible near monetized links and in footer.
- Do not publish copied Amazon price/rating/review/image/availability data unless using compliant API permissions.
- Avoid YMYL/medical claims on wellness lanes; use "may help users compare" language, not outcomes.

Trend/content pages:

- Replace generic generated copy with a template containing:
  - intro summary
  - who it is for
  - what to check before buying/signing up
  - common alternatives
  - current related searches
  - safe CTA block
  - updated date
- Convert "Google Trends signal" to user-facing "Trending now" or "Search interest is rising".
- Add breadcrumbs: Home > Today/Guides > Lane.
- Add internal links from each lane to adjacent categories and utility pages.
- Add noindex guard for thin pages if a lane lacks enough content fields.

## Reusable component approach

Current duplication exists in `scripts/build-spg-trend-pages.mjs` where nav, footer, cards, forms, and base page are template strings in one file. Refactor toward a small static component library:

Suggested structure:

- `src/spg/site/tokens.js`
- `src/spg/site/layout.js`
  - `basePage`, `nav`, `footer`, `skipLink`, `breadcrumbs`
- `src/spg/site/components.js`
  - `hero`, `sectionHeader`, `offerCard`, `guideCard`, `signupForm`, `trendSignalCard`, `disclosureBox`
- `src/spg/site/seo.js`
  - `absolute`, `metaTags`, `jsonLdArticle`, `jsonLdCollection`, `breadcrumbsJsonLd`
- `src/spg/site/content-model.js`
  - normalized guide/lane/offer schemas
- `scripts/build-spg-site.mjs`
  - orchestrates homepage, today hub, trend lanes, guide pages, go pages, sitemap.

Benefits:

- Homepage and trend pages share the same premium brand shell.
- SEO and disclosure rules become harder to forget.
- Mehyar Media CRM events remain data attributes but are not public copy.
- Daily automation can populate content safely without making pages feel machine-generated.

## Daily auto-populated content direction

Keep the existing daily command, but extend output quality:

1. Fetch trends.
2. Normalize lanes into a content model with:
   - category
   - audience
   - intent
   - offer type
   - risk level
   - updated timestamp
   - recommended article template
   - internal links
   - monetization eligibility
3. Build:
   - homepage/today modules
   - `/today.html`
   - `/trends/{slug}.html`
   - `/guides/{slug}.html` for lanes with enough evergreen content
   - `/go/{slug}.html` bridge pages
   - `sitemap.xml`
4. Run content QA:
   - title/description length
   - missing canonical
   - forbidden claims
   - missing disclosure near monetized links
   - thin content threshold
   - no raw PII fields in markup/events
5. Run tests.

## Immediate implementation steps

1. Remove public CRM/admin framing from homepage nav and copy.
2. Add explicit theme toggle and `data-theme` CSS path.
3. Create shared site shell/components so generated trend pages and homepage match.
4. Update trend generator copy to premium editorial language.
5. Add sitemap/robots generation and complete metadata for homepage/static pages.
6. Add homepage sections for Today, Browse by Intent, Featured Guides, and Weekly Picks.
7. Add tests for SEO/disclosure/theme basics.
8. Keep Mehyar Media references out of public copy except compliance/legal contexts.

## Acceptance criteria for the refactor

- Public homepage does not mention CRM, proof events, provider gates, activation, or MehyarSoft/Mehyar Media as product copy.
- Primary nav has no admin/prototype pages.
- User can switch dark/light mode and preference persists.
- Generated trend pages use the same premium shell as the homepage.
- Every public page has title, description, canonical, OG basics, and disclosure if monetized.
- `npm run spg:trends:daily` still builds daily content and passes tests.
- No deployment is performed as part of this refactor.
