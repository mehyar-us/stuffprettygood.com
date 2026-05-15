import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { AuditLog } from '../src/core/audit.js';
import { CommandCenterStore } from '../src/core/command-center.js';
import { AuthStore, seedAdmin } from '../src/core/auth.js';
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

test('production structural seed creates only provenance-aware boot placeholders', () => {
  const store = new CommandCenterStore({ now: () => '2026-05-15T19:30:00.000Z' });
  store.seedFirstBrand();
  const summary = store.buildSummary();

  assert.deepEqual(summary.counts, {
    brands: 2,
    domains: 3,
    lists: 0,
    segments: 0,
    campaigns: 0,
    integrations: 1,
    queryTemplates: 0,
  });
  assert.equal(summary.productionSeedPolicy.structuralOnly, true);
  assert.deepEqual(summary.productionSeedPolicy.prohibitedSeedEntityTypes, ['lists', 'segments', 'campaigns', 'queryTemplates']);

  for (const entityType of ['brands', 'domains', 'integrations']) {
    for (const record of store.list(entityType)) {
      assert.ok(['pending', 'blocked', 'missing'].includes(record.provenance_state), `${entityType} ${record.name || record.domain} must not be verified/actionable at boot`);
      assert.equal(record.source_ref, 'system:structural-boot');
      assert.ok(record.artifact_refs.includes('docs/crm-2026-truth-first-revenue-os-vision.md'));
      assert.match(record.next_action, /verify|configure|connect|Keep/i);
    }
  }
});

test('list, segment, campaign, and query template operator records carry provenance and safe next action', () => {
  const store = new CommandCenterStore({ now: () => '2026-05-15T19:35:00.000Z' });
  const options = { actorId: 'admin-test-user' };

  const list = store.create('lists', {
    name: 'Operator-entered preference list shell',
    safeQuerySource: 'query-template:preference-shell',
    channel: 'email',
  }, options);
  const segment = store.create('segments', {
    name: 'Operator-entered segment shell',
    safeQuerySource: 'query-template:preference-shell',
    channel: 'email',
    filters: {
      sourceIds: ['operator-entry'],
      dateRange: { from: '2026-01-01', to: '2026-05-15' },
      email: { required: true },
      phone: { required: false },
      geo: { countries: ['US'] },
      consentStates: ['pending'],
      excludeUnsubscribed: true,
      excludeSuppressed: true,
    },
    riskTier: 'unknown',
  }, options);
  const campaign = store.create('campaigns', {
    name: 'Operator-entered campaign shell',
    brandId: 'brand_spg',
    channel: 'email',
    targetSegment: segment.id,
  }, options);
  const queryTemplate = store.create('queryTemplates', {
    name: 'Operator-entered bounded query shell',
    sourceSystem: 'legacy-ionos',
    purpose: 'count-only preview planning',
  }, options);

  for (const record of [list, segment, campaign, queryTemplate]) {
    assert.equal(record.provenance_state, 'pending');
    assert.equal(record.source_ref, 'operator:admin-test-user');
    assert.ok(record.artifact_refs.includes('audit-log:operator-entry'));
    assert.match(record.next_action, /Attach verified source artifact/);
  }
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
  const auth = new AuthStore({ auditLog });
  seedAdmin(auth);
  const server = http.createServer(createApp({ authStore: auth, audit: auditLog, commandCenter }));
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
    assert.equal(list.body.record.provenance_state, 'pending');
    assert.match(list.body.record.source_ref, /^operator:usr_/);
    assert.ok(list.body.record.artifact_refs.includes('audit-log:operator-entry'));
    assert.match(list.body.record.next_action, /Attach verified source artifact/);

    const commandCenterSummary = await requestJson(`${baseUrl}/api/command-center`, { headers: adminHeaders });
    assert.equal(commandCenterSummary.status, 200);
    assert.equal(commandCenterSummary.body.productionSeedPolicy.structuralOnly, true);
    assert.equal(commandCenterSummary.body.counts.lists, 1);

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
    assert.ok(segments.body.records.some((record) => record.name === 'ToolSignal explicit consent email segment'));
    assert.ok(segments.body.records.length >= 1);
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
