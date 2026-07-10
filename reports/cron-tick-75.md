# spg-improve-loop · tick 75

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane B #12 — RSS 2.0 feed at `/feed.xml` covering the 10 `/guides/<slug>/` buying guides, newest-first by modified_at, with full autodiscovery + canonical /guides/ links. 4th win in the "meta extension + new dist file" Lane B pattern family (after Twitter t44, format-detection t45, og:site_name+locale t49). Money angle: gives omni a clean source-of-truth feed for the planned weekly-picks digest broadcast the moment Resend comes online (`t_4ebe9ce2` still blocked on RESEND_API_KEY).
✅ DONE:
- scripts/build.mjs:1516 — single regex-add `<link rel="alternate" type="application/rss+xml" title="Stuff Pretty Good — Buying Guides" href="/feed.xml">` to the layout() head template, right after `<link rel="manifest">`. 188/188 non-`/go/` pages now autodiscover the feed for RSS readers (Feedly, NetNewsWire, Inoreader, Feedbin, etc.).
- scripts/build.mjs:2666 — new `_spgFeedItems` + `_spgFeedLastBuild` writer emits `dist/feed.xml` with one `<item>` per post in `data/posts.json`, sorted newest-first by `modified_at`. Each item carries title, link (canonical `/guides/<slug>/`), `guid isPermaLink="true"`, `pubDate` (UTC, RFC 822), `<description><![CDATA[…]]></description>` (capped at 280 chars from `post.intro`), `<author>noreply@stuffprettygood.com (post.author || "Stuff Pretty Good Editorial")</author>`, `<category>post.category</category>`. RSS 2.0 with `xmlns:atom` and an `<atom:link rel="self">` so feed validators pass.
- scripts/build.mjs:2654 — `robots.txt` gains a 2-line comment block noting the RSS feed exists (autodiscovery is per-page via the `<link>` tag; comment is for human readers of the file).
- Wrangler deploy `c463ee16.stuffprettygood.pages.dev` (191 files added, 662 already uploaded, 16.21s)
🧪 TESTED:
- Offline `python -c` walker (XML ElementTree):
  - `dist/feed.xml` parses as RSS 2.0 — root tag `rss`, version `2.0`, `<channel>` has `title` + `link` + `description` + `language=en-us` + `lastBuildDate` + `<atom:link rel="self">`
  - Exactly 10 `<item>` elements
  - All 10 items have title/link/guid/pubDate/description/author/category populated; `link === guid`; each `link` starts with `https://stuffprettygood.com/guides/`
  - Sort order verified: first `pubDate` = `Thu, 09 Jul 2026`, last = `Fri, 03 Jul 2026` (newest-first)
- Offline page-walker: 188/188 non-`/go/` pages contain the `<link rel="alternate" type="application/rss+xml">` autodiscovery tag; 0 missing
- `node --check scripts/build.mjs` exit 0
- `node scripts/validate.mjs` exit 0 (155 catalog records, 155 product pages)
- Live preview: `curl -A "Mozilla/5.0" https://c463ee16.stuffprettygood.pages.dev/feed.xml` returns valid XML; same Python ElementTree probe on live response = 10 items, newest-first sort, all fields
- Live preview: `curl -A "Mozilla/5.0" https://c463ee16.stuffprettygood.pages.dev/` returns home page with the RSS autodiscovery link present in `<head>`
- Browser `browser_navigate` on `https://c463ee16.stuffprettygood.pages.dev/guides/best-useful-gifts-under-50/` — page renders normally, no JS errors related to the new tag; `browser_console(expression=...)` confirms the `<link rel="alternate">` element is in the live DOM
- Browser `browser_navigate` on `/feed.xml` — feed renders as XML (expected for non-HTML), all 10 items visible
📊 RESULTS:
- Commit: `e5c3bfecf5f04b325d66ec9ef68867ebf9f16569`
- CF Pages deploy: `c463ee16.stuffprettygood.pages.dev` (191 files uploaded)
- Push: `53eda95d..e5c3bfec  deploy/legal-expansion-and-signup-modal -> origin/deploy/legal-expansion-and-signup-modal` (verified via `git ls-remote origin deploy/legal-expansion-and-signup-modal | awk '{print $1}'` = `e5c3bfec`, `git rev-list --count origin..HEAD` = 0)
- Diff: 192 files / +407 / -378 (1 source patch in scripts/build.mjs + 188 HTMLs + 1 new feed.xml + sitemap.xml lastmod bump + robots.txt comment)
🔗 LINKS:
- Live preview: https://c463ee16.stuffprettygood.pages.dev/feed.xml
- Live preview guide: https://c463ee16.stuffprettygood.pages.dev/guides/best-useful-gifts-under-50/
- Custom domain (still cached at t74, will refresh within 1-6h per pitfall #72/#76): https://stuffprettygood.com/feed.xml
- Commit: https://github.com/mehyar-us/stuffprettygood.com/commit/e5c3bfecf5f04b325d66ec9ef68867ebf9f16569
🧠 MEMORY: Lane B "meta extension + new dist file" pattern family is now 4-deep (Twitter t44, format-detection t45, og:site_name+locale t49, RSS t75). Recipe: (a) one-line regex-add the new `<link>`/`<meta>` to layout() at scripts/build.mjs:1516, (b) one new `fs.writeFileSync` near the sitemap writer at scripts/build.mjs:2666, (c) optional robots.txt touch. Total cost ≈ 18 source lines + 1 new dist file + 188 rebuilt HTMLs (single line change each). No IIFE/SW/CSS. **Parallel-ship with omni:** file a follow-up `OMNI: weekly-picks digest broadcast from /feed.xml via Resend Broadcasts` so the moment RESEND_API_KEY is provisioned the email-list workflow has its source-of-truth. Next Lane B candidates: `og:locale:alternate` (multi-locale), per-page `<link rel="canonical">` audit (already there — verify), `<link rel="alternate" hreflang>` (only when multi-locale lands).