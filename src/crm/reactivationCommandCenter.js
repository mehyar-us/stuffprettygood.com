const REDACTED = '[redacted]';

export const CONTACT_TIERS = Object.freeze({
  TIER_1: 'tier_1_clean_money',
  TIER_2: 'tier_2_dormant_email_repermission',
  TIER_3: 'tier_3_unknown_provenance_quarantine',
  TIER_4: 'tier_4_sms_no_written_consent',
});

export const BLOCKER_CLASSES = Object.freeze([
  'blocked_missing_source_proof',
  'blocked_suppression_incomplete',
  'blocked_unsubscribe_not_ready',
  'blocked_provider_not_ready',
  'blocked_sms_no_written_consent',
  'blocked_shaft_high_risk_content',
  'blocked_unknown_provenance',
  'blocked_copy_claims',
  'blocked_subject_header',
  'blocked_sponsor_data_transfer',
  'blocked_amazon_paapi_or_scrape',
  'blocked_affiliate_terms_unknown',
  'blocked_raw_pii_exposure',
  'blocked_complaint_danger',
  'blocked_boss_approval_required',
]);

export const REQUIRED_WAR_ROOM_FIELDS = Object.freeze([
  'collected_under_brand',
  'email_source',
  'sms_source',
  'consent_text_ref',
  'opt_in_date',
  'last_open_at',
  'last_click_at',
  'last_purchase_at',
  'interest_category',
  'state_or_region',
  'country',
  'unsubscribe_status',
  'complaint_status',
  'bounce_status',
  'age_sensitive_category_flag',
  'revenue_bucket',
  'evidence_ref',
]);

const HIGH_RISK_OFFER_CATEGORIES = Object.freeze(['crypto', 'debt', 'loans', 'adult', 'dating', 'cannabis', 'tobacco', 'alcohol', 'gambling', 'medical_claims', 'legal_claims', 'insurance_claims']);

export function createContactSourceRecord(input = {}) {
  const fieldPresence = input.fieldPresence || input.field_presence || {};
  const missingRequiredFields = REQUIRED_WAR_ROOM_FIELDS.filter((field) => fieldPresence[field] === false || fieldPresence[field] == null);
  const sourceQualityScore = clamp01(input.sourceQualityScore ?? input.source_quality_score ?? qualityFromEvidence(input.consentEvidenceQuality || input.consent_evidence_quality));
  const approvalFlags = arrayOf(input.approvalFlags || input.approval_flags);
  const inspectedAt = input.inspectedAt || input.inspected_at || new Date().toISOString();

  return {
    sourceId: input.sourceId || input.source_id || null,
    sourceSystem: input.sourceSystem || input.source_system || null,
    sourceTableRef: input.sourceTableRef || input.source_table_ref || null,
    ownerBrand: input.ownerBrand || input.owner_brand || null,
    collectedUnderBrand: input.collectedUnderBrand || input.collected_under_brand || null,
    sourceChannel: input.sourceChannel || input.source_channel || 'unknown',
    relationshipType: input.relationshipType || input.relationship_type || 'unknown',
    estimatedRowCount: integerOrZero(input.estimatedRowCount ?? input.estimated_row_count),
    acquisitionAgeDays: integerOrNull(input.acquisitionAgeDays ?? input.acquisition_age_days),
    consentEvidenceQuality: input.consentEvidenceQuality || input.consent_evidence_quality || 'unknown',
    sourceQualityScore,
    fieldPresence,
    missingRequiredFields,
    approvalFlags,
    defaultState: missingRequiredFields.includes('collected_under_brand') || missingRequiredFields.includes('consent_text_ref') ? 'quarantine' : 'watch',
    rawPiiRendered: false,
    lastInspectedAt: inspectedAt,
    auditEvent: {
      type: 'source_inspected',
      sourceId: input.sourceId || input.source_id || null,
      missingRequiredFields,
      rawPiiPresent: false,
      occurredAt: inspectedAt,
    },
  };
}

export function createFieldMapping({ sourceId = null, mappings = {}, confidence = 0, reviewer = null, now = new Date().toISOString() } = {}) {
  const canonicalFields = {};
  const missingRequiredFields = [];
  for (const field of REQUIRED_WAR_ROOM_FIELDS) {
    if (mappings[field]) canonicalFields[field] = mappings[field];
    else missingRequiredFields.push(field);
  }

  return {
    sourceId,
    canonicalFields,
    fieldMapConfidence: clamp01(confidence),
    missingRequiredFields,
    reviewer,
    rawPiiRendered: false,
    auditEvent: {
      type: 'field_map_saved',
      sourceId,
      mappedFieldCount: Object.keys(canonicalFields).length,
      missingRequiredFields,
      occurredAt: now,
    },
  };
}

export function classifyContactTier(input = {}) {
  const reasons = [];
  const suppression = input.suppression || input.suppressionStatus || input.suppression_status || {};
  const isSuppressed = Boolean(suppression.active || input.unsubscribed || input.complained || input.bounced || input.legalSuppression || input.legal_suppression);
  const hasSourceProof = Boolean(input.sourceProof || input.source_proof || input.sourceKnown || input.source_known);
  const hasBrand = Boolean(input.brand || input.collectedUnderBrand || input.collected_under_brand);
  const hasConsentRef = Boolean(input.consentTextRef || input.consent_text_ref || input.consentEvidenceRef || input.consent_evidence_ref);
  const acquisitionAgeDays = integerOrNull(input.acquisitionAgeDays ?? input.acquisition_age_days);
  const sameBrandOrCategory = input.sameBrandOrCategory ?? input.same_brand_or_category ?? false;
  const recentEngagement = Boolean(input.recentEngagement || input.recent_engagement || input.recentCustomer || input.recent_customer);
  const plausibleFirstPartyRelationship = Boolean(input.plausibleFirstPartyRelationship || input.plausible_first_party_relationship);
  const privacyAllowsBrandComms = Boolean(input.privacyAllowsBrandComms || input.privacy_allows_brand_comms);
  const smsWrittenConsent = Boolean(input.smsWrittenConsent || input.sms_written_consent);
  const channelRequested = input.channel || 'email';

  let tier = CONTACT_TIERS.TIER_3;
  let emailEligibilityStatus = 'blocked';
  let smsEligibilityStatus = smsWrittenConsent ? 'review_required' : 'blocked';
  let quarantineReason = null;

  if (isSuppressed) {
    reasons.push('suppression overrides eligibility');
    quarantineReason = 'suppressed_or_complained_or_bounced';
  }
  if (!hasSourceProof || !hasBrand || !hasConsentRef) {
    reasons.push('missing reliable source, brand, or consent evidence');
    quarantineReason ||= 'unknown_provenance';
  }

  if (!isSuppressed && hasSourceProof && hasBrand && hasConsentRef && recentEngagement && sameBrandOrCategory) {
    tier = CONTACT_TIERS.TIER_1;
    emailEligibilityStatus = 'eligible_for_review';
  } else if (!isSuppressed && hasSourceProof && hasBrand && hasConsentRef && plausibleFirstPartyRelationship && privacyAllowsBrandComms) {
    tier = CONTACT_TIERS.TIER_2;
    emailEligibilityStatus = 'repermission_only';
    reasons.push('Tier 2 is limited to low-pressure re-permission/return-credit email only');
  } else if (!isSuppressed && !smsWrittenConsent && channelRequested === 'sms') {
    tier = CONTACT_TIERS.TIER_4;
    quarantineReason = 'sms_no_written_marketing_consent';
  }

  if (!smsWrittenConsent) {
    smsEligibilityStatus = 'blocked_no_written_marketing_consent';
    if (channelRequested === 'sms') {
      tier = CONTACT_TIERS.TIER_4;
      quarantineReason = 'sms_no_written_marketing_consent';
    }
  } else if (!isSuppressed) {
    smsEligibilityStatus = 'eligible_for_gate_review';
  }

  if (tier === CONTACT_TIERS.TIER_3 && !quarantineReason) quarantineReason = 'unknown_provenance';

  return {
    contactRef: input.contactRef || input.contact_ref || null,
    maskedContact: maskContact(input),
    tier,
    emailEligibilityStatus,
    smsEligibilityStatus,
    channelEligibility: {
      email: emailEligibilityStatus,
      sms: smsEligibilityStatus,
    },
    quarantineReason,
    classifierVersion: input.classifierVersion || input.classifier_version || 'a-to-z-2026-05-15',
    eligibilityLastReviewedAt: input.now || input.eligibilityLastReviewedAt || input.eligibility_last_reviewed_at || new Date().toISOString(),
    acquisitionAgeDays,
    missingEvidenceReasons: reasons,
    rawPiiRendered: false,
  };
}

export function buildCleanSegmentPreview(input = {}) {
  const targetCount = integerOrZero(input.targetCount ?? input.target_count);
  const candidateCount = integerOrZero(input.candidateCount ?? input.candidate_count);
  const suppressionCount = integerOrZero(input.suppressionCount ?? input.suppression_count);
  const unknownProvenanceCount = integerOrZero(input.unknownProvenanceCount ?? input.unknown_provenance_count);
  const smsNoConsentCount = integerOrZero(input.smsNoConsentCount ?? input.sms_no_consent_count);
  const highRiskCategoryCount = integerOrZero(input.highRiskCategoryCount ?? input.high_risk_category_count);
  const eligibleCount = Math.max(0, candidateCount - suppressionCount - unknownProvenanceCount - smsNoConsentCount - highRiskCategoryCount);
  const blockerClasses = [];

  if (suppressionCount > 0 || input.suppressionStatus === 'unchecked' || input.suppression_status === 'unchecked') blockerClasses.push('blocked_suppression_incomplete');
  if (unknownProvenanceCount > 0) blockerClasses.push('blocked_unknown_provenance');
  if (smsNoConsentCount > 0 && (input.channel === 'sms')) blockerClasses.push('blocked_sms_no_written_consent');
  if (highRiskCategoryCount > 0) blockerClasses.push('blocked_shaft_high_risk_content');
  if (!input.sourceProofReviewed && !input.source_proof_reviewed) blockerClasses.push('blocked_missing_source_proof');

  const state = blockerClasses.length > 0 ? 'NO-GO' : eligibleCount >= targetCount && targetCount > 0 ? 'GO' : 'WATCH';

  return {
    previewId: input.previewId || input.preview_id || null,
    queryMode: 'count_only',
    filters: input.filters || {},
    targetCount,
    candidateCount,
    suppressionCount,
    unknownProvenanceCount,
    smsNoConsentCount,
    highRiskCategoryCount,
    eligibleCount,
    suppressionOverlapRate: candidateCount > 0 ? round4(suppressionCount / candidateCount) : 0,
    confidence: clamp01(input.confidence ?? 0),
    sourceAgeDays: integerOrNull(input.sourceAgeDays ?? input.source_age_days),
    expiresAt: input.expiresAt || input.expires_at || hoursFromNow(24),
    state,
    blockerClasses: unique(blockerClasses),
    proofPacket: {
      aggregateOnly: true,
      noListSaleRental: true,
      noConsentTransfer: true,
      rawPiiIncluded: false,
      allowedExport: 'aggregate_buckets_only',
    },
  };
}

export function createSponsorPilot(input = {}) {
  const riskFlags = [];
  if (input.requestsRawData || input.requests_raw_data || input.requestsListRental || input.requests_list_rental) riskFlags.push('blocked_sponsor_data_transfer');
  if (HIGH_RISK_OFFER_CATEGORIES.includes(input.category)) riskFlags.push('blocked_shaft_high_risk_content');
  if (!input.noDataTransferAcknowledged && !input.no_data_transfer_acknowledged) riskFlags.push('blocked_sponsor_data_transfer');
  if (!input.aggregateReportingOnly && !input.aggregate_reporting_only) riskFlags.push('blocked_sponsor_data_transfer');
  if (!input.proofPacketId && !input.proof_packet_id) riskFlags.push('blocked_missing_source_proof');

  const status = riskFlags.length > 0 ? 'blocked' : input.status || 'reviewed';
  const approvalStatus = status === 'blocked' ? 'no_go' : 'watch';

  return {
    sponsorId: input.sponsorId || input.sponsor_id || null,
    company: input.company || null,
    website: input.website || null,
    category: input.category || null,
    sourceUrl: input.sourceUrl || input.source_url || null,
    contactRoute: input.contactRoute || input.contact_route || 'manual_gmail',
    owner: input.owner || null,
    outreachStatus: input.outreachStatus || input.outreach_status || 'sourced',
    offerLane: input.offerLane || input.offer_lane || 'sponsor_funded_reactivation_pilot',
    packagePrice: numericOrZero(input.packagePrice ?? input.package_price ?? 5000),
    performanceOption: input.performanceOption || input.performance_option || null,
    noDataTransferAcknowledged: Boolean(input.noDataTransferAcknowledged || input.no_data_transfer_acknowledged),
    exclusivePlacementOnly: input.exclusivePlacementOnly ?? input.exclusive_placement_only ?? true,
    aggregateReportingOnly: Boolean(input.aggregateReportingOnly || input.aggregate_reporting_only),
    sponsorDisclosureRequired: input.sponsorDisclosureRequired ?? input.sponsor_disclosure_required ?? true,
    proofPacketId: input.proofPacketId || input.proof_packet_id || null,
    contractStatus: input.contractStatus || input.contract_status || 'not_started',
    approvalStatus,
    riskFlags: unique(riskFlags),
    status,
    rawPiiIncluded: false,
    auditEvent: { type: 'sponsor_created', sponsorId: input.sponsorId || input.sponsor_id || null, status, riskFlags: unique(riskFlags) },
  };
}

export function logManualSponsorOutreach(input = {}) {
  const blocked = Boolean(input.audienceListRequested || input.audience_list_requested || input.dataTransferRequested || input.data_transfer_requested);
  return {
    outreachId: input.outreachId || input.outreach_id || null,
    sponsorId: input.sponsorId || input.sponsor_id || null,
    channel: 'manual_gmail',
    status: blocked ? 'no_go' : input.status || 'contacted',
    copyVersion: input.copyVersion || input.copy_version || null,
    claimsUsed: arrayOf(input.claimsUsed || input.claims_used),
    objection: input.objection || null,
    nextStep: blocked ? 'reject_data_transfer_request' : input.nextStep || input.next_step || 'manual_follow_up',
    blockerClass: blocked ? 'blocked_sponsor_data_transfer' : null,
    subscriberBlastEnabled: false,
    rawAudienceDataIncluded: false,
    auditEvent: { type: 'sponsor_outreach_sent', sponsorId: input.sponsorId || input.sponsor_id || null, decision: blocked ? 'blocked' : 'logged' },
  };
}

export function createReactivationWorkflow(input = {}) {
  const pageType = input.pageType || input.page_type || 'preference_reactivation';
  const requiredLinks = arrayOf(input.requiredLinks || input.required_links);
  const brandIdentity = input.brandIdentity || input.brand_identity || null;
  const claimsGuaranteedReward = Boolean(input.claimsGuaranteedReward || input.claims_guaranteed_reward);
  const blockers = [];
  for (const link of ['privacy', 'disclosure', 'unsubscribe']) {
    if (!requiredLinks.includes(link)) blockers.push(`missing_${link}_link`);
  }
  if (!brandIdentity) blockers.push('missing_brand_identity');
  if (claimsGuaranteedReward) blockers.push('blocked_copy_claims');

  return {
    workflowId: input.workflowId || input.workflow_id || null,
    pageType,
    brandIdentity,
    preferenceTaxonomy: arrayOf(input.preferenceTaxonomy || input.preference_taxonomy || ['ai_tools', 'savings', 'software', 'templates', 'business_help', 'job_career', 'local_deals', 'practical_offers']),
    events: ['page_view', 'preference_updated', 'opt_in_submitted', 'unsubscribe', 'return_credit_claimed', 'sponsor_placement_click'],
    copyReviewStatus: blockers.length === 0 ? 'ready_for_review' : 'blocked',
    blockerClasses: blockers,
    liveSendEnabled: false,
    rawPiiRendered: false,
  };
}

export function createSmsConsentRecord(input = {}) {
  const writtenMarketingConsent = Boolean(input.writtenMarketingConsent || input.written_marketing_consent);
  const reviewStatus = input.reviewStatus || input.review_status || 'pending';
  const hasEvidence = Boolean(input.consentTextRef || input.consent_text_ref || input.evidenceRef || input.evidence_ref);
  const blockers = [];
  if (!writtenMarketingConsent) blockers.push('blocked_sms_no_written_consent');
  if (!hasEvidence) blockers.push('blocked_missing_source_proof');
  if (reviewStatus !== 'approved') blockers.push('blocked_boss_approval_required');

  return {
    consentId: input.consentId || input.consent_id || null,
    phoneHash: input.phoneHash || input.phone_hash || (input.phone ? REDACTED : null),
    brand: input.brand || null,
    purpose: input.purpose || 'marketing',
    consentTextRef: input.consentTextRef || input.consent_text_ref || null,
    optInTimestamp: input.optInTimestamp || input.opt_in_timestamp || null,
    source: input.source || null,
    evidenceQuality: input.evidenceQuality || input.evidence_quality || 'unknown',
    writtenMarketingConsent,
    doubleOptIn: Boolean(input.doubleOptIn || input.double_opt_in),
    reviewStatus,
    smsEligibilityStatus: blockers.length === 0 ? 'eligible_for_provider_gate' : 'no_go',
    blockerClasses: unique(blockers),
    stopHelpYesReady: Boolean(input.stopHelpYesReady || input.stop_help_yes_ready),
    liveSmsEnabled: false,
    rawPiiRendered: false,
  };
}

export function evaluateSmallCohortApproval(input = {}) {
  const cap = integerOrZero(input.cap);
  const blockers = [];
  if (!input.segmentSnapshotId && !input.segment_snapshot_id) blockers.push('missing_segment_snapshot');
  if (!input.copyVersion && !input.copy_version) blockers.push('missing_copy_version');
  if (!input.seedDryRunRecorded && !input.seed_dry_run_recorded) blockers.push('missing_seed_dry_run');
  if (!input.providerGateApproved && !input.provider_gate_approved) blockers.push('blocked_provider_not_ready');
  if (!input.suppressionChecked && !input.suppression_checked) blockers.push('blocked_suppression_incomplete');
  if (!input.unsubscribeReady && !input.unsubscribe_ready) blockers.push('blocked_unsubscribe_not_ready');
  if (cap < 1 || cap > 10000) blockers.push('cap_must_be_1_to_10000');
  if (!input.bossApprovalRef && !input.boss_approval_ref) blockers.push('blocked_boss_approval_required');

  return {
    approvalId: input.approvalId || input.approval_id || null,
    cap,
    stopThresholds: input.stopThresholds || input.stop_thresholds || { complaintRate: 0.001, hardKillComplaintRate: 0.003 },
    state: blockers.length === 0 ? 'approved_for_tiny_scoped_test' : 'NO-GO',
    blockerClasses: unique(blockers),
    providerPushEnabled: false,
    liveSendEnabled: false,
    auditEvent: { type: 'small_cohort_approval_checked', decision: blockers.length === 0 ? 'approved_for_gate_review' : 'blocked', blockers: unique(blockers) },
  };
}

export function summarizeScaleKillDashboard(rows = []) {
  return rows.map((row) => {
    const complaintRate = numericOrZero(row.complaintRate ?? row.complaint_rate);
    const bounceRate = numericOrZero(row.bounceRate ?? row.bounce_rate);
    const unsubRate = numericOrZero(row.unsubscribeRate ?? row.unsubscribe_rate);
    const revenue = numericOrZero(row.revenue);
    const cost = numericOrZero(row.cost);
    const audience = Math.max(1, integerOrZero(row.audience || row.eligibleCount || row.eligible_count || 1));
    const rp1000 = round2((revenue / audience) * 1000);
    const cp1000 = round2((cost / audience) * 1000);
    const profitPer1000 = round2(rp1000 - cp1000);
    const blockers = arrayOf(row.blockerClasses || row.blocker_classes);
    let decision = blockers.length > 0 ? 'BLOCKED' : profitPer1000 > 0 ? 'GO' : 'WATCH';
    if (complaintRate >= 0.003 || row.providerWarning) decision = 'KILL';
    else if (complaintRate >= 0.001 || bounceRate >= 0.05 || unsubRate >= 0.01) decision = decision === 'GO' ? 'WATCH' : decision;

    return {
      entityId: row.entityId || row.entity_id || null,
      entityType: row.entityType || row.entity_type || 'segment_offer_channel',
      owner: row.owner || null,
      rp1000,
      cp1000,
      profitPer1000,
      complaintRate,
      bounceRate,
      unsubscribeRate: unsubRate,
      decision,
      blockerClasses: blockers,
      nextAction: decision === 'KILL' ? 'pause_and_review' : decision === 'BLOCKED' ? 'resolve_blocker' : 'review_for_next_cap',
      auditRequired: true,
      rawPiiRendered: false,
    };
  });
}

function maskContact(input) {
  return {
    email: input.email || input.rawEmail || input.raw_email ? REDACTED : null,
    phone: input.phone || input.rawPhone || input.raw_phone ? REDACTED : null,
  };
}

function qualityFromEvidence(value) {
  if (value === 'documented' || value === 'high') return 0.9;
  if (value === 'partial' || value === 'medium') return 0.5;
  return 0.1;
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function arrayOf(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value) return [value];
  return [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function numericOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function integerOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}
