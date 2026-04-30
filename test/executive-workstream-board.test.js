import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const REQUIRED_WORKSTREAMS = [
  'Infrastructure',
  'CRM Core App',
  'Local PostgreSQL Database',
  'Legacy IONOS Data Interface',
  'Brand/Domain Management',
  'List/Segment Management',
  'Suppression/Compliance',
  'Campaign Drafting',
  'Integrations',
  'First Brand Launch Planning',
];

const REQUIRED_WEEK_ONE_ROLES = [
  'Lead Full-Stack Engineer',
  'DevOps / Infrastructure Engineer',
  'Data Engineer',
  'Deliverability / Compliance Operator',
  'Product / Ops Designer',
];

test('executive board documents at least 13 hired agents with concrete week-1 deliverables', async () => {
  const board = await readFile(new URL('../docs/executive-workstream-board.md', import.meta.url), 'utf8');
  const hireRows = board.split('\n').filter((line) => /^\| \d+ \|/.test(line));

  assert.ok(hireRows.length >= 13, `expected at least 13 hires, found ${hireRows.length}`);

  for (const role of REQUIRED_WEEK_ONE_ROLES) {
    assert.match(board, new RegExp(escapeRegExp(role)), `${role} missing from hired roster`);
  }

  for (const row of hireRows) {
    assert.match(row, /\| [^|]+ \| [^|]+ \| [^|]+ \|$/, 'hire row must include agent, role, and week-1 deliverable');
    assert.doesNotMatch(row, /\|\s*(TBD|none|n\/a)\s*\|/i, 'hire row cannot have vague ownership or deliverable');
  }
});

test('executive board covers all required workstreams with owner, deadline, acceptance criteria, and blockers', async () => {
  const board = await readFile(new URL('../docs/executive-workstream-board.md', import.meta.url), 'utf8');

  for (const workstream of REQUIRED_WORKSTREAMS) {
    assert.match(board, new RegExp(`\\| ${escapeRegExp(workstream)} \\|`), `${workstream} workstream row missing`);
  }

  assert.match(board, /\| Workstream \| Owner \| Paperclip issues \| Deliverables \| Deadline \| Acceptance criteria \| Blockers \|/);
  assert.match(board, /No mass sending is authorized in Phase 1\./);
  assert.match(board, /CRM domain is not a sending domain/);
  assert.match(board, /Read-only, limited, paginated previews; no full-table pulls/);
  assert.match(board, /Stale Paperclip execution\/resume artifacts/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
