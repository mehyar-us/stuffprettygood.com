# ComplyOps — Consolidated Daily Pull Guardrail Audit

Date: 2026-05-15
Task: t_3efa2ad3
Reviewer: ComplyOps
Disposition: BLOCK

## Reality
The collector and registry layer is mostly compliant for internal-only collection, but the consolidated daily pull wrapper is not. The wrapper currently performs remote deployment and live publish steps even though its own summary artifact claims "no ... provider push" and the parent task guardrail says no outreach/bid/application/spend/provider push/email/SMS.

## What changed
Reviewed:
- `scripts/collect-opportunity-finder.mjs`
- `data/opportunity-source-registry.json`
- `data/spg-rss-source-registry.json`
- `/home/mehya/.hermes/scripts/mehyar-media-daily-pull-everything.sh`
- `data/daily-pull/latest.json`
- `.ops-logs/daily-pull-everything-20260515T175810Z.log`
- supporting SPG QA / durable-store logic

## Evidence
### PASS findings
1. Internal-only opportunity collection is enforced in collector outputs.
   - `scripts/collect-opportunity-finder.mjs:68-70` sets `gate_status: 'draft_only'` and `external_action_type: 'none'` in evidence.
   - `scripts/collect-opportunity-finder.mjs:161-163` keeps normalized opportunities at `external_action_type: 'none'` and `gate_status: 'draft_only'`.

2. Secret leakage controls are present in collector normalization.
   - `scripts/collect-opportunity-finder.mjs:11` defines secret redaction regex.
   - `scripts/collect-opportunity-finder.mjs:44-46` scrubs secrets from URLs before persistence.
   - `data/opportunity-source-registry.json:8-12` requires no raw secrets/PII and env-key refs only.

3. Merchant-content / image guardrails are present in SPG durable-store layer.
   - `src/spg/durable-store.js:12` blocks copied Amazon price/rating/review/availability claims.
   - `src/spg/durable-store.js:465-466` rejects offer payloads with secret/PII-like data or copied commerce claims.
   - `src/spg/durable-store.js:727-731` requires approved/owned/licensed imagery before public offer eligibility.
   - `data/spg-rss-source-registry.json:5-8` states metadata-only/original-summary and no copied prices/images/ratings/reviews/availability.

4. No-send / no-provider-push logic exists inside durable ingestion and public-event flows.
   - `src/spg/durable-store.js:105` records blocked side effects including `email`, `sms`, `provider_push`, and `public_publish_without_approval`.
   - `src/spg/durable-store.js:249-258`, `275-284`, `288-292` keep signup/preferences/unsubscribe records with `live_send_enabled: false` and `provider_push_enabled: false`.

### BLOCK findings
1. The consolidated daily pull wrapper performs external deployment/public publish actions.
   - `/home/mehya/.hermes/scripts/mehyar-media-daily-pull-everything.sh:116-123` runs SSH backup, `rsync` to Hostinger, `nginx` reload, and live smoke.
   - This is a provider push / public publish side effect, not internal collection only.

2. The wrapper’s audit artifact makes a contradictory compliance claim.
   - `/home/mehya/.hermes/scripts/mehyar-media-daily-pull-everything.sh:88-93` writes guardrails including `no bids/applications/outreach/spend/account KYC/provider push/email/SMS from this job`.
   - `data/daily-pull/latest.json:30-37` repeats that guardrail while also recording `deploy_status: "deployed"`.
   - This is false/contradictory audit evidence.

3. The summary artifact overstates collected source families.
   - `/home/mehya/.hermes/scripts/mehyar-media-daily-pull-everything.sh:75` hardcodes `affiliate_source_signals` into `source_families`.
   - `data/opportunity-source-registry.json:352-396` shows affiliate source family is `enabled: false` and `collector_status: "schema_only"`.
   - This creates misleading operational reporting.

4. RSS/posting feed collectors rely on registry discipline but do not hard-enforce feed-level terms metadata before fetch.
   - `scripts/collect-opportunity-finder.mjs:265-280` fetches RSS entries as long as `enabled` and not `risk === 'blocked'`.
   - `scripts/collect-opportunity-finder.mjs:286-298` fetches posting feeds without validating per-feed `terms_url` / `allowed_use` presence.
   - Current registry entries are acceptable, but enforcement is incomplete if registry quality drifts.

## Risk
- Reputation risk: HIGH — auto-deploy from a job labeled internal-only creates unsafe precedent and misleading compliance posture.
- Authority risk: HIGH — public publish/provider push is occurring without a separate class gate.
- Data/privacy risk: LOW-MEDIUM — no direct raw secret/PII leak found in reviewed artifacts.
- ToS/content risk: MEDIUM — current registries are mostly safe, but feed-level validation is not fully enforced in code.

## Exact fixes required
1. Split collection from deployment.
   - Remove Hostinger backup/rsync/nginx/live-smoke from `daily:pull:everything`, or gate it behind an explicit separate deploy flag that defaults OFF.
   - Required safe default: the daily pull job must end at artifact generation and local QA.

2. Make blocked deployment explicit in the summary artifact.
   - Replace `deploy_status: "deployed"` path for this job with `deploy_status: "blocked_by_guardrail"` or move deploy reporting into a separate deploy-only job.
   - The job must never emit a "no provider push" guardrail and then deploy in the same run.

3. Derive `source_families` from actual executed collectors / latest runs.
   - Remove hardcoded `affiliate_source_signals` from the daily summary unless that family is genuinely enabled and collected under an approved gate.

4. Add hard validation for feed-level ToS fields before fetch.
   - In `collectRssRegistry` and `collectPostings`, skip and log warning if a feed entry lacks `terms_url`, `allowed_use`, or is not explicitly in an approved mode such as `metadata_only`.

5. Add regression tests.
   - Test that the consolidated daily pull artifact cannot claim `no provider push` while reporting any deploy state other than blocked/no_changes.
   - Test that disabled/schema-only affiliate family is not reported as collected.
   - Test that feed entries missing `terms_url` / `allowed_use` are skipped with warning, not fetched.

## Recommended ruling
- Collector layer: CONDITIONAL PASS
- Consolidated daily pull wrapper/job: BLOCK until deploy side effects are removed from the internal-only daily pull lane or moved behind a separately approved deploy gate.

## Next action
Assign remediation to DevOps/DataEng/WebDev:
- DevOps: split deploy from collector cron and enforce no-deploy default.
- DataEng: fix summary generation and feed-validation logic.
- WebDev/QA: add regression tests for no-provider-push and source-family accuracy.
