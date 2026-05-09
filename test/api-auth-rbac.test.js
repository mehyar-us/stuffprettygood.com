import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { AuditLog } from '../src/core/audit.js';
import { AuthStore } from '../src/core/auth.js';
import { createApp } from '../src/server.js';

test('public health remains accessible while admin APIs require authenticated admin session', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await requestJson(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal(health.body.massSendingEnabled, false);

    const denied = await requestJson(`${baseUrl}/api/dashboard`);
    assert.equal(denied.status, 401);
    assert.equal(denied.body.error, 'authentication required');
    assert.equal(denied.body.massSendingEnabled, false);

    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' },
    });
    assert.equal(login.status, 200);

    const authorized = await requestJson(`${baseUrl}/api/dashboard`, {
      headers: { authorization: `Bearer ${login.body.session.id}` },
    });
    assert.equal(authorized.status, 200);
    assert.equal(authorized.body.service.massSendingEnabled, false);

    const crmNamespacedLogin = await requestJson(`${baseUrl}/crm/api/auth/login`, {
      method: 'POST',
      body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' },
    });
    assert.equal(crmNamespacedLogin.status, 200);

    const crmNamespacedDashboard = await requestJson(`${baseUrl}/crm/api/dashboard`, {
      headers: { authorization: `Bearer ${crmNamespacedLogin.body.session.id}` },
    });
    assert.equal(crmNamespacedDashboard.status, 200);
    assert.equal(crmNamespacedDashboard.body.service.massSendingEnabled, false);

    const denialEvent = auditLog.list({ resourceType: 'access_control', limit: 1 })[0];
    assert.equal(denialEvent.action, 'access.denied');
    assert.equal(denialEvent.actorId, 'anonymous');
    assert.equal(denialEvent.metadata.path, '/api/dashboard');
    assert.equal(denialEvent.metadata.reason, 'missing_session');
    assert.equal(Object.hasOwn(denialEvent.metadata, 'authorization'), false);

    const audit = await requestJson(`${baseUrl}/api/audit`, {
      headers: { authorization: `Bearer ${login.body.session.id}` },
    });
    assert.equal(audit.status, 200);
    assert.equal(JSON.stringify(audit.body.events).includes('@mehyarmedia.local'), false);
  } finally {
    await close(server);
  }
});

test('non-admin sessions are forbidden from privileged user and audit endpoints', async () => {
  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  auth.createUser({ email: 'ops@mehyarmedia.local', password: 'safe-local-password', role: 'operator' });
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: 'ops@mehyarmedia.local', password: 'safe-local-password' },
    });
    assert.equal(login.status, 200);

    for (const path of ['/api/auth/users', '/api/audit']) {
      const forbidden = await requestJson(`${baseUrl}${path}`, {
        headers: { authorization: `Bearer ${login.body.session.id}` },
      });
      assert.equal(forbidden.status, 403);
      assert.equal(forbidden.body.error, 'forbidden');
    }

    const denialActions = auditLog.list({ resourceType: 'access_control', limit: 5 }).map((event) => event.action);
    assert.deepEqual(denialActions.slice(0, 2), ['access.denied', 'access.denied']);
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
