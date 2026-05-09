import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const schemaPath = join(process.cwd(), 'db', '001_initial_crm_schema.sql');

function schemaSql() {
  return readFileSync(schemaPath, 'utf8').replace(/\s+/g, ' ').toLowerCase();
}

test('initial CRM PostgreSQL migration creates every Phase 1 operating table', () => {
  const sql = schemaSql();

  for (const table of [
    'crm_users',
    'crm_roles',
    'crm_user_roles',
    'crm_sessions',
    'audit_logs',
    'brands',
    'domains',
    'campaigns',
    'lists',
    'segments',
    'suppressions',
    'integrations',
    'query_templates',
    'sync_jobs',
    'imported_lead_refs',
  ]) {
    assert.match(sql, new RegExp(`create table if not exists ${table}\\b`), `${table} table is required`);
  }
});

test('initial migration encodes Phase 1 safety guardrails and operational indexes', () => {
  const sql = schemaSql();

  assert.match(sql, /create extension if not exists pgcrypto/);
  assert.match(sql, /campaigns_no_mass_send_phase_1/);
  assert.match(sql, /status in \('draft', 'review', 'remediation', 'future_pilot_approved', 'blocked', 'archived'\)/);
  assert.doesNotMatch(sql, /status in \('draft', 'review', 'approved', 'scheduled', 'active', 'sent'\)/);
  assert.match(sql, /provider_push_enabled boolean not null default false/);
  assert.match(sql, /recipient_export_enabled boolean not null default false/);
  assert.match(sql, /full_table_pull_allowed boolean not null default false/);
  assert.match(sql, /read_only boolean not null default true/);
  assert.match(sql, /secret_ref text null/);
  assert.match(sql, /safe_query_source text not null/);
  assert.match(sql, /segment_filters_source_date_channel_idx/);
  assert.match(sql, /crm_domain_not_sender_ready/);
  assert.doesNotMatch(sql, /password\s+text/);
  assert.doesNotMatch(sql, /api_key\s+text/);

  for (const index of [
    'idx_audit_logs_actor_time',
    'idx_brands_domain',
    'idx_domains_type_status',
    'idx_campaigns_brand_status',
    'idx_lists_channel_status',
    'idx_segments_source_risk',
    'idx_suppressions_identifier_hash',
    'idx_integrations_kind_status',
    'idx_query_templates_source_system',
    'idx_sync_jobs_status',
    'idx_imported_lead_refs_legacy',
  ]) {
    assert.match(sql, new RegExp(`create index if not exists ${index}\\b`), `${index} index is required`);
  }
});
