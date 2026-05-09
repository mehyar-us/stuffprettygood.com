import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { AuditLog } from '../src/core/audit.js';
import { CommandCenterStore } from '../src/core/command-center.js';
import { createApp } from '../src/server.js';

test('command center seeds first brand, CRM domain, and legacy integration with no sending enabled', () => {
  const store = new CommandCenterStore({ now: () => '2026-04-29T16:00:00.000Z' });
  store.seedFirstBrand();
  const summary = store.buildSummary();

  assert.equal(summary.massSendingEnabled, false);
  assert.equal(summary.firstBrandReady, true);
  assert.equal(summary.crmDomain.domain, 'mehyarmedia.mehyar.us');
  assert.equal(summary.counts.brands, 2);
  assert.equal(summary.counts.domains, 3);
  assert.equal(summary.counts.integrations, 1);
});

test('command center rejects unsafe records and preserves Phase 1 guardrails', () => {
  const store = new CommandCenterStore();

  assert.throws(() => store.create('campaigns', {
    name: 'Unsafe launch',
    brandId: 'brand-1',
    channel: 'email',
    targetSegment: 'legacy-all',
    status: 'scheduled',
  }), /invalid campaigns record/);

  assert.throws(() => store.create('queryTemplates', {
    name: 'Bad query',
    sourceSystem: 'ionos',
    purpose: 'pull all',
    readOnly: false,
    fullTablePullAllowed: true,
  }), /invalid queryTemplates record/);

  const query = store.create('queryTemplates', {
    name: 'Safe preview',
    sourceSystem: 'ionos',
    purpose: 'schema sample',
    maxPreviewRows: 500,
  });
  assert.equal(query.readOnly, true);
  assert.equal(query.maxPreviewRows, 100);
  assert.equal(query.fullTablePullAllowed, false);
});

test('HTTP command center routes manage brands, domains, lists, integrations, query templates, and legacy source inspection', async () => {
  const auditLog = new AuditLog();
  const commandCenter = new CommandCenterStore({ auditLog, now: () => '2026-04-29T16:05:00.000Z' });
  const server = http.createServer(createApp({ audit: auditLog, commandCenter }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' },
    });
    assert.equal(login.status, 200);
    const authHeaders = { authorization: `Bearer ${login.body.session.id}` };

    const summary = await requestJson(`${baseUrl}/api/command-center`, { headers: authHeaders });
    assert.equal(summary.status, 200);
    assert.equal(summary.body.firstBrandReady, true);

    const list = await requestJson(`${baseUrl}/api/lists`, {
      method: 'POST',
      headers: authHeaders,
      body: { name: 'Safe email preview list', source: 'safe-query-1', channel: 'email', usableCount: 900, suppressionCount: 100, riskLevel: 'medium' },
    });
    assert.equal(list.status, 201);
    assert.equal(list.body.record.status, 'draft');

    const campaign = await requestJson(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: authHeaders,
      body: { name: 'Welcome draft', brandId: 'brand-1', channel: 'email', targetSegment: 'Safe email preview list' },
    });
    assert.equal(campaign.status, 201);
    assert.equal(campaign.body.record.status, 'draft');
    assert.equal(campaign.body.record.approvalStatus, 'draft_only');

    const inspect = await requestJson(`${baseUrl}/api/legacy-source/inspect`, {
      method: 'POST',
      headers: authHeaders,
      body: { connectionStatus: 'connected', schemas: ['public'], tables: [{ schema: 'public', table: 'legacy_signups', estimatedRows: 200000000 }] },
    });
    assert.equal(inspect.status, 200);
    assert.equal(inspect.body.readOnly, true);
    assert.equal(inspect.body.fullTablePullsAllowed, false);
    assert.equal(inspect.body.tables[0].previewAllowed, true);

    const dashboard = await requestJson(`${baseUrl}/api/dashboard`, { headers: authHeaders });
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.widgets.domains.crmDomain, 'mehyarmedia.mehyar.us');
    assert.equal(dashboard.body.widgets.campaigns.massSendingEnabled, false);
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
