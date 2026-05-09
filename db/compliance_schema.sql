-- Mehyar Media CRM suppression/compliance schema fragment.
-- This is additive foundation SQL for the Phase 1 command center.

CREATE TABLE IF NOT EXISTS suppression_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'brand', 'channel', 'contact', 'source', 'legal', 'manual')),
  brand_id UUID NULL,
  channel TEXT NULL CHECK (channel IN ('email', 'sms', 'all')),
  identifier_hash TEXT NOT NULL,
  contact_hash TEXT NULL,
  email_hash TEXT NULL,
  phone_hash TEXT NULL,
  source_id TEXT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'global_unsubscribe',
    'brand_unsubscribe',
    'sms_stop',
    'spam_complaint',
    'hard_bounce',
    'soft_bounce_cooldown',
    'legal_suppression',
    'manual_suppression',
    'invalid_contact_point',
    'source_hold',
    'prohibited_source',
    'provider_warning_hold'
  )),
  source TEXT NOT NULL,
  notes TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_suppression_records_identifier_hash
  ON suppression_records(identifier_hash);

CREATE INDEX IF NOT EXISTS idx_suppression_records_brand_reason
  ON suppression_records(brand_id, reason);

CREATE INDEX IF NOT EXISTS idx_suppression_records_contact_level
  ON suppression_records(contact_hash, email_hash, phone_hash, source_id, reason);

CREATE TABLE IF NOT EXISTS campaign_compliance_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('suppression', 'compliance', 'pilot_authorization')),
  state TEXT NOT NULL CHECK (state IN ('pending', 'approved', 'rejected', 'expired', 'remediation')),
  approved_by UUID NULL,
  approved_at TIMESTAMPTZ NULL,
  legal_basis TEXT NULL,
  checked_categories TEXT[] NOT NULL DEFAULT '{}',
  blocked_recipient_count INTEGER NULL CHECK (blocked_recipient_count IS NULL OR blocked_recipient_count >= 0),
  unsubscribe_url_verified BOOLEAN NOT NULL DEFAULT false,
  sms_stop_handling_verified BOOLEAN NOT NULL DEFAULT false,
  sender_identity_approved BOOLEAN NOT NULL DEFAULT false,
  external_execution_allowed BOOLEAN NOT NULL DEFAULT false,
  provider_push_allowed BOOLEAN NOT NULL DEFAULT false,
  recipient_export_allowed BOOLEAN NOT NULL DEFAULT false,
  unresolved_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_compliance_approvals_campaign_type
  ON campaign_compliance_approvals(campaign_id, approval_type, state);

CREATE TABLE IF NOT EXISTS campaign_gate_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NULL,
  requested_status TEXT NULL,
  event_type TEXT NOT NULL DEFAULT 'campaign_transition' CHECK (event_type IN (
    'campaign_transition',
    'suppression_write',
    'unsubscribe_write',
    'sms_stop_write',
    'consent_review_change',
    'execution_denied',
    'export_denied',
    'provider_push_denied'
  )),
  decision TEXT NOT NULL CHECK (decision IN ('allowed', 'blocked')),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor_id UUID NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
