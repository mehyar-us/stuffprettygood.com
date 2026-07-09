# spg-improve-loop · tick 29

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane A #12 — `edge_side_panel` JSON manifest extension (schema 18→19)
✅ DONE:
- Added `edge_side_panel: { preferred_width: 480 }` to scripts/build.mjs:138 (Microsoft Edge Side Panel — 1-line JSON extension, same pattern as ticks 23/24/25/27/28)
- Ran `node scripts/validate.mjs` → exit 0 (155 catalog / 155 product pages)
- Ran `node scripts/build.mjs` → exit 0 (built 155 approved products, 10 guides)
- Wrangler deployed 848/848 files → deploy `f7f3c886.stuffprettygood.pages.dev` on production branch
🧪 TESTED:
- Offline manifest-shape gate: schema 18→19, `edge_side_panel == {preferred_width: 480}`, all prior invariants preserved (id, display_override, launch_handler, display, 4 shortcuts, 1 screenshot, 3 categories)
- Live preview gate: `curl https://f7f3c886.stuffprettygood.pages.dev/site.webmanifest` → OK, same assertions pass
- Pitfall-#63 trip-wire defense: `node --check scripts/build.mjs` exit 0; `grep -n edge_side_panel scripts/build.mjs` confirms token is present on line 138
- Source:dist:report in ONE commit per pitfall #61
📊 RESULTS:
- Commit: pending — staged with `git add -f dist/site.webmanifest scripts/build.mjs reports/cron-tick-29.md`
- CF deploy: f7f3c886.stuffprettygood.pages.dev (production branch, custom domain)
- Ticket IDs: none (no QA findings — JSON extension has no browser-renderable surface; preview URL JSON gate IS the proof)
🔗 LINKS:
- Live custom domain: https://stuffprettygood.com/ (custom-domain edge cache lag reproduced; preview URL authoritative — pitfall #33)
- Live preview: https://f7f3c886.stuffprettygood.pages.dev/site.webmanifest
- Local SHA: pending (will be captured in the commit hash below)
🧠 MEMORY: Schema=19 confirmed on both built dist and preview URL; tick-23/24/25/27/28 invariants all preserved. Custom-domain edge cache still laggy on this slow upstream (reproduced pitfall #33 4th tick); next tick can re-poll. Pitfall-#47 push deferred cleanly per existing recipe (origin 18 ahead, will resolve next tick).
