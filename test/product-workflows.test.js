import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const PHASE_1_MODULES = [
  'Dashboard',
  'Admin Auth',
  'Legacy IONOS Data Explorer',
  'Query + Segment Builder',
  'Brand Manager',
  'Domain Manager',
  'List Manager',
  'Suppression Manager',
  'Campaign Draft Manager',
  'Integration Manager',
  'Data Explorer UX',
];

const ADMIN_SCREENS = [
  'Login / Admin Auth',
  'Dashboard',
  'Legacy IONOS Data Explorer',
  'Query + Segment Builder',
  'Brand Manager',
  'Domain Manager',
  'List Manager',
  'Suppression Manager',
  'Campaign Draft Manager',
  'Integration Manager',
  'Audit Log',
];

test('product workflow spec covers every Phase 1 admin module with acceptance checklists', async () => {
  const spec = await readFile(new URL('../docs/product-workflows-admin-ux.md', import.meta.url), 'utf8');

  for (const moduleName of PHASE_1_MODULES) {
    assert.match(spec, new RegExp(`## ${escapeRegExp(moduleName)} workflow`), `${moduleName} workflow missing`);
  }

  const checklistCount = (spec.match(/Acceptance checklist:/g) || []).length;
  assert.ok(checklistCount >= PHASE_1_MODULES.length, 'each Phase 1 workflow needs an acceptance checklist');

  assert.match(spec, /No send, blast, schedule, or provider dispatch UI exists\./);
  assert.match(spec, /Destructive queries and full-table pulls are visibly blocked\./);
  assert.match(spec, /CRM domain is not treated as a sending domain\./);
});

test('admin UX acceptance spec defines screen-by-screen criteria and blockers', async () => {
  const spec = await readFile(new URL('../docs/admin-ux-acceptance-spec.md', import.meta.url), 'utf8');

  for (const screenName of ADMIN_SCREENS) {
    assert.match(spec, new RegExp(`### \\d+\\. ${escapeRegExp(screenName)}`), `${screenName} acceptance section missing`);
  }

  const acceptanceCount = (spec.match(/Acceptance criteria:/g) || []).length;
  const blockerCount = (spec.match(/Blockers:/g) || []).length;
  assert.ok(acceptanceCount >= ADMIN_SCREENS.length, 'each admin screen needs acceptance criteria');
  assert.ok(blockerCount >= ADMIN_SCREENS.length, 'each admin screen needs blocker notes');

  assert.match(spec, /No mass sending, blasting, send-now, provider dispatch, or production scheduling control exists\./);
  assert.match(spec, /Legacy IONOS data access is read-only, limited, paginated, and inspected before use\./);
  assert.match(spec, /Secrets are never displayed in the frontend, logs, screenshots, or committed files\./);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
