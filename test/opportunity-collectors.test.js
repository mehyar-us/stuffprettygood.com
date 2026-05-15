import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectSource,
  runCollectors,
  COLLECTOR_VERSION
} from '../scripts/collect-opportunity-finder.mjs';

const registry = JSON.parse(readFileSync(new URL('../data/opportunity-source-registry.json', import.meta.url), 'utf8'));

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => String(data)
  };
}

function textResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(data),
    text: async () => data
  };
}

test('Opportunity source registry is gate-safe and covers required daily source families', () => {
  assert.equal(registry.schema_version, 'opportunity_source_registry.v2');
  assert.ok(registry.guardrails.includes('internal_collection_only_no_submissions'));
  assert.ok(registry.guardrails.includes('no_account_creation_without_separate_gate'));
  assert.ok(registry.guardrails.includes('credential_refs_are_env_key_names_only'));

  const families = new Set(registry.sources.map((source) => source.family));
  for (const family of ['sam_gov', 'usaspending', 'grants_gov', 'rss', 'postings', 'local_smb', 'state_local', 'prime_portal', 'affiliate', 'spg_proof']) {
    assert.ok(families.has(family), `missing source family ${family}`);
  }

  for (const source of registry.sources) {
    assert.ok(source.id);
    assert.ok(source.name);
    assert.ok(source.allowed_access_method);
    assert.ok(source.access_terms_ref);
    if (source.enabled === false) assert.equal(source.collector_status, 'schema_only');
    assert.ok(source.route_owner_profile, `${source.id} missing route_owner_profile`);
    assert.ok(source.source_health, `${source.id} missing source_health`);
    assert.ok(source.expected_value_basis, `${source.id} missing expected_value_basis`);
    assert.doesNotMatch(JSON.stringify(source), /api[_-]?key=.*[A-Za-z0-9]{8,}|token=.*[A-Za-z0-9]{8,}|password=/i);
    if (source.credential_ref_env) assert.match(source.credential_ref_env, /^[A-Z0-9_]+$/);
    assert.ok(source.kill_criteria?.length >= 1);
  }
});

test('SAM.gov collector skips safely when API key env is absent', async () => {
  const source = registry.sources.find((item) => item.family === 'sam_gov');
  const result = await collectSource(source, { env: {}, fetchImpl: async () => { throw new Error('fetch should not run without key'); } });
  assert.equal(result.skipped, true);
  assert.equal(result.skip_reason, 'missing_env:SAM_GOV_API_KEY');
  assert.deepEqual(result.opportunities, []);
});

test('USAspending collector normalizes award intelligence without external action', async () => {
  const source = registry.sources.find((item) => item.family === 'usaspending');
  const result = await collectSource(source, {
    fetchImpl: async (url, options) => {
      assert.equal(url, source.endpoint);
      assert.equal(options.method, 'POST');
      return jsonResponse({
        results: [{
          'Award ID': 'FAKE-AWARD-1',
          'Recipient Name': 'Example contractor',
          'Award Amount': 250000,
          'Awarding Agency': 'Example Agency',
          Description: 'CRM automation and website modernization services'
        }]
      });
    }
  });
  assert.equal(result.opportunities.length, 1);
  const opp = result.opportunities[0];
  assert.equal(opp.source_family, 'usaspending');
  assert.equal(opp.external_action_type, 'none');
  assert.equal(opp.gate_status, 'draft_only');
  assert.equal(opp.evidence.secret_present, false);
  assert.equal(opp.evidence.pii_present, 'none');
  assert.equal(opp.created_by_collector, COLLECTOR_VERSION);
  assert.ok(opp.score.overall_score >= 1);
});

test('Grants.gov collector normalizes grant metadata and flags review-only status', async () => {
  const source = registry.sources.find((item) => item.family === 'grants_gov');
  const result = await collectSource(source, {
    fetchImpl: async () => jsonResponse({
      oppHits: [{
        id: 'GRANT-1',
        title: 'Technology workforce training grant',
        agencyName: 'Example Funder',
        closeDate: '2026-06-30'
      }]
    })
  });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].opportunity_type, 'grant');
  assert.equal(result.opportunities[0].evidence.gate_ref, 't_370312f0');
  assert.equal(result.opportunities[0].next_best_action !== 'submit', true);
});

test('Posting collector imports demand signals from approved RSS only', async () => {
  const source = registry.sources.find((item) => item.family === 'postings');
  const result = await collectSource({ ...source, feeds: source.feeds.slice(0, 1) }, {
    fetchImpl: async () => textResponse('<rss><channel><item><title>AI automation consultant for CRM launch</title><link>https://example.com/job/1</link><description>Need software automation support</description><pubDate>Fri, 15 May 2026 12:00:00 GMT</pubDate></item></channel></rss>')
  });
  assert.equal(result.opportunities.length, 1);
  const opp = result.opportunities[0];
  assert.equal(opp.source_family, 'postings');
  assert.equal(opp.opportunity_type, 'service');
  assert.equal(opp.evidence.allowed_access_method, 'rss');
  assert.doesNotMatch(JSON.stringify(opp), /password=|token=|api_key=/i);
});

test('Daily collector writes idempotent source-run status, errors, and deduped opportunities', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'opportunity-collector-'));
  const registryPath = join(dir, 'registry.json');
  const runsPath = join(dir, 'runs.json');
  const opportunitiesPath = join(dir, 'opportunities.json');
  const fixtureRegistry = {
    ...registry,
    sources: [
      { ...registry.sources.find((item) => item.family === 'sam_gov') },
      { ...registry.sources.find((item) => item.family === 'usaspending') },
      { ...registry.sources.find((item) => item.family === 'grants_gov') }
    ]
  };
  await import('node:fs').then(({ writeFileSync }) => writeFileSync(registryPath, JSON.stringify(fixtureRegistry, null, 2)));
  const fetchImpl = async (url) => {
    if (String(url).includes('usaspending')) return jsonResponse({ results: [{ 'Award ID': 'AWARD-1', 'Awarding Agency': 'Agency', Description: 'Website automation support' }] });
    if (String(url).includes('grants')) return jsonResponse({ oppHits: [{ id: 'G-1', title: 'Small business technology grant', agencyName: 'Funder' }] });
    throw new Error(`unexpected url ${url}`);
  };

  const first = await runCollectors({ registryPath, outputPath: runsPath, opportunitiesPath, env: {}, fetchImpl });
  const second = await runCollectors({ registryPath, outputPath: runsPath, opportunitiesPath, env: {}, fetchImpl });
  assert.equal(first.run_count, 3);
  assert.equal(second.run_count, 3);
  assert.equal(second.skipped_count, 1);
  const runs = JSON.parse(readFileSync(runsPath, 'utf8'));
  const opportunities = JSON.parse(readFileSync(opportunitiesPath, 'utf8'));
  assert.equal(runs.schema_version, 'opportunity_source_runs.v1');
  assert.ok(runs.latest_runs.some((run) => run.status === 'skipped' && run.skip_reason === 'missing_env:SAM_GOV_API_KEY'));
  assert.ok(runs.latest_runs.every((run) => Object.hasOwn(run, 'error')));
  assert.equal(opportunities.schema_version, 'opportunity_records.v1');
  assert.equal(opportunities.opportunities.length, 2);
  assert.ok(opportunities.opportunities.every((opp) => opp.dedupe_key && opp.evidence && opp.score));
});
