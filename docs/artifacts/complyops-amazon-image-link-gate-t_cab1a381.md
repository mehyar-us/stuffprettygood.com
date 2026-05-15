# ComplyOps Gate: Amazon image/link acceptance for SPG offer wall

Task: `t_cab1a381`
Date: 2026-05-15
Reviewer: ComplyOps
Workspace: `/home/mehya/work/mehyarmedia`

## Decision

CONDITIONAL GO for the Amazon-first StuffPrettyGood public offer wall and `/go` bridge implementation under the class gate below.

This is a GO only for public, user-initiated, no-send, disclosure-visible Amazon Associates manual search/bridge links using StoreID `mehyarmedia-20`. It is NOT approval for mass audience activation, email/SMS sends, PA-API use, Amazon scraping, copied Amazon product assets, copied Amazon price/rating/review/availability claims, or third-party affiliate/network account submissions beyond already-approved account-creation gates.

## Evidence checked

- 128 public HTML files inspected for disclosure/affiliate/Amazon patterns.
- 62 Amazon `/go` bridge pages present under `public/go/amazon-*.html`.
- 62 generated SVG offer images present under `public/assets/offers/*.svg`.
- `src/spg/trend-components.js` defines `AMAZON_ASSOCIATES_TAG = 'mehyarmedia-20'` and builds Amazon search URLs with `tag=mehyarmedia-20`.
- Representative bridge page `public/go/amazon-air-purifiers.html` includes visible disclosure, StoreID text, no copied Amazon price/rating/review/image/availability claims, and a sponsored/nofollow/noopener Amazon search link with `tag=mehyarmedia-20`.
- Representative trend page `public/trends/air-purifiers.html` routes offer cards to local `/go/amazon-*.html` bridges and uses local SVG images.
- `public/affiliate-disclosure.html` exists and states affiliate/referral commission disclosure.
- Automated static scan found:
  - `pa_api_mentions`: 0
  - direct Amazon links missing `tag=mehyarmedia-20`: 0
  - external/Amazon image URLs in offer SVGs: 0
  - copied Amazon image `src` URLs in public HTML: 0
- Verified test command with WSL node, not Windows npm shim:
  - `PATH=/home/mehya/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin node --test`
  - Result: 93/93 pass.

Note: plain `npm test` currently resolves `npm` to `/mnt/c/nvm4w/nodejs/npm` and accidentally runs Windows-side tests from `C:\Windows`. Do not treat that run as acceptance evidence; use WSL node or fix PATH before CI/local QA.

## Gate matrix

| Lane | Decision | Conditions | Stop/escalate |
|---|---|---|---|
| Public SPG offer wall | GO | User-initiated page views only; visible affiliate disclosure; local/owned/generated images; claim-safe copy. | Stop on missing disclosure, merchant-copied asset, fake proof/ranking, or regulated outcome claim. |
| `/go` Amazon bridge pages | GO | Bridge page must visibly state affiliate relationship and StoreID; outbound link must use `rel="sponsored nofollow noopener"`; no hidden redirect cloaking; destination is Amazon search/SiteStripe/manual approved link only. | Stop on missing tag, silent redirect, raw PII in URL/logs, or copied Amazon content. |
| Amazon StoreID `mehyarmedia-20` | GO | Use only as affiliate tag in approved manual links; preserve auditability in source/components. | Escalate if changing StoreID/account ownership or routing revenue to another account. |
| Generated/owned SVG images | GO | Images must remain original SPG-generated/owned assets; no `<image>` embeds or external/Amazon CDN references. | Stop on copied product photos, merchant logos used as product endorsement, or unlicensed assets. |
| PA-API / scraping / copied Amazon data | NO-GO | Current implementation makes no PA-API assumptions and has no PA-API mentions. | Any PA-API integration, scraping, copied price/rating/review/availability/image requires separate Amazon compliance review. |
| Public pricing/ratings/reviews/availability | NO-GO for Amazon-derived claims | Generic buyer guidance may say prices/availability change; do not publish merchant-specific Amazon prices, ratings, review counts, stock state, or scarcity claims unless separately authorized under Amazon rules. | Stop on `$X off`, star rating, review count, in-stock, or availability copied from Amazon. |
| Email/SMS/provider push | NO-GO in this gate | Public site may collect explicit web interest only and remain no-send. | Any mass activation, provider push, export, or email/SMS campaign escalates to audience activation gate. |
| Audit/logging | GO | Log only aggregate/go_slug/event metadata; no raw email/phone/name/address, no destination URL with user identifiers, no secrets. | Stop on raw PII/secret-like payload in frontend/backend logs, URLs, Kanban, docs, or analytics. |

## Required fixes before public deploy

1. QA command/path fix: ensure local/CI acceptance uses WSL/Linux node rather than Windows `npm` shim. Evidence command above is valid; plain `npm test` is misleading in this workspace until PATH/npm resolution is fixed.
2. Keep `/go` bridge as a visible user-confirmation page. Do not convert these pages into instant server/client redirects without a fresh ComplyOps review.
3. Add/keep a deploy checklist item: static scan must return 0 for PA-API mentions, external/Amazon image sources, direct Amazon links missing `tag=mehyarmedia-20`, and raw PII-like URL parameters in offer routes.

## Success metric

- Approved public launch surface has 100% visible affiliate disclosure coverage, 0 copied Amazon assets/data claims, 0 PA-API/scraping use, 0 raw PII leakage in event payloads/routes/logs, and all user-initiated Amazon outbound links use the approved StoreID.

## Stop condition

Immediate stop/no-publish if any copied Amazon price, rating, review count, availability, image, PA-API output, scraped Amazon content, undisclosed affiliate route, untagged direct Amazon link, silent redirect, or raw PII/secret exposure is introduced.

## Escalation threshold

Escalate to Boss/Hot Zero/ComplyOps before: mass audience reactivation, email/SMS sends, provider pushes, raw PII exports, use of PA-API, account ownership/tag changes, legal-sensitive claims, sponsor data transfer, or material change from manual user-initiated Amazon search bridges.
