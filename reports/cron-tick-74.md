# spg-improve-loop · tick 74

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane B #11 — flip og:type from "website" to "article" on guide pages so social unfurls and AI crawlers see the same graph shape the Article JSON-LD + article:author/published_time already declare. Single regex rewrite, mirrors Lane B #9 (t73) shape, no IIFE/SW/CSS.
✅ DONE:
- scripts/build.mjs:1555 — inside the existing `if (/^guides\//.test(route))` block, added one `.replace()` that flips `<meta property="og:type" content="website">` → `og:type=article` + emits `article:section=<post.category>` + `article:tag=practical finds`. No changes outside the guide-route block.
- `node scripts/build.mjs` regenerated 10/10 guide HTMLs + sitemap.xml (build-regen side effect, pitfall #84)
- All 10 guides now ship `og:type=article` + `article:section=<semantic category>` (`under-25`, `under-50`, `home-office`, `kitchen`, `travel`, `tech`, `pets`, `small-apartment`, `car`, `desk-upgrades`)
- Wrangler deploy `b28c979e.stuffprettygood.pages.dev` (852 files, 11 new)
🧪 TESTED:
- Offline `python -c` walker: 10/10 guides have `og:type=article` + `article:section` + `article:tag` present; 0/0 non-guide pages accidentally got the article markers (home/category/products/stories all still `og:type=website`)
- Live preview `curl -A "Mozilla/5.0" https://b28c979e.stuffprettygood.pages.dev/guides/best-useful-gifts-under-50/` returns the 3 expected meta tags
- Live preview home `https://b28c979e.stuffprettygood.pages.dev/` still `og:type=website` (correctly untouched)
- `node --check scripts/build.mjs` exit 0
- `node scripts/validate.mjs` exit 0 (155 catalog records, 155 product pages)
📊 RESULTS:
- Commit: `d250ed8fec5467c2af7553580ffe9c350a6f6a0e`
- CF Pages deploy: `b28c979e.stuffprettygood.pages.dev`
- Diff: +10/-0 in scripts/build.mjs (the new .replace call), 10 guide HTMLs rebuilt, sitemap.xml lastmod bumped
🔗 LINKS:
- Live: https://stuffprettygood.com/guides/best-useful-gifts-under-50/ (cache-bust ?cb=$RANDOM; if custom-domain still serves t73 HTML after 30s, preview URL is authoritative per pitfall #33)
- Preview: https://b28c979e.stuffprettygood.pages.dev/guides/best-useful-gifts-under-50/
- Commit: `d250ed8fec5467c2af7553580ffe9c350a6f6a0e` (pushed via git push)
🧠 MEMORY: Lane B pattern family index updated — Lane B #11 (article-og-type) shipped. Future candidates remaining: per-page theme-color is already done (t20+); `apple-itunes-app` skipped (no native app); `og:locale:alternate` and `<link rel="alternate" type="application/rss+xml">` (RSS feed) are next-up.