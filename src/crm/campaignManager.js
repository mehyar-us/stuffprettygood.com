const APPROVED = 'approved';
const REDACTED = '[redacted]';

export const RISKY_ACTIONS = Object.freeze(['send', 'export', 'provider_push']);

export const ATTRIBUTION_EVENT_TYPES = Object.freeze([
  'page_view',
  'quiz_started',
  'quiz_answered',
  'quiz_completed',
  'result_viewed',
  'preference_updated',
  'opt_in_submitted',
  'offer_impression',
  'go_clicked',
  'conversion_reported',
  'conversion_imported',
  'checklist_downloaded',
  'template_downloaded',
  'setup_requested',
  'unsubscribe',
  'complaint',
  'bounce',
  'suppression_written',
]);

export function createOfferCatalogRecord(input = {}) {
  const offer = {
    id: input.id || input.offerId || null,
    vendor: input.vendor || null,
    category: input.category || null,
    offerName: input.offerName || input.offer_name || null,
    payoutType: input.payoutType || input.payout_type || null,
    estimatedPayout: numericOrNull(input.estimatedPayout ?? input.estimated_payout),
    epc: numericOrNull(input.epc ?? input.EPC),
    network: input.network || input.program || null,
    landingUrl: input.landingUrl || input.landing_url || null,
    goSlug: input.goSlug || input.go_slug || null,
    approvalStatus: input.approvalStatus || input.approval_status || 'draft',
    targetPersona: input.targetPersona || input.target_persona || null,
    allowedSurfaces: arrayOf(input.allowedSurfaces || input.allowed_surfaces),
    claimRestrictions: arrayOf(input.claimRestrictions || input.claim_restrictions),
    complianceNotes: input.complianceNotes || input.compliance_notes || null,
    disclosureRequired: input.disclosureRequired ?? input.disclosure_required ?? true,
    disclosure: input.disclosure || null,
    riskTier: input.riskTier || input.risk_tier || null,
    conversionConfidence: numericOrNull(input.conversionConfidence ?? input.conversion_confidence),
    lastReviewedAt: input.lastReviewedAt || input.last_reviewed_at || null,
    owner: input.owner || null,
    auditEventIds: arrayOf(input.auditEventIds || input.audit_event_ids),
  };

  offer.goLink = evaluateGoLinkActivation(offer);
  return offer;
}

export function evaluateGoLinkActivation(offer = {}) {
  const reasons = [];

  if (offer.approvalStatus !== APPROVED) reasons.push('offer approval_status must be approved');
  if (!offer.landingUrl) reasons.push('offer landing_url is required');
  if (offer.disclosureRequired !== false && !offer.disclosure) reasons.push('offer disclosure is required');
  if (!offer.riskTier) reasons.push('offer risk_tier is required');
  if (!offer.targetPersona) reasons.push('offer target_persona is required');
  if (!Array.isArray(offer.claimRestrictions) || offer.claimRestrictions.length === 0) {
    reasons.push('offer claim_restrictions are required');
  }

  return {
    allowed: reasons.length === 0,
    state: reasons.length === 0 ? 'active' : 'blocked',
    reasons,
    slug: offer.goSlug || null,
  };
}

export function createPreferenceProfile(input = {}) {
  const consent = input.consent || {};
  const source = input.source || {};
  const suppressionState = input.suppressionState || input.suppression_state || 'clear';
  const globalUnsubscribe = Boolean(input.globalUnsubscribe || input.global_unsubscribe);
  const brandUnsubscribe = Boolean(input.brandUnsubscribe || input.brand_unsubscribe);
  const exclusionReasons = [];

  if (consent.state !== 'opted_in') exclusionReasons.push('consent state is not opted_in');
  if (!source.page && !source.route && !input.sourcePage && !input.source_route) {
    exclusionReasons.push('source page/route is required');
  }
  if (globalUnsubscribe) exclusionReasons.push('global unsubscribe is active');
  if (brandUnsubscribe) exclusionReasons.push('brand unsubscribe is active');
  if (suppressionState !== 'clear') exclusionReasons.push(`suppression state is ${suppressionState}`);

  const profile = {
    profileId: input.profileId || input.profile_id || null,
    visitorSessionId: input.visitorSessionId || input.visitor_session_id || null,
    sourcePage: source.page || input.sourcePage || input.source_page || null,
    sourceRoute: source.route || input.sourceRoute || input.source_route || null,
    utm: source.utm || input.utm || {},
    referrer: source.referrer || input.referrer || null,
    role: input.role || input.persona || null,
    businessType: input.businessType || input.business_type || null,
    teamSize: input.teamSize || input.team_size || null,
    interests: arrayOf(input.interests || input.toolInterests || input.tool_interests),
    quizAnswers: input.quizAnswers || input.quiz_answers || {},
    topics: arrayOf(input.topics || input.topicPreferences || input.topic_preferences),
    preferredChannel: input.preferredChannel || input.preferred_channel || null,
    frequency: input.frequency || null,
    consent: {
      state: consent.state || 'unknown',
      basis: consent.basis || null,
      timestamp: consent.timestamp || input.consentTimestamp || input.consent_timestamp || null,
    },
    contact: {
      email: input.email ? REDACTED : null,
      phone: input.phone ? REDACTED : null,
      emailVerified: Boolean(input.emailVerified || input.email_verified),
    },
    globalUnsubscribe,
    brandUnsubscribe,
    suppressionState,
    eligibility: {
      channelEligible: exclusionReasons.length === 0,
      exclusionReasons,
    },
  };

  profile.auditEvent = {
    type: 'preference_updated',
    profileId: profile.profileId,
    visitorSessionId: profile.visitorSessionId,
    sourcePage: profile.sourcePage,
    consentState: profile.consent.state,
    suppressionState: profile.suppressionState,
    rawPiiPresent: false,
  };

  return profile;
}

export function recordAttributionEvent(input = {}) {
  const type = input.type || 'page_view';
  if (!ATTRIBUTION_EVENT_TYPES.includes(type)) {
    throw new Error(`unknown attribution event type: ${type}`);
  }

  return {
    eventId: input.eventId || input.event_id || `evt_${Math.random().toString(36).slice(2, 10)}`,
    type,
    occurredAt: input.occurredAt || input.occurred_at || new Date().toISOString(),
    surfaceId: input.surfaceId || input.surface_id || null,
    visitorSessionId: input.visitorSessionId || input.visitor_session_id || null,
    profileId: input.profileId || input.profile_id || null,
    persona: input.persona || null,
    sourcePage: input.sourcePage || input.source_page || null,
    utm: input.utm || {},
    referrer: input.referrer || null,
    affiliateId: input.affiliateId || input.affiliate_id || null,
    offerId: input.offerId || input.offer_id || null,
    goSlug: input.goSlug || input.go_slug || null,
    campaignId: input.campaignId || input.campaign_id || null,
    segmentId: input.segmentId || input.segment_id || null,
    cohortId: input.cohortId || input.cohort_id || null,
    riskTier: input.riskTier || input.risk_tier || null,
    revenueAmount: numericOrZero(input.revenueAmount ?? input.revenue_amount),
    currency: input.currency || 'USD',
    confidence: numericOrNull(input.confidence),
    disclosureSeen: Boolean(input.disclosureSeen || input.disclosure_seen),
    auditEventId: input.auditEventId || input.audit_event_id || null,
    rawPiiPresent: false,
  };
}

export function evaluateReadinessGates({ segment = {}, offer = null, channel = 'onsite', providerReadiness = {}, controls = {}, requestedAction = 'simulate' } = {}) {
  const failedGates = [];
  const sourceClassification = segment.sourceClassification || segment.source_classification;
  const consentState = segment.consentState || segment.consent_state;
  const suppressionStatus = segment.suppressionStatus || segment.suppression_status;
  const unsubscribeStatus = segment.unsubscribeStatus || segment.unsubscribe_status;

  if (suppressionStatus === 'suppressed') failedGates.push('segment is suppressed or contains suppressed records');
  if (suppressionStatus !== 'applied' && suppressionStatus !== 'clear') failedGates.push('suppression has not been checked and applied');
  if (unsubscribeStatus !== 'live' && (channel !== 'onsite' || ['send', 'export', 'provider_push'].includes(requestedAction))) {
    failedGates.push('unsubscribe/preference path is not live');
  }
  if (!['fresh_intent', 'opt_in'].includes(sourceClassification)) {
    failedGates.push('segment source classification is not fresh_intent or opt_in');
  }
  if (consentState !== 'opted_in' && (channel !== 'onsite' || ['send', 'export', 'provider_push'].includes(requestedAction))) {
    failedGates.push('consent/source classification incomplete');
  }

  if (offer && offer.goLink && offer.goLink.allowed === false) {
    failedGates.push('offer go link is not approved for activation');
  }

  if (['send', 'provider_push'].includes(requestedAction) || channel === 'email' || channel === 'sms') {
    if (providerReadiness.providerStatus !== 'approved_controlled') failedGates.push('provider readiness is not approved_controlled');
    if (providerReadiness.dnsStatus !== 'green') failedGates.push('DNS readiness is not green');
    if (!providerReadiness.webhooksVerified) failedGates.push('complaint/bounce/unsubscribe webhooks are not verified');
  }

  if (!controls.auditEnabled) failedGates.push('audit logging is not enabled');
  if (!controls.monitoringEnabled) failedGates.push('monitoring is not enabled');
  if (!controls.rawPiiMasked) failedGates.push('raw PII masking/control is not enabled');

  return {
    allowed: failedGates.length === 0,
    state: failedGates.length === 0 ? 'GO' : 'NO-GO',
    failedGates,
  };
}

export function simulateCampaign({ segment = {}, offer = {}, channel = 'onsite', assumptions = {}, providerReadiness = {}, controls = {} } = {}) {
  const ctr = numericOrZero(assumptions.ctr);
  const cvr = numericOrZero(assumptions.cvr);
  const epc = numericOrZero(assumptions.epc ?? offer.epc);
  const eligibleAudience = Math.max(0, Math.trunc(numericOrZero(segment.eligibleCount ?? segment.eligible_count)));
  const clicks = round2(eligibleAudience * ctr);
  const conversions = round2(clicks * cvr);
  const revenue = round2(clicks * epc);
  const confidence = numericOrZero(assumptions.confidence ?? offer.conversionConfidence);
  const complaintRisk = numericOrZero(assumptions.complaintRisk ?? assumptions.complaint_risk);
  const unsubscribeRisk = numericOrZero(assumptions.unsubscribeRisk ?? assumptions.unsubscribe_risk);

  const gate = evaluateReadinessGates({ segment, offer, channel, providerReadiness, controls, requestedAction: 'simulate' });
  const requiredApprovals = [];
  let state = gate.state;

  if (gate.allowed) {
    if (confidence < 0.6 || complaintRisk >= 0.001 || unsubscribeRisk >= 0.01 || offer.riskTier === 'medium' || offer.riskTier === 'high') {
      state = 'WATCH';
      requiredApprovals.push('smaller cap or seed/inbox test required');
      if (confidence < 0.6) requiredApprovals.push('more signal required before expansion');
      if (complaintRisk >= 0.001 || unsubscribeRisk >= 0.01) requiredApprovals.push('copy/risk revision required');
    } else {
      state = 'GO';
    }
  }

  return {
    simulationId: `sim_${Math.random().toString(36).slice(2, 10)}`,
    segmentId: segment.id || null,
    offerId: offer.id || null,
    channel,
    eligibleAudience,
    offerFitScore: offer.targetPersona && segment.persona && offer.targetPersona === segment.persona ? 1 : 0.75,
    complianceReadinessScore: gate.allowed ? 1 : 0,
    deliverabilityRiskScore: round2(complaintRisk + unsubscribeRisk),
    projected: { clicks, conversions, revenue, currency: 'USD' },
    riskEstimate: { complaintRisk, unsubscribeRisk },
    confidence,
    failedGates: gate.failedGates,
    state,
    requiredApprovals,
    killCriteria: [
      'complaints or unsubscribe risk exceeds approved threshold',
      'projected revenue no longer positive after actual EPC/CVR update',
      'missing disclosure, suppression, audit, or readiness evidence appears',
    ],
    assumptionsVisible: { ctr, cvr, epc, complaintRisk, unsubscribeRisk, confidence },
    liveActionsEnabled: false,
  };
}

export function attemptRiskyAction({ action, actorId = null, targetId = null, gate = null, now = new Date().toISOString() } = {}) {
  if (!RISKY_ACTIONS.includes(action)) {
    throw new Error(`unknown risky action: ${action}`);
  }

  const gatePassed = Boolean(gate?.allowed && gate?.state === 'GO' && gate?.classGatePassed === true);
  const allowed = false;
  const reason = gatePassed
    ? `${action} remains blocked in simulator/API-contract build; separate live activation implementation required`
    : `${action} blocked until class gate passes`;

  return {
    action,
    targetId,
    actorId,
    allowed,
    state: 'blocked',
    reason,
    auditEvent: {
      type: 'risky_action_attempted',
      action,
      targetId,
      actorId,
      decision: 'blocked',
      reason,
      occurredAt: now,
    },
  };
}

export function summarizeRevenueDashboard(events = []) {
  const dashboard = {
    totals: emptyRollup(),
    byOffer: {},
    byPersona: {},
    bySource: {},
    byCampaign: {},
    bySegment: {},
    byRisk: {},
  };

  for (const event of events) {
    addEventToRollup(dashboard.totals, event);
    addGrouped(dashboard.byOffer, event.offerId, event);
    addGrouped(dashboard.byPersona, event.persona, event);
    addGrouped(dashboard.bySource, event.sourcePage, event);
    addGrouped(dashboard.byCampaign, event.campaignId, event);
    addGrouped(dashboard.bySegment, event.segmentId, event);
    addGrouped(dashboard.byRisk, event.riskTier, event);
  }

  finalizeRollup(dashboard.totals);
  for (const group of [dashboard.byOffer, dashboard.byPersona, dashboard.bySource, dashboard.byCampaign, dashboard.bySegment, dashboard.byRisk]) {
    for (const rollup of Object.values(group)) finalizeRollup(rollup);
  }

  return dashboard;
}

function addGrouped(group, key, event) {
  if (!key) return;
  group[key] ||= emptyRollup();
  addEventToRollup(group[key], event);
}

function addEventToRollup(rollup, event) {
  if (event.type === 'page_view' || event.type === 'result_viewed') rollup.views += 1;
  if (event.type === 'go_clicked') rollup.clicks += 1;
  if (event.type === 'conversion_reported' || event.type === 'conversion_imported') rollup.conversions += 1;
  rollup.revenue = round2(rollup.revenue + numericOrZero(event.revenueAmount));
}

function finalizeRollup(rollup) {
  rollup.epc = rollup.clicks > 0 ? round2(rollup.revenue / rollup.clicks) : 0;
  rollup.rpm = rollup.views > 0 ? round2((rollup.revenue / rollup.views) * 1000) : 0;
}

function emptyRollup() {
  return { views: 0, clicks: 0, conversions: 0, revenue: 0, epc: 0, rpm: 0 };
}

function arrayOf(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value) return [value];
  return [];
}

function numericOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numericOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
