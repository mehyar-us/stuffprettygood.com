# Browser QA Page Rotation

What to check each tick, how to check it, and where to save the evidence. The `dogfood` skill is the underlying QA workflow; this file is the page-rotation schedule for stuffprettygood.com specifically.

## The 7 pages, ranked

| # | Page | URL | Why | Check every |
|---|---|---|---|---|
| 1 | Homepage | `/` | Highest traffic, first impression, AI bubble visible | Every tick |
| 2 | Signup form | `/signup/` | The 3-fieldset form, TCPA consent, success state | Every tick |
| 3 | AI Gift Finder | `/gift-finder/` | The marquee AI feature | Every other tick |
| 4 | AI Starter Kit Builder | `/starter-kits/` | Second AI feature, more complex input | Every other tick |
| 5 | Category page | `/under-50/` (rotate: `/kitchen/`, `/travel/`, `/tech/`, `/pets/`) | Product grid, image loading, affiliate links | Every third tick |
| 6 | Story lists | `/stories/` | Dynamic content, lazy-loaded | Every fourth tick |
| 7 | Privacy | `/privacy/` | Legal page, TCPA disclosure, signup modal opt-out | Every fifth tick |

Pages 1 and 2 are mandatory every tick. Pages 3-7 rotate so all get covered within a week.

## Per-page checklist

### Homepage (`/`)

```
□ Hero renders with the new copy / design
□ Nav has all 6 links (Gift Finder, Starter Kits, Under $50, Walmart, Stories, Sign up)
□ Story strip loads (the "Loading new story lists…" placeholder should be replaced within 2 s)
□ AI bubble visible bottom-right
□ Footer renders with the affiliate disclosure link
□ browser_console clean (no JS errors)
□ All product images load (not 404, not broken alt)
```

**Click test:** Open the AI bubble. Send "gift under $25". Verify the response is in the message list. Close the bubble. Verify it stays closed.

### Signup form (`/signup/`)

```
□ All 3 fieldsets visible (Personal info, Contact preferences, Consent)
□ 2-2-1 grid layout in fieldsets 1 and 2
□ TCPA consent checkbox is OFF by default (not pre-checked)
□ Phone field is hidden until the user ticks "Yes, send me SMS"
□ Submit empty → required-field validation fires
□ Submit invalid email → email format validation fires
□ Submit valid + consent unchecked → blocks on consent
□ Submit valid + consent checked → success state shows
□ browser_console clean
```

**The legal test:** If the TCPA consent is pre-checked, that's a class-A legal bug. File immediately, severity Critical, assignee `frontend`, body must include the screenshot AND the exact HTML of the consent field.

### AI Gift Finder (`/gift-finder/`)

```
□ Multi-input form renders (recipient, occasion, budget, interests, vibe)
□ Submit with valid inputs → shows 5-10 affiliate-approved picks
□ Each pick has a product image, title, why-useful, best-for, avoid-if
□ Each pick has a working "View on Amazon" or merchant link with the mehyarmedia-20 tag
□ browser_console clean
```

**Catalog test:** Pick any 3 results. Verify the affiliate URL contains the Amazon Associates tag `mehyarmedia-20` (or whatever the current tag is — check `wrangler.toml` `[vars]`). If a product's URL is missing the tag, that's a revenue leak — file Critical.

### AI Starter Kit Builder (`/starter-kits/`)

```
□ Free-text prompt input + category/budget filters
□ Submit "home office under $300" → 5-10 picks across multiple categories
□ Total estimated cost shown
□ Each pick links to its product page
□ browser_console clean
```

### Category page (e.g. `/under-50/`)

```
□ Product grid renders (16-25 products expected)
□ Product images load (or graceful fallback)
□ Each card has a title, price band, brief why-useful
□ Click a card → goes to the product detail page
□ browser_console clean
```

### Story lists (`/stories/`)

```
□ Story cards render
□ Each story has a title, intro, and 3-8 picks
□ Stories page loads within 3 s (it's a fetcher, can be slow)
□ browser_console clean (especially no fetch errors)
```

### Privacy (`/privacy/`)

```
□ Legal text renders
□ Affiliate disclosure is prominent
□ NO signup modal auto-opens (the design opt-out)
□ Signup form on this page (if present) is a fallback, not the modal
□ browser_console clean
```

## Mobile viewport protocol

Set the viewport to 375 × 812 (iPhone-ish, covers most modern phones):

```bash
browser_vision(question="Check mobile layout for <page>", annotate=true)
# Annotations should number every interactive element
# Verify: no horizontal scroll, nav collapses, AI bubble is thumb-reachable, CTAs ≥48x48
```

Specific mobile checks:

```
□ No horizontal scroll on any page (test by scrolling right)
□ Nav collapses to a hamburger OR fits in one line (the current design wraps to 2 lines, which is OK)
□ AI bubble position is bottom-right, ≥ 56x56, ≥ 24px from edges
□ Hero text is ≥ 18px (Gen Z mobile readability)
□ Tap targets ≥ 48x48 (use the annotated screenshot to measure)
□ Form inputs are ≥ 48px tall (Apple's HIG minimum)
```

If the mobile layout fails any of these, file a ticket with the annotated screenshot as the evidence.

## Evidence save path

```
dogfood-output/
  tick-001/
    screenshots/
      home-desktop.png
      home-mobile.png
      signup-desktop.png
      signup-success-state.png
      gift-finder-results.png
    console.log              # all browser_console output for this tick
    report.md                # dogfood-format report
  tick-002/
    ...
```

The `report.md` is optional — only generated if the tick found real issues. The screenshots are mandatory; they're what the Telegram report embeds.

## Pitfalls

1. **Forgetting to `browser_console(clear=true)` after each navigation.** Old console output pollutes new output. Clear before each new page.
2. **Trusting the AI bubble without testing it.** It looks fine in the static snapshot but the JS might be broken. Click it, type, submit, verify.
3. **Skipping the privacy page because it's "boring."** It's the legal page. If the modal opt-out is broken here, the site is a TCPA risk. Always check at least once every 5 ticks.
4. **Saving screenshots without the full URL in the filename.** When you file a ticket, the screenshot path is the only evidence the worker has. `signup-desktop-2026-07-08T1530.png` is useless; `signup-2026-07-08-desktop-empty-submit.png` tells the story.
5. **Testing only the homepage.** The AI features on `/gift-finder/` and `/starter-kits/` are the product. If they break, the site is a brochure. Rotate through them.
6. **Filing a "no console errors" finding as a ticket.** "No errors" is the baseline, not a finding. Only file tickets for actual errors or actual visual issues.
7. **Ignoring the network tab.** `browser_console` shows JS errors; it doesn't show 404s on assets. If a product image is broken, that's a 404 the console may not surface. Spot-check 2-3 product images per tick by `curl -sI` on their URLs.
