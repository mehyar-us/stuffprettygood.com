import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMAIL_PROVIDERS,
  KILL_SWITCHES,
  OPS_RUNTIME_TASKS,
  buildProviderReadinessRegistry,
  createRuntimeTaskSchedule,
  evaluateSmsActivationGate,
  evaluateSponsorOutreachMode,
  evaluateTinyEmailTestGate,
  proveNoSendSurface,
} from '../src/crm/opsRails.js';

test('provider registry keeps every email provider in dry-run mode with live send and provider push blocked', () => {
  const registry = buildProviderReadinessRegistry();

  assert.equal(registry.length, EMAIL_PROVIDERS.length);
  assert.ok(registry.length >= 10);

  for (const provider of registry) {
    assert.equal(provider.domain, 'stuffprettygood.com');
    assert.equal(provider.mode, 'dry_run');
    assert.equal(provider.liveSendEnabled, false);
    assert.equal(provider.providerPushEnabled, false);
    assert.ok(provider.requiredChecks.includes('SPF_status_green'));
    assert.ok(provider.requiredChecks.includes('DKIM_status_green'));
    assert.ok(provider.requiredChecks.includes('DMARC_status_green'));
    assert.ok(provider.requiredChecks.includes('complaint_webhook_verified'));
    assert.ok(provider.requiredChecks.includes('suppression_writeback_verified'));
    assert.ok(provider.blockedActions.includes('live_send'));
    assert.ok(provider.blockedActions.includes('provider_push'));
    assert.ok(provider.blockedActions.includes('audience_export'));
  }
});

test('tiny email test gate blocks by default and never approves broad sending', () => {
  const blocked = evaluateTinyEmailTestGate();

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.state, 'blocked');
  assert.equal(blocked.broadSendAllowed, false);
  assert.equal(blocked.maxScaleAction, 'simulation only');
  assert.ok(blocked.blockers.includes('scoped class gate approval missing'));
  assert.ok(blocked.blockers.includes('send kill switch remains off'));

  const approvedTinyOnlyInput = {
    classGateApproved: true,
    segmentApproved: true,
    suppressionApplied: true,
    sourceConsentClassified: true,
    unsubscribeLive: true,
    webhooksVerified: true,
    dnsGreen: true,
    providerMode: 'approved_controlled',
    auditEnabled: true,
    monitoringEnabled: true,
    killSwitchEnabled: true,
    cohortSize: 100,
    maxApprovedCohortSize: 100,
  };
  const approvedTinyOnly = evaluateTinyEmailTestGate(approvedTinyOnlyInput);

  assert.equal(approvedTinyOnly.allowed, true);
  assert.equal(approvedTinyOnly.state, 'approved_controlled_test_only');
  assert.equal(approvedTinyOnly.broadSendAllowed, false);
  assert.equal(approvedTinyOnly.maxScaleAction, 'single scoped tiny email test only');

  const tooLarge = evaluateTinyEmailTestGate({ ...approvedTinyOnlyInput, cohortSize: 1000 });
  assert.equal(tooLarge.allowed, false);
});

test('sponsor outreach support is manual Gmail only and forbids audience list blasting or data transfer', () => {
  const manual = evaluateSponsorOutreachMode({ gmailAccountReady: true, targetIsSponsor: true });

  assert.equal(manual.allowed, true);
  assert.equal(manual.mode, 'manual_gmail_sponsor_outreach_only');
  assert.equal(manual.audienceBlastAllowed, false);
  assert.equal(manual.dataTransferAllowed, false);

  const blast = evaluateSponsorOutreachMode({
    gmailAccountReady: true,
    targetIsSponsor: true,
    listBlastRequested: true,
    automationRequested: true,
  });

  assert.equal(blast.allowed, false);
  assert.ok(blast.blockers.includes('list blasting is prohibited'));
  assert.ok(blast.blockers.includes('autonomous outreach automation is prohibited for sponsor pilot lane'));
});

test('SMS readiness remains behind documented consent gate and never enables SMS send by default', () => {
  const blocked = evaluateSmsActivationGate();
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.smsSendAllowed, false);
  assert.ok(blocked.blockers.includes('documented_written_marketing_consent_required'));

  const readinessOnly = evaluateSmsActivationGate({
    documentedWrittenMarketingConsent: true,
    providerGateApproved: true,
    stopFlowVerified: true,
  });

  assert.equal(readinessOnly.allowed, true);
  assert.equal(readinessOnly.state, 'readiness_record_only');
  assert.equal(readinessOnly.smsSendAllowed, false);

  const sendAttempt = evaluateSmsActivationGate({
    documentedWrittenMarketingConsent: true,
    providerGateApproved: true,
    stopFlowVerified: true,
    requestedAction: 'send',
  });

  assert.equal(sendAttempt.allowed, false);
  assert.equal(sendAttempt.state, 'blocked');
  assert.equal(sendAttempt.smsSendAllowed, false);
  assert.ok(sendAttempt.blockers.includes('SMS send activation is not implemented by default'));
});

test('runtime schedule is disabled dry-run by default and produces monitoring artifacts only', () => {
  const schedule = createRuntimeTaskSchedule();

  assert.equal(schedule.length, OPS_RUNTIME_TASKS.length);
  assert.ok(KILL_SWITCHES.includes('GLOBAL_OUTBOUND_EMAIL_ENABLED'));
  assert.ok(schedule.some((task) => task.task === 'test_send_simulator' && task.produces.includes('no_send_proof')));
  assert.ok(schedule.some((task) => task.task === 'link_health_check'));
  assert.ok(schedule.some((task) => task.task === 'metrics_rollup'));

  for (const task of schedule) {
    assert.equal(task.enabled, false);
    assert.equal(task.dryRunOnly, true);
    assert.equal(task.sendsMessages, false);
    assert.equal(task.failureAction, 'alert_ops_and_keep_kill_switches_off');
    assert.equal(task.auditEventRequired, true);
  }
});

test('no-send proof explicitly reports no live send, provider push, export, SMS, or broad audience action surface', () => {
  const proof = proveNoSendSurface();

  assert.equal(proof.outboundEmailDefault, 'blocked');
  assert.equal(proof.providerPushDefault, 'blocked');
  assert.equal(proof.exportsDefault, 'blocked');
  assert.equal(proof.smsDefault, 'blocked');
  assert.equal(proof.liveSendFunctionsImplemented, false);
  assert.equal(proof.providerPushFunctionsImplemented, false);
  assert.equal(proof.broadAudienceActionsAllowed, false);
  assert.ok(proof.requiredBeforeAnyTinyEmailTest.includes('cohort_cap_enforced'));
});
