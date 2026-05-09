import test from 'node:test';
import assert from 'node:assert/strict';

import fs from 'node:fs';
import path from 'node:path';

import { MAX_PREVIEW_LIMIT, evaluateSegmentPlan } from '../src/segments/builder.js';

function withLegacyContactTable(value, fn) {
  const previous = process.env.LEGACY_CONTACT_TABLE;
  if (value === undefined) {
    delete process.env.LEGACY_CONTACT_TABLE;
  } else {
    process.env.LEGACY_CONTACT_TABLE = value;
  }

  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.LEGACY_CONTACT_TABLE;
    } else {
      process.env.LEGACY_CONTACT_TABLE = previous;
    }
  }
}

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

test('segment builder creates bounded read-only preview with configured legacy contact table', () => {
  withLegacyContactTable('crm_legacy_contacts', () => {
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
    assert.match(plan.preview.query.text, /FROM crm_legacy_contacts c WHERE/);
    assert.match(plan.preview.query.text, /LIMIT 100$/);
    assert.match(plan.preview.query.text, /NOT EXISTS \(SELECT 1 FROM suppressions s WHERE s\.contact_hash = c\.contact_hash\)/);
    assert.doesNotMatch(plan.preview.query.text, /legacy_signups/);
    assert.deepEqual(plan.preview.query.parameters.sourceIds, ['legacy-ionos']);
    assert.equal(plan.materialization.allowed, true);
    assert.equal(plan.materialization.limit, 5000);
  });
});

test('segment builder flags high risk materialization for high suppression overlap', () => {
  withLegacyContactTable('crm_legacy_contacts', () => {
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
});

test('segment builder rejects missing or unsafe legacy contact table config without pulling full tables', () => {
  withLegacyContactTable(undefined, () => {
    const plan = evaluateSegmentPlan({
      channel: 'email',
      filters: { sourceIds: ['legacy'], dateRange: { from: '2025-01-01', to: '2026-01-01' }, email: { required: true } },
      counts: { estimatedTotal: 10, suppressedCount: 0, countsReviewedAt: '2026-04-29T13:45:00.000Z' },
    });

    assert.equal(plan.ok, false);
    assert.equal(plan.preview.safe, false);
    assert.equal(plan.preview.query, null);
    assert.ok(plan.reasons.includes('LEGACY_CONTACT_TABLE server config is required'));
  });

  withLegacyContactTable('crm_legacy_contacts; DROP TABLE suppressions', () => {
    const plan = evaluateSegmentPlan({
      channel: 'email',
      filters: { sourceIds: ['legacy'], dateRange: { from: '2025-01-01', to: '2026-01-01' }, email: { required: true } },
      counts: { estimatedTotal: 10, suppressedCount: 0, countsReviewedAt: '2026-04-29T13:45:00.000Z' },
    });

    assert.equal(plan.ok, false);
    assert.equal(plan.preview.safe, false);
    assert.equal(plan.preview.query, null);
    assert.ok(plan.reasons.includes('LEGACY_CONTACT_TABLE must be a known-safe SQL identifier'));
  });
});

test('frontend and public assets do not bundle DB or table config names', () => {
  const roots = ['frontend', 'public'].map((entry) => path.join(process.cwd(), entry)).filter((entry) => fs.existsSync(entry));
  const forbidden = ['IONOS_PSQL_DB', 'LEGACY_CONTACT_TABLE'];

  for (const root of roots) {
    const stack = [root];
    while (stack.length > 0) {
      const current = stack.pop();
      const stat = fs.statSync(current);
      if (stat.isDirectory()) {
        for (const child of fs.readdirSync(current)) stack.push(path.join(current, child));
        continue;
      }
      const content = fs.readFileSync(current, 'utf8');
      for (const token of forbidden) {
        assert.equal(content.includes(token), false, `${token} leaked into ${path.relative(process.cwd(), current)}`);
      }
    }
  }
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
