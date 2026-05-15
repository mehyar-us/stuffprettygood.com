const BLOCKED = 'blocked';
const DRY_RUN = 'dry_run';
const DOCUMENTED_CONSENT_REQUIRED = 'documented_written_marketing_consent_required';

export const EMAIL_PROVIDERS = Object.freeze([
  'brevo',
  'amazon_ses',
  'mailgun',
  'sendgrid',
  'postmark',
  'sparkpost_bird',
  'mailjet',
  'smtp2go',
  'elastic_email',
  'resend',
]);

export const OPS_RUNTIME_TASKS = Object.freeze([
  'test_send_simulator',
  'provider_dns_readiness_check',
  'provider_webhook_health_check',
  'link_health_check',
  'approved_source_monitor',
  'metrics_rollup',
  'reply_inbox_triage',
  'bounce_complaint_suppression_sync',
  'backup_verification',
  'audit_log_integrity_check',
]);

export const KILL_SWITCHES = Object.freeze([
  'GLOBAL_OUTBOUND_EMAIL_ENABLED',
  'GLOBAL_PROVIDER_PUSH_ENABLED',
  'GLOBAL_EXPORTS_ENABLED',
  'GLOBAL_SMS_ENABLED',
  'SPG_CONTROLLED_TEST_SEND_ENABLED',
  'SPG_SPONSOR_OUTREACH_AUTOMATION_ENABLED',
]);

export function buildProviderReadinessRegistry({ providers = EMAIL_PROVIDERS, domain = 'stuffprettygood.com' } = {}) {
  return providers.map((provider) => ({
    provider,
    domain,
    mode: DRY_RUN,
    liveSendEnabled: false,
    providerPushEnabled: false,
    requiredChecks: [
      'provider_account_record_exists',
      'secret_reference_configured_by_env_key_name',
      'sender_identity_verified',
      'SPF_status_green',
      'DKIM_status_green',
      'DMARC_status_green',
      'bounce_webhook_verified',
      'complaint_webhook_verified',
      'unsubscribe_webhook_or_list_unsubscribe_verified',
      'reply_to_inbox_verified',
      'audit_logging_enabled',
      'suppression_writeback_verified',
      'kill_switches_default_off',
    ],
    allowedActions: ['store_config_reference', 'run_dns_check', 'run_webhook_dry_run', 'simulate_test_send'],
    blockedActions: ['live_send', 'provider_push', 'bulk_import', 'audience_export'],
  }));
}

export function evaluateTinyEmailTestGate({
  classGateApproved = false,
  segmentApproved = false,
  suppressionApplied = false,
  sourceConsentClassified = false,
  unsubscribeLive = false,
  webhooksVerified = false,
  dnsGreen = false,
  providerMode = DRY_RUN,
  auditEnabled = false,
  monitoringEnabled = false,
  killSwitchEnabled = false,
  cohortSize = 0,
  maxApprovedCohortSize = 0,
} = {}) {
  const blockers = [];

  if (!classGateApproved) blockers.push('scoped class gate approval missing');
  if (!segmentApproved) blockers.push('specific tiny cohort approval missing');
  if (!suppressionApplied) blockers.push('suppression not applied');
  if (!sourceConsentClassified) blockers.push('source/consent classification incomplete');
  if (!unsubscribeLive) blockers.push('unsubscribe and preference path not live');
  if (!webhooksVerified) blockers.push('bounce/complaint/unsubscribe webhooks not verified');
  if (!dnsGreen) blockers.push('domain DNS readiness not green');
  if (providerMode !== 'approved_controlled') blockers.push('provider mode is not approved_controlled');
  if (!auditEnabled) blockers.push('audit logging not enabled');
  if (!monitoringEnabled) blockers.push('monitoring not enabled');
  if (!killSwitchEnabled) blockers.push('send kill switch remains off');
  if (cohortSize <= 0) blockers.push('cohort size must be positive and explicitly approved');
  if (maxApprovedCohortSize <= 0) blockers.push('approved cohort cap missing');
  if (cohortSize > maxApprovedCohortSize) blockers.push('cohort size exceeds approved cap');

  return {
    allowed: blockers.length === 0,
    state: blockers.length === 0 ? 'approved_controlled_test_only' : BLOCKED,
    blockers,
    broadSendAllowed: false,
    maxScaleAction: blockers.length === 0 ? 'single scoped tiny email test only' : 'simulation only',
  };
}

export function evaluateSponsorOutreachMode({ gmailAccountReady = false, targetIsSponsor = false, listBlastRequested = false, automationRequested = false } = {}) {
  const blockers = [];
  if (!gmailAccountReady) blockers.push('Gmail/manual outreach account not verified');
  if (!targetIsSponsor) blockers.push('recipient must be sponsor/merchant/network contact, not audience list contact');
  if (listBlastRequested) blockers.push('list blasting is prohibited');
  if (automationRequested) blockers.push('autonomous outreach automation is prohibited for sponsor pilot lane');

  return {
    allowed: blockers.length === 0,
    mode: blockers.length === 0 ? 'manual_gmail_sponsor_outreach_only' : BLOCKED,
    blockers,
    audienceBlastAllowed: false,
    dataTransferAllowed: false,
  };
}

export function evaluateSmsActivationGate({ documentedWrittenMarketingConsent = false, providerGateApproved = false, stopFlowVerified = false, requestedAction = 'readiness' } = {}) {
  const blockers = [];
  if (!documentedWrittenMarketingConsent) blockers.push(DOCUMENTED_CONSENT_REQUIRED);
  if (!providerGateApproved) blockers.push('SMS provider gate approval missing');
  if (!stopFlowVerified) blockers.push('YES/STOP handling not verified');

  return {
    allowed: blockers.length === 0 && requestedAction === 'readiness',
    state: blockers.length === 0 && requestedAction === 'readiness' ? 'readiness_record_only' : BLOCKED,
    blockers: requestedAction === 'send' ? [...blockers, 'SMS send activation is not implemented by default'] : blockers,
    smsSendAllowed: false,
  };
}

export function createRuntimeTaskSchedule() {
  return OPS_RUNTIME_TASKS.map((task) => {
    const defaults = {
      task,
      enabled: false,
      dryRunOnly: true,
      writesAudience: false,
      sendsMessages: false,
      failureAction: 'alert_ops_and_keep_kill_switches_off',
      auditEventRequired: true,
    };

    if (task === 'test_send_simulator') return { ...defaults, cadence: 'on_demand_before_any_send_request', produces: ['no_send_proof', 'gate_failure_report'] };
    if (task === 'provider_dns_readiness_check') return { ...defaults, cadence: 'daily', produces: ['SPF_DKIM_DMARC_status'] };
    if (task === 'provider_webhook_health_check') return { ...defaults, cadence: 'daily', produces: ['bounce_complaint_unsubscribe_webhook_status'] };
    if (task === 'link_health_check') return { ...defaults, cadence: 'daily', produces: ['broken_link_report', 'affiliate_redirect_status'] };
    if (task === 'approved_source_monitor') return { ...defaults, cadence: 'daily', produces: ['source_health_report', 'terms_review_queue'] };
    if (task === 'metrics_rollup') return { ...defaults, cadence: 'hourly_when_traffic_exists', produces: ['RPM_EPC_click_conversion_rollup'] };
    if (task === 'reply_inbox_triage') return { ...defaults, cadence: 'business_daily', produces: ['reply_unsub_complaint_interest_queue'] };
    if (task === 'bounce_complaint_suppression_sync') return { ...defaults, cadence: 'near_realtime_when_webhooks_live', produces: ['suppression_writeback_audit'] };
    if (task === 'backup_verification') return { ...defaults, cadence: 'daily', produces: ['backup_restore_point_status'] };
    return { ...defaults, cadence: 'daily', produces: ['audit_integrity_status'] };
  });
}

export function proveNoSendSurface() {
  return {
    outboundEmailDefault: BLOCKED,
    providerPushDefault: BLOCKED,
    exportsDefault: BLOCKED,
    smsDefault: BLOCKED,
    liveSendFunctionsImplemented: false,
    providerPushFunctionsImplemented: false,
    broadAudienceActionsAllowed: false,
    requiredBeforeAnyTinyEmailTest: [
      'class_gate_approval',
      'specific_tiny_segment_approval',
      'suppression_applied',
      'source_consent_classified',
      'unsubscribe_preference_path_live',
      'webhooks_verified',
      'DNS_green',
      'provider_approved_controlled',
      'audit_monitoring_enabled',
      'kill_switch_explicitly_enabled_for_test_window',
      'cohort_cap_enforced',
    ],
  };
}
