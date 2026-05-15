-- Source Ledger provenance contract schema
-- Task: t_258ebd86
-- Additive migration draft only. No destructive statements.

create table if not exists source_ledger_artifacts (
  artifact_ref text primary key,
  source_id text not null,
  source_name text,
  source_class text not null check (source_class in ('SPG offer feed','public opportunity feed','job posting','RSS','government','affiliate/network','legacy audience','operator entry','system job')),
  artifact_type text not null,
  artifact_uri text not null,
  artifact_hash text,
  produced_by_run_id text,
  observed_at text,
  source_updated_at text,
  source_age_hours real,
  freshness_sla_hours real,
  freshness_state text not null default 'unknown' check (freshness_state in ('fresh','stale','unknown')),
  credential_ref_env text,
  no_raw_pii_asserted integer not null default 1,
  no_raw_secret_asserted integer not null default 1,
  created_at text not null default CURRENT_TIMESTAMP,
  check (credential_ref_env is null or credential_ref_env glob 'env:[A-Z0-9_]*' or credential_ref_env glob 'cloudflare_secret:[A-Z0-9_]*' or credential_ref_env glob 'vault:[A-Z0-9_/-]*')
);

create index if not exists idx_source_ledger_artifacts_source on source_ledger_artifacts(source_id, observed_at desc);
create index if not exists idx_source_ledger_artifacts_class on source_ledger_artifacts(source_class, freshness_state);

create table if not exists source_ledger_runs (
  run_id text primary key,
  source_id text not null,
  status text not null check (status in ('queued','running','ok','warning','error','blocked','skipped')),
  started_at text,
  finished_at text,
  records_seen integer not null default 0,
  records_added integer not null default 0,
  records_updated integer not null default 0,
  records_rejected integer not null default 0,
  records_blocked integer not null default 0,
  rejection_rate real not null default 0,
  artifacts_written_json text not null default '[]',
  top_errors_json text not null default '[]',
  delta_state text not null check (delta_state in ('verified','pending','blocked','missing')),
  safe_log_preview_ref text,
  no_raw_pii_asserted integer not null default 1,
  no_raw_secret_asserted integer not null default 1,
  created_at text not null default CURRENT_TIMESTAMP
);

create index if not exists idx_source_ledger_runs_source_finished on source_ledger_runs(source_id, finished_at desc);
create index if not exists idx_source_ledger_runs_status on source_ledger_runs(status, delta_state);

create table if not exists source_ledger_records (
  ledger_record_id text primary key,
  contract_version text not null default 'source-ledger-provenance-v1',
  entity_type text not null check (entity_type in ('opportunity','spg_offer','job','campaign_prerequisite')),
  entity_id text not null,
  display_name text,
  provenance_state text not null check (provenance_state in ('verified','pending','simulated','blocked','missing')),
  source_ref text,
  artifact_refs_json text not null default '[]',
  latest_run_id text references source_ledger_runs(run_id),
  source_age_hours real,
  suppression_status text not null default 'not_applicable' check (suppression_status in ('not_applicable','verified_clear','pending','blocked','unknown')),
  consent_state text,
  gate_status text,
  owner_profile text,
  route_owner_profile text,
  next_action text,
  missing_data_json text not null default '[]',
  blocker_classes_json text not null default '[]',
  confidence_score real not null default 0,
  production_visible integer not null default 0,
  actionable integer not null default 0,
  no_raw_pii_asserted integer not null default 1,
  no_raw_secret_asserted integer not null default 1,
  created_at text not null default CURRENT_TIMESTAMP,
  updated_at text not null default CURRENT_TIMESTAMP,
  unique(entity_type, entity_id),
  check (provenance_state <> 'verified' or (source_ref is not null and artifact_refs_json <> '[]')),
  check (production_visible = 0 or (provenance_state = 'verified' and suppression_status in ('not_applicable','verified_clear') and no_raw_pii_asserted = 1 and no_raw_secret_asserted = 1)),
  check (actionable = 0 or production_visible = 1),
  check (provenance_state <> 'simulated' or production_visible = 0),
  check (provenance_state <> 'missing' or next_action is not null)
);

create index if not exists idx_source_ledger_records_entity on source_ledger_records(entity_type, entity_id);
create index if not exists idx_source_ledger_records_state on source_ledger_records(provenance_state, production_visible);
create index if not exists idx_source_ledger_records_owner on source_ledger_records(route_owner_profile, actionable);
create index if not exists idx_source_ledger_records_suppression on source_ledger_records(suppression_status, provenance_state);

create view if not exists production_provenance_records as
select *
from source_ledger_records
where provenance_state = 'verified'
  and production_visible = 1
  and suppression_status in ('not_applicable','verified_clear')
  and no_raw_pii_asserted = 1
  and no_raw_secret_asserted = 1;

create view if not exists non_simulated_source_ledger_records as
select *
from source_ledger_records
where provenance_state <> 'simulated';

-- Migration path for existing objects, to be implemented by LeadFS with table-specific backfills:
-- opportunities: add/derive provenance_state, source_ref, artifact_refs_json, latest_source_run_id, suppression_status.
-- SPG offers: map offer_candidates/publish_decisions/public feed eligibility into spg_offer ledger records; fixtures remain simulated.
-- jobs: map Jobs Control run rows into source_ledger_runs and source_ledger_records(entity_type='job').
-- campaign prerequisites: default to blocked unless consent + suppression proof artifacts are verified.
