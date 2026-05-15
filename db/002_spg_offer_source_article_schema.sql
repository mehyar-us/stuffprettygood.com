-- StuffPrettyGood durable offer/source/article schema
-- Status: additive migration draft for LeadFS. Do not run in production without review.
-- Privacy: no raw PII, no secrets, no Amazon scraping/copying merchant prices/images/reviews/ratings/availability.

create extension if not exists pgcrypto;

create table if not exists spg_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  source_type text not null check (source_type in ('google_trends','rss','atom','manual_amazon','direct_merchant','saas_referral','sponsor','owned_offer','template_lead_magnet','public_api','manual_editorial','other')),
  homepage_url text,
  feed_url text,
  api_endpoint_label text,
  terms_url text,
  robots_or_terms_notes text,
  allowed_use text not null check (allowed_use in ('metadata_only','short_excerpt','original_summary_only','merchant_creative_allowed','owned_content','blocked')),
  license_name text,
  license_url text,
  rights_contact text,
  country_scope text default 'US',
  category_hint text,
  risk_tier text not null check (risk_tier in ('low','medium','high','blocked')),
  source_quality_score integer check (source_quality_score between 0 and 100),
  enabled boolean not null default false,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','paused','rejected','blocked')),
  approval_notes text,
  reviewed_by text,
  last_reviewed_at timestamptz,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_class text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spg_sources_approved_requires_terms check (
    approval_status <> 'approved' or (terms_url is not null and allowed_use <> 'blocked' and risk_tier <> 'blocked')
  ),
  constraint spg_sources_no_amazon_feed check (
    source_type <> 'manual_amazon' or feed_url is null
  )
);

create table if not exists spg_categories (
  id uuid primary key default gen_random_uuid(),
  category_key text not null unique,
  name text not null,
  parent_id uuid references spg_categories(id),
  description text,
  seo_slug text unique,
  risk_tier text not null default 'low' check (risk_tier in ('low','medium','high','blocked')),
  display_order integer not null default 100,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists spg_tags (
  id uuid primary key default gen_random_uuid(),
  tag_key text not null unique,
  name text not null,
  tag_type text not null check (tag_type in ('topic','persona','trend','merchant','risk','seasonal','format','other')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists spg_source_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references spg_sources(id),
  source_item_key text,
  canonical_url text not null,
  canonical_domain text not null,
  url_hash text not null,
  content_hash text,
  dedupe_hash text not null,
  title text not null,
  summary_excerpt text,
  source_author text,
  published_at timestamptz,
  fetched_at timestamptz not null,
  last_seen_at timestamptz not null,
  first_seen_at timestamptz not null,
  language text not null default 'en',
  country_scope text not null default 'US',
  raw_category text,
  normalized_category_id uuid references spg_categories(id),
  matched_trend_lane text,
  matched_keywords text[] not null default '{}',
  source_age_hours numeric,
  allowed_use text not null check (allowed_use in ('metadata_only','short_excerpt','original_summary_only','merchant_creative_allowed','owned_content','blocked')),
  license_name text,
  risk_tier text not null check (risk_tier in ('low','medium','high','blocked')),
  risk_flags text[] not null default '{}',
  quarantine_reason text,
  ingest_status text not null default 'new' check (ingest_status in ('new','deduped','candidate_created','quarantined','rejected','ignored')),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','needs_review','approved_for_candidate','rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint spg_source_items_quarantine_requires_reason check (
    ingest_status <> 'quarantined' or quarantine_reason is not null
  )
);

create unique index if not exists spg_source_items_url_hash_idx on spg_source_items(url_hash);
create index if not exists spg_source_items_dedupe_idx on spg_source_items(dedupe_hash, first_seen_at desc);
create index if not exists spg_source_items_source_seen_idx on spg_source_items(source_id, last_seen_at desc);
create index if not exists spg_source_items_review_idx on spg_source_items(review_status, ingest_status, risk_tier);

create table if not exists spg_offer_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_key text not null unique,
  source_item_id uuid references spg_source_items(id),
  source_id uuid references spg_sources(id),
  candidate_type text not null check (candidate_type in ('amazon_manual','direct_merchant','saas_referral','sponsor_slot','owned_mehyarsoft','template_lead_magnet','editorial_recommendation','network_application_target')),
  vendor_name text not null,
  program_name text,
  program_type text not null check (program_type in ('amazon_associates_manual','affiliate_network','direct_referral','direct_sponsor','owned','free_resource','unknown')),
  landing_url text,
  manual_link_label text,
  proposed_go_slug text,
  title text not null,
  editorial_angle text,
  short_description text,
  claim_restrictions text[] not null default '{}',
  required_disclosure text,
  persona_fit text[] not null default '{}',
  category_id uuid references spg_categories(id),
  tag_ids uuid[] not null default '{}',
  trend_lane text,
  risk_tier text not null check (risk_tier in ('low','medium','high','blocked')),
  approval_status text not null default 'pending' check (approval_status in ('pending','needs_compliance','approved','paused','rejected')),
  approval_notes text,
  source_license text,
  image_policy text not null default 'none' check (image_policy in ('owned','generated','licensed','merchant_provided','placeholder_safe','none','blocked')),
  candidate_score numeric check (candidate_score between 0 and 100),
  candidate_confidence numeric check (candidate_confidence between 0 and 1),
  missing_data text[] not null default '{}',
  false_positive_risks text[] not null default '{}',
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint spg_offer_candidate_approved_requires_disclosure check (
    approval_status <> 'approved' or (required_disclosure is not null and risk_tier <> 'blocked' and image_policy <> 'blocked')
  )
);

create index if not exists spg_offer_candidates_status_idx on spg_offer_candidates(approval_status, risk_tier, candidate_type);
create index if not exists spg_offer_candidates_seen_idx on spg_offer_candidates(last_seen_at desc);

create table if not exists spg_images (
  id uuid primary key default gen_random_uuid(),
  image_key text not null unique,
  source_type text not null check (source_type in ('owned','generated','licensed_stock','merchant_provided','public_domain','placeholder_safe','blocked')),
  source_url text,
  storage_url text,
  alt_text text not null,
  caption text,
  license_name text,
  license_url text,
  credit_required text,
  credit_rendered boolean not null default false,
  allowed_surfaces text[] not null default '{}',
  rights_status text not null default 'pending' check (rights_status in ('pending','approved','expired','blocked')),
  risk_tier text not null check (risk_tier in ('low','medium','high','blocked')),
  hash text,
  width integer,
  height integer,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint spg_images_credit_required_rendered check (
    credit_required is null or credit_rendered = true or rights_status <> 'approved'
  ),
  constraint spg_images_approved_not_blocked check (
    rights_status <> 'approved' or (source_type <> 'blocked' and risk_tier <> 'blocked')
  )
);

create table if not exists spg_disclosure_blocks (
  id uuid primary key default gen_random_uuid(),
  disclosure_key text not null unique,
  disclosure_type text not null check (disclosure_type in ('affiliate','amazon_associates','sponsor','owned_offer','mixed')),
  disclosure_text text not null,
  version text not null,
  active boolean not null default true,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists spg_offers (
  id uuid primary key default gen_random_uuid(),
  offer_key text not null unique,
  candidate_id uuid references spg_offer_candidates(id),
  vendor_name text not null,
  offer_title text not null,
  offer_subtitle text,
  offer_description text,
  program_type text not null check (program_type in ('amazon_associates_manual','affiliate_network','direct_referral','direct_sponsor','owned','free_resource','unknown')),
  destination_url text,
  destination_domain text,
  category_id uuid references spg_categories(id),
  primary_tag_ids uuid[] not null default '{}',
  image_id uuid references spg_images(id),
  disclosure_block_id uuid references spg_disclosure_blocks(id),
  allowed_surfaces text[] not null default '{}',
  required_disclosure text not null,
  approval_status text not null default 'approved' check (approval_status in ('approved','paused','rejected','expired')),
  publish_state text not null default 'draft' check (publish_state in ('draft','scheduled','published','paused','archived')),
  risk_tier text not null check (risk_tier in ('low','medium','high','blocked')),
  compliance_notes text,
  price_claim_allowed boolean not null default false,
  availability_claim_allowed boolean not null default false,
  rating_review_claim_allowed boolean not null default false,
  last_health_status text not null default 'unknown' check (last_health_status in ('unknown','ok','redirect_ok','broken','blocked','manual_review')),
  last_health_checked_at timestamptz,
  first_published_at timestamptz,
  last_published_at timestamptz,
  last_reviewed_at timestamptz not null,
  owner text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spg_offers_publish_requires_approval check (
    publish_state <> 'published' or (approval_status = 'approved' and risk_tier <> 'blocked' and required_disclosure is not null)
  )
);

create index if not exists spg_offers_publish_idx on spg_offers(approval_status, publish_state, risk_tier);
create index if not exists spg_offers_category_idx on spg_offers(category_id, publish_state);

create table if not exists spg_go_links (
  id uuid primary key default gen_random_uuid(),
  go_slug text not null unique,
  offer_id uuid references spg_offers(id),
  destination_url text not null,
  destination_domain text not null,
  link_type text not null check (link_type in ('amazon_manual','direct_merchant','saas_referral','sponsor','owned','resource')),
  affiliate_tag_label text,
  utm_template_id uuid,
  disclosure_required boolean not null default true,
  disclosure_version text,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','paused','rejected')),
  redirect_status text not null default 'inactive' check (redirect_status in ('inactive','active','paused','broken')),
  health_status text not null default 'unknown' check (health_status in ('unknown','ok','redirect_ok','broken','blocked','manual_review')),
  last_health_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spg_go_active_requires_approval check (
    redirect_status <> 'active' or (approval_status = 'approved' and disclosure_version is not null and health_status not in ('broken','blocked'))
  )
);

create index if not exists spg_go_links_active_idx on spg_go_links(go_slug, redirect_status, approval_status);

alter table spg_offers
  add column if not exists go_link_id uuid references spg_go_links(id);

create table if not exists spg_articles (
  id uuid primary key default gen_random_uuid(),
  article_key text not null unique,
  slug text not null unique,
  title text not null,
  dek text,
  body_md text,
  article_type text not null check (article_type in ('daily_digest','trend_lane','buyer_guide','comparison','how_to','advertiser_page','reactivation_lane','quiz_result')),
  source_item_ids uuid[] not null default '{}',
  offer_ids uuid[] not null default '{}',
  category_id uuid references spg_categories(id),
  tag_ids uuid[] not null default '{}',
  canonical_url text,
  seo_title text,
  seo_description text,
  schema_json jsonb not null default '{}',
  disclosure_block_id uuid references spg_disclosure_blocks(id),
  approval_status text not null default 'draft' check (approval_status in ('draft','needs_review','approved','rejected','paused')),
  publish_state text not null default 'draft' check (publish_state in ('draft','scheduled','published','paused','archived')),
  risk_tier text not null default 'low' check (risk_tier in ('low','medium','high','blocked')),
  generated_by text,
  reviewed_by text,
  last_reviewed_at timestamptz,
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spg_articles_publish_requires_review check (
    publish_state <> 'published' or (approval_status = 'approved' and risk_tier <> 'blocked' and seo_title is not null and seo_description is not null)
  )
);

create table if not exists spg_page_placements (
  id uuid primary key default gen_random_uuid(),
  surface text not null check (surface in ('home','category','trend_hub','trend_lane','article','quiz_result','advertiser','preference_center')),
  route_path text not null,
  slot_key text not null,
  placement_type text not null check (placement_type in ('offer','article','category','signup_module','sponsor_slot','disclosure','image_card')),
  offer_id uuid references spg_offers(id),
  article_id uuid references spg_articles(id),
  image_id uuid references spg_images(id),
  category_id uuid references spg_categories(id),
  headline text,
  display_copy text,
  cta_label text,
  cta_url text,
  rank integer not null default 100,
  theme_variant text not null default 'both' check (theme_variant in ('dark','light','both')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','paused','rejected')),
  publish_state text not null default 'draft' check (publish_state in ('draft','scheduled','published','paused','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint spg_page_placements_has_entity check (
    offer_id is not null or article_id is not null or image_id is not null or category_id is not null or placement_type in ('signup_module','disclosure')
  ),
  constraint spg_page_placements_publish_requires_approval check (
    publish_state <> 'published' or approval_status = 'approved'
  )
);

create index if not exists spg_page_placements_route_idx on spg_page_placements(route_path, surface, publish_state, rank);

create table if not exists spg_approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('source','source_item','offer_candidate','offer','article','image','go_link','placement')),
  entity_id uuid not null,
  approval_status text not null check (approval_status in ('pending','needs_changes','approved','paused','rejected','blocked')),
  reviewer_role text not null check (reviewer_role in ('Scout','ComplyOps','WebDev','DataEng','Arman','HotZero')),
  reviewer text,
  risk_tier text not null check (risk_tier in ('low','medium','high','blocked')),
  decision_reason text not null,
  requirements_checked text[] not null default '{}',
  missing_data text[] not null default '{}',
  reviewed_at timestamptz not null default now()
);

create index if not exists spg_approvals_entity_idx on spg_approvals(entity_type, entity_id, reviewed_at desc);

create table if not exists spg_public_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('page_view','offer_impression','disclosure_seen','go_click','signup_started','signup_submitted','preference_saved','unsubscribe_requested','unsubscribe_completed','source_item_reviewed','offer_approved','article_published')),
  brand text not null default 'StuffPrettyGood',
  event_date date not null default current_date,
  event_at timestamptz not null default now(),
  route_path text,
  surface text,
  lane_slug text,
  category_key text,
  offer_id uuid references spg_offers(id),
  article_id uuid references spg_articles(id),
  go_link_id uuid references spg_go_links(id),
  source_id uuid references spg_sources(id),
  utm_source_bucket text,
  utm_medium_bucket text,
  device_class text check (device_class in ('desktop','tablet','mobile','unknown')),
  session_ref_hash text,
  profile_ref_hash text,
  raw_pii_present boolean not null default false,
  blocked_payload_stored boolean not null default false,
  blocker_classes text[] not null default '{}',
  metadata jsonb not null default '{}',
  constraint spg_public_events_no_raw_payload_storage check (raw_pii_present = false and blocked_payload_stored = false)
);

create index if not exists spg_public_events_rollup_idx on spg_public_events(event_date, event_type, route_path);
create index if not exists spg_public_events_offer_idx on spg_public_events(event_date, offer_id, go_link_id);

create table if not exists spg_signup_preference_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('signup_started','signup_submitted','double_opt_in_pending','preference_saved','unsubscribe_requested','unsubscribe_completed','global_optout_requested')),
  route_path text not null,
  form_key text,
  consent_copy_version text,
  privacy_version text,
  disclosure_version text,
  preference_topics text[] not null default '{}',
  frequency_preference text,
  channel_preference text not null default 'unknown' check (channel_preference in ('email','sms','web_only','unknown')),
  consent_state text not null check (consent_state in ('preference_only','email_opt_in_pending','email_opted_in','opted_out','unknown')),
  profile_ref_hash text,
  identifier_hash text,
  source_category text,
  source_route text,
  raw_pii_present boolean not null default false,
  provider_push_enabled boolean not null default false,
  live_send_enabled boolean not null default false,
  audit_notes text,
  created_at timestamptz not null default now(),
  constraint spg_signup_preference_no_send_default check (provider_push_enabled = false and live_send_enabled = false and raw_pii_present = false)
);

create index if not exists spg_signup_pref_events_type_idx on spg_signup_preference_events(created_at desc, event_type, consent_state);

create table if not exists spg_daily_ingestion_metrics (
  metric_date date not null,
  source_id uuid references spg_sources(id),
  category_key text,
  items_fetched integer not null default 0,
  items_new integer not null default 0,
  items_deduped integer not null default 0,
  items_quarantined integer not null default 0,
  candidates_created integer not null default 0,
  candidates_approved integer not null default 0,
  offers_published integer not null default 0,
  articles_published integer not null default 0,
  images_approved integer not null default 0,
  source_success_rate numeric,
  median_source_age_hours numeric,
  quarantine_rate numeric,
  approval_rate numeric,
  missing_terms_count integer not null default 0,
  rights_block_count integer not null default 0,
  no_pii_leak_asserted boolean not null default true,
  no_amazon_scrape_asserted boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (metric_date, source_id, category_key)
);

create table if not exists spg_network_readiness_snapshots (
  snapshot_date date primary key,
  content_pages_live integer not null default 0,
  approved_offers_live integer not null default 0,
  active_go_links integer not null default 0,
  approved_sources integer not null default 0,
  median_source_age_hours numeric,
  views_7d integer not null default 0,
  go_clicks_7d integer not null default 0,
  signup_starts_7d integer not null default 0,
  preference_categories_7d integer not null default 0,
  disclosure_seen_rate_7d numeric,
  compliance_pages_live boolean not null default false,
  hard_blockers text[] not null default '{}',
  readiness_score numeric not null default 0 check (readiness_score between 0 and 100),
  confidence numeric not null default 0.2 check (confidence between 0 and 1),
  missing_data text[] not null default '{}',
  false_positive_risks text[] not null default '{}',
  privacy_pii_handling text not null,
  refresh_cadence text not null default 'daily ingestion + weekly Scout review + monthly target recalibration',
  readiness_status text not null check (readiness_status in ('NO_GO','WATCH','READY_FOR_APPLICATION')),
  created_at timestamptz not null default now(),
  constraint spg_network_readiness_hard_blockers_no_go check (
    cardinality(hard_blockers) = 0 or readiness_status = 'NO_GO'
  )
);

-- Optional helper view for approved public offer inventory.
create or replace view spg_public_offer_inventory as
select
  o.id,
  o.offer_key,
  o.vendor_name,
  o.offer_title,
  o.program_type,
  o.publish_state,
  o.approval_status,
  o.risk_tier,
  o.category_id,
  c.category_key,
  c.name as category_name,
  gl.go_slug,
  gl.redirect_status,
  gl.health_status,
  o.last_reviewed_at
from spg_offers o
left join spg_categories c on c.id = o.category_id
left join spg_go_links gl on gl.offer_id = o.id
where o.approval_status = 'approved'
  and o.publish_state in ('published','scheduled')
  and o.risk_tier <> 'blocked';
