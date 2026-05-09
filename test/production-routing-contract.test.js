import assert from 'node:assert/strict';
import test from 'node:test';

import { PRODUCTION_ROUTE_MAP, crmHealthPath } from '../src/core/production-route-map.js';

test('production route map keeps brand and CRM on the same Hostinger server contract', () => {
  assert.equal(PRODUCTION_ROUTE_MAP.sameServer, true);
  assert.equal(PRODUCTION_ROUTE_MAP.hosts.brand, 'stuffprettygood.com');
  assert.equal(PRODUCTION_ROUTE_MAP.hosts.crm, 'mehyarmedia.mehyar.us');

  const crmHealth = PRODUCTION_ROUTE_MAP.publicRoutes.find((route) => route.healthRole === 'crm_health');
  assert.equal(crmHealth.path, '/crm/health');
  assert.equal(crmHealth.owner, 'crm-command-center');
  assert.equal(crmHealth.upstream, 'http://127.0.0.1:3000/health');
  assert.equal(crmHealthPath(), '/crm/health');

  const legacyCrmHealth = PRODUCTION_ROUTE_MAP.compatibilityRoutes.find((route) => route.path === '/crm-health');
  assert.equal(legacyCrmHealth.status, 'public_alias');
  assert.equal(legacyCrmHealth.equivalentTo, '/crm/health');
});
