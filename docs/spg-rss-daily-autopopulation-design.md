# StuffPrettyGood RSS/daily autopopulation design

Status: recommendation only; no deployment or live scheduler changes made.

## Current pipeline inspected

The existing daily SPG trend path is intentionally small and dependency-free:

1. `npm run spg:trends:fetch`
   - Runs `scripts/fetch-google-trends.mjs`.
   - Uses built-in Node `fetch` against SerpAPI Google Trends.
   - Requires `SERP_API_KEY` or `SERPAPI_API_KEY` from the environment.
   - Writes `data/google-trends-snapshot.json` with seed momentum, related queries, generated timestamp, and guardrails.

2. `npm run spg:trends:update`
   - Runs `scripts/update-trend-offers.mjs`.
   - Reads the snapshot and updates `src/spg/trending-offers.js`.
   - Preserves curated lane copy/metadata and only refreshes momentum/latest/related queries for known seeds.

3. `npm run spg:trends:build`
   - Runs `scripts/build-spg-trend-pages.mjs`.
   - Generates `public/trends.html`, `public/trends/*.html`, and disclosure-visible `public/go/amazon-*.html` bridge pages.
   - Uses `src/spg/trend-components.js` for Amazon manual search links and the approved tag `mehyarmedia-20`.

4. `npm run spg:trends:daily`
   - Chains fetch -> update -> build -> `npm test`.

5. `scripts/daily-spg-trend-populate.sh`
   - Loads local env from `/home/mehya/.hermes/.env` if present.
   - Runs the daily npm command, writes `.ops-logs/spg-trends-daily-*.log`, reports whether files changed, and does not deploy.

Package constraints: `package.json` has no runtime or dev dependencies and requires Node >=20. The safest RSS design should keep this constraint unless an explicit parser dependency is approved.

## Safety guardrails to preserve

Hard blocks:

- No external posting, social publishing, email send, SMS send, provider push, list export, or audience activation.
- No scraping prohibited merchant content.
- No Amazon scraping and no PA-API unless separately approved and credentialed.
- No copied merchant prices, images, ratings, reviews, availability, product descriptions, claims, or discount assertions.
- No raw secrets, API keys, raw PII, or contact identifiers in public files, logs, docs, generated JSON, or browser events.
- No claims that RSS/news/trends prove quality, best ranking, savings, safety, health outcomes, endorsement, or availability.

Allowed scope:

- Fetch public RSS/Atom feeds whose terms allow reading/summary for editorial discovery.
- Store metadata and short source excerpts only where allowed; prefer title/link/source/date/category over full article bodies.
- Generate original StuffPrettyGood article/offer briefs with visible source attribution and affiliate disclosure.
- Route commerce through existing `/go` bridge pages or reviewed direct program pages only.
- Use generated content on-site only after tests pass and human review gate is satisfied.

## Recommended architecture

Add a parallel RSS input stage that produces a normalized JSON packet, then merge that packet into article/offer candidates before the existing static build.

Proposed flow:

1. Source registry
   - File: `data/spg-rss-source-registry.json`.
   - Fields per source:
     - `id`
     - `name`
     - `feed_url`
     - `homepage_url`
     - `category`
     - `allowed_use`: `metadata_only`, `short_excerpt`, or `original_summary_only`
     - `terms_url`
     - `robots_or_terms_notes`
     - `risk`: `low`, `medium`, `blocked`
     - `enabled`
     - `reviewed_at`
     - `owner`
   - Only `enabled: true` and non-blocked sources are fetched.

2. Fetch/normalize RSS JSON
   - Script: `scripts/fetch-spg-rss.mjs`.
   - Output: `data/spg-rss-snapshot.json`.
   - Use only Node built-ins: `fetch`, `URL`, and lightweight XML extraction functions.
   - Avoid adding `rss-parser` unless feed edge cases become unmanageable.
   - Normalize both RSS `<item>` and Atom `<entry>` into:
     - `source_id`
     - `source_name`
     - `category`
     - `title`
     - `url`
     - `published_at`
     - `author` if present and safe
     - `summary_excerpt` capped to a conservative length only if source allows it
     - `terms_allowed_use`
     - `matched_lanes`
     - `risk_flags`
     - `fetched_at`
   - Drop query strings known to contain tracking identifiers where possible, but do not alter canonical publisher URLs if that would break attribution.

3. Candidate scoring/filtering
   - Script: `scripts/update-spg-rss-candidates.mjs`.
   - Inputs: `data/spg-rss-snapshot.json`, `src/spg/trending-offers.js`, optional denylist.
   - Output: `data/spg-rss-candidates.json` or `src/spg/rss-content-candidates.js`.
   - Match feed items to existing trend lanes via lane seed, slug keywords, related queries, and allowed category tags.
   - Reject or quarantine:
     - blocked source status
     - high-risk regulated topics not already approved
     - copied merchant/product pages where terms are unclear
     - titles containing prohibited claims that cannot be safely rewritten
     - content requiring login/paywall/private access
     - feed entries with suspicious URLs, secrets, or PII-like values
   - Keep only a small number per lane/day to avoid noisy autopopulation.

4. Generate on-site article/offer modules
   - Script: extend `scripts/build-spg-trend-pages.mjs` or add `scripts/build-spg-rss-pages.mjs`.
   - Recommended generated files:
     - `public/trends/daily.html` for the daily digest hub.
     - Optional `public/trends/daily/YYYY-MM-DD.html` archive only after indexing policy is decided.
     - Optional lane modules embedded on existing `public/trends/{lane}.html` pages.
   - Content rules:
     - Generated copy must be original commentary, not copied feed body text.
     - Show source name and link for attribution.
     - Use language like “worth watching,” “source signal,” and “editorial discovery,” not “best,” “verified,” “deal,” or “guaranteed.”
     - Commerce CTAs should point to existing reviewed `/go` bridges or preference forms, not directly to merchants unless that route is approved.

5. Daily integration
   - Add scripts after implementation:
     - `spg:rss:fetch`: `node scripts/fetch-spg-rss.mjs data/spg-rss-source-registry.json data/spg-rss-snapshot.json`
     - `spg:rss:update`: `node scripts/update-spg-rss-candidates.mjs data/spg-rss-snapshot.json data/spg-rss-candidates.json`
     - `spg:rss:build`: `node scripts/build-spg-rss-pages.mjs`
     - `spg:daily`: `npm run spg:trends:fetch && npm run spg:trends:update && npm run spg:rss:fetch && npm run spg:rss:update && npm run spg:trends:build && npm run spg:rss:build && npm test`
   - Keep the existing `spg:trends:daily` intact initially for rollback safety.
   - Update `scripts/daily-spg-trend-populate.sh` only after RSS scripts/tests exist; include RSS data/public paths in its `git diff --quiet` review list.

## Tests to add

Add Node test coverage before daily integration:

1. Source registry contract test
   - Every enabled source has URL, terms notes, allowed use, reviewed date, owner, and non-blocked risk.
   - No source URL is an Amazon product/search page or prohibited merchant scrape target.

2. RSS parser fixture test
   - Parse local RSS and Atom fixtures without network.
   - Confirm normalized schema, URL validity, date handling, dedupe, and excerpt length caps.

3. Safety filter test
   - Fixture items with prices, ratings, “best/#1/guaranteed,” health/finance claims, PII-like strings, and blocked sources are quarantined.

4. Generated page test
   - Daily digest/lane modules include affiliate disclosure, privacy, preferences, unsubscribe links, source attribution, and no copied merchant price/image/rating/review/availability claims.

5. No-outbound invariant test
   - Assert RSS scripts do not call email/SMS/provider APIs, do not create exports, and do not write raw secrets/PII to public files.

## Recommended rollout sequence

1. Add source registry with 5-10 conservative, public, editorial/RSS sources first.
2. Build RSS fetcher against local fixtures and one live manual run.
3. Add candidate scoring with quarantine output; do not generate public pages yet.
4. Add generated daily digest as a reviewed static page.
5. Add tests and run `npm test`.
6. Wire into a new `spg:daily` command while leaving `spg:trends:daily` unchanged.
7. Update daily shell script only after review confirms generated files are safe.

## Initial source policy

Prefer sources such as official affiliate/network blogs, public deal/news/editorial feeds, and brand-neutral commerce trend feeds that provide RSS/Atom and clear attribution paths. Avoid merchant product feeds, pages requiring login, Amazon pages, coupon pages with price/availability claims, sources with unclear reuse terms, and anything that would require scraping HTML instead of reading RSS/Atom.

## Operational recommendation

Treat RSS as “discovery plus original synthesis,” not autopublished merchant content. The daily job can automatically fetch, normalize, score, quarantine, and generate draft/static modules, but public release should remain gated by tests plus human diff review until there is enough source-policy confidence.
