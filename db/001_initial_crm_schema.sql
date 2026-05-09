-- Mehyar Media CRM Phase 1 initial PostgreSQL schema.
-- Guardrails: command-center only, no mass sending, no plaintext secrets.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS crm_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'invited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_user_roles (
  user_id UUID NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES crm_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS crm_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  ip_hash TEXT NULL,
  user_agent TEXT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NULL REFERENCES crm_users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'agent')),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  vertical TEXT NOT NULL,
  brand_type TEXT NOT NULL DEFAULT 'affiliate' CHECK (brand_type IN ('affiliate', 'crm', 'content', 'internal')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  sender_identity JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance_urls JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NULL REFERENCES brands(id) ON DELETE SET NULL,
  domain TEXT NOT NULL UNIQUE,
  domain_type TEXT NOT NULL CHECK (domain_type IN ('crm', 'landing', 'sending', 'tracking')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'blocked', 'retired')),
  dns_status TEXT NOT NULL DEFAULT 'unchecked' CHECK (dns_status IN ('unchecked', 'pending', 'verified', 'failed')),
  ssl_status TEXT NOT NULL DEFAULT 'unchecked' CHECK (ssl_status IN ('unchecked', 'pending', 'valid', 'failed')),
  sender_readiness TEXT NOT NULL DEFAULT 'not_applicable' CHECK (sender_readiness IN ('not_applicable', 'not_a_sending_domain', 'not_ready', 'ready', 'blocked')),
  CONSTRAINT crm_domain_not_sender_ready CHECK (domain_type <> 'crm' OR sender_readiness <> 'ready'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'web', 'push')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'remediation', 'future_pilot_approved', 'blocked', 'archived')),
  target_segment_id UUID NULL,
  copy JSONB NOT NULL DEFAULT '{}'::jsonb,
  sender TEXT NULL,
  suppression_status TEXT NOT NULL DEFAULT 'pending' CHECK (suppression_status IN ('pending', 'passed', 'failed')),
  compliance_status TEXT NOT NULL DEFAULT 'pending' CHECK (compliance_status IN ('pending', 'passed', 'failed')),
  approval_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (approval_status IN ('not_requested', 'requested', 'future_pilot_approved', 'rejected', 'remediation')),
  send_enabled BOOLEAN NOT NULL DEFAULT false,
  provider_push_enabled BOOLEAN NOT NULL DEFAULT false,
  recipient_export_enabled BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT campaigns_no_mass_send_phase_1 CHECK (send_enabled = false AND provider_push_enabled = false AND recipient_export_enabled = false),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NULL REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  safe_query_source TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'mixed')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'blocked', 'archived')),
  usable_count INTEGER NOT NULL DEFAULT 0 CHECK (usable_count >= 0),
  suppression_count INTEGER NOT NULL DEFAULT 0 CHECK (suppression_count >= 0),
  risk_level TEXT NOT NULL DEFAULT 'unknown' CHECK (risk_level IN ('unknown', 'low', 'medium', 'high', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NULL REFERENCES lists(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  safe_query_source TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  filter_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_filters JSONB NOT NULL DEFAULT '[]'::jsonb,
  date_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  phone_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  geo_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_filter JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclude_unsubscribed BOOLEAN NOT NULL DEFAULT true,
  exclude_suppressed BOOLEAN NOT NULL DEFAULT true,
  preview_limit INTEGER NOT NULL DEFAULT 100 CHECK (preview_limit BETWEEN 1 AND 1000),
  full_table_pull_allowed BOOLEAN NOT NULL DEFAULT false,
  suppression_overlap_count INTEGER NOT NULL DEFAULT 0 CHECK (suppression_overlap_count >= 0),
  risk_tier TEXT NOT NULL DEFAULT 'unknown' CHECK (risk_tier IN ('unknown', 'low', 'medium', 'high', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NULL REFERENCES brands(id) ON DELETE SET NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'brand', 'channel', 'contact', 'source', 'legal', 'manual')),
  channel TEXT NULL CHECK (channel IN ('email', 'sms', 'all')),
  identifier_hash TEXT NOT NULL,
  contact_hash TEXT NULL,
  email_hash TEXT NULL,
  phone_hash TEXT NULL,
  source_id TEXT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('global_unsubscribe', 'brand_unsubscribe', 'sms_stop', 'spam_complaint', 'hard_bounce', 'soft_bounce_cooldown', 'legal_suppression', 'manual_suppression', 'invalid_contact_point', 'source_hold', 'prohibited_source', 'provider_warning_hold')),
  source TEXT NOT NULL,
  notes TEXT NULL,
  created_by UUID NULL REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('email_provider', 'sms_provider', 'affiliate_network', 'dns_registrar', 'validation_tool', 'tracking_system', 'legacy_database')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'configured', 'active', 'blocked', 'retired')),
  read_only BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_ref TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_system TEXT NOT NULL,
  read_only BOOLEAN NOT NULL DEFAULT true,
  sql_text TEXT NOT NULL,
  max_rows INTEGER NOT NULL DEFAULT 100 CHECK (max_rows BETWEEN 1 AND 1000),
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('schema_inspection', 'preview', 'summary_cache', 'bounded_import')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  read_only BOOLEAN NOT NULL DEFAULT true,
  requested_by UUID NULL REFERENCES crm_users(id) ON DELETE SET NULL,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imported_lead_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  legacy_table TEXT NOT NULL,
  legacy_primary_key_hash TEXT NOT NULL,
  list_id UUID NULL REFERENCES lists(id) ON DELETE SET NULL,
  segment_id UUID NULL REFERENCES segments(id) ON DELETE SET NULL,
  email_hash TEXT NULL,
  phone_hash TEXT NULL,
  consent_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, legacy_table, legacy_primary_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brands_domain ON brands(domain);
CREATE INDEX IF NOT EXISTS idx_domains_type_status ON domains(domain_type, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_status ON campaigns(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_lists_channel_status ON lists(channel, status);
CREATE INDEX IF NOT EXISTS idx_segments_source_risk ON segments(safe_query_source, risk_tier);
CREATE INDEX IF NOT EXISTS segment_filters_source_date_channel_idx ON segments(safe_query_source, channel, risk_tier);
CREATE INDEX IF NOT EXISTS idx_suppressions_identifier_hash ON suppressions(identifier_hash);
CREATE INDEX IF NOT EXISTS idx_suppressions_contact_level ON suppressions(contact_hash, email_hash, phone_hash, source_id, reason);
CREATE INDEX IF NOT EXISTS idx_integrations_kind_status ON integrations(kind, status);
CREATE INDEX IF NOT EXISTS idx_query_templates_source_system ON query_templates(source_system);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imported_lead_refs_legacy ON imported_lead_refs(source_system, legacy_table, legacy_primary_key_hash);
