# spg-improve-loop · tick 35

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane B — Add FAQPage JSON-LD to the 5 category-page routes (`/under-50/`, `/walmart/`, `/home-office/`, `/kitchen/`, `/travel/`) so the AI-search and Google-rich-results surfaces can ingest the canonical "what is this page / how do picks qualify" Q/A pairs. Each route gets 3-4 unique mainEntity questions — no overlap with the gift-finder / starter-kits FAQPage entries added in tick 2.

✅ DONE:
- **Inspected existing JSON-LD wiring (pitfall #12 invariant):** `layout()` at scripts/build.mjs:911-920 picks up `FAQ_JSONLD[route]` from the literal at line 836, pushes it through `JSON.stringify(FAQ_JSONLD[route])` into the page's `<script type="application/ld+json">` block. Org/WebSite/BreadcrumbList/Product all stay site-wide; FAQPage is route-aware. **No layout() change needed** — just extend `FAQ_JSONLD`.
- **Extended `FAQ_JSONLD` literal in scripts/build.mjs:856-909** with 5 new route entries, each with 4 unique mainEntity Question/Answer pairs (`+55/-0` lines, single patch, no indentation drift, no overlap with the gift-finder/starter-kits entries above):
  - `under-50`: "What is SPG's Under $50 page?", "How do you decide what makes the Under $50 list?", "Does Under $50 include the cheapest possible product?", "Can I ask the AI to narrow Under $50 picks for me?"
  - `walmart`: "What is the Walmart-approved picks page on SPG?", "Why filter picks to one retailer like Walmart?", "Is the Walmart page a substitute for the main catalog?", "Are Walmart prices on SPG updated in real time?"
  - `home-office`: "What makes the Home Office picks page worth browsing?", "I already own a laptop and monitor — what would actually help?", "Are these picks suitable for a small desk or apartment?", "Does Home Office overlap with the desk-setup guide?"
  - `kitchen`: "What kind of products are on the SPG Kitchen page?", "Are the kitchen picks suitable for small apartments or dorms?", "Are any of these picks single-use novelties?", "Can I ask the AI which kitchen pick to start with?"
  - `travel`: "What kind of products are on the SPG Travel page?", "I only travel carry-on. Are any of these still useful?", "Do you recommend travel adapters and converters?", "Can the AI build me a travel kit for a specific trip?"
- **Disambiguated scope carefully:** each route's questions reference that route's specific category and constraints (carry-on / small apartment / single-retailer / cheap vs useful), so a search engine reading the schema can tell which page owns which topic.
- **One patch, one source file, one canonical definition site:** every new entry follows the exact `{ '@context', '@type':'FAQPage', mainEntity: [...] }` shape already in the literal. No new helper function needed.
- **Routed the editorial rule:** categories now have a structured-data layer that AI tools and Google's rich-results test can read, with answers that mirror the voice/tone of the rest of the site ("no marketplace doom-scroll" / "no fake hype" / "approved-affiliate" / "weekly rotation") — same vocabulary as the gift-finder and starter-kits Q/A pairs.
- **ONE-commit discipline (pitfall #61):** source + dist + report all land in a single `git add -f dist/ scripts/build.mjs reports/cron-tick-35.md` + ONE `git commit`. Audit gap closed in advance.

🧪 TESTED:
- `node --check scripts/build.mjs` → SYNTAX_OK, exit 0
- `node scripts/validate.mjs` → "validation passed: 155 catalog records, 155 product pages", exit 0
- `node scripts/build.mjs` → "built 155 approved products, 10 guides", exit 0
- `grep -nE "'(under-50|walmart|home-office|kitchen|travel)': \{" scripts/build.mjs` → 5 lines found (861, 871, 881, 891, 901) — every category in the literal at its expected position
- **Offline shape gate** (`python -c` parsing each dist file's JSON-LD blocks):
  - `dist/under-50/index.html`: 1 FAQPage, 4 questions
  - `dist/walmart/index.html`: 1 FAQPage, 4 questions
  - `dist/home-office/index.html`: 1 FAQPage, 4 questions
  - `dist/kitchen/index.html`: 1 FAQPage, 4 questions
  - `dist/travel/index.html`: 1 FAQPage, 4 questions
- **Live preview shape gate** (`curl https://48c4da14.stuffprettygood.pages.dev/<route>/ | python -c`):
  - `/under-50/` (125,729 bytes): 1 FAQPage block, 4 questions ✓
  - `/walmart/` (121,034 bytes): 1 FAQPage block, 4 questions ✓
  - `/home-office/` (125,808 bytes): 1 FAQPage block, 4 questions ✓
  - `/kitchen/` (125,876 bytes): 1 FAQPage block, 4 questions ✓
  - `/travel/` (128,265 bytes): 1 FAQPage block, 4 questions ✓
  - `/signup/` CONTROL (114,741 bytes): 0 FAQPage blocks (router did NOT leak schema into non-target routes) ✓
- **Schema validity:** all 5 FAQPage blocks parse cleanly as JSON; `@context` is the canonical schema.org URL; `@type` is exactly `FAQPage`; each mainEntity Question has a single `name` + a single `acceptedAnswer.text` (no nested arrays, no missing fields).
- **No regression on existing FAQPage surface:** `dist/gift-finder/index.html` and `dist/starter-kits/index.html` still ship their original 4-question and 3-question FAQPage blocks respectively (the patch anchored on the `};` that closes the `starter-kits` entry, so neither earlier entry was touched).

📊 RESULTS:
| | |
|---|---|
| **Tick number** | 35 (Lane B) |
| **Lane** | B (SEO surface — JSON-LD expansion) |
| **Source file** | `scripts/build.mjs` (+55 lines, no removals) |
| **Local commit** | pending — will be 1 source commit + dist + report |
| **CF deploy ID** | `48c4da14.stuffprettygood.pages.dev` |
| **Live preview FAQPage routes** | `/under-50/`, `/walmart/`, `/home-office/`, `/kitchen/`, `/travel/` |
| **FAQPage Q/A pairs added** | 20 (5 routes × 4 questions) |
| **Tickets filed** | none — Lane B clean win, no findings |
| **Sitemap growth** | no new entries (all 5 routes were already indexed from prior ticks) |
| **Manifest** | unchanged (21 keys still intact — Lane A manifest is mature; not touched by Lane B tick) |
| **Custom domain** | edge cache lag continues from prior reproduction streak (pitfall #33). Preview URL `https://48c4da14.stuffprettygood.pages.dev/` is the authoritative deploy proof. |

🔗 LINKS:
- Live preview root: https://48c4da14.stuffprettygood.pages.dev/
- Live preview FAQPage routes:
  - https://48c4da14.stuffprettygood.pages.dev/under-50/
  - https://48c4da14.stuffprettygood.pages.dev/walmart/
  - https://48c4da14.stuffprettygood.pages.dev/home-office/
  - https://48c4da14.stuffprettygood.pages.dev/kitchen/
  - https://48c4da14.stuffprettygood.pages.dev/travel/
- Custom domain cache-buster: https://stuffprettygood.com/?cb=$$

🧠 MEMORY for next-tick-Hermes:
- **Lane B taxonomy confirmed: `dist/index.html` ships exactly `['Organization', 'WebSite']` blocks** (no BreadcrumbList on the home route per design, no FAQPage on home, no Product block — the homepage is intentionally schema-light). Category pages now ship `Organization + WebSite + BreadcrumbList + FAQPage`. Product pages ship `Organization + WebSite + BreadcrumbList + Product`. AI tool pages (`/gift-finder/`, `/starter-kits/`) ship `Organization + WebSite + BreadcrumbList + FAQPage`. Handler pages (`/open/`) ship `Organization + WebSite + BreadcrumbList` only (FAQPage would be misleading for a transient utility route per the same editorial rule).
- **Pitfall #33 still reproducing** — preview URL is durable; custom domain catch-up has been broken >4 hours despite 3 wrangler deploys and 1 Cloudflare API cache-purge. Worth filing a Lane D / devops card on the next tick that touches deployment, per the previous tick's MEMORY.
- **Pitfall #47 push streak** now 20+ ticks (deferred per pitfall #47 ground-truth recipe). Local is 11 commits ahead of origin. Next tick should attempt a fresh `git push` since the slow-upstream window may have settled.
- **Lane A PWA manifest is mature at 21 keys** — no 1-line JSON extensions left. Next feature parity work would be `share_target` (5-10 min, requires a POST handler mirroring the tick-33 `/open/` IIFE pattern); otherwise, lane rotation favors Lane B/C/D.
- **Lane C #7 (LLM call) is awaiting user greenlight** — cursor stays put per tick-34 MEMORY.
- **The 4-F Q/A editorial bar (4 questions per category) felt right** — enough to cover "what is this page" / "how do picks qualify" / "is this just cheap" / "does AI help me shop" without bloating the JSON-LD block. Future Lane B work on remaining category pages (`/pets/`, `/tech/`, `/wellness/`, `/car/`, `/home/`) can mirror this exact 4-question shape.
- **Lane B simple-content win template:** N routes × 4 Q/A pairs = ~11 lines per route in `FAQ_JSONLD` literal, zero new helpers, zero new files, ~3 minutes of build/deploy. Lane B can repeat this for `/pets/`, `/tech/`, `/wellness/`, `/car/`, `/home/` on future ticks without growing `scripts/build.mjs` complexity.
