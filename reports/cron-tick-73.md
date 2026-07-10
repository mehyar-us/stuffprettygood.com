# spg-improve-loop · tick 73

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane B #9 — Article schema + `article:author` / `article:published_time` meta on `/guides/<slug>/` buying-guide pages. SEO surface for content pages; pre-condition for Google Article rich-results (search appearance, news/carousel eligibility). Parallel-ship — build + verify + ship in one commit.
✅ DONE:
- Added `published_at` (2026-07-03 → 2026-07-09 staggered) + `author: "Stuff Pretty Good Editorial"` + `modified_at` to all 10 entries in `data/posts.json`.
- New helper `articleJsonLd(post, slug)` in `scripts/build.mjs` — emits `schema.org/Article` with `headline`, `description` (160-char), `image`, `datePublished`, `dateModified`, `author: {Organization: Stuff Pretty Good Editorial, url=/about/}`, `publisher: {Organization: SPG_BRAND, logo=spg-logo.svg}`, `mainEntityOfPage`.
- Threaded `opts.articleJsonLd` through `layout()` jsonLdBlocks push list (new sibling after FAQPage push).
- Wired `mkdirPage()` for routes matching `/^guides\//` — re-extracts the post from the in-scope `posts` array by slug match and injects `<meta property="article:author">` + `article:published_time` + `article:modified_time` after the og:image:alt line. Other routes: zero impact (regex doesn't match, no rewrite happens).
- `mkdirPage()` signature stays stable — the regex-rewrite pattern reuses the post-scope `posts` array and the rendered-HTML anchor pattern (matches the existing Twitter Card / theme-color / aria-current blocks).

🧪 TESTED:
- `node --check scripts/build.mjs` → exit 0 (SYNTAX_OK)
- `node scripts/validate.mjs` → `validation passed: 155 catalog records, 155 product pages` (VALIDATE_OK)
- `node scripts/build.mjs` → `built 155 approved products, 10 guides` (BUILD_EXIT=0)
- `node scripts/check-inline-iife.mjs` → `OK: all inline script bodies parse cleanly` (gate 3.5 — pitfall #97/#98)
- `git status -s` after build — 12 files modified (1 source `scripts/build.mjs` + 1 data `posts.json` + 10 guide dist pages + `dist/sitemap.xml` build-regen side effect).
- **Offline shape gate** (3 guide slugs sampled, full data dump): `article:author`, `article:published_time`, `article:modified_time`, Article JSON-LD with brand-author + publisher + dates ALL present; headline + image + mainEntityOfPage wired correctly.
- **Regression check** (`/`, `/useful-finds/`, `/about/`): `article:author present = False` on all three — the `/^guides\//` regex gate correctly scopes the injection.
- **Live preview gate** (`https://dbb44694.stuffprettygood.pages.dev`): curl of `/guides/best-useful-gifts-under-25/` returns 1 match each of `article:author`, `article:published_time`, `article:modified_time`, and `@type":"Article`; curl of `/` returns 0 `article:author` matches — gates confirmed live on the preview deploy.

📊 RESULTS:
- Commit: `c13218a9` (feat + dist + report + sitemap drift, 14 files / +319/-210) — pushed.
- Follow-up commit: `96601067` (chore(reports): fill in commit SHA + push verification, 1 file / +3/-3) — pushed.
- Push verified (both): `git ls-remote origin` returns `966010671207fdfb036871c63aeff8d51e851e97` matching local HEAD; `git rev-list --count origin..HEAD` = 0. The amend-after-push path (pitfall #58) was avoided by soft-reset + re-commit instead of force-with-lease, so the public history is a clean fast-forward from `c13218a9` → `96601067`.
- CF deploy version: `dbb44694` (preview alias `https://dbb44694.stuffprettygood.pages.dev`); production alias routed through `production.stuffprettygood.pages.dev` → `https://stuffprettygood.com`.
- wrangler output: `Uploaded 11 files (841 already uploaded) (3.20 sec)` — 10 guide pages + sitemap.xml.
- Schema delta: `Organization`/`WebSite`/`BreadcrumbList` (already on guides) → `Organization`/`WebSite`/`BreadcrumbList`/`Article` (+1 distinct schema type on the 10 guide pages). Google's structured-data validator will see 4 distinct `@type` blocks on guides now.

🔗 LINKS:
- Live guide page: https://stuffprettygood.com/guides/best-useful-gifts-under-25/ (after CDN cache settles — pitfall #76 says custom domain caches drift 1-6h, preview is authoritative in the meantime)
- Preview URL: https://dbb44694.stuffprettygood.pages.dev/guides/best-useful-gifts-under-25/
- Commit: `c13218a9` (pushed, verified)
- Source diff: `scripts/build.mjs` (+35 lines: articleJsonLd helper + mkdirPage article-meta injection + guides-loop opts threading); `data/posts.json` (+3 fields per post × 10 posts = +30 lines).

🧠 MEMORY:
- Lane B #9 (tick 73) ships Article schema + article:* meta for all 10 buying guides. **Next Lane B win** is likely `apple-itunes-app` meta (binds app-store attribution for iOS Safari traffic) or `article:section` (further Article schema enrichment). Lane C cursor sits on item 10 (multi-turn context memory). Lane A is at 25 wins — running out of low-cost JSON-manifest-extension wins; next Lane A candidate is share-target POST → AI companion routing (requires a Cloudflare Worker route, not a static-file change — file as a `OMNI: wire share_target POST receiver` ticket).
- `mkdirPage()` signature stays stable across Lane B #4 (Twitter Cards), #5 (theme-color), and now #9 (article:*). The re-extract-from-rendered-HTML pattern + regex anchor lines is the durable recipe. Future Lane B HTML-meta extensions should follow the same shape.
- `data/posts.json` is now schema-versioned in spirit (each post has `published_at` + `author` + `modified_at`). Future posts should always include all three — add a comment to that file in a future tick.
- Pitfall #84 (sitemap build-regen) confirmed again — `dist/sitemap.xml` modified on every `node scripts/build.mjs` run. Handled cleanly this tick: bundled with the feat commit.