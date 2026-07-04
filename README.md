# StuffPrettyGood.com v0.1

Cloudflare Pages static frontend for the approved-offer shopping guide. Source of truth: vision.md.

Commands:
- npm run curate:dry — preview the daily curated Amazon-safe additions
- npm run curate:daily — add the next curated Amazon-safe batch from `data/curation-backlog.json`
- npm run build
- npm test
- npm run daily:check
- npm run smoke

Daily curation rule: add only manually curated Amazon search-link products with the Associates tag. Images and product metadata come from approved sources only: Amazon PA-API when available, Amazon SiteStripe embeds, merchant feeds (Walmart, Impact, etc.), and licensed stock. The generated SVG is the fallback when no approved image source applies.

Hard rule: only affiliate_status=approved products with approved affiliate URLs render outbound buttons.
