import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { AuditLog } from '../src/core/audit.js';
import { AuthStore } from '../src/core/auth.js';
import { buildDashboard } from '../src/core/dashboard.js';
import { createApp } from '../src/server.js';

test('auth creates admin user, logs in, and validates session without exposing password hash', () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });

  const user = auth.createUser({ email: 'Admin@MehyarMedia.local', password: 'safe-local-password', role: 'admin' });
  assert.equal(user.email, 'admin@mehyarmedia.local');
  assert.equal(user.role, 'admin');
  assert.equal(Object.hasOwn(user, 'passwordHash'), false);

  const result = auth.login({ email: 'admin@mehyarmedia.local', password: 'safe-local-password' });
  assert.equal(result.ok, true);
  assert.equal(auth.getSession(result.session.id).role, 'admin');
  assert.equal(auditLog.count(), 2);
});

test('auth rejects invalid credentials and records failed login audit event', () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  auth.createUser({ email: 'ops@mehyarmedia.local', password: 'correct', role: 'operator' });

  const result = auth.login({ email: 'ops@mehyarmedia.local', password: 'wrong' });
  assert.equal(result.ok, false);
  assert.equal(auditLog.list({ limit: 1 })[0].action, 'auth.login.failed');
});

test('dashboard reports healthy shell, disabled mass sending, and audit readiness', () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  auth.createUser({ email: 'viewer@mehyarmedia.local', password: 'pw', role: 'viewer' });

  const dashboard = buildDashboard({ authStore: auth, auditLog, now: '2026-04-29T13:40:00.000Z' });

  assert.equal(dashboard.service.status, 'healthy');
  assert.equal(dashboard.service.massSendingEnabled, false);
  assert.equal(dashboard.auth.status, 'ready');
  assert.equal(dashboard.audit.status, 'ready');
  assert.equal(dashboard.widgets.campaigns.status, 'draft_only');
});

test('audit log stores immutable append-only events with newest first listing', () => {
  const auditLog = new AuditLog();
  const first = auditLog.record({ actorId: 'a1', action: 'first', resourceType: 'test', now: '2026-04-29T13:00:00.000Z' });
  auditLog.record({ actorId: 'a2', action: 'second', resourceType: 'test', now: '2026-04-29T13:01:00.000Z' });

  assert.throws(() => {
    first.action = 'mutated';
  }, TypeError);
  assert.deepEqual(auditLog.list({ limit: 2 }).map((event) => event.action), ['second', 'first']);
});

test('HTTP app seeds admin credentials from environment when provided', async () => {
  const previousEmail = process.env.CRM_ADMIN_EMAIL;
  const previousPassword = process.env.CRM_ADMIN_PASSWORD;
  process.env.CRM_ADMIN_EMAIL = 'owner@example.test';
  process.env.CRM_ADMIN_PASSWORD = 'env-only-test-password';

  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: 'owner@example.test', password: 'env-only-test-password' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.email, 'owner@example.test');
  } finally {
    if (previousEmail === undefined) delete process.env.CRM_ADMIN_EMAIL;
    else process.env.CRM_ADMIN_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.CRM_ADMIN_PASSWORD;
    else process.env.CRM_ADMIN_PASSWORD = previousPassword;
    await close(server);
  }
});

test('HTTP app exposes health, dashboard, auth, session, audit, and compliance transition routes', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await requestJson(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'healthy');

    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.ok, true);
    const authHeaders = { authorization: `Bearer ${login.body.session.id}` };

    const dashboard = await requestJson(`${baseUrl}/api/dashboard`, { headers: authHeaders });
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.service.massSendingEnabled, false);

    const session = await requestJson(`${baseUrl}/api/auth/session`, {
      headers: authHeaders,
    });
    assert.equal(session.status, 200);
    assert.equal(session.body.session.role, 'admin');

    const transition = await requestJson(`${baseUrl}/api/campaigns/evaluate-transition`, {
      method: 'POST',
      headers: authHeaders,
      body: { campaign: { id: 'camp-http', channel: 'email' }, targetStatus: 'review', actorId: 'tester' },
    });
    assert.equal(transition.status, 200);
    assert.equal(transition.body.allowed, false);

    const audit = await requestJson(`${baseUrl}/api/audit`, { headers: authHeaders });
    assert.equal(audit.status, 200);
    assert.ok(audit.body.events.length >= 1);
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
