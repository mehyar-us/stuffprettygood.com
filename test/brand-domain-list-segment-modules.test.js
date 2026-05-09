import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { AuditLog } from '../src/core/audit.js';
import { CommandCenterStore } from '../src/core/command-center.js';
import { createApp } from '../src/server.js';

test('brand/domain/list/segment seed records expose required control-room fields and no CRM sending domain use', () => {
  const store = new CommandCenterStore({ now: () => '2026-05-08T20:00:00.000Z' });
  store.seedFirstBrand();
  const summary = store.buildSummary();

  assert.deepEqual(summary.moduleReadiness.brandManager.requiredFields, [
    'name',
    'domain',
    'vertical',
    'type',
    'status',
    'senderIdentity',
    'complianceUrls',
  ]);
  assert.deepEqual(summary.moduleReadiness.domainManager.requiredFields, [
    'domain',
    'domainType',
    'status',
    'dnsStatus',
    'sslStatus',
    'senderReadiness',
  ]);
  assert.deepEqual(summary.moduleReadiness.listManager.requiredFields, [
    'name',
    'safeQuerySource',
    'channel',
    'usableCount',
    'suppressionCount',
    'riskLevel',
  ]);
  assert.deepEqual(summary.moduleReadiness.segmentBuilder.requiredFilters, [
    'sourceIds',
    'dateRange',
    'email',
    'phone',
    'geo',
    'consentStates',
    'excludeUnsubscribed',
    'excludeSuppressed',
    'riskTier',
  ]);

  const crmDomain = store.list('domains').find((domain) => domain.domainType === 'crm');
  assert.equal(crmDomain.senderReadiness, 'not_a_sending_domain');
  assert.equal(summary.senderDomainSeparation.crmDomainUsedForSending, false);
  assert.equal(summary.senderDomainSeparation.sendingDomains.every((domain) => domain.domainType === 'sending'), true);
});

test('store validates brand compliance fields, list safe query source, segment filters, and CRM domain separation', () => {
  const store = new CommandCenterStore();

  const brand = store.create('brands', {
    name: 'DealSignal',
    domain: 'dealsignal.example',
    vertical: 'deals',
    type: 'reactivation',
    status: 'planning',
    senderIdentity: { fromName: 'DealSignal', replyTo: 'support@dealsignal.example' },
    complianceUrls: {
      privacy: 'https://dealsignal.example/privacy',
      terms: 'https://dealsignal.example/terms',
      unsubscribe: 'https://dealsignal.example/unsubscribe',
    },
  });
  assert.equal(brand.senderIdentity.fromName, 'DealSignal');

  assert.throws(() => store.create('domains', {
    domain: 'crm.example',
    domainType: 'crm',
    status: 'active',
    dnsStatus: 'verified',
    sslStatus: 'valid',
    senderReadiness: 'ready',
  }), /CRM domains cannot be sender-ready/);

  const list = store.create('lists', {
    name: 'DealSignal safe email list',
    safeQuerySource: 'query-template:legacy-explicit-us-email',
    channel: 'email',
    usableCount: 1200,
    suppressionCount: 80,
    riskLevel: 'low',
  });
  assert.equal(list.safeQuerySource, 'query-template:legacy-explicit-us-email');

  assert.throws(() => store.create('lists', {
    name: 'Unsafe list',
    source: 'manual-import',
    channel: 'email',
  }), /safeQuerySource is required/);

  const segment = store.create('segments', {
    name: 'Explicit US email segment',
    safeQuerySource: list.safeQuerySource,
    channel: 'email',
    filters: {
      sourceIds: ['legacy-ionos'],
      dateRange: { from: '2024-01-01', to: '2026-01-01' },
      email: { required: true, verifiedOnly: true },
      phone: { required: false },
      geo: { countries: ['US'], regions: ['NY'] },
      consentStates: ['explicit'],
      excludeUnsubscribed: true,
      excludeSuppressed: true,
    },
    riskTier: 'low',
  });
  assert.equal(segment.filters.excludeSuppressed, true);

  assert.throws(() => store.create('segments', {
    name: 'Missing suppression filter',
    safeQuerySource: list.safeQuerySource,
    channel: 'email',
    filters: { sourceIds: ['legacy-ionos'], dateRange: { from: '2024-01-01', to: '2026-01-01' }, email: { required: true } },
    riskTier: 'medium',
  }), /segments must exclude suppressed records/);
});

test('HTTP routes expose list and segment workflow records', async () => {
  const auditLog = new AuditLog();
  const commandCenter = new CommandCenterStore({ auditLog, now: () => '2026-05-08T20:05:00.000Z' });
  const server = http.createServer(createApp({ audit: auditLog, commandCenter }));
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const adminHeaders = await loginAdmin(baseUrl);
    const list = await requestJson(`${baseUrl}/api/lists`, {
      method: 'POST',
      headers: adminHeaders,
      body: {
        name: 'ToolSignal preference capture list',
        safeQuerySource: 'query-template:tools-explicit-email',
        channel: 'email',
        usableCount: 700,
        suppressionCount: 35,
        riskLevel: 'low',
      },
    });
    assert.equal(list.status, 201);

    const segment = await requestJson(`${baseUrl}/api/segments`, {
      method: 'POST',
      headers: adminHeaders,
      body: {
        name: 'ToolSignal explicit consent email segment',
        safeQuerySource: 'query-template:tools-explicit-email',
        channel: 'email',
        filters: {
          sourceIds: ['legacy-ionos'],
          dateRange: { from: '2024-01-01', to: '2026-01-01' },
          email: { required: true, verifiedOnly: true },
          phone: { required: false },
          geo: { countries: ['US'], regions: [] },
          consentStates: ['explicit'],
          excludeUnsubscribed: true,
          excludeSuppressed: true,
        },
        riskTier: 'low',
      },
    });
    assert.equal(segment.status, 201);
    assert.equal(segment.body.record.riskTier, 'low');

    const segments = await requestJson(`${baseUrl}/api/segments`, { headers: adminHeaders });
    assert.equal(segments.status, 200);
    assert.equal(segments.body.records.length, 1);
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

async function loginAdmin(baseUrl) {
  const login = await requestJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    body: { email: 'admin@mehyarmedia.local', password: 'change-me-before-production' },
  });
  assert.equal(login.status, 200);
  return { authorization: `Bearer ${login.body.session.id}` };
}

async function requestJson(url, { method = 'GET', headers = {}, body = null } = {}) {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
