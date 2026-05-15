import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTACT_TIERS,
  BLOCKER_CLASSES,
  REQUIRED_WAR_ROOM_FIELDS,
  createContactSourceRecord,
  createFieldMapping,
  classifyContactTier,
  buildCleanSegmentPreview,
  createSponsorPilot,
  logManualSponsorOutreach,
  createReactivationWorkflow,
  createSmsConsentRecord,
  evaluateSmallCohortApproval,
  summarizeScaleKillDashboard,
} from '../src/crm/reactivationCommandCenter.js';

test('Contact War Room source records and field maps are aggregate/masked and audit source inspection', () => {
  const source = createContactSourceRecord({
    sourceId: 'src-legacy-a',
    sourceSystem: 'legacy_ionos',
    sourceTableRef: 'public.signup_metadata',
    ownerBrand: 'Mehyar Media',
    collectedUnderBrand: 'StuffPrettyGood',
    estimatedRowCount: 100000,
    consentEvidenceQuality: 'partial',
    fieldPresence: {
      collected_under_brand: true,
      email_source: true,
      sms_source: false,
      consent_text_ref: true,
      opt_in_date: true,
      last_open_at: true,
      last_click_at: true,
      last_purchase_at: true,
      interest_category: true,
      state_or_region: true,
      country: true,
      unsubscribe_status: true,
      complaint_status: true,
      bounce_status: true,
      age_sensitive_category_flag: true,
      revenue_bucket: true,
      evidence_ref: true,
    },
  });

  assert.equal(source.rawPiiRendered, false);
  assert.equal(source.auditEvent.type, 'source_inspected');
  assert.ok(source.missingRequiredFields.includes('sms_source'));
  assert.equal(source.defaultState, 'watch');

  const mapping = createFieldMapping({
    sourceId: source.sourceId,
    confidence: 0.72,
    mappings: Object.fromEntries(REQUIRED_WAR_ROOM_FIELDS.map((field) => [field, `mapped_${field}`])),
  });

  assert.equal(mapping.fieldMapConfidence, 0.72);
  assert.deepEqual(mapping.missingRequiredFields, []);
  assert.equal(mapping.rawPiiRendered, false);
  assert.equal(mapping.auditEvent.type, 'field_map_saved');
});

test('tier classifier separates Tier 1, Tier 2, Tier 3 quarantine, and Tier 4 SMS no-consent', () => {
  const tier1 = classifyContactTier({
    contactRef: 'hash-1',
    email: 'test-email-present',
    sourceKnown: true,
    brand: 'StuffPrettyGood',
    consentTextRef: 'consent-v1',
    recentEngagement: true,
    sameBrandOrCategory: true,
    smsWrittenConsent: false,
  });

  assert.equal(tier1.tier, CONTACT_TIERS.TIER_1);
  assert.equal(tier1.emailEligibilityStatus, 'eligible_for_review');
  assert.equal(tier1.smsEligibilityStatus, 'blocked_no_written_marketing_consent');
  assert.equal(tier1.maskedContact.email, '[redacted]');

  const tier2 = classifyContactTier({
    sourceKnown: true,
    brand: 'Owned Legacy Brand',
    consentTextRef: 'legacy-terms-ref',
    plausibleFirstPartyRelationship: true,
    privacyAllowsBrandComms: true,
  });

  assert.equal(tier2.tier, CONTACT_TIERS.TIER_2);
  assert.equal(tier2.emailEligibilityStatus, 'repermission_only');
  assert.ok(tier2.missingEvidenceReasons.some((reason) => reason.includes('re-permission')));

  const tier3 = classifyContactTier({ sourceKnown: false, brand: null, consentTextRef: null });
  assert.equal(tier3.tier, CONTACT_TIERS.TIER_3);
  assert.equal(tier3.quarantineReason, 'unknown_provenance');

  const tier4 = classifyContactTier({ channel: 'sms', sourceKnown: true, brand: 'StuffPrettyGood', consentTextRef: 'email-only', smsWrittenConsent: false });
  assert.equal(tier4.tier, CONTACT_TIERS.TIER_4);
  assert.equal(tier4.quarantineReason, 'sms_no_written_marketing_consent');
});

test('Clean Segment Finder is count-only, computes suppression overlap, and produces aggregate proof packets only', () => {
  const preview = buildCleanSegmentPreview({
    previewId: 'preview-1',
    channel: 'email',
    targetCount: 10000,
    candidateCount: 50000,
    suppressionCount: 1200,
    unknownProvenanceCount: 400,
    smsNoConsentCount: 0,
    highRiskCategoryCount: 0,
    sourceProofReviewed: true,
    confidence: 0.8,
    filters: { tier: ['tier_1_clean_money'], brand: 'StuffPrettyGood' },
  });

  assert.equal(preview.queryMode, 'count_only');
  assert.equal(preview.eligibleCount, 48400);
  assert.equal(preview.suppressionOverlapRate, 0.024);
  assert.equal(preview.proofPacket.aggregateOnly, true);
  assert.equal(preview.proofPacket.rawPiiIncluded, false);
  assert.ok(preview.blockerClasses.includes('blocked_suppression_incomplete'));
  assert.equal(preview.state, 'NO-GO');
});

test('Sponsor Pilot Manager and manual Gmail outreach enforce no data transfer and no audience blasting', () => {
  const sponsor = createSponsorPilot({
    sponsorId: 'sponsor-1',
    company: 'Example Sponsor',
    category: 'ai_tools',
    proofPacketId: 'packet-1',
    noDataTransferAcknowledged: true,
    aggregateReportingOnly: true,
    packagePrice: 5000,
  });

  assert.equal(sponsor.status, 'reviewed');
  assert.equal(sponsor.packagePrice, 5000);
  assert.equal(sponsor.rawPiiIncluded, false);
  assert.deepEqual(sponsor.riskFlags, []);

  const blockedSponsor = createSponsorPilot({ sponsorId: 'sponsor-2', requestsRawData: true, category: 'crypto' });
  assert.equal(blockedSponsor.status, 'blocked');
  assert.ok(blockedSponsor.riskFlags.includes('blocked_sponsor_data_transfer'));
  assert.ok(blockedSponsor.riskFlags.includes('blocked_shaft_high_risk_content'));

  const outreach = logManualSponsorOutreach({ sponsorId: 'sponsor-1', dataTransferRequested: true });
  assert.equal(outreach.channel, 'manual_gmail');
  assert.equal(outreach.status, 'no_go');
  assert.equal(outreach.subscriberBlastEnabled, false);
  assert.equal(outreach.rawAudienceDataIncluded, false);
  assert.equal(outreach.blockerClass, 'blocked_sponsor_data_transfer');
});

test('reactivation/preference/return-credit workflows require brand identity and required legal links with no live-send side effect', () => {
  const workflow = createReactivationWorkflow({
    workflowId: 'flow-1',
    pageType: 'return_credit',
    brandIdentity: 'StuffPrettyGood',
    requiredLinks: ['privacy', 'disclosure', 'unsubscribe'],
  });

  assert.equal(workflow.copyReviewStatus, 'ready_for_review');
  assert.equal(workflow.liveSendEnabled, false);
  assert.equal(workflow.rawPiiRendered, false);
  assert.ok(workflow.events.includes('return_credit_claimed'));

  const blocked = createReactivationWorkflow({ pageType: 'private_drop', claimsGuaranteedReward: true, requiredLinks: ['privacy'] });
  assert.equal(blocked.copyReviewStatus, 'blocked');
  assert.ok(blocked.blockerClasses.includes('missing_disclosure_link'));
  assert.ok(blocked.blockerClasses.includes('blocked_copy_claims'));
});

test('SMS Consent Vault keeps SMS no-go without documented written marketing consent, evidence, review, and provider gates', () => {
  const missing = createSmsConsentRecord({ phone: 'test-phone-present', brand: 'StuffPrettyGood' });
  assert.equal(missing.phoneHash, '[redacted]');
  assert.equal(missing.smsEligibilityStatus, 'no_go');
  assert.equal(missing.liveSmsEnabled, false);
  assert.ok(missing.blockerClasses.includes('blocked_sms_no_written_consent'));
  assert.ok(missing.blockerClasses.includes('blocked_missing_source_proof'));

  const reviewed = createSmsConsentRecord({
    consentId: 'sms-consent-1',
    phoneHash: 'hash-only',
    brand: 'StuffPrettyGood',
    consentTextRef: 'sms-consent-v1',
    writtenMarketingConsent: true,
    reviewStatus: 'approved',
    stopHelpYesReady: true,
  });

  assert.equal(reviewed.smsEligibilityStatus, 'eligible_for_provider_gate');
  assert.equal(reviewed.liveSmsEnabled, false);
  assert.deepEqual(reviewed.blockerClasses, []);
});

test('small-cohort approval requires seed/dry-run, provider/suppression/unsubscribe gates, cap, and Boss approval but never provider-pushes', () => {
  const blocked = evaluateSmallCohortApproval({ cap: 50000 });
  assert.equal(blocked.state, 'NO-GO');
  assert.ok(blocked.blockerClasses.includes('cap_must_be_1_to_10000'));
  assert.ok(blocked.blockerClasses.includes('blocked_provider_not_ready'));
  assert.equal(blocked.providerPushEnabled, false);
  assert.equal(blocked.liveSendEnabled, false);

  const approved = evaluateSmallCohortApproval({
    approvalId: 'approval-1',
    cap: 5000,
    segmentSnapshotId: 'snapshot-1',
    copyVersion: 'copy-v1',
    seedDryRunRecorded: true,
    providerGateApproved: true,
    suppressionChecked: true,
    unsubscribeReady: true,
    bossApprovalRef: 'approval-ref',
  });

  assert.equal(approved.state, 'approved_for_tiny_scoped_test');
  assert.equal(approved.liveSendEnabled, false);
  assert.deepEqual(approved.blockerClasses, []);
});

test('scale/kill dashboard computes RP1000/CP1000 and kills or blocks risky rows without raw PII', () => {
  const rows = summarizeScaleKillDashboard([
    { entityId: 'seg-offer-1', audience: 1000, revenue: 300, cost: 100, complaintRate: 0.0005, owner: 'Arman' },
    { entityId: 'seg-offer-2', audience: 1000, revenue: 100, cost: 50, complaintRate: 0.003, owner: 'Arman' },
    { entityId: 'seg-offer-3', audience: 1000, revenue: 200, cost: 100, blockerClasses: ['blocked_unknown_provenance'] },
  ]);

  assert.equal(rows[0].decision, 'GO');
  assert.equal(rows[0].rp1000, 300);
  assert.equal(rows[0].cp1000, 100);
  assert.equal(rows[0].profitPer1000, 200);
  assert.equal(rows[0].rawPiiRendered, false);
  assert.equal(rows[1].decision, 'KILL');
  assert.equal(rows[2].decision, 'BLOCKED');
  assert.equal(rows[2].nextAction, 'resolve_blocker');
});

test('blocker taxonomy includes required A-to-Z hard gates', () => {
  for (const blocker of ['blocked_sms_no_written_consent', 'blocked_sponsor_data_transfer', 'blocked_raw_pii_exposure', 'blocked_provider_not_ready']) {
    assert.ok(BLOCKER_CLASSES.includes(blocker));
  }
});
