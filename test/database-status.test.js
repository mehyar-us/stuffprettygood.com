import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { AuditLog } from '../src/core/audit.js';
import { AuthStore } from '../src/core/auth.js';
import { collectDatabaseStatus } from '../src/core/database-status.js';
import { createApp } from '../src/server.js';

test('database status reports not_configured and pending without database environment', async () => {
  const status = await collectDatabaseStatus({
    env: {},
    checkMigrations: async () => ({ applied: false, appliedCount: 0, pending: ['001_initial_crm_schema.sql'] }),
  });

  assert.equal(status.status, 'not_configured');
  assert.equal(status.migrations, 'pending');
  assert.deepEqual(status.configuredEnv, []);
  assert.equal(status.host, null);
  assert.equal(JSON.stringify(status).includes('password'), false);
});

test('database status reports configured and applied with sanitized host and env key names only', async () => {
  const status = await collectDatabaseStatus({
    env: { CRM_DATABASE_URL: 'postgres://crm_user:test-only-placeholder@localhost:5432/crm_command_center' },
    checkMigrations: async () => ({ applied: true, appliedCount: 2, pending: [] }),
  });

  assert.equal(status.status, 'configured');
  assert.equal(status.migrations, 'applied');
  assert.equal(status.host, 'localhost');
  assert.deepEqual(status.configuredEnv, ['CRM_DATABASE_URL']);
  assert.equal(status.appliedMigrations, 2);
  assert.equal(JSON.stringify(status).includes('test-only-placeholder'), false);
  assert.equal(JSON.stringify(status).includes('crm_user'), false);
});

test('authenticated dashboard includes sanitized database status and unauthenticated CRM dashboard stays protected', async () => {
  const previousDatabaseUrl = process.env.CRM_DATABASE_URL;
  process.env.CRM_DATABASE_URL = 'postgres://crm_user:test-only-placeholder@localhost:5432/crm_command_center';

  const auditLog = new AuditLog();
  const auth = new AuthStore({ auditLog });
  const server = http.createServer(createApp({
    authStore: auth,
    audit: auditLog,
    databaseStatus: async () => ({
      status: 'configured',
      host: 'localhost',
      port: 5432,
      database: 'crm_command_center',
      migrations: 'applied',
      appliedMigrations: 2,
      configuredEnv: ['CRM_DATABASE_URL'],
    }),
  }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await requestJson(`${baseUrl}/crm-health`);
    assert.equal(health.status, 200);
    assert.equal(health.body.massSendingEnabled, false);

    const denied = await requestJson(`${baseUrl}/crm/api/dashboard`);
    assert.equal(denied.status, 401);

    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' },
    });
    assert.equal(login.status, 200);

    const dashboard = await requestJson(`${baseUrl}/crm/api/dashboard`, {
      headers: { authorization: `Bearer ${login.body.session.id}` },
    });

    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.database.status, 'configured');
    assert.equal(dashboard.body.database.migrations, 'applied');
    assert.equal(dashboard.body.database.host, 'localhost');
    assert.deepEqual(dashboard.body.database.configuredEnv, ['CRM_DATABASE_URL']);
    assert.equal(JSON.stringify(dashboard.body.database).includes('test-only-placeholder'), false);
    assert.equal(JSON.stringify(dashboard.body.database).includes('crm_user'), false);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.CRM_DATABASE_URL;
    else process.env.CRM_DATABASE_URL = previousDatabaseUrl;
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
