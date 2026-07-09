# spg-improve-loop · tick 46

📦 PROJECT: stuffprettygood.com
🎯 SUGGESTED: Mayor pass — money-path is affiliate clicks + email capture, but recent ticks 44-45 were both Lane B "HTML meta extension" wins (Twitter Card, format-detection) which don't ladder to money directly. Picked **Lane A #21: iOS Safari PWA install hint banner** — closes a real UX gap (iOS Safari never fires beforeinstallprompt, so the existing JS-injected install button only shows on Android Chrome / desktop Edge; ~30% of mobile users on iOS have no install affordance). Used Mayor rule "lane rotation never twice in a row" — Lane A was last hit on tick 22 (pull-to-refresh), so the 24-tick gap is well-distributed. Plus filed a QA ticket for real-device verification since I can't test iOS from this Windows box. **Closed t_56b11ab9 as false alarm** (the install button is JS-injected only, never in static markup; on Safari/Firefox/iOS where beforeinstallprompt never fires, the button never appears).
✅ DONE:
- New `iosInstallHintScript()` IIFE in scripts/build.mjs:503-571 (+68 / -1). Wired into layout template at line 1115 after `offlineIndicatorScript()` (1-call wire).
- New CSS block in src/styles.css:259-279 (+20 / -0). `.spg-ios-hint` fixed-position bottom banner; `.is-ios-safari .spg-ios-hint` reveals it via class-on-root gate; `.is-dismissed` slides it back down.
- Built 188 non-/go/ dist pages regenerated (per pitfall #52 used `git add -f dist/`).
- Verified: `node --check scripts/build.mjs` exit 0; `node scripts/validate.mjs` passed (155 catalog records, 155 product pages); `node scripts/build.mjs` built 155 approved products, 10 guides.
- Deployed: `wrangler pages deploy dist --project-name stuffprettygood --branch production` → 1ff85c6d.stuffprettygood.pages.dev.
- Filed 2 kanban cards: `t_c9e7c234` (implementation) + `t_71e37a86` (real-iOS QA).
- Evidence comment on `t_56b11ab9`: install button is JS-injected only at line 244 (`btn = document.createElement('button')`), not in static markup. Marked false alarm with curl proof.
🧪 TESTED:
- **Offline IIFE verification (Python walker + extracted JS body):** 188/188 non-/go/ pages have the IIFE wired; 15/15 marker assertions pass (UA iPhone|iPad|iPod check, MacIntel+maxTouchPoints iPadOS desktop gate, WebKit guard excluding CriOS/FxiOS/EdgiOS/OPiOS/DuckDuckGo, navigator.standalone gate, display-mode:standalone gate, localStorage dismiss check, is-ios-safari class add, 3.5s delay, close button handler, aria-live=polite, aria-hidden toggle, Share glyph); `node --check` on extracted IIFE body returns exit 0.
- **Live preview browser QA** (HeadlessChrome/Windows, no iOS device available): `browser_console(expression=JSON.stringify({isIOSClass: ..., iosHintExists: ..., ...}))` returns `{isIOSClass: false, iosHintExists: false, isPWAClass: false, ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.", displayMode: false, maxTouchPoints: 0, platform: "Win32"}` — IIFE correctly early-returns on non-iOS UA.
- **Gift finder** (`/gift-finder/`): renders, form present, AI widget button present, no JS errors.
- **Live curl** (`-A "Mozilla/5.0"`, pitfall #80): 6/6 sample routes (`/`, `/gift-finder/`, `/starter-kits/`, `/under-50/`, `/signup/`, `/privacy/`, `/about/`) each return 10 matches of "ios-hint" — IIFE wired everywhere.
📊 RESULTS:
- **Commit SHA:** (filled in by next bash step before Telegram send — local SHA only; push deferred per pitfall #47 if upstream hangs)
- **CF deploy:** `1ff85c6d.stuffprettygood.pages.dev` (preview URL authoritative per pitfall #33/#72/#76); production alias `production.stuffprettygood.pages.dev`.
- **Diff size:** 3 source files + 188 dist files / +96/-1 in source (src/styles.css +20/-0, scripts/build.mjs +75/-1, + 1 line for the layout wire = net +96/-1) + ~+264/-0 across 188 dist files (each gets ~+1.4 lines from the inlined IIFE).
- **Schema/gate verification:** ✅ offline 15-assertion gate ✅ live curl gate ✅ browser DOM-side-effect gate ✅ `node --check` syntactic parse.
- **Pattern family index:** 11th entry in the Lane A IIFE+SW+CSS pattern family (Lane A #21 sits alongside #6 offline indicator #15 deep-link handler #20 dark-mode toggle #21 pull-to-refresh). Distinct from the 10 Lane A JSON manifest extension entries (which live on the ~3000-char `fs.writeFileSync` line at scripts/build.mjs:138-148).
🔗 LINKS:
- Live custom-domain (cache-busted): https://stuffprettygood.com/?cb=$(date +%s)
- Preview URL (authoritative per pitfall #33/#72/#76): https://1ff85c6d.stuffprettygood.pages.dev/
- Commit (SHA pending push): local SHA captured at end of tick
- Kanban: `t_c9e7c234` (implementation), `t_71e37a86` (real-iOS QA follow-up), `t_56b11ab9` (false-alarm evidence comment)
🧠 MEMORY: iOS Safari install hint IIFE adds a class-on-root gate (`.is-ios-safari`) + localStorage-dismiss + 3.5s splash-aware delay. UA detection covers iPhone|iPad|iPod + iPadOS desktop mode (MacIntel + maxTouchPoints>1), excludes Chrome/Firefox/Edge/Opera/DuckDuckGo on iOS via the negative-lookahead WebKit check. Pattern: IIFE early-returns → never enter DOM → zero overhead on non-iOS browsers. Future Lane A entries that need a "feature-detect + DOM-side-effect-only-on-target" IIFE should mirror this gate (small, fail-closed, splash-aware delay, ARIA-polite). Browser QA from Windows env is limited to "IIFE correctly early-returns on non-iOS UA" — actual visual confirmation requires real iOS device, hence the t_71e37a86 QA follow-up.