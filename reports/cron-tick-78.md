# spg-improve-loop · tick 78

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane B #16 — FAQPage JSON-LD on the 5 remaining routes (under-25, pets, tech, useful-finds, stories). 20 unique Q/A pairs across 5 routes. Closes the FAQPage gap on all 12 category/browse routes. Live FAQPage helps Google AI Overviews + Perplexity + ChatGPT browse mode return direct answers.
✅ DONE:
- scripts/build.mjs FAQ_JSONLD dict extended with 5 new route entries: 'under-25', 'pets', 'tech', 'useful-finds', 'stories'
- 4 unique Q/A pairs per route (20 total), grounded in actual page content, no overlap with the 7 already-shipped FAQPage routes (home, gift-finder, starter-kits, under-50, travel, home, kitchen)
- node scripts/build.mjs regenerated dist/<route>/index.html for all 5 routes with FAQPage embedded
- All 5 routes now serve the full schema quintet: Organization + WebSite + BreadcrumbList + ItemList + FAQPage (Stories skips ItemList — magazine feed, not static category)
🧪 TESTED:
- node --check scripts/build.mjs → 0
- node scripts/validate.mjs → validation passed: 155 catalog records, 155 product pages
- node scripts/check-inline-iife.mjs → 3171 inline scripts across 188 dist pages, all parse cleanly
- python shape gate: all 5 routes have 4 Q/A pairs; schema set includes FAQPage
- curl -A "Mozilla/5.0" https://bdef45b5.stuffprettygood.pages.dev/<route>/ | grep -oE '"@type":"[A-Za-z]+"' | sort -u → 12 distinct types per route (5 routes × 12 = full schema set + Question + Answer + sub-types)
- Live preview URL bdef45b5.stuffprettygood.pages.dev verified for under-25, pets, stories (all show FAQPage + Question + Answer in served HTML)
📊 RESULTS:
- Commit: 51bcce9f234f268433260140a57ecbea6c3e732a ("feat(seo): Lane B #16 FAQPage JSON-LD on 5 remaining routes")
- Files changed: 8 (1 source + 7 dist), +251/-194
- Wrangler deploy: bdef45b5.stuffprettygood.pages.dev (853 files uploaded, 0 new — dist in sync with build)
- Push: origin/deploy/legal-expansion-and-signup-modal..HEAD = 0 (push verified)
🔗 LINKS:
- Live URL: https://stuffprettygood.com/under-25/ (and /pets/, /tech/, /useful-finds/, /stories/)
- Preview URL: https://bdef45b5.stuffprettygood.pages.dev/under-25/
- Commit: https://github.com/mehyar-us/stuffprettygood.com/commit/51bcce9f
- Schema reference: https://schema.org/FAQPage
🧠 MEMORY: Lane B #16 pattern complete. The 5 routes added today close the FAQPage gap on every static category/browse page (12/12). Remaining Lane B candidates are HTML-meta extensions (apple-itunes-app, per-page theme-color, article:author) and additional JSON-LD types (HowTo for guides, VideoObject for product demos). Lane B cursor advances to those — file as t_<id> cards before next Lane B tick.
