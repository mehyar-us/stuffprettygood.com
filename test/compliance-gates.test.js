import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUIRED_SUPPRESSION_CATEGORIES,
  evaluateCampaignTransition,
  validateComplianceApproval,
  validateSuppressionApproval,
} from '../src/compliance/gates.js';

const completeSuppressionApproval = {
  state: 'approved',
  approvedBy: 'compliance-operator',
  approvedAt: '2026-04-29T13:30:00.000Z',
  blockedRecipientCount: 42,
  checkedCategories: REQUIRED_SUPPRESSION_CATEGORIES,
  unresolvedFindings: [],
};

const completeComplianceApproval = {
  state: 'approved',
  approvedBy: 'compliance-operator',
  approvedAt: '2026-04-29T13:31:00.000Z',
  legalBasis: 'reactivation-risk-reviewed',
  senderIdentityApproved: true,
  unsubscribeUrlVerified: true,
  smsStopHandlingVerified: true,
  unresolvedFindings: [],
};

test('campaign may stay in draft without approvals', () => {
  const decision = evaluateCampaignTransition({
    campaign: { id: 'campaign-1', channel: 'email' },
    targetStatus: 'draft',
    actorId: 'tester',
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.decision, 'allowed');
});

test('campaign cannot move to review without suppression and compliance approvals', () => {
  const decision = evaluateCampaignTransition({
    campaign: { id: 'campaign-2', channel: 'email' },
    targetStatus: 'review',
    actorId: 'tester',
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.decision, 'blocked');
  assert.ok(decision.reasons.includes('suppression approval state must be approved'));
  assert.ok(decision.reasons.includes('compliance approval state must be approved'));
});

test('suppression approval must check every required category', () => {
  const result = validateSuppressionApproval({
    ...completeSuppressionApproval,
    checkedCategories: ['global_unsubscribe'],
  });

  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('suppression category not checked: brand_unsubscribe'));
  assert.ok(result.reasons.includes('suppression category not checked: sms_stop'));
  assert.ok(result.reasons.includes('suppression category not checked: legal_suppression'));
});

test('email compliance requires verified unsubscribe URL', () => {
  const result = validateComplianceApproval(
    { ...completeComplianceApproval, unsubscribeUrlVerified: false },
    { channel: 'email' },
  );

  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('email campaign requires verified unsubscribe URL'));
});

test('SMS compliance requires verified STOP handling', () => {
  const result = validateComplianceApproval(
    { ...completeComplianceApproval, smsStopHandlingVerified: false },
    { channel: 'sms' },
  );

  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('SMS campaign requires verified STOP handling'));
});

test('campaign may move beyond draft only when all compliance gates pass', () => {
  const decision = evaluateCampaignTransition({
    campaign: {
      id: 'campaign-3',
      channel: 'email',
      suppressionApproval: completeSuppressionApproval,
      complianceApproval: completeComplianceApproval,
    },
    targetStatus: 'review',
    actorId: 'tester',
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.decision, 'allowed');
  assert.deepEqual(decision.reasons, []);
});
