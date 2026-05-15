import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { AuditLog } from '../src/core/audit.js';
import { AuthStore, seedAdmin } from '../src/core/auth.js';
import { createApp } from '../src/server.js';
import {
  CAMPAIGN_STATUSES,
  REQUIRED_SUPPRESSION_CATEGORIES,
  evaluateCampaignTransition,
} from '../src/compliance/gates.js';
import {
  SuppressionStore,
  buildSuppressionToken,
  evaluateContactEligibility,
} from '../src/compliance/suppression.js';

test('Phase 1 campaign status vocabulary excludes executable send states and uses truth-first review states', () => {
  assert.deepEqual(CAMPAIGN_STATUSES, [
    'draft',
    'evidence-needed',
    'compliance-review',
    'Boss-approval-needed',
    'ready-for-dry-run',
    'blocked',
  ]);
  assert.deepEqual(CAMPAIGN_STATUSES.includes('scheduled'), false);
  assert.deepEqual(CAMPAIGN_STATUSES.includes('active'), false);
  assert.deepEqual(CAMPAIGN_STATUSES.includes('sent'), false);
  assert.deepEqual(CAMPAIGN_STATUSES.includes('future_pilot_approved'), false);

  for (const targetStatus of ['scheduled', 'active', 'sent']) {
    const decision = evaluateCampaignTransition({
      campaign: { id: 'phase1-campaign', channel: 'email' },
      targetStatus,
      actorId: 'tester',
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.decision, 'blocked');
    assert.match(decision.reasons.join(';'), /unknown target status/);
  }
});

test('suppression approval requires every contact-level suppression source in the pilot taxonomy', () => {
  for (const category of [
    'global_unsubscribe',
    'brand_unsubscribe',
    'sms_stop',
    'spam_complaint',
    'hard_bounce',
    'soft_bounce_cooldown',
    'legal_suppression',
    'manual_suppression',
    'invalid_contact_point',
    'source_hold',
    'prohibited_source',
    'provider_warning_hold',
  ]) {
    assert.ok(REQUIRED_SUPPRESSION_CATEGORIES.includes(category), `${category} is required`);
  }
});

test('contact eligibility denies every required suppression category before a candidate can remain usable', () => {
  const store = new SuppressionStore();
  const contact = {
    contactHash: 'contact_hash_test_001',
    emailHash: 'email_hash_test_001',
    phoneHash: 'phone_hash_test_001',
    brandId: 'stuffprettygood.com',
    sourceId: 'legacy-source-1',
  };

  const categories = [
    ['global_unsubscribe', { channel: 'email', scope: 'global', emailHash: contact.emailHash }],
    ['brand_unsubscribe', { channel: 'email', brandId: contact.brandId, emailHash: contact.emailHash }],
    ['sms_stop', { channel: 'sms', scope: 'global', phoneHash: contact.phoneHash }],
    ['spam_complaint', { emailHash: contact.emailHash }],
    ['hard_bounce', { emailHash: contact.emailHash }],
    ['soft_bounce_cooldown', { emailHash: contact.emailHash, expiresAt: '2099-01-01T00:00:00.000Z' }],
    ['legal_suppression', { contactHash: contact.contactHash }],
    ['manual_suppression', { contactHash: contact.contactHash }],
    ['invalid_contact_point', { emailHash: contact.emailHash }],
    ['source_hold', { sourceId: contact.sourceId }],
    ['prohibited_source', { sourceId: contact.sourceId }],
    ['provider_warning_hold', { brandId: contact.brandId }],
  ];

  for (const [category, fields] of categories) {
    const isolated = new SuppressionStore();
    isolated.writeSuppression({ category, reason: 'test fixture', ...fields });
    const decision = evaluateContactEligibility(contact, { suppressionStore: isolated, brandId: contact.brandId, now: '2026-05-09T00:00:00.000Z' });
    assert.equal(decision.eligible, false, `${category} must block eligibility`);
    assert.ok(decision.matchedSuppressions.some((match) => match.category === category));
  }

  assert.equal(evaluateContactEligibility(contact, { suppressionStore: store, brandId: contact.brandId }).eligible, true);
});

test('public unsubscribe and STOP endpoints require no login, use opaque tokens, write suppressions, and audit without raw PII', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
  const suppressionStore = new SuppressionStore({ auditLog });
  const token = buildSuppressionToken('test-contact-opaque-token');
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, suppressionStore }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await requestJson(`${baseUrl}/api/preferences/unsubscribe`, {
      method: 'POST',
      body: { token, brandId: 'stuffprettygood.com', scope: 'brand_and_global', email: 'should-not-be-stored@example.test' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.massSendingEnabled, false);
    assert.equal(response.body.suppression.categories.includes('brand_unsubscribe'), true);
    assert.equal(response.body.suppression.categories.includes('global_unsubscribe'), true);
    assert.equal(JSON.stringify(response.body).includes('should-not-be-stored'), false);

    const contactHash = suppressionStore.contactHashFromToken(token);
    const eligibility = evaluateContactEligibility(
      { contactHash, emailHash: contactHash, brandId: 'stuffprettygood.com' },
      { suppressionStore, brandId: 'stuffprettygood.com' },
    );
    assert.equal(eligibility.eligible, false);

    const actions = auditLog.list({ limit: 10 }).map((event) => event.action);
    assert.ok(actions.includes('unsubscribe.email.recorded'));
    assert.ok(actions.includes('suppression.write'));
    assert.equal(JSON.stringify(auditLog.list({ limit: 10 })).includes('should-not-be-stored'), false);

    const stopResponse = await requestJson(`${baseUrl}/api/preferences/sms-stop`, {
      method: 'POST',
      body: { token, brandId: 'stuffprettygood.com', phone: '+155****0123' },
    });
    assert.equal(stopResponse.status, 200);
    assert.equal(stopResponse.body.ok, true);
    assert.equal(stopResponse.body.suppression.categories.includes('sms_stop'), true);
    assert.equal(JSON.stringify(stopResponse.body).includes('5555'), false);
    assert.ok(auditLog.list({ limit: 20 }).some((event) => event.action === 'sms_stop.recorded'));
    assert.equal(JSON.stringify(auditLog.list({ limit: 20 })).includes('+155****0123'), false);
  } finally {
    await close(server);
  }
});


test('consent review changes are authenticated, audited, and sanitized', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const denied = await requestJson(`${baseUrl}/api/consent-reviews`, {
      method: 'POST',
      body: { contactEmail: 'blocked@example.test', reviewStatus: 'remediation' },
    });
    assert.equal(denied.status, 401);

    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' },
    });

    const review = await requestJson(`${baseUrl}/api/consent-reviews`, {
      method: 'POST',
      headers: { authorization: `Bearer ${login.body.session.id}` },
      body: {
        contactHash: 'contact_hash_review_001',
        contactEmail: 'must-not-log@example.test',
        brandId: 'stuffprettygood.com',
        reviewStatus: 'remediation',
        consentChannel: 'email',
      },
    });

    assert.equal(review.status, 200);
    assert.equal(review.body.ok, true);
    assert.equal(JSON.stringify(review.body).includes('must-not-log'), false);

    const event = auditLog.list({ resourceType: 'consent_review', limit: 1 })[0];
    assert.equal(event.action, 'consent.review.changed');
    assert.equal(event.resourceId, 'contact_hash_review_001');
    assert.equal(event.metadata.brandId, 'stuffprettygood.com');
    assert.equal(JSON.stringify(event).includes('must-not-log'), false);
  } finally {
    await close(server);
  }
});

test('send, export, and provider push routes are hard-blocked and audited even when requested by an admin', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' },
    });
    assert.equal(login.status, 200);

    for (const path of ['/api/campaigns/send', '/api/campaigns/export', '/api/campaigns/provider-push']) {
      const denied = await requestJson(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${login.body.session.id}` },
        body: { campaignId: 'campaign-fixture' },
      });
      assert.equal(denied.status, 403);
      assert.equal(denied.body.massSendingEnabled, false);
      assert.match(denied.body.error, /blocked in Phase 1/);
    }

    const deniedActions = auditLog.list({ resourceType: 'execution_control', limit: 10 })
      .map((event) => event.action);
    assert.deepEqual(deniedActions.slice(0, 3), [
      'execution.provider_push.denied',
      'execution.export.denied',
      'execution.send.denied',
    ]);
  } finally {
    await close(server);
  }
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function requestJson(url, { method = 'GET', headers = {}, body = null } = {}) {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
