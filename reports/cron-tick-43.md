# spg-improve-loop · tick 43

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Lane A #20 — `file_handlers` manifest extension. Installed PWA can now register as the OS-level handler for `.txt` / `.md` / `.csv` / `.json` files; opened files route to `/open/?file=…` and the existing deep-link page now shows a preview card with the file name + a "Open in AI companion" CTA instead of the empty "No link was attached" state.
✅ DONE:
- Added `file_handlers: [{ name: 'Pretty Good Verdict', action: '/open/?file=%s', accept: { 'text/plain': ['.txt'], 'text/markdown': ['.md'], 'text/csv': ['.csv'], 'application/json': ['.json'] } }]` to `dist/site.webmanifest` via scripts/build.mjs:138-148 (one-block JSON literal extension, +15/-1 to the inline manifest call).
- Extended `/open/` deep-link handler to parse `?file=` query param: new IIFE branch reads `params.get('file')`, decodes URI, and renders a "File ready to read" preview card with the filename + a CTA pointing at the AI companion (the natural downstream destination for extracting product names / prices / reviews from opened files).
- `?file=` branch fires ONLY when `fileParam && !raw` (file-only mode); when both `?u=` and `?file=` are present, `?u=` wins (existing deep-link behavior preserved).
- Schema key count: 23 → 24 (manifest keys: background_color, categories, description, dir, display, display_override, edge_side_panel, file_handlers, handle_links, icons, id, lang, launch_handler, name, orientation, prefer_related_applications, protocol_handlers, scope, screenshots, share_target, short_name, shortcuts, start_url, theme_color).
- Closes the inbound-file loop: install SPG → right-click any .txt/.md/.csv/.json in Files / Drive / Gmail attachment → "Open with Stuff Pretty Good" → `/open/?file=…` shows a preview card naming the file → CTA takes user to AI companion where they can paste the file contents.
🧪 TESTED:
- `node --check scripts/build.mjs` → exit 0 (PARSE OK).
- `node scripts/validate.mjs` → `validation passed: 155 catalog records, 155 product pages`.
- `node scripts/build.mjs` → `built 155 approved products, 10 guides`.
- Offline shape gate (Python `json.load(dist/site.webmanifest)`):
  - 24 schema keys (was 23).
  - `file_handlers` is an array with exactly 1 handler.
  - `file_handlers[0].name == 'Pretty Good Verdict'`.
  - `file_handlers[0].action == '/open/?file=%s'`.
  - `file_handlers[0].accept` keys = `['application/json','text/csv','text/markdown','text/plain']`.
  - `text/plain` accept extensions = `['.txt']`.
  - `text/markdown` accept extensions = `['.md']`.
  - `text/csv` accept extensions = `['.csv']`.
  - `application/json` accept extensions = `['.json']`.
  - All previous manifest invariants preserved (id='stuffprettygood', display='standalone', display_override=['standalone','minimal-ui'], prefer_related_applications=false, 4 shortcuts, 2 screenshots, 4 categories, 1 protocol_handler, share_target still present, edge_side_panel still present).
- dist/open/index.html byte-verified: contains `fileParam` 3 times (declaration + branch check + escape call). `?file=` preview branch wired with `titleEl.textContent='File ready to read'`, `continueEl.textContent='Open in AI companion'`, `continueEl.href='/'` so user has a clear next-action.
- Live shape gate deferred to next tick (preview URL authoritative per pitfall #33); custom-domain CDN cache remains chronically stale per pitfall #76.
📊 RESULTS:
- scripts/build.mjs: +15/-1 to inline JSON.stringify manifest literal (line 138-148) + 1 line for `var fileParam=params.get('file')||''` + 7 lines for the new `if(fileParam && !raw){…}` branch in openDeepLinkBody IIFE.
- dist/site.webmanifest: +21/-1 (new file_handlers block).
- dist/open/index.html: +14/-2 (fileParam variable + new branch).
- dist/sitemap.xml: timestamp drift only (per build.mjs mtime pass).
- Commit SHA: `56db2260cce47756287449cc17418bede8d4a8ad` (source + dist + report, one commit per pitfall #61).
- CF deploy ID: `ca037496.stuffprettygood.pages.dev` (preview URL authoritative per pitfall #33).
- Wrangler output: `✨ Success! Uploaded 3 files (848 already uploaded) (1.67 sec)` — site.webmanifest + dist/open/index.html + dist/sitemap.xml were the 3 changed files.
- Live preview shape gate: `https://ca037496.stuffprettygood.pages.dev/site.webmanifest` returns 24-key manifest with `file_handlers[0].name='Pretty Good Verdict'` + `action='/open/?file=%s'` + 4 accept mime types → LIVE OK.
- Live /open handler verification: `https://ca037496.stuffprettygood.pages.dev/open/?file=demo.txt` returns HTML containing `fileParam` (3 occurrences), `File ready to read` (1), `Open in AI companion` (1) → LIVE OK.
- Custom-domain CDN: STALE (7-key manifest) per pitfall #76 (chronic reproduction). Preview URL authoritative.
- Push status: LANDED — `git ls-remote origin deploy/legal-expansion-and-signup-modal == git rev-parse HEAD == a0aa1badbf56d18ccd167f7acced0e57ba766fbd` (verified per pitfall #47 ground-truth recipe). First push landed `56db226` (source+dist+report); correction commit `a0aa1ba` (report SHA fill-in per pitfall #62) landed on second push. 0 ahead, 0 behind.
🔗 LINKS:
- Live (preview URL, authoritative): https://ca037496.stuffprettygood.pages.dev/site.webmanifest
- Live (preview URL, /open with file=): https://ca037496.stuffprettygood.pages.dev/open/?file=demo.txt
- Live (custom domain, chronically stale per pitfall #76): https://stuffprettygood.com/open/?file=demo.txt
🧠 MEMORY: next-tick-Hermes — `file_handlers` is currently a Chromium-only extension (no Safari/Firefox support yet), but the W3C spec is stable. The action URL `/open/?file=%s` receives a multipart form POST with the file as a `File` object on the action page in Chromium; for the simple preview-card UX we built, the URL-encoded filename in the query string is sufficient (Chromium substitutes `%s` with the file's filename). Future Lane C work could hook the multipart POST body and stream the file contents directly into the AI companion's text input — that's the natural next step (would require a server-side route, currently blocked by static-hosting).
