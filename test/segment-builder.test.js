import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_PREVIEW_LIMIT, evaluateSegmentPlan } from '../src/segments/builder.js';

test('segment builder blocks unsafe broad imports without source, date, counts, and suppression exclusion', () => {
  const plan = evaluateSegmentPlan({
    channel: 'email',
    filters: {
      email: { required: true },
      excludeSuppressed: false,
    },
    counts: { estimatedTotal: 200_000, suppressedCount: 0 },
    materialization: { requested: true },
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.preview.safe, false);
  assert.ok(plan.reasons.includes('at least one source filter is required'));
  assert.ok(plan.reasons.includes('bounded dateRange.from and dateRange.to are required'));
  assert.ok(plan.reasons.includes('suppressed records must be excluded'));
  assert.ok(plan.reasons.includes('safe count review is required before segment activation'));
  assert.ok(plan.materialization.reasons.includes('segment must pass safety checks before materialization'));
});

test('segment builder creates bounded read-only preview with suppression overlap counts', () => {
  const plan = evaluateSegmentPlan({
    name: 'Legacy explicit consent email reactivation',
    channel: 'email',
    filters: {
      sourceIds: ['legacy-ionos', 'legacy-ionos'],
      dateRange: { from: '2024-01-01', to: '2026-01-01' },
      email: { required: true, verifiedOnly: true },
      geo: { countries: ['US'], regions: ['CA', 'NY'] },
      consentStates: ['explicit'],
      excludeUnsubscribed: true,
      excludeSuppressed: true,
    },
    counts: {
      estimatedTotal: 9000,
      suppressedCount: 300,
      countsReviewedAt: '2026-04-29T13:45:00.000Z',
    },
    materialization: { requested: true, approved: true, limit: 5000 },
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.riskTier, 'low');
  assert.equal(plan.suppressionOverlap.usableCount, 8700);
  assert.equal(plan.suppressionOverlap.rate, 0.0333);
  assert.equal(plan.preview.safe, true);
  assert.equal(plan.preview.limit, MAX_PREVIEW_LIMIT);
  assert.match(plan.preview.query.text, /LIMIT 100$/);
  assert.match(plan.preview.query.text, /NOT EXISTS/);
  assert.deepEqual(plan.preview.query.parameters.sourceIds, ['legacy-ionos']);
  assert.equal(plan.materialization.allowed, true);
  assert.equal(plan.materialization.limit, 5000);
});

test('segment builder flags high risk materialization for high suppression overlap', () => {
  const plan = evaluateSegmentPlan({
    channel: 'sms',
    filters: {
      sourceIds: ['legacy-ionos'],
      dateRange: { from: '2024-01-01', to: '2026-01-01' },
      phone: { required: true },
      consentStates: ['unknown'],
    },
    counts: {
      estimatedTotal: 40_000,
      suppressedCount: 10_000,
      countsReviewedAt: '2026-04-29T13:45:00.000Z',
    },
    materialization: { requested: true, approved: true, limit: 10_000 },
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.riskTier, 'high');
  assert.equal(plan.materialization.allowed, false);
  assert.ok(plan.materialization.reasons.includes('high-risk segments require manual compliance review before materialization'));
});

test('segment builder enforces channel-specific contact filters', () => {
  const emailPlan = evaluateSegmentPlan({
    channel: 'email',
    filters: { sourceIds: ['legacy'], dateRange: { from: '2025-01-01', to: '2026-01-01' }, phone: { required: true } },
    counts: { estimatedTotal: 10, suppressedCount: 0, countsReviewedAt: '2026-04-29T13:45:00.000Z' },
  });
  assert.ok(emailPlan.reasons.includes('email channel requires email.required=true'));

  const smsPlan = evaluateSegmentPlan({
    channel: 'sms',
    filters: { sourceIds: ['legacy'], dateRange: { from: '2025-01-01', to: '2026-01-01' }, email: { required: true } },
    counts: { estimatedTotal: 10, suppressedCount: 0, countsReviewedAt: '2026-04-29T13:45:00.000Z' },
  });
  assert.ok(smsPlan.reasons.includes('SMS channel requires phone.required=true'));
});
