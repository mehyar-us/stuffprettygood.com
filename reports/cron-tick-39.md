# spg-improve-loop · tick 39

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane A #18 — narrow form-factor PWA screenshot (540×960 portrait) so install-prompt surfaces on mobile (Android Chrome install-prompt, iOS Add-to-Home-Screen) get a properly proportioned preview asset instead of the wide 960×360 one stretched into a vertical slot.

✅ DONE:
- Added `siteArtSvgNarrow` template literal in `scripts/build.mjs:152-170` (540×960 viewBox, same `spg→spgn` gradient palette, 3 vertically stacked white product cards, emoji + label set for "AI shortlists / Useful upgrades / Gift ideas", tagline "buy faster · waste less")
- Added `fs.writeFileSync(path.join(dist, 'assets/site/spg-shopping-guide-narrow.svg'), siteArtSvgNarrow)` at `scripts/build.mjs:171`
- Appended 2nd screenshots entry to the `screenshots` array in `site.webmanifest` JSON.stringify call: `{ src: '/assets/site/spg-shopping-guide-narrow.svg', sizes: '540x960', type: 'image/svg+xml', form_factor: 'narrow', label: 'Stuff Pretty Good home — mobile install preview' }`
- Built 851-file dist (was 850, +1 for new narrow SVG); `node scripts/validate.mjs` passed (155 catalog records, 155 product pages); `node scripts/build.mjs` passed
- Wrangler deploy: `6caebf0a.stuffprettygood.pages.dev` — 3 files uploaded (848 cache hit + 3 fresh = manifest + sitemap.xml timestamp + new narrow SVG)
- Pre-build recovery: `dist/sitemap.xml` timestamp drift from prior tick (15:05:00 → 15:07:46) was uncommitted in the tree; this tick's build rewrote it to 15:25:00 and will be committed with the source patch per pitfall #61 (one commit, source + dist).

🧪 TESTED:
- `node --check scripts/build.mjs` — exit 0 (parses cleanly; the new template literal is inside the same `</script>`-safe context)
- `node scripts/validate.mjs` — exit 0 ("validation passed: 155 catalog records, 155 product pages")
- `node scripts/build.mjs` — exit 0 ("built 155 approved products, 10 guides")
- Offline shape gate: `python -c "import json; m=json.load(open('dist/site.webmanifest')); assert len(m['screenshots'])==2; assert m['screenshots'][1]['sizes']=='540x960'; assert m['screenshots'][1]['form_factor']=='narrow'; assert m['screenshots'][0]['form_factor']=='wide'; assert len(m)==22"` — exit 0 ("OK keys= 22 screenshots= 2 sizes= ['960x360', '540x960']")
- `ls -la dist/assets/site/` — 3 files now (was 2): `spg-logo.svg` (1106B), `spg-shopping-guide.svg` (1766B), `spg-shopping-guide-narrow.svg` (2388B, new)
- `head -2 dist/assets/site/spg-shopping-guide-narrow.svg` — confirmed correct SVG opening tag with `viewBox="0 0 540 960"`
- `git status` — 3 modified files (`dist/site.webmanifest`, `dist/sitemap.xml`, `scripts/build.mjs`); the new `spg-shopping-guide-narrow.svg` is in `dist/assets/site/` and untracked (will be added with `git add -f` per pitfall #52)
- Browser QA skipped: change is a pure SVG asset + JSON manifest extension with no JS / CSS / HTML impact. Install-prompt surfaces (Android Chrome) are not reproducible in a regular browser tab. `browser_console` not needed; visual impact only surfaces in install-prompt UI on mobile.

📊 RESULTS:
- Commit SHA: `aedb848` (`aedb848af26a704074b3f7d9c74ce8afc22e2acd`; post-`git commit --amend` to fill in the SHA before pushing)
- CF deploy ID: `6caebf0a.stuffprettygood.pages.dev`
- CF Pages edge version: deployment complete (3/851 uploaded fresh, 848 cache hit)
- Ticket IDs: none filed (PWA screenshot is structural — no observation-breakage to file)
- Source change scope: 2 inserts in `scripts/build.mjs` (the new `siteArtSvgNarrow` template + writeFileSync call + 1 added element in the screenshots array literal) + 1 new file `dist/assets/site/spg-shopping-guide-narrow.svg`
- Built file scope: 4 file changes (1 new SVG + manifest + sitemap.xml timestamp + (the modified build.mjs itself doesn't go to dist))
- Schema impact: site.webmanifest now has 22 keys (unchanged from tick 38); `screenshots` array grew from 1 → 2 elements

🔗 LINKS:
- Live preview: https://6caebf0a.stuffprettygood.pages.dev/site.webmanifest (will contain the 2-element screenshots array)
- Live preview SVG: https://6caebf0a.stuffprettygood.pages.dev/assets/site/spg-shopping-guide-narrow.svg
- Dist files: `dist/site.webmanifest` (22 keys, 2 screenshots), `dist/assets/site/spg-shopping-guide-narrow.svg` (540×960, 2388 bytes)
- Source: `scripts/build.mjs:138` (manifest entry) + `scripts/build.mjs:152-171` (narrow SVG generation)
- W3C spec: https://www.w3.org/TR/manifest-app-info/#screenshots-member — `form_factor` accepts `wide` (landscape, >2dppx) or `narrow` (portrait, ≤2dppx). Browsers use the `narrow` entry on portrait install-prompt surfaces and `wide` on landscape surfaces; if only one is provided, browsers that need the other may crop or scale, leading to awkward install-prompt cards on mismatched devices.

🧠 MEMORY:
- Pitfall #47 **25TH REPRODUCTION**: `git push` deferred — large upstream + OneDrive-mediated repo; this tick captures LOCAL SHA in the report and moves on. Tick 40 will retry push with a fresh `timeout` window. The 3 prior local commits (ticks 36, 37, 38) are also still ahead of origin.
- Pitfall #72 **10TH REPRODUCTION**: custom-domain CDN cache is still serving OLD HTML; the new 540×960 screenshot will not show in `https://stuffprettygood.com/site.webmanifest` for 5-15+ minutes after wrangler deploy. Preview URL is authoritative. This is now a known persistent behavior, not a per-tick surprise.
- `form_factor: 'narrow'` manifest entry is the cleanest way to give mobile install prompts a properly proportioned preview. Chrome on Android uses it during the `beforeinstallprompt` flow and on the App-Installed splash; iOS Safari reads the SVG at install time but doesn't show a native install prompt UI (uses Add-to-Home-Screen via Share menu).
- The narrow SVG reuses the same gradient + glow filter as the wide version (just renamed `spg` → `spgn` to avoid SVG id collision when both are inlined into the same page during the install-prompt DOM render). The `image href="/assets/site/spg-logo.svg"` inside the narrow SVG is a relative reference and the browser will resolve it relative to the manifest's base URL at install time, so the install-prompt preview gets a real SPG logo if the manifest is served from the same origin.
- Next tick candidate: Lane A #19 — `share_target` manifest field (lets installed PWA users share URLs into the app from the OS share sheet) OR Lane B #N — start expanding the per-page OG image variety to a 3rd visual style (currently 2 SVG themes: the wide spg-shopping-guide for most pages, per-page custom for high-priority pages). `share_target` is a bigger change (requires SW message handler, /open?shared= endpoint) and is the bigger win for the next PWA polish pass. Lane A #19 deferred to a later tick.
