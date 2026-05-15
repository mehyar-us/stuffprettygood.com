-- Opportunity Desk durable CRM/API contract schema
-- Additive migration only. No destructive statements.

create table if not exists opportunity_source_registry (
  source_id text primary key,
  source_family text not null check (source_family in ('sam_gov','usaspending','grants_gov','state_local','local_smb','rss','affiliate','sponsor','job_board','postings','marketplace','subcontracting','prime_portal','internal_network','spg_proof','manual')),
  source_name text not null,
  source_type text not null default 'source_registry_entry',
  source_url text,
  owner_department text not null,
  route_owner_profile text not null default 'scout',
  business_line text not null default 'mixed',
  access_method text not null check (access_method in ('api','rss','scrape','manual','webhook','csv_import','partner_export')),
  auth_required integer not null default 0,
  credential_ref_env text,
  license_terms text,
  contact_policy text not null default 'internal_research_only',
  privacy_risk_level text not null default 'low',
  refresh_cadence text not null default 'manual',
  expected_latency_minutes integer not null default 1440,
  active integer not null default 1,
  quality_baseline_score integer not null default 50,
  source_priority integer not null default 50,
  source_notes text,
  source_health_reason text,
  source_health_checked_at text,
  source_risk_json text not null default '[]',
  source_fit_dimensions_json text not null default '{}',
  source_health text not null default 'needs_review' check (source_health in ('ok','warning','blocked','needs_review')),
  rate_limit_json text not null default '{}',
  kill_switch integer not null default 1,
  created_at text not null,
  updated_at text not null,
  last_run_at text,
  unique (source_family, source_name),
  check (credential_ref_env is null or credential_ref_env glob 'env:[A-Z0-9_]*')
);

create index if not exists idx_opportunity_sources_active_family on opportunity_source_registry(active, source_family);
create index if not exists idx_opportunity_sources_health on opportunity_source_registry(source_health);
create index if not exists idx_opportunity_sources_route_owner on opportunity_source_registry(route_owner_profile);
create index if not exists idx_opportunity_sources_business_line on opportunity_source_registry(business_line);

create table if not exists opportunity_source_runs (
  run_id text primary key,
  source_id text not null references opportunity_source_registry(source_id),
  started_at text not null,
  finished_at text,
  status text not null check (status in ('queued','running','ok','warning','error','blocked','skipped','completed')),
  fetch_window_start text,
  fetch_window_end text,
  external_cursor text,
  request_count integer not null default 0,
  records_seen integer not null default 0,
  records_new integer not null default 0,
  records_updated integer not null default 0,
  records_rejected integer not null default 0,
  data_age_min real,
  data_age_max real,
  http_status_summary_json text not null default '{}',
  error_summary text,
  schema_version_observed text,
  parser_version text,
  completeness_pct real,
  duplicate_pct real,
  stale_pct real,
  parse_error_pct real,
  quality_metrics_json text not null default '{}',
  source_health_after text,
  source_health_reason text,
  next_run_after text,
  privacy_review_required integer not null default 0,
  created_at text not null
);

create index if not exists idx_opportunity_source_runs_source_started on opportunity_source_runs(source_id, started_at desc);
create index if not exists idx_opportunity_source_runs_status_finished on opportunity_source_runs(status, finished_at);

create table if not exists opportunities (
  opportunity_id text primary key,
  source_id text not null references opportunity_source_registry(source_id),
  latest_source_run_id text references opportunity_source_runs(run_id),
  external_id text,
  external_url text,
  opportunity_type text not null check (opportunity_type in ('grant','contract','subcontract','sponsorship','affiliate_program','job_signal','marketplace_rfp','content_signal','partnership','internal_referral','local_smb_lead','service','government','government_award_intel','state_local_procurement','prime_portal','proof_signal')),
  title text not null,
  summary text,
  buyer_org_name text,
  buyer_domain text,
  geography text,
  jurisdiction text,
  amount_min real,
  amount_max real,
  expected_value_usd real,
  expected_value_basis text,
  expected_value_confidence real,
  currency text not null default 'USD',
  due_at text,
  posted_at text,
  source_updated_at text,
  estimated_start_at text,
  fit_tags_json text not null default '[]',
  fit_score_dimensions_json text not null default '{}',
  revenue_model text,
  status text not null check (status in ('new','scored','pursue','watch','reject','needs_partner','needs_approval','blocked','archived','routed','pursuing','submitted','won','lost','stale','duplicate')),
  dedupe_key text not null unique,
  public_contact_url text,
  public_contact_email_domain text,
  compliance_flags_json text not null default '[]',
  suppression_status text not null default 'unknown' check (suppression_status in ('unknown','not_applicable','clear','blocked','needs_review')),
  evidence_refs_json text not null default '[]',
  first_cash_path text,
  first_cash_window_days integer,
  first_cash_window_basis text,
  required_assets_json text not null default '[]',
  eligibility text,
  required_docs_json text not null default '[]',
  proof_required_json text not null default '[]',
  spg_proof_signals_json text not null default '[]',
  partner_needed integer not null default 0,
  gate_status text not null default 'not_required' check (gate_status in ('not_required','pending','approved','rejected','expired','needs_review')),
  external_action_type text not null default 'none',
  approval_ref text,
  approval_expires_at text,
  privacy_pii_handling text not null default 'public_org_only',
  route_state text not null default 'not_routed',
  route_owner_profile text not null default 'productops',
  owner_profile text not null default 'productops',
  latest_score_id text,
  created_at text not null,
  updated_at text not null,
  unique (source_id, external_id)
);

create index if not exists idx_opportunities_status_due on opportunities(status, due_at);
create index if not exists idx_opportunities_type_posted on opportunities(opportunity_type, posted_at);
create index if not exists idx_opportunities_buyer_domain on opportunities(buyer_domain);
create index if not exists idx_opportunities_gate_status on opportunities(gate_status);
create index if not exists idx_opportunities_expected_value on opportunities(expected_value_usd desc, expected_value_confidence desc);
create index if not exists idx_opportunities_first_cash on opportunities(first_cash_window_days, status);
create index if not exists idx_opportunities_route_owner on opportunities(route_owner_profile, route_state);

create table if not exists opportunity_scores (
  score_id text primary key,
  opportunity_id text not null references opportunities(opportunity_id),
  model_version text not null,
  raw_dimension_scores_json text not null,
  weights_json text not null,
  expected_value_usd real,
  expected_value_confidence real,
  first_cash_window_days integer,
  weighted_score real not null,
  confidence_score real not null,
  false_positive_risk text not null check (false_positive_risk in ('low','medium','high')),
  missing_fields_json text not null default '[]',
  source_age_hours real,
  source_health text,
  privacy_pii_handling text not null,
  refresh_cadence text,
  score_explanation text not null,
  recommendation_band_json text not null default '{}',
  created_by_profile text not null,
  created_at text not null
);

create index if not exists idx_opportunity_scores_opportunity_created on opportunity_scores(opportunity_id, created_at desc);
create index if not exists idx_opportunity_scores_weighted_confidence on opportunity_scores(weighted_score desc, confidence_score desc);
create index if not exists idx_opportunity_scores_model_version on opportunity_scores(model_version);

create table if not exists opportunity_ai_memos (
  memo_id text primary key,
  opportunity_id text not null references opportunities(opportunity_id),
  source_run_id text references opportunity_source_runs(run_id),
  memo_type text not null,
  model_provider text not null,
  model_name text not null,
  prompt_version text not null,
  input_evidence_refs_json text not null default '[]',
  memo_markdown text not null,
  confidence_score real not null,
  hallucination_risk text not null,
  human_review_status text not null,
  created_by_profile text not null,
  created_at text not null,
  check (memo_markdown like '%INTERNAL DECISION SUPPORT%')
);

create index if not exists idx_opportunity_ai_memos_opportunity_created on opportunity_ai_memos(opportunity_id, created_at desc);
create index if not exists idx_opportunity_ai_memos_type_review on opportunity_ai_memos(memo_type, human_review_status);

create table if not exists opportunity_decision_logs (
  decision_id text primary key,
  opportunity_id text not null references opportunities(opportunity_id),
  score_id text references opportunity_scores(score_id),
  decision text not null,
  decision_reason text,
  decision_owner_profile text not null,
  decision_confidence real,
  expected_value_snapshot_usd real,
  first_cash_window_snapshot_days integer,
  route_owner_profile text,
  gate_status_snapshot text,
  decision_deadline text,
  next_review_at text,
  risk_acceptance_notes text,
  external_action_type text not null default 'none',
  gate_ref text,
  decided_at text not null
);

create index if not exists idx_opportunity_decisions_opportunity_decided on opportunity_decision_logs(opportunity_id, decided_at desc);
create index if not exists idx_opportunity_decisions_decision_review on opportunity_decision_logs(decision, next_review_at);

create table if not exists opportunity_evidence_refs (
  evidence_id text primary key,
  entity_type text not null,
  entity_id text not null,
  evidence_type text not null,
  uri_or_storage_key text not null,
  content_hash text,
  captured_at text not null,
  source_timestamp text,
  retention_class text not null default 'internal_reference',
  pii_class text not null default 'public_org_only',
  access_notes text
);

create index if not exists idx_opportunity_evidence_entity on opportunity_evidence_refs(entity_type, entity_id);
create index if not exists idx_opportunity_evidence_hash on opportunity_evidence_refs(content_hash);
create index if not exists idx_opportunity_evidence_pii on opportunity_evidence_refs(pii_class);

create table if not exists opportunity_kanban_routing_refs (
  routing_id text primary key,
  opportunity_id text not null references opportunities(opportunity_id),
  decision_id text references opportunity_decision_logs(decision_id),
  kanban_task_id text,
  kanban_board text not null default 'mehyar-media',
  assignee_profile text not null,
  route_type text not null check (route_type in ('product_brief','collector','backend_api','ui_build','comply_review','scout_research','sales_prep','devops_job','data_quality','review')),
  route_status text not null check (route_status in ('proposed','created','accepted','blocked','completed','archived')),
  acceptance_criteria_json text not null default '[]',
  sanitized_kanban_draft_json text not null default '{}',
  created_by_profile text not null,
  created_at text not null
);

create index if not exists idx_opportunity_routes_opportunity on opportunity_kanban_routing_refs(opportunity_id);
create index if not exists idx_opportunity_routes_task on opportunity_kanban_routing_refs(kanban_task_id);
create index if not exists idx_opportunity_routes_status on opportunity_kanban_routing_refs(route_status);


create table if not exists opportunity_source_health_logs (
  health_log_id text primary key,
  source_id text not null references opportunity_source_registry(source_id),
  source_run_id text references opportunity_source_runs(run_id),
  source_health text not null check (source_health in ('ok','warning','blocked','needs_review')),
  health_reason text,
  http_status_summary_json text not null default '{}',
  records_seen integer not null default 0,
  records_rejected integer not null default 0,
  stale_pct real,
  parse_error_pct real,
  checked_by_profile text not null default 'dataeng',
  checked_at text not null
);

create index if not exists idx_opportunity_source_health_logs_source_checked on opportunity_source_health_logs(source_id, checked_at desc);
create index if not exists idx_opportunity_source_health_logs_health on opportunity_source_health_logs(source_health);

create table if not exists opportunity_daily_digest_snapshots (
  digest_id text primary key,
  digest_date text not null,
  snapshot_scope text not null,
  top_opportunity_ids_json text not null default '[]',
  source_performance_summary_json text not null default '{}',
  counts_by_status_json text not null default '{}',
  counts_by_source_json text not null default '{}',
  counts_by_type_json text not null default '{}',
  top_recommendations_json text not null default '[]',
  stale_kill_list_json text not null default '[]',
  fast_cash_pick_json text,
  asset_building_pick_json text,
  strategic_pick_json text,
  generated_by_profile text not null,
  generated_at text not null,
  unique (digest_date, snapshot_scope)
);

create table if not exists opportunity_suppression_checks (
  suppression_check_id text primary key,
  opportunity_id text references opportunities(opportunity_id),
  account_id text,
  check_type text not null,
  status text not null check (status in ('unknown','not_applicable','clear','blocked','needs_review')),
  checked_at text not null,
  checked_by_profile text not null,
  evidence_ref_id text references opportunity_evidence_refs(evidence_id),
  notes text
);

create index if not exists idx_opportunity_suppression_opportunity_checked on opportunity_suppression_checks(opportunity_id, checked_at desc);
create index if not exists idx_opportunity_suppression_account_checked on opportunity_suppression_checks(account_id, checked_at desc);
create index if not exists idx_opportunity_suppression_status on opportunity_suppression_checks(status);
