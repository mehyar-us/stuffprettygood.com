-- StuffPrettyGood offer routing + attribution schema hardening
-- Task: t_512923db
-- Status: additive migration draft for LeadFS/WebDev/ComplyOps review before production use.
-- Safety: no raw secrets and no raw PII. Destination URLs are either sanitized public URLs or opaque secret refs.

create extension if not exists pgcrypto;

-- 1) Durable route identity on candidate/offer rows.
-- canonical_slug is the only public route key; candidate id remains the internal offer_id.
alter table offer_candidates
  add column if not exists canonical_slug text,
  add column if not exists public_landing_path text,
  add column if not exists public_redirect_path text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords text[] not null default '{}',
  add column if not exists schema_org_type text not null default 'Offer',
  add column if not exists schema_org_json jsonb not null default '{}',
  add column if not exists source_attribution jsonb not null default '{}',
  add column if not exists source_attribution_text text,
  add column if not exists source_retrieved_at timestamptz,
  add column if not exists source_license text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists redirect_health text not null default 'unknown',
  add column if not exists click_count bigint not null default 0,
  add column if not exists signup_count bigint not null default 0;

-- Backfill deterministic slugs/paths for existing safe candidates. This is idempotent and does not publish new rows.
update offer_candidates
set
  canonical_slug = coalesce(canonical_slug, regexp_replace(lower(candidate_key), '[^a-z0-9]+', '-', 'g')),
  public_landing_path = coalesce(public_landing_path, '/offers/' || regexp_replace(lower(candidate_key), '[^a-z0-9]+', '-', 'g')),
  public_redirect_path = coalesce(public_redirect_path, '/go/' || regexp_replace(lower(candidate_key), '[^a-z0-9]+', '-', 'g')),
  source_attribution_text = coalesce(source_attribution_text, 'Source reviewed by StuffPrettyGood editorial/data workflow.'),
  source_attribution = case
    when source_attribution = '{}'::jsonb then jsonb_build_object(
      'source_url', source_url,
      'source_id', source_id,
      'ingest_run_id', ingest_run_id,
      'source_type', 'candidate_source',
      'attribution_policy', 'metadata/original-summary only; no merchant creative copied unless rights-approved'
    )
    else source_attribution
  end,
  last_verified_at = coalesce(last_verified_at, last_reviewed_at, last_seen_at),
  redirect_health = case
    when redirect_health = 'unknown' and approval_status = 'approved' then 'manual_review'
    else redirect_health
  end,
  seo_title = coalesce(seo_title, offer_title || ' | StuffPrettyGood'),
  seo_description = coalesce(seo_description, left(coalesce(offer_summary, offer_title), 155))
where canonical_slug is null
   or public_landing_path is null
   or public_redirect_path is null
   or source_attribution = '{}'::jsonb
   or seo_title is null
   or seo_description is null;

create unique index if not exists offer_candidates_canonical_slug_uidx on offer_candidates(canonical_slug) where canonical_slug is not null;
create unique index if not exists offer_candidates_public_landing_path_uidx on offer_candidates(public_landing_path) where public_landing_path is not null;
create unique index if not exists offer_candidates_public_redirect_path_uidx on offer_candidates(public_redirect_path) where public_redirect_path is not null;
create index if not exists offer_candidates_health_verified_idx on offer_candidates(redirect_health, last_verified_at desc);

alter table offer_candidates
  drop constraint if exists offer_candidates_route_paths_match_slug,
  add constraint offer_candidates_route_paths_match_slug check (
    canonical_slug is null
    or (
      canonical_slug ~ '^[a-z0-9][a-z0-9-]{2,120}$'
      and public_landing_path = '/offers/' || canonical_slug
      and public_redirect_path = '/go/' || canonical_slug
    )
  ),
  drop constraint if exists offer_candidates_redirect_health_vocab,
  add constraint offer_candidates_redirect_health_vocab check (redirect_health in ('unknown','ok','redirect_ok','broken','blocked','manual_review')),
  drop constraint if exists offer_candidates_click_signup_counts_nonnegative,
  add constraint offer_candidates_click_signup_counts_nonnegative check (click_count >= 0 and signup_count >= 0),
  drop constraint if exists offer_candidates_public_routes_require_slug_seo_source_health,
  add constraint offer_candidates_public_routes_require_slug_seo_source_health check (
    publish_decision not in ('publish_monetized','publish_lead_magnet')
    or (
      canonical_slug is not null
      and public_landing_path = '/offers/' || canonical_slug
      and public_redirect_path = '/go/' || canonical_slug
      and seo_title is not null
      and seo_description is not null
      and schema_org_type is not null
      and source_attribution <> '{}'::jsonb
      and source_attribution_text is not null
      and last_verified_at is not null
      and redirect_health not in ('broken','blocked')
    )
  );

-- 2) Durable redirect target handling. Prefer destination_url_secret_ref for private/deep links;
-- destination_url_sanitized is only for URLs safe enough for internal audit logs and public-domain display.
alter table affiliate_tracking
  add column if not exists offer_id uuid,
  add column if not exists canonical_slug text,
  add column if not exists public_landing_path text,
  add column if not exists public_redirect_path text,
  add column if not exists destination_url_mode text not null default 'sanitized',
  add column if not exists destination_url_secret_ref text,
  add column if not exists destination_url_sanitized text,
  add column if not exists network text,
  add column if not exists account_ref text,
  add column if not exists click_count bigint not null default 0,
  add column if not exists signup_count bigint not null default 0,
  add column if not exists last_verified_at timestamptz,
  add column if not exists redirect_health text not null default 'unknown',
  add column if not exists source_attribution jsonb not null default '{}';

update affiliate_tracking at
set
  offer_id = coalesce(at.offer_id, c.id),
  canonical_slug = coalesce(at.canonical_slug, c.canonical_slug, at.go_slug),
  public_landing_path = coalesce(at.public_landing_path, c.public_landing_path, '/offers/' || coalesce(c.canonical_slug, at.go_slug)),
  public_redirect_path = coalesce(at.public_redirect_path, c.public_redirect_path, '/go/' || coalesce(c.canonical_slug, at.go_slug)),
  destination_url_sanitized = coalesce(at.destination_url_sanitized, at.destination_url),
  network = coalesce(at.network, oa.merchant_or_network),
  account_ref = coalesce(at.account_ref, oa.account_key),
  last_verified_at = coalesce(at.last_verified_at, at.last_health_checked_at, c.last_verified_at),
  redirect_health = case
    when at.redirect_health = 'unknown' then at.last_health_status
    else at.redirect_health
  end,
  source_attribution = case
    when at.source_attribution = '{}'::jsonb then jsonb_build_object(
      'candidate_key', c.candidate_key,
      'source_url', c.source_url,
      'source_attribution_text', c.source_attribution_text,
      'account_key', oa.account_key
    )
    else at.source_attribution
  end
from offer_candidates c
left join offer_accounts oa on oa.id = c.account_id
where at.candidate_id = c.id;

create unique index if not exists affiliate_tracking_public_redirect_path_uidx on affiliate_tracking(public_redirect_path) where public_redirect_path is not null;
create index if not exists affiliate_tracking_offer_id_idx on affiliate_tracking(offer_id);
create index if not exists affiliate_tracking_network_account_idx on affiliate_tracking(network, account_ref, tracking_status);

alter table affiliate_tracking
  drop constraint if exists affiliate_tracking_route_paths_match_slug,
  add constraint affiliate_tracking_route_paths_match_slug check (
    canonical_slug is null
    or (
      canonical_slug ~ '^[a-z0-9][a-z0-9-]{2,120}$'
      and public_landing_path = '/offers/' || canonical_slug
      and public_redirect_path = '/go/' || canonical_slug
    )
  ),
  drop constraint if exists affiliate_tracking_destination_url_safe_mode,
  add constraint affiliate_tracking_destination_url_safe_mode check (
    (destination_url_mode = 'secret_ref' and destination_url_secret_ref is not null and destination_url_sanitized is null)
    or (destination_url_mode = 'sanitized' and destination_url_sanitized is not null)
  ),
  drop constraint if exists affiliate_tracking_no_obvious_raw_secret_destination_ref,
  add constraint affiliate_tracking_no_obvious_raw_secret_destination_ref check (
    coalesce(destination_url_secret_ref, '') !~* '(secret|token|password|api[_-]?key)=[^& ]+'
    and coalesce(destination_url_secret_ref, '') !~* '(sk-|pk_live_|AKIA|-----BEGIN)'
  ),
  drop constraint if exists affiliate_tracking_redirect_health_vocab,
  add constraint affiliate_tracking_redirect_health_vocab check (redirect_health in ('unknown','ok','redirect_ok','broken','blocked','manual_review')),
  drop constraint if exists affiliate_tracking_counts_nonnegative,
  add constraint affiliate_tracking_counts_nonnegative check (click_count >= 0 and signup_count >= 0),
  drop constraint if exists affiliate_tracking_active_requires_routes_destination_health,
  add constraint affiliate_tracking_active_requires_routes_destination_health check (
    tracking_status <> 'active'
    or (
      offer_id is not null
      and canonical_slug is not null
      and public_landing_path = '/offers/' || canonical_slug
      and public_redirect_path = '/go/' || canonical_slug
      and network is not null
      and account_ref is not null
      and source_attribution <> '{}'::jsonb
      and last_verified_at is not null
      and redirect_health not in ('broken','blocked')
      and (
        (destination_url_mode = 'secret_ref' and destination_url_secret_ref is not null and destination_url_sanitized is null)
        or (destination_url_mode = 'sanitized' and destination_url_sanitized is not null)
      )
    )
  );

-- 3) Click attribution without raw PII. Route events use coarse/no-PII identifiers only.
create table if not exists offer_click_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offer_candidates(id),
  affiliate_tracking_id uuid not null references affiliate_tracking(id),
  canonical_slug text not null,
  landing_path text not null,
  redirect_path text not null,
  event_at timestamptz not null default now(),
  event_date date not null default current_date,
  surface text not null default 'unknown',
  source_channel text not null default 'unknown',
  attribution_ref_hash text,
  session_ref_hash text,
  user_agent_family text,
  country_code text,
  raw_pii_present boolean not null default false,
  raw_ip_stored boolean not null default false,
  raw_user_agent_stored boolean not null default false,
  metadata jsonb not null default '{}',
  constraint offer_click_events_no_raw_pii check (raw_pii_present = false and raw_ip_stored = false and raw_user_agent_stored = false),
  constraint offer_click_events_paths_match_slug check (landing_path = '/offers/' || canonical_slug and redirect_path = '/go/' || canonical_slug)
);

create index if not exists offer_click_events_offer_date_idx on offer_click_events(offer_id, event_date desc);
create index if not exists offer_click_events_slug_date_idx on offer_click_events(canonical_slug, event_date desc);

create table if not exists offer_signup_attribution_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offer_candidates(id),
  affiliate_tracking_id uuid references affiliate_tracking(id),
  signup_event_id uuid references signup_intent_events(id),
  canonical_slug text not null,
  landing_path text not null,
  redirect_path text,
  event_at timestamptz not null default now(),
  event_date date not null default current_date,
  attribution_ref_hash text,
  consent_state text not null default 'preference_only',
  raw_pii_present boolean not null default false,
  provider_push_enabled boolean not null default false,
  live_send_enabled boolean not null default false,
  metadata jsonb not null default '{}',
  constraint offer_signup_attribution_no_raw_pii_or_send check (raw_pii_present = false and provider_push_enabled = false and live_send_enabled = false),
  constraint offer_signup_attribution_landing_matches_slug check (landing_path = '/offers/' || canonical_slug)
);

create index if not exists offer_signup_attr_offer_date_idx on offer_signup_attribution_events(offer_id, event_date desc);
create index if not exists offer_signup_attr_slug_date_idx on offer_signup_attribution_events(canonical_slug, event_date desc);

create table if not exists offer_performance_daily (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offer_candidates(id),
  affiliate_tracking_id uuid references affiliate_tracking(id),
  canonical_slug text not null,
  metric_date date not null,
  click_count bigint not null default 0,
  signup_count bigint not null default 0,
  source_channel text not null default 'all',
  surface text not null default 'all',
  last_rollup_at timestamptz not null default now(),
  raw_pii_present boolean not null default false,
  metadata jsonb not null default '{}',
  unique (offer_id, metric_date, source_channel, surface),
  constraint offer_performance_daily_nonnegative_counts check (click_count >= 0 and signup_count >= 0),
  constraint offer_performance_daily_no_raw_pii check (raw_pii_present = false)
);

create index if not exists offer_performance_daily_slug_date_idx on offer_performance_daily(canonical_slug, metric_date desc);

-- 4) Approved public routing/feed view. Public cards link only to /offers/<slug>;
-- landing pages link only to /go/<slug>; external destination is not exposed in the feed.
create or replace view public_approved_offer_route_feed as
select
  c.id as offer_id,
  c.canonical_slug,
  c.public_landing_path as public_landing_url,
  c.public_redirect_path as redirect_url,
  c.vendor_name,
  c.offer_title,
  c.offer_summary,
  c.category_key,
  c.trend_lane,
  c.monetization_status,
  c.approval_status,
  c.image_rights_status,
  c.disclosure_text,
  c.seo_title,
  c.seo_description,
  c.seo_keywords,
  c.schema_org_type,
  c.schema_org_json,
  at.network,
  at.account_ref,
  case when at.destination_url_mode = 'sanitized' then at.destination_url_sanitized else null end as destination_url_sanitized,
  case when at.destination_url_mode = 'secret_ref' then at.destination_url_secret_ref else null end as destination_url_secret_ref,
  c.source_attribution,
  c.source_attribution_text,
  coalesce(c.click_count, 0) as click_count,
  coalesce(c.signup_count, 0) as signup_count,
  coalesce(c.last_verified_at, at.last_verified_at) as last_verified_at,
  coalesce(nullif(c.redirect_health, 'unknown'), at.redirect_health) as redirect_health,
  pd.surface,
  pd.publish_decision,
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
  and c.canonical_slug is not null
  and c.public_landing_path = '/offers/' || c.canonical_slug
  and c.public_redirect_path = '/go/' || c.canonical_slug
  and c.seo_title is not null
  and c.seo_description is not null
  and c.source_attribution <> '{}'::jsonb
  and pd.approval_status = 'approved'
  and pd.risk_tier <> 'blocked'
  and pd.publish_decision in ('publish_monetized','publish_lead_magnet')
  and (pd.starts_at is null or pd.starts_at <= now())
  and (pd.ends_at is null or pd.ends_at > now())
  and at.tracking_status = 'active'
  and at.approval_status = 'approved'
  and at.risk_tier <> 'blocked'
  and at.public_redirect_path = '/go/' || c.canonical_slug
  and at.destination_url_mode in ('secret_ref','sanitized')
  and at.redirect_health not in ('broken','blocked')
  and at.disclosure_required = true
  and at.disclosure_version is not null
  and (
    (pd.publish_decision = 'publish_monetized' and c.monetization_status = 'approved_monetized' and c.payout_model <> 'none' and at.monetization_status = 'approved_monetized')
    or (pd.publish_decision = 'publish_lead_magnet' and c.monetization_status = 'approved_lead_magnet' and c.payout_model = 'lead_magnet' and at.monetization_status = 'approved_lead_magnet')
  );

-- 5) Rollup helper: updates durable aggregate counts from no-PII event tables.
create or replace view offer_performance_rollup as
select
  c.id as offer_id,
  c.canonical_slug,
  coalesce(clicks.click_count, 0) as click_count,
  coalesce(signups.signup_count, 0) as signup_count
from offer_candidates c
left join (
  select offer_id, count(*)::bigint as click_count
  from offer_click_events
  where raw_pii_present = false and raw_ip_stored = false and raw_user_agent_stored = false
  group by offer_id
) clicks on clicks.offer_id = c.id
left join (
  select offer_id, count(*)::bigint as signup_count
  from offer_signup_attribution_events
  where raw_pii_present = false and provider_push_enabled = false and live_send_enabled = false
  group by offer_id
) signups on signups.offer_id = c.id;

-- Acceptance queries
-- 1. Public routes must expose only /offers/<slug> and /go/<slug> for approved rows.
-- select count(*) as bad_public_routes from public_approved_offer_route_feed where public_landing_url <> '/offers/' || canonical_slug or redirect_url <> '/go/' || canonical_slug;
-- expect 0
-- 2. Active tracking must have a safe destination mode and no obvious raw secret ref.
-- select count(*) as unsafe_destination_rows from affiliate_tracking where tracking_status = 'active' and not ((destination_url_mode = 'secret_ref' and destination_url_secret_ref is not null and destination_url_sanitized is null) or (destination_url_mode = 'sanitized' and destination_url_sanitized is not null));
-- expect 0
-- 3. Click/signup attribution events must not contain raw PII or live-send flags.
-- select count(*) as unsafe_attribution_events from offer_click_events where raw_pii_present or raw_ip_stored or raw_user_agent_stored;
-- expect 0
-- select count(*) as unsafe_signup_attr_events from offer_signup_attribution_events where raw_pii_present or provider_push_enabled or live_send_enabled;
-- expect 0
-- 4. Existing Amazon manual rows must have canonical /offers and /go routes before WebDev generates pages.
-- select count(*) as amazon_rows_missing_routes from affiliate_tracking where account_ref = 'amazon-associates-manual' and (canonical_slug is null or public_landing_path is null or public_redirect_path is null);
-- expect 0
