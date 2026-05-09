# Production same-server routing contract

## Decision

`stuffprettygood.com` and `mehyarmedia.mehyar.us` intentionally share the same Hostinger server. The canonical CRM contract is namespaced under `/crm/` so the brand-site root can keep owning `/` and `/health`. The original `/crm-health` path remains supported as a compatibility alias for monitors that were already pointed there.

## Canonical live route map

| Host | Route | Owner | Expected contract |
| --- | --- | --- | --- |
| `stuffprettygood.com` | `/` | Brand site | HTTP 200 HTML |
| `stuffprettygood.com` | `/health` | Brand site | HTTP 200 HTML/site health |
| `stuffprettygood.com` | `/crm/health` | CRM Command Center | HTTP 200 JSON: `status=healthy`, `service=mehyarmedia-crm`, `massSendingEnabled=false` |
| `stuffprettygood.com` | `/crm-health` | CRM Command Center | HTTP 200 JSON compatibility alias for `/crm/health` |
| `stuffprettygood.com` | `/crm/api/*` | CRM Command Center | JSON API routes proxied to the CRM app |
| `mehyarmedia.mehyar.us` | `/` | Brand/company site shell | HTTP 200 HTML |
| `mehyarmedia.mehyar.us` | `/health` | Brand/company site shell | HTTP 200 HTML/site health |
| `mehyarmedia.mehyar.us` | `/crm/health` | CRM Command Center | HTTP 200 JSON: `status=healthy`, `service=mehyarmedia-crm`, `massSendingEnabled=false` |
| `mehyarmedia.mehyar.us` | `/crm-health` | CRM Command Center | HTTP 200 JSON compatibility alias for `/crm/health` |
| `mehyarmedia.mehyar.us` | `/crm/api/*` | CRM Command Center | JSON API routes proxied to the CRM app |

## Non-canonical routes

- `/healthz` is internal/service-local only. It should not be treated as the public CRM health endpoint at the shared brand root.

## Operational checks

Use these checks for live verification:

```bash
curl -fsS https://stuffprettygood.com/crm/health
curl -fsS https://stuffprettygood.com/crm-health
curl -fsS https://mehyarmedia.mehyar.us/crm/health
curl -fsS https://mehyarmedia.mehyar.us/crm-health
```

All four CRM health checks must return JSON with `status: healthy`, `service: mehyarmedia-crm`, and `massSendingEnabled: false`.

## Security notes

- No secrets belong in frontend code, logs, route reports, or health payloads.
- CRM routes stay under `/crm/` until a dedicated CRM hostname is approved and DNS/HTTPS are complete.
- This route contract does not enable sending, blasting, imports, or destructive legacy database access.
