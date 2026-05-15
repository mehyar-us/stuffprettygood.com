# StuffPrettyGood Amazon-first homepage QA

Date: 2026-05-15
Task: t_00f16009

## Acceptance checks

- Direct `/go/amazon-*` links above fold/near top: PASS
  - 3 direct Amazon chips are now rendered inside the hero via `heroAmazonLinks()`.
  - 6 additional direct Amazon cards are rendered in the near-top `amazon-quick-rail` before search/signup/full wall.
  - Programmatic count: 105 `/go/amazon-*` links on homepage; 3 inside hero; 9 before search.
- >=48 image-led offer cards: PASS
  - Programmatic count: 48 `.offer-card.product-card` cards and 48 `.product-image` images.
  - 62 reusable generated `public/assets/offers/amazon-*.svg` assets present.
- Signup/preferences/unsubscribe visible: PASS
  - Navbar includes Preferences, Unsubscribe, Sign up.
  - Signup band and weekly form remain present.
- Dark/light responsive: PASS with screenshot evidence.
  - Mobile, tablet, desktop captured in both light and dark modes.
- Modern cartoon minimalist vibe: PASS
  - Original SPG SVG/cartoon cards and hand-drawn chip styling remain; no copied Amazon images/prices/reviews/ratings.

## Fixes made

- Added reusable `heroAmazonLinks()` to `scripts/build-spg-trend-pages.mjs` so direct Amazon bridge chips sit in the homepage hero.
- Kept existing near-top `amazonQuickRail()` and full 48-card wall generated from the public offer feed.
- Added `.hero-amazon-links` styling in `public/styles.css`.
- Hardened the screenshot QA helper so lazy offer-wall images are eagerly loaded before capture.

## Verification commands

```bash
PATH=/home/mehya/.local/nodejs/node-v22.12.0-linux-x64/bin:$PATH npm run spg:trends:build
PATH=/home/mehya/.local/nodejs/node-v22.12.0-linux-x64/bin:$PATH npm test
python3 qa/spg_homepage_responsive_qa.py
```

Results:

- `npm run spg:trends:build`: PASS; homepageOfferWall=48; amazonTag=mehyarmedia-20.
- `npm test`: PASS; 95/95 node tests.
- Screenshot QA: PASS; screenshots updated under `qa/screenshots/`.

## Key screenshot evidence

- `qa/screenshots/mobile-light.png`
- `qa/screenshots/mobile-dark.png`
- `qa/screenshots/tablet-light.png`
- `qa/screenshots/tablet-dark.png`
- `qa/screenshots/desktop-light.png`
- `qa/screenshots/desktop-dark.png`
- `qa/screenshots/mobile-light-offerwall.png`
- `qa/screenshots/tablet-dark-offerwall.png`
- `qa/screenshots/desktop-dark-offerwall.png`

## Notes

- Initial accidental `npm test` without Linux Node hit the known WSL Windows npm/UNC path quirk and tested Windows files. Re-ran successfully with `/home/mehya/.local/nodejs/node-v22.12.0-linux-x64/bin` prepended.
- Port 3000 was occupied by an unrelated uvicorn process, so screenshot QA used a local static server from `public/` on port 4180.
