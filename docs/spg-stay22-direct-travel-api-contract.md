# SPG Stay22 Direct Travel API Contract

Purpose: document the verified Stay22 contract used by `scripts/fetch-spg-daily-offers.mjs` without storing raw secret values.

## Verified public contract

Source: Stay22 OpenAPI at `https://api.stay22.com/openapi.json`.

Primary endpoint:

- `GET https://api.stay22.com/v1/accommodations`

Useful parameters:

- `provider`: required on v1. Supported values include `booking`, `vrbo`, `expedia`, `hotelscom`.
- `address` or `lat`/`lng` or bounding box fields: location search input.
- `checkin`: `YYYY-MM-DD`.
- `checkout`: `YYYY-MM-DD`.
- `adults`, `children`, `rooms`.
- `currency`.
- `limit`: max results, 1-100.
- `aid`: Stay22 affiliate/partner ID for commission attribution.
- `campaign`: campaign label for tracking.

Authentication options from OpenAPI:

- Header: `X-API-KEY: <token>`.
- Query: `key=<token>`.

Important: the API can return sample/public accommodation data without a key, but SPG should only publish monetized Stay22 offers when an affiliate `aid` is configured by env key name. Do not put an API token into public `aid` links.

## SPG env contract

- `SPG_STAY22_API_ENDPOINT`: optional override, defaults to `https://api.stay22.com/v1/accommodations`.
- `SPG_STAY22_API_KEY` / `STAY22_API_KEY`: optional API key for higher-rate/premium access.
- `SPG_STAY22_AID` / `STAY22_AID`: required for monetized Stay22 publishing.
- `SPG_DAILY_STAY22_OFFER_LIMIT`: optional daily cap, defaults to `24`.

## Runtime behavior

- If no Stay22 AID exists: daily feed reports `stay22.status = skipped_missing_aid`, publishes zero Stay22 offers, and keeps Amazon unaffected.
- If AID exists: the daily offer fetcher calls Stay22 accommodations searches for travel/event locations, normalizes listing names, thumbnails, provider links, campaign labels, and metadata into the shared SPG offer contract.
- If the API key receives HTTP 401: the fetcher redacts the key, falls back to the public endpoint contract, and records a sanitized warning.

## Public route contract

Stay22 offers use the same SPG attribution pattern:

- Card links to `/offers/<slug>`.
- Landing CTA links to `/go/<slug>`.
- `/go` redirects server/static bridge to the Stay22 URL.
- Landing page includes affiliate disclosure and preference/unsubscribe links.

## Current blocker

The stored `STAY22_API_KEY` value is not accepted by the Direct Travel API as `X-API-KEY` or `key`; it returns `INVALID_API_KEY`. A separate Stay22 `aid`/partner ID is still needed before real Stay22 offers can be published as monetized.
