# StuffPrettyGood.com v0.1

Cloudflare Pages static frontend for the approved-offer shopping guide. Source of truth: vision.md.

Commands:
- npm run curate:dry — preview the daily curated Amazon-safe additions
- npm run curate:daily — add the next curated Amazon-safe batch from `data/curation-backlog.json`
- npm run build
- npm test
- npm run daily:check
- npm run smoke

Daily curation rule: add only manually curated Amazon search-link products with the Associates tag. Do not scrape Amazon images, prices, reviews, ratings, or availability. Generated artwork remains the fallback until PA-API, SiteStripe, merchant feed, or licensed images are approved.

Hard rule: only affiliate_status=approved products with approved affiliate URLs render outbound buttons.
