# Image-First Product Sort

**Rule:** On every page that lists or recommends products, products with an
approved real image render **before** products that only have the generated SVG
fallback art.

## How "has image" is computed

Stored as a boolean `has_image` on each product in `data/products.json`.

```
has_image = image_status ∈ {
  "sitestripe",         # Amazon SiteStripe embed captured via import-sitestripe.mjs
  "approved_real",      # human-approved real product photo (manual)
  "merchant_feed",      # from an approved merchant data feed
  "paapi",              # Amazon Product Advertising API image
  "licensed",           # paid/royalty-free licensed imagery
  "site_verified"       # other verified sources
}
```

Default `image_status = "generated_original_placeholder"` → `has_image = false`.

## Where the sort applies

Every product list built from `data/products.json` is sorted
`has_image DESC, <existing sort>` so that:

- The auto-generated SVG fallback remains the visual default.
- The moment a real image is attached (`image_status` flipped), the product
  jumps to the top of every list automatically.
- Build output is deterministic and idempotent — re-running `npm run build`
  with the same input produces the same page order.

### Build-time surfaces (static `dist/`)

| Path | Function in `scripts/build.mjs` | Sort applied |
|---|---|---|
| `/` home | `filtered(route).slice(0, 12)` | yes |
| `/gift-finder/`, `/starter-kits/`, `/useful-finds/` | `recommend()` | yes |
| `/under-25/`, `/under-50/`, `/walmart/` | `filtered(route).slice(0, 12)` | yes |
| `/tech/`, `/kitchen/`, `/travel/`, `/pets/`, `/home-office/`, etc. | `filtered(route)` | yes |
| `/products/:id/` (single product) | direct lookup | n/a |
| `/guides/:slug/` (story posts) | `products.filter(...)` | yes |
| Sitemap (`/sitemap.xml`) | product URLs in `urls` list | yes |
| `/go/:id/` (outbound redirect pages) | one per product, full set | yes |

### API-time surfaces (Cloudflare Worker)

| Endpoint | Handler | Sort applied |
|---|---|---|
| `GET /api/catalog` | `workboard_cards.api_catalog` | yes |
| `POST /api/recommend` | `recommend()` in `build.mjs` (also served via API) | yes |
| `POST /api/chat` | AI helper (`/ask-spg` widget) | yes — image-first added to candidate pool |
| `GET /products/:id` | direct lookup | n/a |
| `POST /api/curation/run` | adds new products | n/a (writes only) |

## Implementation notes

- The sort key is the boolean `has_image` plus the existing primary sort
  (score, category, etc.). It never **replaces** business ordering — only
  **promotes** within ties.
- New products added by `npm run curate:daily` get `has_image: false` by
  default. When SiteStripe imports land via `import-sitestripe.mjs`, the
  importer must flip `image_status` and the build will re-sort automatically.
- The AI helper (`build.mjs:174-225`) injects `products` into `spg-ai-catalog`.
  The sort runs before injection, so the AI's "show me the first 4 picks"
  query result also comes from the promoted order.

## How to verify

```bash
cd /home/openclaw/repos/stuffprettygood.com
npm run build
# inspect dist/index.html — first card should have data-has-image="true"
# once any product gets a real image attached.
```

Currently 0 of 155 products have `has_image: true` — so the sort is a no-op
today but will activate the moment a single SiteStripe import lands. That is
intentional: shipping the sort now means we don't need a coordinated deploy
later.

## Rollout plan

1. **Today (this PR):** data layer + build sort + API sort, all behind the
   same `has_image` flag. No visible change to visitors yet.
2. **When SiteStripe imports resume:** first import with a non-empty
   `sitestripe_embed_html` triggers the flip in `import-sitestripe.mjs`.
3. **When PA-API access is granted:** `daily-curate.mjs` (or a sibling
   `paapi-attach.mjs`) flips `image_status` to `paapi` and rebuilds.
4. **Monitor:** check the daily build report at
   `data/reports/latest-curation-run.json` for `real_image_count`.