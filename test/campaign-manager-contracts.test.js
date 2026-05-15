import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RISKY_ACTIONS,
  createOfferCatalogRecord,
  createPreferenceProfile,
  recordAttributionEvent,
  evaluateReadinessGates,
  simulateCampaign,
  summarizeRevenueDashboard,
  attemptRiskyAction,
} from '../src/crm/campaignManager.js';

const approvedOffer = createOfferCatalogRecord({
  id: 'offer-1',
  vendor: 'Example AI',
  category: 'ai_assistant',
  offerName: 'Example AI Pro',
  payoutType: 'cpa',
  estimatedPayout: 25,
  epc: 1.5,
  landingUrl: 'https://example.com/partner',
  approvalStatus: 'approved',
  complianceNotes: 'Affiliate disclosure required before click.',
  targetPersona: 'solo_consultant',
  riskTier: 'low',
  disclosure: 'We may earn a commission if you buy through this link.',
  claimRestrictions: ['no ROI guarantee'],
  allowedSurfaces: ['/tools-by-job/consultants'],
  goSlug: 'example-ai-pro',
});

test('offer catalog rejects activation when approval, disclosure, risk, or landing URL is missing', () => {
  const draft = createOfferCatalogRecord({
    id: 'offer-draft',
    vendor: 'Draft Vendor',
    category: 'automation',
    offerName: 'Draft Offer',
    approvalStatus: 'draft',
    targetPersona: 'agency_owner',
    riskTier: 'medium',
    disclosure: 'Affiliate disclosure.',
    landingUrl: 'https://example.invalid',
    claimRestrictions: ['needs terms review'],
  });

  assert.equal(draft.goLink.allowed, false);
  assert.ok(draft.goLink.reasons.includes('offer approval_status must be approved'));

  const incomplete = createOfferCatalogRecord({
    id: 'offer-incomplete',
    vendor: 'Incomplete Vendor',
    category: 'crm',
    offerName: 'Incomplete CRM',
    approvalStatus: 'approved',
  });

  assert.equal(incomplete.goLink.allowed, false);
  assert.ok(incomplete.goLink.reasons.includes('offer landing_url is required'));
  assert.ok(incomplete.goLink.reasons.includes('offer disclosure is required'));
  assert.ok(incomplete.goLink.reasons.includes('offer risk_tier is required'));
  assert.ok(incomplete.goLink.reasons.includes('offer target_persona is required'));
  assert.ok(incomplete.goLink.reasons.includes('offer claim_restrictions are required'));
});

test('preference profile masks raw contact fields and treats unknown consent as not eligible', () => {
  const profile = createPreferenceProfile({
    profileId: 'profile-1',
    visitorSessionId: 'session-1',
    email: 'boss@example.com',
    role: 'consultant',
    businessType: 'solo',
    interests: ['automation', 'crm'],
    quizAnswers: { budget_range: '$50-$200', current_tools: ['Sheets'] },
    topics: ['ai_tools'],
    preferredChannel: 'email',
    source: { page: '/ai-tool-stack-quiz', route: '/ai-tool-stack-quiz', utm: { source: 'organic' } },
    consent: { state: 'unknown', basis: null },
  });

  assert.equal(profile.contact.email, '[redacted]');
  assert.equal(profile.eligibility.channelEligible, false);
  assert.ok(profile.eligibility.exclusionReasons.includes('consent state is not opted_in'));
  assert.ok(profile.auditEvent.type === 'preference_updated');
});

test('attribution ledger links quiz, go clicks, campaign/cohort, UTM, affiliate id, and revenue without raw PII', () => {
  const event = recordAttributionEvent({
    type: 'go_clicked',
    surfaceId: 'surface-consultants',
    visitorSessionId: 'session-1',
    profileId: 'profile-1',
    email: 'boss@example.com',
    persona: 'solo_consultant',
    sourcePage: '/tools-by-job/consultants',
    utm: { source: 'organic', campaign: 'tools-by-job' },
    affiliateId: 'aff-123',
    offerId: approvedOffer.id,
    goSlug: approvedOffer.goSlug,
    campaignId: 'campaign-draft-1',
    segmentId: 'fresh-intent-consultants',
    cohortId: 'cohort-a',
    revenueAmount: 12.5,
    currency: 'USD',
    confidence: 0.8,
    disclosureSeen: true,
  });

  assert.equal(event.type, 'go_clicked');
  assert.equal(event.rawPiiPresent, false);
  assert.equal(event.offerId, approvedOffer.id);
  assert.equal(event.affiliateId, 'aff-123');
  assert.equal(event.revenueAmount, 12.5);
  assert.equal(event.email, undefined);
});

test('readiness gate hard-blocks suppressed, unsubscribed, unknown consent/source, missing provider/DNS, missing audit, and raw PII controls', () => {
  const gate = evaluateReadinessGates({
    segment: {
      id: 'legacy-unknown',
      eligibleCount: 1000000,
      sourceClassification: 'unknown',
      consentState: 'unknown',
      suppressionStatus: 'unchecked',
      unsubscribeStatus: 'missing',
    },
    providerReadiness: { providerStatus: 'not_configured', dnsStatus: 'missing', webhooksVerified: false },
    controls: { auditEnabled: false, monitoringEnabled: false, rawPiiMasked: false },
    requestedAction: 'send',
  });

  assert.equal(gate.state, 'NO-GO');
  assert.equal(gate.allowed, false);
  assert.ok(gate.failedGates.includes('segment source classification is not fresh_intent or opt_in'));
  assert.ok(gate.failedGates.includes('consent/source classification incomplete'));
  assert.ok(gate.failedGates.includes('suppression has not been checked and applied'));
  assert.ok(gate.failedGates.includes('unsubscribe/preference path is not live'));
  assert.ok(gate.failedGates.includes('provider readiness is not approved_controlled'));
  assert.ok(gate.failedGates.includes('DNS readiness is not green'));
  assert.ok(gate.failedGates.includes('audit logging is not enabled'));
  assert.ok(gate.failedGates.includes('monitoring is not enabled'));
  assert.ok(gate.failedGates.includes('raw PII masking/control is not enabled'));
});

test('campaign simulator returns economics, risk, confidence, failed gates, and GO/WATCH/NO-GO without live action capability', () => {
  const simulation = simulateCampaign({
    segment: {
      id: 'fresh-consultants',
      eligibleCount: 1000,
      sourceClassification: 'fresh_intent',
      consentState: 'opted_in',
      suppressionStatus: 'applied',
      unsubscribeStatus: 'live',
    },
    offer: approvedOffer,
    channel: 'onsite',
    assumptions: {
      ctr: 0.08,
      cvr: 0.05,
      epc: 1.5,
      complaintRisk: 0.0001,
      unsubscribeRisk: 0.001,
      confidence: 0.82,
    },
    providerReadiness: { providerStatus: 'dry_run', dnsStatus: 'not_required', webhooksVerified: false },
    controls: { auditEnabled: true, monitoringEnabled: true, rawPiiMasked: true },
  });

  assert.equal(simulation.state, 'GO');
  assert.equal(simulation.liveActionsEnabled, false);
  assert.equal(simulation.projected.clicks, 80);
  assert.equal(simulation.projected.conversions, 4);
  assert.equal(simulation.projected.revenue, 120);
  assert.deepEqual(simulation.requiredApprovals, []);

  const watch = simulateCampaign({
    segment: {
      id: 'fresh-small-signal',
      eligibleCount: 200,
      sourceClassification: 'fresh_intent',
      consentState: 'opted_in',
      suppressionStatus: 'applied',
      unsubscribeStatus: 'live',
    },
    offer: { ...approvedOffer, riskTier: 'medium' },
    channel: 'email',
    assumptions: { ctr: 0.04, cvr: 0.02, epc: 1, complaintRisk: 0.002, unsubscribeRisk: 0.02, confidence: 0.45 },
    providerReadiness: { providerStatus: 'approved_controlled', dnsStatus: 'green', webhooksVerified: true },
    controls: { auditEnabled: true, monitoringEnabled: true, rawPiiMasked: true },
  });

  assert.equal(watch.state, 'WATCH');
  assert.ok(watch.requiredApprovals.includes('smaller cap or seed/inbox test required'));

  const noGo = simulateCampaign({
    segment: { id: 'suppressed', eligibleCount: 50, sourceClassification: 'fresh_intent', consentState: 'opted_in', suppressionStatus: 'suppressed', unsubscribeStatus: 'live' },
    offer: approvedOffer,
    channel: 'email',
    assumptions: { ctr: 0.1, cvr: 0.1, epc: 3, confidence: 0.9 },
    providerReadiness: { providerStatus: 'approved_controlled', dnsStatus: 'green', webhooksVerified: true },
    controls: { auditEnabled: true, monitoringEnabled: true, rawPiiMasked: true },
  });

  assert.equal(noGo.state, 'NO-GO');
  assert.ok(noGo.failedGates.includes('segment is suppressed or contains suppressed records'));
});

test('risky send/export/provider_push attempts always write audit events and stay blocked until class gate passes', () => {
  for (const action of RISKY_ACTIONS) {
    const attempt = attemptRiskyAction({ action, actorId: 'operator-1', targetId: 'campaign-1' });

    assert.equal(attempt.allowed, false);
    assert.equal(attempt.state, 'blocked');
    assert.equal(attempt.auditEvent.action, action);
    assert.equal(attempt.auditEvent.decision, 'blocked');
    assert.ok(attempt.reason.includes('blocked until class gate passes'));
  }
});

test('revenue dashboard rolls up clicks, conversions, revenue, EPC, RPM by offer, persona, source, campaign, segment, and risk', () => {
  const events = [
    recordAttributionEvent({ type: 'page_view', surfaceId: 'surface-1', persona: 'solo_consultant', sourcePage: '/tools-by-job/consultants', riskTier: 'low' }),
    recordAttributionEvent({ type: 'go_clicked', offerId: 'offer-1', persona: 'solo_consultant', sourcePage: '/tools-by-job/consultants', campaignId: 'campaign-1', segmentId: 'seg-1', revenueAmount: 10, riskTier: 'low' }),
    recordAttributionEvent({ type: 'conversion_reported', offerId: 'offer-1', persona: 'solo_consultant', sourcePage: '/tools-by-job/consultants', campaignId: 'campaign-1', segmentId: 'seg-1', revenueAmount: 25, riskTier: 'low' }),
    recordAttributionEvent({ type: 'go_clicked', offerId: 'offer-2', persona: 'creator', sourcePage: '/tools-by-job/creators', campaignId: 'campaign-2', segmentId: 'seg-2', revenueAmount: 5, riskTier: 'medium' }),
  ];

  const dashboard = summarizeRevenueDashboard(events);

  assert.equal(dashboard.totals.views, 1);
  assert.equal(dashboard.totals.clicks, 2);
  assert.equal(dashboard.totals.conversions, 1);
  assert.equal(dashboard.totals.revenue, 40);
  assert.equal(dashboard.totals.epc, 20);
  assert.equal(dashboard.totals.rpm, 40000);
  assert.equal(dashboard.byOffer['offer-1'].revenue, 35);
  assert.equal(dashboard.byPersona.solo_consultant.clicks, 1);
  assert.equal(dashboard.bySource['/tools-by-job/consultants'].conversions, 1);
  assert.equal(dashboard.byCampaign['campaign-1'].revenue, 35);
  assert.equal(dashboard.bySegment['seg-2'].clicks, 1);
  assert.equal(dashboard.byRisk.medium.revenue, 5);
});
