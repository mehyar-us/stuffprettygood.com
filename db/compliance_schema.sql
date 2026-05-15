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

-- Campaign Manager 2026 contract tables. These are additive and safe for
-- backend/API implementation; live send/export/provider push remains gated
-- outside this schema fragment.

CREATE TABLE IF NOT EXISTS crm_offer_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  offer_name TEXT NOT NULL,
  payout_type TEXT NULL,
  estimated_payout NUMERIC NULL,
  epc NUMERIC NULL,
  network TEXT NULL,
  landing_url TEXT NOT NULL,
  go_slug TEXT UNIQUE NULL,
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'approved', 'paused', 'rejected')),
  target_persona TEXT NOT NULL,
  allowed_surfaces TEXT[] NOT NULL DEFAULT '{}',
  claim_restrictions TEXT[] NOT NULL DEFAULT '{}',
  compliance_notes TEXT NULL,
  disclosure_required BOOLEAN NOT NULL DEFAULT true,
  disclosure TEXT NOT NULL,
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('low', 'medium', 'high')),
  conversion_confidence NUMERIC NULL CHECK (conversion_confidence IS NULL OR (conversion_confidence >= 0 AND conversion_confidence <= 1)),
  last_reviewed_at TIMESTAMPTZ NULL,
  owner UUID NULL,
  audit_event_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_offer_catalog_status_risk
  ON crm_offer_catalog(approval_status, risk_tier);

CREATE TABLE IF NOT EXISTS crm_preference_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_hash TEXT NULL,
  visitor_session_id TEXT NULL,
  source_page TEXT NULL,
  source_route TEXT NULL,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  referrer TEXT NULL,
  role_persona TEXT NULL,
  business_type TEXT NULL,
  team_size TEXT NULL,
  topic_preferences TEXT[] NOT NULL DEFAULT '{}',
  tool_interests TEXT[] NOT NULL DEFAULT '{}',
  quiz_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  budget_range TEXT NULL,
  preferred_channel TEXT NULL CHECK (preferred_channel IS NULL OR preferred_channel IN ('email', 'sms', 'onsite', 'none')),
  frequency TEXT NULL,
  opt_in_status TEXT NOT NULL DEFAULT 'unknown' CHECK (opt_in_status IN ('unknown', 'opted_in', 'opted_out')),
  consent_state TEXT NOT NULL DEFAULT 'unknown' CHECK (consent_state IN ('unknown', 'opted_in', 'opted_out')),
  consent_basis TEXT NULL,
  consent_timestamp TIMESTAMPTZ NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  global_unsubscribe BOOLEAN NOT NULL DEFAULT false,
  brand_unsubscribe BOOLEAN NOT NULL DEFAULT false,
  suppression_state TEXT NOT NULL DEFAULT 'clear',
  audit_event_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_preference_profiles_source_consent
  ON crm_preference_profiles(consent_state, suppression_state, preferred_channel);

CREATE TABLE IF NOT EXISTS crm_attribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  surface_id UUID NULL,
  visitor_session_id TEXT NULL,
  profile_id UUID NULL,
  persona TEXT NULL,
  source_page TEXT NULL,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  referrer TEXT NULL,
  affiliate_id TEXT NULL,
  offer_id UUID NULL,
  go_slug TEXT NULL,
  campaign_id UUID NULL,
  segment_id TEXT NULL,
  cohort_id TEXT NULL,
  risk_tier TEXT NULL,
  revenue_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  confidence NUMERIC NULL,
  disclosure_seen BOOLEAN NOT NULL DEFAULT false,
  audit_event_id UUID NULL,
  raw_pii_present BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_crm_attribution_events_rollup
  ON crm_attribution_events(event_type, offer_id, campaign_id, segment_id, source_page, persona, risk_tier);

CREATE TABLE IF NOT EXISTS crm_campaign_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id TEXT NULL,
  offer_id UUID NULL,
  channel TEXT NOT NULL,
  eligible_audience INTEGER NOT NULL DEFAULT 0,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  projected JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_estimate JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0,
  failed_gates JSONB NOT NULL DEFAULT '[]'::jsonb,
  state TEXT NOT NULL CHECK (state IN ('GO', 'WATCH', 'NO-GO')),
  required_approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
  live_actions_enabled BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_campaign_simulations_state
  ON crm_campaign_simulations(state, channel, created_at);

CREATE TABLE IF NOT EXISTS crm_risky_action_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('send', 'export', 'provider_push')),
  target_id TEXT NULL,
  actor_id UUID NULL,
  decision TEXT NOT NULL DEFAULT 'blocked' CHECK (decision IN ('blocked', 'allowed')),
  reason TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A-to-Z Reactivation + Sponsor Pilot command-center tables.
-- All contact identifiers are hashes/refs only. Raw PII belongs outside these
-- aggregate/admin tables and must not render in default CRM views.

CREATE TABLE IF NOT EXISTS crm_contact_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  source_table_ref TEXT NOT NULL,
  owner_brand TEXT NULL,
  collected_under_brand TEXT NULL,
  source_channel TEXT NOT NULL DEFAULT 'unknown',
  relationship_type TEXT NOT NULL DEFAULT 'unknown',
  estimated_row_count BIGINT NOT NULL DEFAULT 0 CHECK (estimated_row_count >= 0),
  acquisition_age_days INTEGER NULL CHECK (acquisition_age_days IS NULL OR acquisition_age_days >= 0),
  consent_evidence_quality TEXT NOT NULL DEFAULT 'unknown',
  source_quality_score NUMERIC NOT NULL DEFAULT 0 CHECK (source_quality_score >= 0 AND source_quality_score <= 1),
  field_presence JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_required_fields TEXT[] NOT NULL DEFAULT '{}',
  approval_flags TEXT[] NOT NULL DEFAULT '{}',
  default_state TEXT NOT NULL DEFAULT 'watch' CHECK (default_state IN ('watch', 'go_internal', 'quarantine')),
  raw_pii_rendered BOOLEAN NOT NULL DEFAULT false,
  last_inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_contact_sources_state_quality
  ON crm_contact_sources(default_state, source_quality_score, last_inspected_at);

CREATE TABLE IF NOT EXISTS crm_source_field_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL,
  canonical_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_map_confidence NUMERIC NOT NULL DEFAULT 0 CHECK (field_map_confidence >= 0 AND field_map_confidence <= 1),
  missing_required_fields TEXT[] NOT NULL DEFAULT '{}',
  reviewer UUID NULL,
  raw_pii_rendered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_source_field_maps_source
  ON crm_source_field_maps(source_id, updated_at);

CREATE TABLE IF NOT EXISTS crm_contact_tier_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_ref TEXT NULL,
  source_id UUID NULL,
  tier TEXT NOT NULL CHECK (tier IN ('tier_1_clean_money', 'tier_2_dormant_email_repermission', 'tier_3_unknown_provenance_quarantine', 'tier_4_sms_no_written_consent')),
  email_eligibility_status TEXT NOT NULL,
  sms_eligibility_status TEXT NOT NULL,
  channel_eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  quarantine_reason TEXT NULL,
  classifier_version TEXT NOT NULL,
  eligibility_last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  missing_evidence_reasons TEXT[] NOT NULL DEFAULT '{}',
  raw_pii_rendered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_contact_tier_snapshots_tier_channel
  ON crm_contact_tier_snapshots(tier, email_eligibility_status, sms_eligibility_status, eligibility_last_reviewed_at);

CREATE TABLE IF NOT EXISTS crm_clean_segment_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_mode TEXT NOT NULL DEFAULT 'count_only' CHECK (query_mode = 'count_only'),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_count INTEGER NOT NULL DEFAULT 0 CHECK (target_count >= 0),
  candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  suppression_count INTEGER NOT NULL DEFAULT 0 CHECK (suppression_count >= 0),
  unknown_provenance_count INTEGER NOT NULL DEFAULT 0 CHECK (unknown_provenance_count >= 0),
  sms_no_consent_count INTEGER NOT NULL DEFAULT 0 CHECK (sms_no_consent_count >= 0),
  high_risk_category_count INTEGER NOT NULL DEFAULT 0 CHECK (high_risk_category_count >= 0),
  eligible_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_count >= 0),
  suppression_overlap_rate NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  source_age_days INTEGER NULL,
  state TEXT NOT NULL CHECK (state IN ('GO', 'WATCH', 'NO-GO')),
  blocker_classes TEXT[] NOT NULL DEFAULT '{}',
  proof_packet JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_pii_included BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_clean_segment_previews_state_expires
  ON crm_clean_segment_previews(state, expires_at);

CREATE TABLE IF NOT EXISTS crm_sponsor_pilots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  website TEXT NULL,
  category TEXT NULL,
  source_url TEXT NULL,
  contact_route TEXT NOT NULL DEFAULT 'manual_gmail',
  owner UUID NULL,
  outreach_status TEXT NOT NULL DEFAULT 'sourced',
  offer_lane TEXT NOT NULL DEFAULT 'sponsor_funded_reactivation_pilot',
  package_price NUMERIC NOT NULL DEFAULT 5000,
  performance_option TEXT NULL,
  no_data_transfer_acknowledged BOOLEAN NOT NULL DEFAULT false,
  exclusive_placement_only BOOLEAN NOT NULL DEFAULT true,
  aggregate_reporting_only BOOLEAN NOT NULL DEFAULT false,
  sponsor_disclosure_required BOOLEAN NOT NULL DEFAULT true,
  proof_packet_id UUID NULL,
  contract_status TEXT NOT NULL DEFAULT 'not_started',
  approval_status TEXT NOT NULL DEFAULT 'watch' CHECK (approval_status IN ('watch', 'no_go', 'approved')),
  risk_flags TEXT[] NOT NULL DEFAULT '{}',
  raw_pii_included BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_sponsor_pilots_status
  ON crm_sponsor_pilots(outreach_status, approval_status, category);

CREATE TABLE IF NOT EXISTS crm_sponsor_outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NULL,
  channel TEXT NOT NULL DEFAULT 'manual_gmail' CHECK (channel = 'manual_gmail'),
  status TEXT NOT NULL,
  copy_version TEXT NULL,
  claims_used TEXT[] NOT NULL DEFAULT '{}',
  objection TEXT NULL,
  next_step TEXT NULL,
  blocker_class TEXT NULL,
  subscriber_blast_enabled BOOLEAN NOT NULL DEFAULT false,
  raw_audience_data_included BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_reactivation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL,
  brand_identity TEXT NULL,
  preference_taxonomy TEXT[] NOT NULL DEFAULT '{}',
  events TEXT[] NOT NULL DEFAULT '{}',
  copy_review_status TEXT NOT NULL CHECK (copy_review_status IN ('ready_for_review', 'blocked', 'approved')),
  blocker_classes TEXT[] NOT NULL DEFAULT '{}',
  live_send_enabled BOOLEAN NOT NULL DEFAULT false,
  raw_pii_rendered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_sms_consent_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash TEXT NULL,
  brand TEXT NULL,
  purpose TEXT NOT NULL DEFAULT 'marketing',
  consent_text_ref TEXT NULL,
  opt_in_timestamp TIMESTAMPTZ NULL,
  source TEXT NULL,
  evidence_quality TEXT NOT NULL DEFAULT 'unknown',
  written_marketing_consent BOOLEAN NOT NULL DEFAULT false,
  double_opt_in BOOLEAN NOT NULL DEFAULT false,
  review_status TEXT NOT NULL DEFAULT 'pending',
  sms_eligibility_status TEXT NOT NULL DEFAULT 'no_go',
  blocker_classes TEXT[] NOT NULL DEFAULT '{}',
  stop_help_yes_ready BOOLEAN NOT NULL DEFAULT false,
  live_sms_enabled BOOLEAN NOT NULL DEFAULT false,
  raw_pii_rendered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_sms_consent_vault_status
  ON crm_sms_consent_vault(sms_eligibility_status, review_status, brand);

CREATE TABLE IF NOT EXISTS crm_small_cohort_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cap INTEGER NOT NULL CHECK (cap >= 0 AND cap <= 10000),
  segment_snapshot_id UUID NULL,
  copy_version TEXT NULL,
  stop_thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  state TEXT NOT NULL,
  blocker_classes TEXT[] NOT NULL DEFAULT '{}',
  provider_push_enabled BOOLEAN NOT NULL DEFAULT false,
  live_send_enabled BOOLEAN NOT NULL DEFAULT false,
  boss_approval_ref TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_scale_kill_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT NULL,
  entity_type TEXT NOT NULL,
  owner UUID NULL,
  rp1000 NUMERIC NOT NULL DEFAULT 0,
  cp1000 NUMERIC NOT NULL DEFAULT 0,
  profit_per1000 NUMERIC NOT NULL DEFAULT 0,
  complaint_rate NUMERIC NOT NULL DEFAULT 0,
  bounce_rate NUMERIC NOT NULL DEFAULT 0,
  unsubscribe_rate NUMERIC NOT NULL DEFAULT 0,
  decision TEXT NOT NULL CHECK (decision IN ('GO', 'WATCH', 'KILL', 'BLOCKED')),
  blocker_classes TEXT[] NOT NULL DEFAULT '{}',
  next_action TEXT NOT NULL,
  audit_required BOOLEAN NOT NULL DEFAULT true,
  raw_pii_rendered BOOLEAN NOT NULL DEFAULT false,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- StuffPrettyGood daily trend proof packet schema.
-- Aggregate-only measurement for Google Trends -> trend lane -> SEO page ->
-- signup hook -> /go offer bridge. No raw PII, secrets, Amazon scrape data,
-- copied merchant content, or email/SMS activation belongs in these tables.

CREATE TABLE IF NOT EXISTS spg_trend_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'google_trends_serpapi',
  geo TEXT NOT NULL DEFAULT 'US',
  lookback_window TEXT NOT NULL DEFAULT '12m',
  trend_updated_at TIMESTAMPTZ NOT NULL,
  seed_categories TEXT[] NOT NULL DEFAULT '{}',
  snapshot_uri TEXT NULL,
  source_age_hours NUMERIC NULL,
  guardrails TEXT[] NOT NULL DEFAULT '{}',
  raw_pii_included BOOLEAN NOT NULL DEFAULT false,
  secrets_included BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spg_trend_snapshots_updated
  ON spg_trend_snapshots(trend_updated_at DESC);

CREATE TABLE IF NOT EXISTS spg_trend_lanes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NULL REFERENCES spg_trend_snapshots(id),
  lane_slug TEXT NOT NULL,
  lane_title TEXT NOT NULL,
  topic_category TEXT NOT NULL,
  seed_query TEXT NULL,
  rising_queries TEXT[] NOT NULL DEFAULT '{}',
  seo_route TEXT NOT NULL,
  signup_hook_id TEXT NULL,
  offer_sources TEXT[] NOT NULL DEFAULT '{}',
  trend_updated_at TIMESTAMPTZ NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'review' CHECK (approval_status IN ('approved', 'review', 'pending', 'paused', 'rejected')),
  claim_restrictions TEXT[] NOT NULL DEFAULT '{}',
  raw_pii_included BOOLEAN NOT NULL DEFAULT false,
  copied_merchant_content_included BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_id, lane_slug)
);

CREATE INDEX IF NOT EXISTS idx_spg_trend_lanes_topic_status
  ON spg_trend_lanes(topic_category, approval_status, trend_updated_at DESC);

CREATE TABLE IF NOT EXISTS spg_trend_proof_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'trend_page_view',
    'trend_lane_view',
    'signup_started',
    'topic_preference_saved',
    'go_click',
    'disclosure_seen'
  )),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  packet_date DATE NOT NULL DEFAULT CURRENT_DATE,
  trend_snapshot_id UUID NULL REFERENCES spg_trend_snapshots(id),
  lane_slug TEXT NULL,
  topic_category TEXT NULL,
  route TEXT NULL,
  surface TEXT NOT NULL CHECK (surface IN ('trend_hub', 'trend_lane', 'signup_hook', 'go_bridge')),
  offer_source TEXT NULL CHECK (offer_source IS NULL OR offer_source IN (
    'amazon_manual',
    'direct_merchant',
    'saas_referral',
    'sponsor_slot',
    'mehyarsoft_in_house',
    'public_feed_allowed',
    'template_or_lead_magnet',
    'unknown'
  )),
  go_slug TEXT NULL,
  disclosure_seen BOOLEAN NOT NULL DEFAULT false,
  disclosure_version TEXT NULL,
  offer_approval_status TEXT NULL CHECK (offer_approval_status IS NULL OR offer_approval_status IN ('approved', 'review', 'pending', 'paused', 'rejected')),
  device_class TEXT NOT NULL DEFAULT 'unknown' CHECK (device_class IN ('desktop', 'tablet', 'mobile', 'unknown')),
  source_medium TEXT NULL,
  event_count INTEGER NOT NULL DEFAULT 1 CHECK (event_count >= 0),
  raw_pii_included BOOLEAN NOT NULL DEFAULT false,
  raw_referrer_included BOOLEAN NOT NULL DEFAULT false,
  raw_ip_included BOOLEAN NOT NULL DEFAULT false,
  raw_user_agent_included BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spg_trend_proof_events_rollup
  ON spg_trend_proof_events(packet_date, event_type, lane_slug, offer_source, topic_category);

CREATE TABLE IF NOT EXISTS spg_daily_trend_proof_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_date DATE NOT NULL,
  brand TEXT NOT NULL DEFAULT 'StuffPrettyGood',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  trend_snapshot_id UUID NULL REFERENCES spg_trend_snapshots(id),
  trend_updated_at TIMESTAMPTZ NOT NULL,
  source_age_hours NUMERIC NULL,
  lane_slug TEXT NULL,
  lane_title TEXT NULL,
  topic_category TEXT NULL,
  offer_source TEXT NULL,
  page_views INTEGER NOT NULL DEFAULT 0 CHECK (page_views >= 0),
  lane_views INTEGER NOT NULL DEFAULT 0 CHECK (lane_views >= 0),
  signup_starts INTEGER NOT NULL DEFAULT 0 CHECK (signup_starts >= 0),
  topic_preferences INTEGER NOT NULL DEFAULT 0 CHECK (topic_preferences >= 0),
  go_clicks INTEGER NOT NULL DEFAULT 0 CHECK (go_clicks >= 0),
  disclosure_seen INTEGER NOT NULL DEFAULT 0 CHECK (disclosure_seen >= 0),
  disclosure_seen_rate NUMERIC NOT NULL DEFAULT 0 CHECK (disclosure_seen_rate >= 0 AND disclosure_seen_rate <= 1),
  signup_start_rate NUMERIC NOT NULL DEFAULT 0 CHECK (signup_start_rate >= 0 AND signup_start_rate <= 1),
  go_click_rate NUMERIC NOT NULL DEFAULT 0 CHECK (go_click_rate >= 0 AND go_click_rate <= 1),
  confidence NUMERIC NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  missing_data TEXT[] NOT NULL DEFAULT '{}',
  false_positive_risk TEXT[] NOT NULL DEFAULT '{}',
  refresh_cadence TEXT NOT NULL DEFAULT 'daily',
  aggregate_only BOOLEAN NOT NULL DEFAULT true,
  raw_pii_included BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(packet_date, trend_snapshot_id, lane_slug, offer_source)
);

CREATE INDEX IF NOT EXISTS idx_spg_daily_trend_packets_date_lane
  ON spg_daily_trend_proof_packets(packet_date DESC, lane_slug, offer_source);

CREATE TABLE IF NOT EXISTS spg_network_readiness_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_date DATE NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  content_pages_live INTEGER NOT NULL DEFAULT 0 CHECK (content_pages_live >= 0),
  trend_lanes_live INTEGER NOT NULL DEFAULT 0 CHECK (trend_lanes_live >= 0),
  seven_day_page_views INTEGER NOT NULL DEFAULT 0 CHECK (seven_day_page_views >= 0),
  seven_day_go_clicks INTEGER NOT NULL DEFAULT 0 CHECK (seven_day_go_clicks >= 0),
  seven_day_signup_starts INTEGER NOT NULL DEFAULT 0 CHECK (seven_day_signup_starts >= 0),
  preference_categories_observed INTEGER NOT NULL DEFAULT 0 CHECK (preference_categories_observed >= 0),
  disclosure_seen_rate NUMERIC NOT NULL DEFAULT 0 CHECK (disclosure_seen_rate >= 0 AND disclosure_seen_rate <= 1),
  compliance_pages_live BOOLEAN NOT NULL DEFAULT false,
  amazon_manual_only BOOLEAN NOT NULL DEFAULT true,
  no_copied_merchant_content BOOLEAN NOT NULL DEFAULT true,
  no_email_sms_activation BOOLEAN NOT NULL DEFAULT true,
  readiness_score NUMERIC NOT NULL DEFAULT 0 CHECK (readiness_score >= 0 AND readiness_score <= 100),
  readiness_status TEXT NOT NULL CHECK (readiness_status IN ('NO-GO', 'WATCH', 'READY_FOR_APPLICATION')),
  confidence NUMERIC NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  missing_data TEXT[] NOT NULL DEFAULT '{}',
  blockers TEXT[] NOT NULL DEFAULT '{}',
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  targets JSONB NOT NULL DEFAULT '{}'::jsonb,
  privacy_handling TEXT NOT NULL DEFAULT 'aggregate metrics only; raw PII excluded',
  refresh_cadence TEXT NOT NULL DEFAULT 'daily trend packet, weekly network-readiness review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spg_network_readiness_status
  ON spg_network_readiness_snapshots(packet_date DESC, readiness_status, readiness_score DESC);

-- StuffPrettyGood Google Trends -> trend lane -> SEO page -> signup hook
-- -> /go bridge attribution contract. Additive only; no production migration is
-- run by this schema file. Raw PII is explicitly excluded from these tables.

CREATE TABLE IF NOT EXISTS crm_spg_trend_attribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('trend_page_viewed', 'trend_lane_viewed', 'trend_offer_clicked', 'topic_preference', 'disclosure_seen')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  brand TEXT NOT NULL DEFAULT 'StuffPrettyGood',
  source_category TEXT NOT NULL CHECK (source_category IN ('google_trends', 'trend_lane', 'seo_page', 'signup_hook', 'go_bridge', 'manual_source', 'sponsor_source', 'direct_navigation', 'unknown')),
  source_route TEXT NULL,
  referrer_host TEXT NULL,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  visitor_session_id TEXT NULL,
  profile_hash TEXT NULL,
  trend_lane TEXT NULL,
  trend_seed TEXT NULL,
  topic_preference TEXT NULL,
  offer_type TEXT NOT NULL DEFAULT 'none' CHECK (offer_type IN ('amazon', 'manual', 'direct', 'sponsor', 'service', 'referral', 'none')),
  go_slug TEXT NULL,
  offer_id UUID NULL,
  affiliate_tag_label TEXT NULL,
  destination_kind TEXT NULL,
  disclosure_seen BOOLEAN NOT NULL DEFAULT false,
  signup_hook TEXT NULL,
  copied_merchant_content BOOLEAN NOT NULL DEFAULT false,
  live_send_enabled BOOLEAN NOT NULL DEFAULT false,
  provider_push_enabled BOOLEAN NOT NULL DEFAULT false,
  raw_pii_present BOOLEAN NOT NULL DEFAULT false,
  blocked_payload_stored BOOLEAN NOT NULL DEFAULT false,
  blocker_classes TEXT[] NOT NULL DEFAULT '{}',
  audit_event_id UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_spg_trend_attribution_rollup
  ON crm_spg_trend_attribution_events(event_type, source_category, trend_lane, offer_type, go_slug, occurred_at);

CREATE TABLE IF NOT EXISTS crm_spg_topic_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL DEFAULT 'StuffPrettyGood',
  profile_hash TEXT NULL,
  visitor_session_id TEXT NULL,
  source_category TEXT NOT NULL CHECK (source_category IN ('google_trends', 'trend_lane', 'seo_page', 'signup_hook', 'go_bridge', 'manual_source', 'sponsor_source', 'direct_navigation', 'unknown')),
  source_route TEXT NULL,
  trend_lane TEXT NULL,
  topic_preferences TEXT[] NOT NULL DEFAULT '{}',
  frequency TEXT NULL,
  consent_state TEXT NOT NULL DEFAULT 'preference_only' CHECK (consent_state IN ('unknown', 'preference_only', 'opted_in', 'opted_out')),
  consent_basis TEXT NULL,
  disclosure_seen BOOLEAN NOT NULL DEFAULT false,
  suppression_state TEXT NOT NULL DEFAULT 'clear',
  raw_pii_rendered BOOLEAN NOT NULL DEFAULT false,
  raw_pii_stored_in_log BOOLEAN NOT NULL DEFAULT false,
  blocker_classes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_spg_topic_preferences_topics
  ON crm_spg_topic_preferences(source_category, trend_lane, consent_state, created_at);

CREATE TABLE IF NOT EXISTS crm_spg_go_bridge_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  go_slug TEXT NOT NULL,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('amazon', 'manual', 'direct', 'sponsor', 'service', 'referral')),
  redirect_allowed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('ready_for_manual_redirect', 'blocked')),
  affiliate_tag_label TEXT NULL,
  required_click_event TEXT NOT NULL DEFAULT 'trend_offer_clicked',
  required_disclosure_event TEXT NOT NULL DEFAULT 'disclosure_seen',
  destination_url_logged BOOLEAN NOT NULL DEFAULT false,
  raw_pii_logged BOOLEAN NOT NULL DEFAULT false,
  blocker_classes TEXT[] NOT NULL DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_spg_go_bridge_checks_slug
  ON crm_spg_go_bridge_checks(go_slug, status, checked_at);
