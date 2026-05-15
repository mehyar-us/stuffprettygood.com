# SPG ProductOps Final Offer Flow QA

Date: 2026-05-15 13:18 EDT
Task: t_f9feb351
Scope: StuffPrettyGood landing + redirect offer flow after LeadFS/WebDev/DevOps gates and WebDev related-offer remediation.

## Executive verdict

STATUS: FINAL PRODUCTOPS PASS — READY FOR ARMAN ACCEPTANCE REVIEW

The routing architecture and buyer-facing offer flow now satisfy the Boss directive: visible offer cards route to owned `/offers/<slug>.html` pages, offer landings use paired `/go/<slug>.html` outbound CTAs, every offer landing includes related offers, live smoke passes, and Amazon redirect bridges preserve `mehyarmedia-20` tag/disclosure evidence where applicable.

Commercial UX is acceptable for this release: SPG is disclosure-forward, readable, responsive, and safer than typical direct-link offer walls. Conversion polish remains a future optimization, not a release blocker.

## Evidence run

### Automated QA

Command:

```bash
npm run spg:qa:offers
```

Result:

```text
SPG offer QA passed: 111 offer cards and 66 offer landing pages verified.
```

Coverage from the enforced script:

- Offer cards contain `/offers/<slug>.html` links.
- Offer cards do not link directly to `/go/<slug>.html`.
- Offer cards do not link directly to known monetized external hosts.
- Offer landings include paired `/go/<slug>.html` CTA.
- Offer landings include disclosure, preferences, unsubscribe, privacy, terms, title, meta description, canonical, and JSON-LD schema.

### Live/local route smoke

Command:

```bash
SPG_LIVE_BASE_URL=https://stuffprettygood.com npm run spg:smoke
```

Result:

```json
{
  "status": "spg_smoke_passed",
  "live_base_url": "https://stuffprettygood.com/",
  "checks": 31
}
```

Live smoke covered homepage, sample offer landings, sample `/go` bridges, preferences, unsubscribe, privacy, terms, affiliate disclosure, robots, and sitemap.

### ProductOps static audit

One-off static audit over `public/**/*.html` after WebDev remediation:

```json
{
  "html_files": 198,
  "offer_pages": 66,
  "go_pages": 74,
  "related_offer_cards": 198,
  "direct_external_card_violations": 0,
  "direct_go_card_violations": 0,
  "missing_offer_card_links": 0,
  "landing_requirement_violations": 0,
  "related_external_violations": 0,
  "related_go_violations": 0,
  "related_non_offer_href_violations": 0,
  "amazon_go_pages": 63,
  "amazon_go_pages_with_tag_or_disclosure": 63,
  "amazon_untagged_routes": []
}
```

Remediated prior blocker: `/offers/amazon-daily-standing-desk-cable-kit.html`, `/offers/mehyarsoft-ai-audit.html`, and `/offers/travel-esim-watchlist.html` now pass the related-offer requirement.

## Screenshot evidence

Screenshots refreshed locally through Playwright against `http://127.0.0.1:4180` after serving `public/`.

Directory:

```text
qa/screenshots/productops-offer-flow-final/
```

Files written: 18

Coverage:

- Homepage offer wall: mobile/tablet/desktop, light/dark
- Sample offer landing: `/offers/amazon-sourdough-starter-kits.html`, mobile/tablet/desktop, light/dark
- Sample redirect bridge: `/go/amazon-sourdough-starter-kits.html`, mobile/tablet/desktop, light/dark

Visual QA notes:

- Homepage mobile dark and desktop light are readable and branded; no blocking overflow or unreadable sections observed in screenshot QA.
- Sample offer landing is attractive enough for final ProductOps acceptance: disclosure is high on page, CTA clearly routes through `/go`, preference/save controls are present, footer compliance links are visible, and the new related-offer rail renders three internal `/offers/` cards.
- `/go` bridge clearly discloses Amazon Associates bridge, avoids copied Amazon content, and exposes the outbound Amazon CTA after disclosure.
- Non-blocking polish remains: the top offer badges still run together (`Approved monetizedNo copied prices/reviewsOriginal SPG art`) in some layouts. This should be cleaned in a later UX polish pass, but it does not break routing, disclosure, compliance visibility, or acceptance for this release.

## Comparison to leading affiliate/offers patterns

Benchmarks checked:

- Wirecutter Deals: strong product-level specificity, price/savings, pick labels, retailer CTA, and expandable “why it’s a deal.”
- Slickdeals: dense deal feed with search, category navigation, price anchors, merchant names, heat/community proof, and comments.

SPG is safer/compliance-cleaner than many offer sites because it forces owned landing + disclosure before outbound routing. It is weaker commercially because most landings still sell the routing/disclosure concept more than the buyer outcome. This is acceptable for the release gate; next monetization iteration should add stronger buyer guidance, category-specific CTAs, multiple monetized options where compliant, and tighter badge/card visual polish.

## Acceptance criteria matrix

| Check | Status | Evidence |
|---|---:|---|
| All visible offer cards/rails route to `/offers/<slug>` | PASS | `npm run spg:qa:offers`: 111 offer cards verified |
| Zero direct external monetized card hrefs | PASS | Automated QA + ProductOps static audit: 0 direct external card violations |
| Zero direct `/go` card hrefs | PASS | Automated QA + ProductOps static audit: 0 direct `/go` card violations |
| Offer pages include disclosure | PASS | `npm run spg:qa:offers` pass + screenshots |
| Offer pages include signup/preferences/unsubscribe | PASS | `npm run spg:qa:offers` pass + screenshots |
| Offer pages include SEO/schema | PASS | `npm run spg:qa:offers` pass |
| Offer outbound CTA uses `/go/<slug>` | PASS | `npm run spg:qa:offers` pass |
| Amazon tag remains in redirect bridge where appropriate | PASS | 63/63 Amazon go pages have `tag=mehyarmedia-20` or visible Amazon disclosure evidence |
| Mobile/tablet/desktop light/dark screenshots | PASS | 18 refreshed screenshots in `qa/screenshots/productops-offer-flow-final/` |
| Offer pages include related offers | PASS | 66/66 offer pages; 198 related-offer cards; 0 external, `/go`, or non-`/offers` related href violations |

## ProductOps decision

ProductOps final QA accepts the SPG landing + redirect offer flow for Arman acceptance review. No remaining ProductOps blocker. Keep the next iteration focused on conversion lift and badge/card visual polish, not release gating.
