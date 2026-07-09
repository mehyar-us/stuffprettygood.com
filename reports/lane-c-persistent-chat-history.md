# Lane C #8 — Persistent Chat History + "Start New Chat" Reset Button

Tick 51 — Lane C #8 — the 8th cursor-advanced item on the AI companion lane.

## Problem

The AI bubble had two related gaps that made the chat feel disposable:

1. **No persistence across sessions.** Chat history lived in `sessionStorage` under key `spg_ai_session_v1`. Close the tab → conversation gone. Return visitor sees the same greeting every time, even if they asked a great gift question yesterday.
2. **No "start over" affordance.** Once a user got into a long back-and-forth, there was no clean way to clear the panel and start fresh. The only escape was to close the bubble and reopen it — but the history was still there waiting.

## Solution

Two pieces wired into the existing `assistantWidget()` IIFE in `scripts/build.mjs`:

### A. Promote history from sessionStorage → localStorage

- New key: `spg-ai-history:v1` (versioned suffix for forward compat with the Lane A #22 saved-picks `:v1` pattern)
- Backup key: `spg-ai-history-seen:v1` (boolean — tracks whether the user has *ever* opened the bubble)
- Wrap every localStorage read/write in `try/catch` so private-browsing / quota errors don't crash the bubble
- Cap stays at 12 turns (`history.slice(-12)`) — same UX memory ceiling, just persistent
- The seen flag is set the first time `renderHistory()` shows the greeting, so the greeting only appears on the first-ever visit (or after a reset)

### B. New header button — `data-ai-reset`

```html
<button type="button" class="ai-reset" data-ai-reset
        aria-label="Start a new chat" title="Start a new chat">
  <svg viewBox="0 0 24 24" width="16" height="16">…circular-arrow icon…</svg>
</button>
```

Placed between `<button class="ai-share">` and `<button class="ai-close">` in the `.ai-header-actions` flex row. Matches `.ai-share` / `.ai-mic` styling exactly (34×34, ghost, hover-fade to brand orange, focus-visible 3px ring).

Click handler:

```js
function resetHistory(){
  try { localStorage.removeItem(sessionKey); } catch (_) {}
  try { localStorage.removeItem(seenKey); } catch (_) {}
  history.length = 0;                                      // empty the in-memory array
  if (location.hash && location.hash.indexOf('spg=') === 1)
    window.history.replaceState(null, '', location.pathname + location.search);  // strip share-hash
  const shareBtn2 = root.querySelector('[data-ai-share]');
  if (shareBtn2) shareBtn2.hidden = true;                  // no share state yet
  renderHistory();                                         // re-show warm greeting
  haptic(10);                                              // confirm with a tap
}
```

Three deliberate side-effects of the reset:

1. **Strip the URL hash.** If the user is on a `#spg=q=...&p=...` share-replay URL and hits "Start new chat," the hash is cleared so the *next* open won't auto-replay the old question into a freshly-emptied chat.
2. **Hide the share button.** Reset means no Q&A yet, so there's nothing to share. The button re-shows on the first bot response.
3. **Re-show the warm greeting.** `renderHistory()` checks `history.length` (now 0) and emits the welcome card. The seen flag is rewritten so the next open without a reset doesn't re-greet.

### C. CSS — `.ai-reset` rule

Added to the minified inline `.ai-bubble{…}` block in `src/styles.css` (between `.ai-share` and `.ai-header-actions`). One-line swap, no separate rule file. Mirrors `.ai-share` / `.ai-mic` hover / focus / `[hidden]` behavior.

## Verification recipe

```bash
# 1. Offline shape gate (after node scripts/build.mjs)
python -c "
import re
html = open('dist/index.html','r',encoding='utf-8').read()
assert html.count('data-ai-reset') >= 2           # button + JS lookup
assert html.count('class=\"ai-reset\"') >= 1
assert html.count('resetHistory') >= 2            # def + 1 call
assert html.count('sessionKey') >= 4
assert html.count('spg-ai-history:v1') >= 2
assert html.count('spg-ai-history-seen:v1') >= 1
assert html.count('localStorage.removeItem') >= 2
assert 'aria-label=\"Start a new chat\"' in html
print('OK: Lane C #8 markup + IIFE + localStorage swap all present')
"

# 2. Live preview gate (after wrangler pages deploy)
curl -sS -A "Mozilla/5.0" "https://afede3ea.stuffprettygood.pages.dev/?cb=$RANDOM" \
  | grep -oE 'data-ai-reset|ai-reset class|Start a new chat|spg-ai-history:v1|spg-ai-history-seen:v1|resetHistory' \
  | sort | uniq -c
# Expected: each marker present >= 1 (live preview returns the new HTML)

# 3. JS syntax gate
node --check scripts/build.mjs   # exits 0

# 4. Site-wide markup walk
python <<'PYEOF'
import re, os
pages=[]
for root,dirs,files in os.walk('dist'):
    norm=root.replace(os.sep,'/')
    if norm.startswith('dist/go/'): continue
    [pages.append(os.path.join(root,f)) for f in files if f=='index.html']
hits=0
for p in pages:
    html=open(p,'r',encoding='utf-8').read()
    if 'data-ai-reset' in html: hits+=1
print(f'TOTAL: {len(pages)}, with ai-reset: {hits}')
PYEOF
# Expected: TOTAL: 188, with ai-reset: 188 (all non-/go/ pages carry the bubble)
```

Tick 51 case study returned: TOTAL: 188, with ai-reset: 188. Live preview returned: `2 data-ai-reset / 2 resetHistory / 2 spg-ai-history:v1 / 1 spg-ai-history-seen:v1 / 2 Start a new chat`.

## Files touched

| File | Change |
|---|---|
| `scripts/build.mjs` | +51 / -6 (one `ai-reset` button HTML inserted, one IIFE reset-handler block inserted after `bindShare()`, `sessionKey` / `seenKey` const declarations added, `history`/`save`/`renderHistory` rewrites for localStorage) |
| `src/styles.css` | +1 / -1 (one-line swap of the minified `.ai-bubble{…}` selector list to include the `.ai-reset` rule) |
| `dist/<188 pages>` | +47 / -0 per page (auto-regenerated; the new button HTML + reset IIFE + new CSS rule land in every non-/go/ page that renders the assistantWidget) |

Commit: `ea5b7d8` — "feat(ai-companion): Lane C #8 — persistent chat history (localStorage) + Start new chat reset button" (192 files, +8697 / -948 lines).

## Pattern notes

- **localStorage naming convention** — `spg-<feature>:v<N>` keys with the `:v1` suffix. Lane A #22 (tick 48) used the same convention for `spg-saved-picks:v1`. Pattern is now: 3 keys total under this scheme (`spg-saved-picks:v1`, `spg-ai-history:v1`, `spg-ai-history-seen:v1`).
- **Reset button styling** — mirrors the `.ai-share` / `.ai-mic` ghost-pill style exactly (34×34, hover-fade to brand orange, focus-visible 3px ring). All three header buttons share the same `:hover` + `:focus-visible` CSS.
- **IIFE placement** — `resetBtn.addEventListener(...)` lives between `bindShare()` and the saved-picks block in the IIFE. Function declarations (`function haptic()`) hoist, so calling `haptic(10)` from inside the reset handler works even though `haptic` is declared later in the same scope (pitfall #41 reaffirmed).
- **Why not use `sessionStorage.clear()`** — localStorage has a separate namespace from sessionStorage; clearing the wrong one is a footgun. Explicit key removal is clearer about what is being reset.
- **Why strip the URL hash** — a share-replay URL (`#spg=q=…&p=…`) would otherwise auto-replay the old question into the freshly-emptied chat on the next bubble open. Stripping the hash gives the user a true clean slate.

## Future work

- **Cursor advances to Lane C #9.** Next up: per-message feedback (👍/👎 buttons under each bot response). Pattern would mirror `bindFollowups()` — feature-detect for click handlers, wire via delegated event listener on `[data-ai-messages]`, log thumbs to a new localStorage key `spg-ai-feedback:v1`, surface aggregate in dev console.
- **Storage quota bound** — `history.slice(-12)` keeps the JSON under ~10 KB. No need for LRU eviction yet. If users start pasting long URLs that get logged as picks, watch the localStorage usage; add LRU if it crosses 50 KB.
- **Reset confirmation** — currently one-click reset, no "are you sure?" prompt. Intentional: the warm greeting is recoverable; users can just re-ask if they reset by mistake. Adding a confirm dialog would add friction without much benefit.