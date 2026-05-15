# SPG offer landing redirect WebDev QA

Task: t_c14344e6
Date: 2026-05-15

## Scope verified

- Public offer cards route to `/offers/<slug>.html` before `/go/<slug>.html`.
- Shared offer landing component renders disclosure before outbound CTA.
- Landing CTA routes only to `/go/<slug>.html`.
- Related offers route to `/offers/<related-slug>.html`.
- Landing pages include preference capture, preferences/unsubscribe path, OG image, canonical, and JSON-LD graph.
- Homepage/trend public pages checked for Amazon/SPG direct `/go` card-link violations outside `/offers` and `/go` pages: 0.

## Commands run

```bash
npm run spg:trends:build
npm run spg:qa:offers
npm test
```

Results:

- `npm run spg:trends:build` passed; generated 11 lanes, 40 RSS candidates, 48 homepage offer-wall items.
- `npm run spg:qa:offers` passed; 111 offer cards and 65 offer landing pages verified.
- `npm test` passed; 101/101 tests.
- `npm run build` was attempted first, but this package has no `build` script; canonical SPG build is `npm run spg:trends:build`.

## Screenshot-led QA

Local server: `python3 -m http.server 4180 --directory public`

Captured homepage offer wall, offer landing disclosure, and `/go` bridge across mobile/tablet/desktop in light and dark schemes. Console/page errors: none.

Screenshot directory:

`/home/mehya/work/mehyarmedia/qa/screenshots/offers-audit/`

Representative files:

- `/home/mehya/work/mehyarmedia/qa/screenshots/offers-audit/home-desktop-light-offerwall.png`
- `/home/mehya/work/mehyarmedia/qa/screenshots/offers-audit/offer-mobile-light-landing-disclosure.png`
- `/home/mehya/work/mehyarmedia/qa/screenshots/offers-audit/offer-tablet-dark-landing-disclosure.png`
- `/home/mehya/work/mehyarmedia/qa/screenshots/offers-audit/go-desktop-light-bridge.png`

Visual findings:

- Desktop homepage offer wall is image-led, monetized, and CTAs read “See offer page →” rather than direct merchant/go CTAs.
- Mobile offer landing shows brand/menu, offer title, approved monetized badges, and “Before you click” affiliate disclosure in usable one-column layout.
- Tablet dark offer landing shows disclosure, `/go` CTA, save-lane CTA, and hero image coherently with no dark-mode contrast issue observed.

## Automated route sanity check

```json
{
  "sample_offer_has_before_click_disclosure": true,
  "sample_offer_go_cta_only_internal": true,
  "sample_offer_has_preference_form": true,
  "sample_offer_has_jsonld_graph": true,
  "sample_offer_has_og_image": true,
  "public_non_offer_direct_go_violations": 0
}
```

## Notes for reviewer

- Generated static artifacts changed under `public/offers`, `public/go`, `public/trends`, sitemap, and screenshot files after running the SPG build/QA flow.
- There are pre-existing broader workspace changes outside the WebDev edits (for example durable store/schema/QA artifacts). Review should inspect the full working tree before merge.
