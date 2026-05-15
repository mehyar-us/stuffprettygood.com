-- StuffPrettyGood monetized offer pipeline schema
-- Task: t_6eab4df0
-- Status: additive migration draft for LeadFS/WebDev review before production use.
-- Safety: no raw secrets and no raw PII. Credential values live only in approved secret stores;
-- this migration stores opaque credential references and hashed/aggregate event identifiers only.

create extension if not exists pgcrypto;

-- Shared status vocab is enforced with table-level checks instead of custom enum types so the
-- migration remains additive/idempotent across partial deployments.

create table if not exists account_credentials_refs (
  id uuid primary key default gen_random_uuid(),
  credential_ref text not null unique,
  provider text not null,
  account_label text not null,
  secret_store text not null check (secret_store in ('env','cloudflare_secret','vault','1password','other')),
  secret_key_label text not null,
  rotation_status text not null default 'unknown' check (rotation_status in ('unknown','current','rotation_due','rotated','revoked')),
  last_rotated_at timestamptz,
  next_rotation_due_at timestamptz,
  owner_role text not null default 'DevOps',
  access_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_credentials_refs_no_raw_secret check (
    credential_ref !~* '(secret|token|password|api[_-]?key)=[^& ]+'
    and secret_key_label !~* '(sk-|pk_live_|AKIA|-----BEGIN|[A-Za-z0-9_/+=]{40,})'
  )
);

create table if not exists offer_accounts (
  id uuid primary key default gen_random_uuid(),
  account_key text not null unique,
  account_name text not null,
  merchant_or_network text not null,
  account_type text not null check (account_type in ('affiliate_network','amazon_associates','direct_referral','direct_sponsor','owned_mehyarsoft','lead_magnet','other')),
  monetization_status text not null default 'not_monetized' check (monetization_status in ('not_monetized','pending_application','approved_monetized','approved_lead_magnet','paused','rejected','blocked')),
  payout_model text not null default 'none' check (payout_model in ('none','cpa','cpl','cpc','commission','revshare','flat_sponsor','owned_margin','lead_magnet')),
  account_status text not null default 'draft' check (account_status in ('draft','application_ready','application_submitted','active','paused','rejected','closed','blocked')),
  credential_ref text references account_credentials_refs(credential_ref),
  terms_url text,
  account_dashboard_url text,
  disclosure_required boolean not null default true,
  default_disclosure_text text,
  allowed_surfaces text[] not null default '{}',
  prohibited_claims text[] not null default '{}',
  risk_tier text not null default 'medium' check (risk_tier in ('low','medium','high','blocked')),
  owner_role text not null default 'Arman',
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_accounts_active_requires_credential_or_lead_magnet check (
    account_status <> 'active'
    or account_type = 'lead_magnet'
    or credential_ref is not null
  ),
  constraint offer_accounts_active_requires_approved_status check (
    account_status <> 'active'
    or monetization_status in ('approved_monetized','approved_lead_magnet')
  ),
  constraint offer_accounts_blocked_not_active check (
    risk_tier <> 'blocked' or account_status <> 'active'
  )
);

create table if not exists offer_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_name text not null,
  source_type text not null check (source_type in ('google_trends','rss','manual_editorial','merchant_terms','affiliate_network','direct_merchant','owned_catalog','sponsor_research','public_api','other')),
  source_url text not null,
  terms_url text,
  source_owner text not null default 'Scout',
  allowed_use text not null default 'metadata_only' check (allowed_use in ('metadata_only','original_summary_only','merchant_creative_allowed','owned_content','blocked')),
  source_status text not null default 'pending_review' check (source_status in ('pending_review','approved','paused','rejected','blocked')),
  risk_tier text not null default 'medium' check (risk_tier in ('low','medium','high','blocked')),
  source_quality_score integer check (source_quality_score between 0 and 100),
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_error_class text,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_sources_approved_requires_terms_and_safe_use check (
    source_status <> 'approved'
    or (terms_url is not null and allowed_use <> 'blocked' and risk_tier <> 'blocked')
  )
);

create table if not exists daily_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  run_date date not null default current_date,
  source_id uuid references offer_sources(id),
  run_type text not null check (run_type in ('trend_fetch','rss_fetch','manual_review','offer_health','public_feed_build','signup_rollup')),
  run_status text not null default 'started' check (run_status in ('started','succeeded','partial','failed','blocked')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items_seen integer not null default 0,
  items_new integer not null default 0,
  candidates_created integer not null default 0,
  candidates_quarantined integer not null default 0,
  public_rows_published integer not null default 0,
  no_raw_pii_asserted boolean not null default true,
  no_raw_secret_asserted boolean not null default true,
  no_scrape_asserted boolean not null default true,
  blocker_classes text[] not null default '{}',
  error_summary text,
  metadata jsonb not null default '{}',
  constraint daily_ingest_runs_failed_or_blocked_explains_why check (
    run_status not in ('failed','blocked') or error_summary is not null or cardinality(blocker_classes) > 0
  ),
  constraint daily_ingest_runs_safety_assertions_required check (
    no_raw_pii_asserted = true and no_raw_secret_asserted = true and no_scrape_asserted = true
  )
);

create table if not exists offer_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_key text not null unique,
  account_id uuid references offer_accounts(id),
  source_id uuid references offer_sources(id),
  ingest_run_id uuid references daily_ingest_runs(id),
  source_url text not null,
  destination_url text,
  canonical_domain text,
  vendor_name text not null,
  offer_title text not null,
  offer_summary text,
  category_key text,
  trend_lane text,
  monetization_status text not null default 'not_monetized' check (monetization_status in ('not_monetized','pending_application','approved_monetized','approved_lead_magnet','paused','rejected','blocked')),
  payout_model text not null default 'none' check (payout_model in ('none','cpa','cpl','cpc','commission','revshare','flat_sponsor','owned_margin','lead_magnet')),
  payout_notes text,
  account_status text not null default 'draft' check (account_status in ('draft','application_ready','application_submitted','active','paused','rejected','closed','blocked')),
  approval_status text not null default 'pending' check (approval_status in ('pending','needs_compliance','approved','paused','rejected','blocked')),
  image_rights_status text not null default 'not_selected' check (image_rights_status in ('not_selected','pending','approved','expired','blocked')),
  disclosure_required boolean not null default true,
  disclosure_text text,
  risk_tier text not null default 'medium' check (risk_tier in ('low','medium','high','blocked')),
  publish_decision text not null default 'do_not_publish' check (publish_decision in ('do_not_publish','publish_monetized','publish_lead_magnet','hold_for_review','paused','blocked')),
  claim_restrictions text[] not null default '{}',
  missing_data text[] not null default '{}',
  candidate_score numeric check (candidate_score between 0 and 100),
  candidate_confidence numeric check (candidate_confidence between 0 and 1),
  false_positive_risks text[] not null default '{}',
  scoring_inputs jsonb not null default '{}',
  scoring_weights jsonb not null default '{"monetization_fit":0.35,"source_quality":0.20,"trend_fit":0.15,"rights_readiness":0.15,"risk_penalty":0.15}',
  source_age_hours numeric,
  privacy_pii_handling text not null default 'No raw PII stored. Public eligibility uses offer/account/source approval metadata only.',
  refresh_cadence text not null default 'daily ingest + approval event refresh + weekly account terms review',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_candidates_public_requires_safe_state check (
    publish_decision not in ('publish_monetized','publish_lead_magnet')
    or (
      approval_status = 'approved'
      and risk_tier <> 'blocked'
      and image_rights_status = 'approved'
      and disclosure_required = true
      and disclosure_text is not null
      and (
        (publish_decision = 'publish_monetized' and monetization_status = 'approved_monetized' and payout_model <> 'none')
        or (publish_decision = 'publish_lead_magnet' and monetization_status = 'approved_lead_magnet' and payout_model = 'lead_magnet')
      )
    )
  )
);

create index if not exists offer_candidates_public_gate_idx on offer_candidates(publish_decision, approval_status, monetization_status, risk_tier);
create index if not exists offer_candidates_source_idx on offer_candidates(source_id, last_seen_at desc);
create index if not exists offer_candidates_account_idx on offer_candidates(account_id, account_status, monetization_status);

create table if not exists offer_images (
  id uuid primary key default gen_random_uuid(),
  image_key text not null unique,
  candidate_id uuid references offer_candidates(id),
  source_url text,
  storage_url text,
  alt_text text not null,
  image_source_type text not null check (image_source_type in ('owned','generated','licensed_stock','merchant_provided','public_domain','placeholder_safe','blocked')),
  image_rights_status text not null default 'pending' check (image_rights_status in ('not_selected','pending','approved','expired','blocked')),
  image_rights_notes text,
  license_name text,
  license_url text,
  credit_required text,
  credit_rendered boolean not null default false,
  allowed_surfaces text[] not null default '{}',
  risk_tier text not null default 'medium' check (risk_tier in ('low','medium','high','blocked')),
  reviewed_by text,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint offer_images_approved_requires_safe_rights check (
    image_rights_status <> 'approved'
    or (image_source_type <> 'blocked' and risk_tier <> 'blocked' and (credit_required is null or credit_rendered = true))
  )
);

create table if not exists offer_approvals (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references offer_candidates(id),
  approval_status text not null check (approval_status in ('pending','needs_changes','approved','paused','rejected','blocked')),
  approval_scope text not null check (approval_scope in ('monetization','source_terms','image_rights','copy_claims','public_publish','account_credentials','lead_magnet')),
  reviewer_role text not null check (reviewer_role in ('Scout','ComplyOps','WebDev','DataEng','Arman','HotZero','DevOps')),
  reviewer text,
  decision_reason text not null,
  requirements_checked text[] not null default '{}',
  missing_data text[] not null default '{}',
  risk_tier text not null default 'medium' check (risk_tier in ('low','medium','high','blocked')),
  reviewed_at timestamptz not null default now()
);

create index if not exists offer_approvals_candidate_idx on offer_approvals(candidate_id, approval_scope, reviewed_at desc);

create table if not exists affiliate_tracking (
  id uuid primary key default gen_random_uuid(),
  tracking_key text not null unique,
  candidate_id uuid references offer_candidates(id),
  account_id uuid references offer_accounts(id),
  go_slug text not null unique,
  destination_url text not null,
  destination_domain text not null,
  payout_model text not null check (payout_model in ('none','cpa','cpl','cpc','commission','revshare','flat_sponsor','owned_margin','lead_magnet')),
  monetization_status text not null check (monetization_status in ('not_monetized','pending_application','approved_monetized','approved_lead_magnet','paused','rejected','blocked')),
  disclosure_required boolean not null default true,
  disclosure_version text,
  tracking_status text not null default 'inactive' check (tracking_status in ('inactive','active','paused','broken','blocked')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','paused','rejected','blocked')),
  risk_tier text not null default 'medium' check (risk_tier in ('low','medium','high','blocked')),
  utm_template jsonb not null default '{}',
  last_health_status text not null default 'unknown' check (last_health_status in ('unknown','ok','redirect_ok','broken','blocked','manual_review')),
  last_health_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_tracking_active_requires_approved_monetization check (
    tracking_status <> 'active'
    or (
      approval_status = 'approved'
      and disclosure_required = true
      and disclosure_version is not null
      and risk_tier <> 'blocked'
      and last_health_status not in ('broken','blocked')
      and (
        (monetization_status = 'approved_monetized' and payout_model <> 'none')
        or (monetization_status = 'approved_lead_magnet' and payout_model = 'lead_magnet')
      )
    )
  )
);

create index if not exists affiliate_tracking_active_idx on affiliate_tracking(go_slug, tracking_status, approval_status);

create table if not exists publish_decisions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references offer_candidates(id),
  affiliate_tracking_id uuid references affiliate_tracking(id),
  publish_decision text not null check (publish_decision in ('do_not_publish','publish_monetized','publish_lead_magnet','hold_for_review','paused','blocked')),
  approval_status text not null check (approval_status in ('pending','approved','paused','rejected','blocked')),
  decision_reason text not null,
  decision_by_role text not null check (decision_by_role in ('ComplyOps','Arman','HotZero','WebDev','DataEng')),
  decision_by text,
  route_path text,
  surface text,
  starts_at timestamptz,
  ends_at timestamptz,
  risk_tier text not null default 'medium' check (risk_tier in ('low','medium','high','blocked')),
  created_at timestamptz not null default now(),
  constraint publish_decisions_public_requires_approved_safe_state check (
    publish_decision not in ('publish_monetized','publish_lead_magnet')
    or (approval_status = 'approved' and risk_tier <> 'blocked' and route_path is not null)
  )
);

create index if not exists publish_decisions_public_idx on publish_decisions(publish_decision, approval_status, risk_tier, starts_at, ends_at);

create table if not exists signup_intent_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('signup_started','signup_submitted','preference_saved','double_opt_in_pending','unsubscribe_requested','unsubscribe_completed')),
  event_at timestamptz not null default now(),
  route_path text not null,
  source_candidate_id uuid references offer_candidates(id),
  source_publish_decision_id uuid references publish_decisions(id),
  preference_topics text[] not null default '{}',
  consent_copy_version text,
  privacy_version text,
  disclosure_version text,
  channel_preference text not null default 'unknown' check (channel_preference in ('email','sms','web_only','unknown')),
  consent_state text not null default 'preference_only' check (consent_state in ('preference_only','email_opt_in_pending','email_opted_in','sms_opt_in_pending','sms_opted_in','opted_out','unknown')),
  profile_ref_hash text,
  identifier_hash text,
  raw_pii_present boolean not null default false,
  provider_push_enabled boolean not null default false,
  live_send_enabled boolean not null default false,
  suppression_checked boolean not null default false,
  blocked_payload_stored boolean not null default false,
  blocker_classes text[] not null default '{}',
  metadata jsonb not null default '{}',
  constraint signup_intent_events_no_raw_pii_or_send_default check (
    raw_pii_present = false and provider_push_enabled = false and live_send_enabled = false and blocked_payload_stored = false
  )
);

create index if not exists signup_intent_events_rollup_idx on signup_intent_events(event_at desc, event_type, consent_state, route_path);

-- Public site contract: WebDev/public surfaces should read from this view, not from raw candidate tables.
-- It only exposes approved monetized rows or explicitly approved lead magnets with active tracking.
create or replace view public_approved_offer_feed as
select
  c.id as candidate_id,
  c.candidate_key,
  c.vendor_name,
  c.offer_title,
  c.offer_summary,
  c.category_key,
  c.trend_lane,
  c.monetization_status,
  c.payout_model,
  c.disclosure_required,
  c.disclosure_text,
  c.risk_tier,
  pd.publish_decision,
  pd.route_path,
  pd.surface,
  at.go_slug,
  at.destination_domain,
  at.disclosure_version,
  oi.storage_url as image_url,
  oi.alt_text as image_alt_text
from offer_candidates c
join publish_decisions pd on pd.candidate_id = c.id
join affiliate_tracking at on at.id = pd.affiliate_tracking_id and at.candidate_id = c.id
left join offer_images oi on oi.candidate_id = c.id and oi.image_rights_status = 'approved' and oi.risk_tier <> 'blocked'
where c.approval_status = 'approved'
  and c.image_rights_status = 'approved'
  and c.risk_tier <> 'blocked'
  and c.disclosure_required = true
  and c.disclosure_text is not null
  and pd.approval_status = 'approved'
  and pd.risk_tier <> 'blocked'
  and pd.publish_decision in ('publish_monetized','publish_lead_magnet')
  and (pd.starts_at is null or pd.starts_at <= now())
  and (pd.ends_at is null or pd.ends_at > now())
  and at.tracking_status = 'active'
  and at.approval_status = 'approved'
  and at.risk_tier <> 'blocked'
  and at.disclosure_required = true
  and at.disclosure_version is not null
  and (
    (pd.publish_decision = 'publish_monetized' and c.monetization_status = 'approved_monetized' and c.payout_model <> 'none' and at.monetization_status = 'approved_monetized')
    or (pd.publish_decision = 'publish_lead_magnet' and c.monetization_status = 'approved_lead_magnet' and c.payout_model = 'lead_magnet' and at.monetization_status = 'approved_lead_magnet')
  );

-- Sample seed rows: safe references only. No raw secrets, no raw PII.
insert into account_credentials_refs (credential_ref, provider, account_label, secret_store, secret_key_label, rotation_status, owner_role)
values
  ('env:SPG_AMAZON_ASSOCIATES_TAG', 'amazon_associates', 'StuffPrettyGood Amazon Associates tag', 'env', 'SPG_AMAZON_ASSOCIATES_TAG', 'current', 'DevOps'),
  ('cloudflare_secret:MEHYARSOFT_AUDIT_CHECKOUT', 'stripe', 'MehyarSoft audit checkout', 'cloudflare_secret', 'MEHYARSOFT_AUDIT_CHECKOUT', 'unknown', 'DevOps')
on conflict (credential_ref) do nothing;

insert into offer_accounts (account_key, account_name, merchant_or_network, account_type, monetization_status, payout_model, account_status, credential_ref, terms_url, disclosure_required, default_disclosure_text, allowed_surfaces, prohibited_claims, risk_tier, owner_role, last_reviewed_at)
values
  ('amazon-associates-manual', 'Amazon Associates manual bridge account', 'Amazon Associates', 'amazon_associates', 'approved_monetized', 'commission', 'active', 'env:SPG_AMAZON_ASSOCIATES_TAG', 'https://affiliate-program.amazon.com/help/operating/policies', true, 'As an Amazon Associate, StuffPrettyGood may earn from qualifying purchases.', array['go_bridge','trend_page'], array['price','availability','reviews','ratings','best','guaranteed'], 'medium', 'Arman', now()),
  ('mehyarsoft-audit-owned', 'MehyarSoft AI audit offer', 'MehyarSoft', 'owned_mehyarsoft', 'approved_monetized', 'owned_margin', 'active', 'cloudflare_secret:MEHYARSOFT_AUDIT_CHECKOUT', 'https://mehyarsoft.com/terms', true, 'This is a MehyarSoft owned offer.', array['trend_page','owned_offer_card'], array['guaranteed results','certified compliance'], 'low', 'Arman', now()),
  ('spg-free-checklist', 'StuffPrettyGood free checklist lead magnet', 'StuffPrettyGood', 'lead_magnet', 'approved_lead_magnet', 'lead_magnet', 'active', null, 'https://stuffprettygood.com/terms', true, 'Free resource; no purchase required.', array['trend_page','signup_module'], array['guaranteed savings'], 'low', 'Arman', now())
on conflict (account_key) do nothing;

insert into offer_sources (source_key, source_name, source_type, source_url, terms_url, allowed_use, source_status, risk_tier, source_quality_score, last_reviewed_at)
values
  ('google-trends-us-daily', 'Google Trends US daily signal', 'google_trends', 'https://trends.google.com/trends/', 'https://policies.google.com/terms', 'metadata_only', 'approved', 'low', 80, now()),
  ('manual-editorial-spg', 'SPG manual editorial review', 'manual_editorial', 'https://stuffprettygood.com/internal/manual-editorial', 'https://stuffprettygood.com/terms', 'owned_content', 'approved', 'low', 90, now())
on conflict (source_key) do nothing;

-- Acceptance queries for reviewers/operators:
-- 1) Public rows must be monetized or approved lead magnets only:
--    select count(*) as bad_public_rows from public_approved_offer_feed where not (
--      (publish_decision = 'publish_monetized' and monetization_status = 'approved_monetized' and payout_model <> 'none')
--      or (publish_decision = 'publish_lead_magnet' and monetization_status = 'approved_lead_magnet' and payout_model = 'lead_magnet')
--    ); -- expect 0
-- 2) Active accounts never expose raw credential values:
--    select account_key, credential_ref from offer_accounts where account_status = 'active' and credential_ref ~* '(secret|token|password|api[_-]?key)=[^& ]+'; -- expect 0 rows
-- 3) Signup events remain no-send/no-PII by default:
--    select count(*) as unsafe_signup_events from signup_intent_events where raw_pii_present or provider_push_enabled or live_send_enabled or blocked_payload_stored; -- expect 0
-- 4) Publishable candidates have approvals/disclosure/image rights:
--    select candidate_key from offer_candidates where publish_decision in ('publish_monetized','publish_lead_magnet') and not (approval_status = 'approved' and image_rights_status = 'approved' and disclosure_required and disclosure_text is not null and risk_tier <> 'blocked'); -- expect 0 rows
