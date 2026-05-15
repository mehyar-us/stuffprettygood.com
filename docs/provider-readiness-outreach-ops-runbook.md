# Provider Readiness, Sponsor Outreach Ops, Monitoring, and Kill Switch Runbook

Owner role: DevOps / Infrastructure Engineer
Source directive: `/home/mehya/.hermes/projects/mehyar-media/PROJECT-001-CRM-COMMAND-CENTER.md`
Scope: A-to-Z reactivation and sponsor pilot operational rails for StuffPrettyGood / Mehyar Media CRM.

## Reality

The CRM is still a control system, not a blast system. These rails prepare provider/domain readiness, sponsor-sales operations, simulator jobs, monitoring, rollback, and audit evidence while preserving NO-SEND / NO-SMS / NO-EXPORT defaults.

Allowed now:

- Store provider records and secret references by environment key name only.
- Run DNS/readiness checks and webhook dry-run checks.
- Support manual Gmail sponsor outreach to sponsor/merchant/network contacts only.
- Run test-send simulations and metrics/link/source monitors without audience sends.
- Record SMS provider readiness only behind a documented-consent gate.

Not allowed by this runbook:

- Broad email send, 300M/1M/100K list activation, or provider push.
- Gmail list blasting.
- SMS activation without documented written marketing consent.
- Raw PII exports or raw PII in logs, docs, Git, screenshots, frontend, or Kanban.
- Consent transfer, list rental/sale, or sponsor access to raw audience records.

## Provider and domain readiness lane for tiny approved email test only

Readiness domain: `stuffprettygood.com`.
Admin/CRM domain: `mehyarmedia.mehyar.us` must not be used for marketing sends.
Default provider mode: `dry_run`.
Live mode allowed only after a scoped class gate and only for a single approved tiny cohort.

Email provider registry must cover these records:

- Brevo
- Amazon SES
- Mailgun
- SendGrid
- Postmark
- SparkPost/Bird
- Mailjet
- SMTP2GO
- Elastic Email
- Resend

Per-provider readiness checklist:

1. Provider account record exists.
2. Secret reference configured by environment key name only.
3. Sender identity verified for the brand domain.
4. SPF status green.
5. DKIM status green.
6. DMARC status green.
7. Bounce webhook verified.
8. Complaint webhook verified.
9. Unsubscribe webhook or List-Unsubscribe handling verified.
10. Reply-to inbox verified.
11. Suppression writeback verified.
12. Audit logging enabled.
13. Monitoring enabled.
14. Kill switches default OFF.
15. Provider remains `dry_run` until scoped approval.

Tiny controlled email test gate requires all of this before any live test:

- Scoped class gate approval.
- Specific tiny cohort approval and cap.
- Suppression applied.
- Source/consent classified.
- Unsubscribe/preference path live.
- Bounce/complaint/unsubscribe webhooks verified.
- SPF/DKIM/DMARC green.
- Provider mode set to `approved_controlled` for the approved window only.
- Audit and monitoring enabled.
- Kill switch explicitly enabled for the test window only.
- Rollback/kill switch owner named.

Even when the tiny-test gate passes, broad sending remains blocked. The only allowed action is one scoped tiny test with the approved cap.

## Gmail/manual sponsor outreach support

Purpose: sell sponsor-funded reactivation pilots through manual business development, not audience messaging.

Allowed:

- Manual Gmail one-to-one outreach to sponsor/merchant/network contacts.
- Sponsor lead status tracking.
- Segment proof packet creation using aggregate/count-only proof.
- No-data-transfer evidence tracking.
- Reply triage into the CRM sponsor pilot manager.

Blocked:

- Gmail list blasting.
- Audience outreach through Gmail.
- Autonomous AI sending.
- Sponsor export of raw contacts.
- Claims that segment proof is live-send validated before actual approved tests.

Sponsor proof packet may include aggregate-only facts:

- Brand fit.
- Vertical/category match.
- Count-only eligible audience range.
- Suppression/risk class summary.
- Placement offer and pilot price.
- No data rental/sale/transfer language.
- Required ComplyOps approval state.

## SMS readiness gate

SMS remains OFF by default.

SMS provider records can be prepared only as readiness metadata. SMS send activation requires:

1. Documented written marketing consent for the specific SMS lane.
2. SMS provider class gate approval.
3. YES/STOP handling verified.
4. Suppression writeback verified.
5. SMS-specific audit event and monitoring.
6. ComplyOps approval.

Without documented written marketing consent, SMS records must stay quarantined as `readiness_record_only` or `blocked`.

## Queue and scheduler runtime tasks

All runtime tasks default disabled and dry-run only until an approved deployment gate enables them.

| Task | Cadence | Sends messages? | Writes audience? | Output |
| --- | --- | --- | --- | --- |
| `test_send_simulator` | On demand before any send request | No | No | no-send proof, gate failure report |
| `provider_dns_readiness_check` | Daily | No | No | SPF/DKIM/DMARC status |
| `provider_webhook_health_check` | Daily | No | No | bounce/complaint/unsubscribe webhook status |
| `link_health_check` | Daily | No | No | broken link report, affiliate redirect status |
| `approved_source_monitor` | Daily | No | No | source health report, terms review queue |
| `metrics_rollup` | Hourly when traffic exists | No | No | RPM/EPC/click/conversion rollups |
| `reply_inbox_triage` | Business daily | No | No | reply/unsub/complaint/interest queue |
| `bounce_complaint_suppression_sync` | Near-real-time only when webhooks are live | No | Suppression only | suppression writeback audit |
| `backup_verification` | Daily | No | No | backup restore point status |
| `audit_log_integrity_check` | Daily | No | No | audit integrity status |

Failure action for all tasks: alert ops, keep kill switches OFF, and write an audit/incident event. Do not auto-send, auto-export, or auto-push providers as a recovery action.

## Health checks

Provider/domain health:

- Provider record exists for each supported provider.
- DNS readiness: SPF, DKIM, DMARC.
- Sender identity readiness.
- Webhook health: bounce, complaint, unsubscribe/List-Unsubscribe.
- Reply-to inbox reachability.
- Provider mode: `dry_run`, `approved_controlled`, or `blocked`.

CRM operations health:

- Test-send simulator available and returning blocked/no-send evidence by default.
- Audit log writes for every gate decision, provider check, webhook event, source monitor event, backup check, and risky-action attempt.
- Suppression writeback path available for bounces, complaints, unsubscribes, STOP, legal, and manual suppressions.
- Queue retry/dead-letter visibility.
- Backup verification status.
- Kill switch state visible in Operations Center.

Sponsor outreach health:

- Gmail/manual account readiness.
- Sponsor-only recipient classification.
- Reply inbox triage operational.
- No audience list import into Gmail.
- No autonomous outreach flag enabled.

SMS health:

- Consent evidence state.
- STOP/YES flow readiness.
- Provider readiness metadata.
- SMS send default blocked.

## Kill switches

Kill switches must default OFF unless a class gate explicitly opens a narrow window.

- `GLOBAL_OUTBOUND_EMAIL_ENABLED`
- `GLOBAL_PROVIDER_PUSH_ENABLED`
- `GLOBAL_EXPORTS_ENABLED`
- `GLOBAL_SMS_ENABLED`
- `SPG_CONTROLLED_TEST_SEND_ENABLED`
- `SPG_SPONSOR_OUTREACH_AUTOMATION_ENABLED`

Rollback procedure:

1. Set the relevant kill switch OFF.
2. Pause provider/campaign/job queue entries.
3. Stop queue workers if live workers exist.
4. Verify no pending provider deliveries remain in local queue.
5. Confirm suppression webhook/writeback tasks still run if events are inbound.
6. Write incident/audit event with actor, timestamp, reason, affected campaign/provider/job, and final state.
7. Restore last known-good app revision if release caused the incident.
8. Keep broad send/export/SMS disabled until postmortem approval.

## Backups and audit logs

Backups:

- Daily database backup verification.
- Retention policy documented in deployment lane.
- Restore drill before any live provider activation.
- Export/download storage private, expiring, and audit-backed.

Audit events required for:

- Provider config changes.
- DNS/readiness checks.
- Webhook verification.
- Reply inbox classifications.
- Sponsor proof packet creation.
- Test-send simulations.
- Tiny-test gate decisions.
- Kill switch changes.
- Queue retries/dead letters.
- Backup verification.
- Suppression writes.
- Risky action attempts.

## Environment key-name checklist only

Do not print or commit values. Store secrets in the approved environment/secrets manager only.

Core deployment:

- `HOSTINGER_VPS_SERVER_IP`
- `HOSTINGER_VPS_SERVER_USERNAME`
- `HOSTINGER_VPS_SERVER_PASS`
- `GITHUB_REPOSITORY`
- `GITHUB_TOKEN`
- `DEPLOY_BRANCH`
- `APP_DOMAIN`
- `CRM_DOMAIN`
- `CRM_SECRET_KEY`
- `DATABASE_URL`
- `CRM_PUBLIC_BASE_URL`
- `CRM_ADMIN_BASE_URL`

IONOS source read-only path:

- `IONOS_SERVER_IP`
- `IONOS_USER`
- `IONOS_PASSWORD`
- `IONOS_PSQL_HOST`
- `IONOS_PSQL_USER`
- `IONOS_PSQL_PASS`
- `IONOS_PSQL_DB`
- `IONOS_PSQL_PORT`
- `IONOS_PSQL_SSLMODE`

Cloudflare/domain readiness:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID_SPG`
- `CLOUDFLARE_ZONE_ID_MEHYAR_US`
- `SPG_DOMAIN`
- `SPG_TRACKING_DOMAIN`
- `SPG_REPLY_DOMAIN`

Email provider secret references:

- `BREVO_API_KEY`
- `AMAZON_SES_ACCESS_KEY_ID`
- `AMAZON_SES_SECRET_ACCESS_KEY`
- `AMAZON_SES_REGION`
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `SENDGRID_API_KEY`
- `POSTMARK_SERVER_TOKEN`
- `SPARKPOST_API_KEY`
- `BIRD_API_KEY`
- `MAILJET_API_KEY`
- `MAILJET_SECRET_KEY`
- `SMTP2GO_API_KEY`
- `ELASTIC_EMAIL_API_KEY`
- `RESEND_API_KEY`

Webhook/reply inbox:

- `PROVIDER_WEBHOOK_SIGNING_SECRET`
- `BREVO_WEBHOOK_SECRET`
- `MAILGUN_WEBHOOK_SIGNING_KEY`
- `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY`
- `POSTMARK_WEBHOOK_BASIC_AUTH_USER`
- `POSTMARK_WEBHOOK_BASIC_AUTH_PASS`
- `REPLY_INBOX_IMAP_HOST`
- `REPLY_INBOX_IMAP_USER`
- `REPLY_INBOX_IMAP_PASS`
- `REPLY_INBOX_SMTP_HOST`
- `REPLY_INBOX_SMTP_USER`
- `REPLY_INBOX_SMTP_PASS`

Gmail/manual sponsor outreach:

- `SPONSOR_OUTREACH_GMAIL_ACCOUNT`
- `SPONSOR_OUTREACH_GOOGLE_CLIENT_ID`
- `SPONSOR_OUTREACH_GOOGLE_CLIENT_SECRET`
- `SPONSOR_OUTREACH_GOOGLE_REFRESH_TOKEN`

SMS readiness only:

- `SMS_PROVIDER_NAME`
- `SMS_PROVIDER_API_KEY`
- `SMS_PROVIDER_WEBHOOK_SECRET`
- `SMS_REPLY_WEBHOOK_SECRET`
- `SMS_CONSENT_EVIDENCE_STORE_URL`

Ops/runtime:

- `QUEUE_REDIS_URL`
- `OPS_SCHEDULER_ENABLED`
- `OPS_DRY_RUN_ONLY`
- `OPS_AUDIT_LOG_ENABLED`
- `OPS_MONITORING_ENABLED`
- `OPS_BACKUP_BUCKET`
- `OPS_BACKUP_ENCRYPTION_KEY_REF`
- `OPS_ALERT_WEBHOOK_URL`
- `OPS_ALERT_EMAIL_TO`

Kill switches:

- `GLOBAL_OUTBOUND_EMAIL_ENABLED`
- `GLOBAL_PROVIDER_PUSH_ENABLED`
- `GLOBAL_EXPORTS_ENABLED`
- `GLOBAL_SMS_ENABLED`
- `SPG_CONTROLLED_TEST_SEND_ENABLED`
- `SPG_SPONSOR_OUTREACH_AUTOMATION_ENABLED`

## No-send proof

Executable proof lives in:

- `src/crm/opsRails.js`
- `test/ops-rails.test.js`

The proof asserts:

- Provider registry defaults all providers to dry-run.
- Live send, provider push, audience export, and SMS send are false by default.
- Tiny email test is blocked until every scoped gate is present.
- Even approved tiny test mode never approves broad sending.
- Sponsor outreach is manual Gmail only and forbids list blasting/data transfer.
- SMS send is never enabled by default even when readiness metadata is complete.
- Runtime tasks are disabled dry-run monitors by default and send no messages.

Verification command:

```bash
node --test test/ops-rails.test.js test/campaign-manager-contracts.test.js test/compliance-gates.test.js
```
