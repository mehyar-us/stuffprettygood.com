# ComplyOps source-gate review — expanded opportunity registry

Task: t_e8a4f014
Reviewed artifacts:
- data/opportunity-source-registry.json -> recommended_additions_2026_05_16
- data/opportunity-desk/source-registry-expansion-2026-05-16.json

## Executive decision

Approved for internal metadata-only collection under caps: 7 source entries.
Watch/manual only: 10 source entries.
Schema-only / disabled until separate gate: 7 source entries.
Rejected / keep out of registry until reverified: 7 candidate entries.

No entry is approved for applying, registration, signup, bidding, enrollment, sponsor listing, outreach, customer charging, raw PII export, or credential storage. Those remain separate Tier 1/Tier 2 gates.

## Global source collection class gate

Status: APPROVED for metadata-only collection only.

Allowed accounts/providers:
- Public unauthenticated APIs, RSS feeds, documented public bulk downloads, official public HTML pages, or manual review by agents.
- API credentials may be referenced by environment variable name only, e.g. SAM_GOV_API_KEY or USAJOBS_API_KEY. No credential values in repo, logs, Kanban, docs, prompts, screenshots, or frontend.

Data boundary:
- Public opportunity metadata only: source_id, source_family, source URL, title/name, organization/company/agency, category/tags, posting date, due date if public, public budget/range if visible, and source health.
- No raw personal contact export. No candidate/user data. No tax/bank/KYC files. No bid documents behind login unless separately gated. No secrets.

Caps / rate limits:
- Default: daily or weekly run, max 25 items/source/run, max 1 request/minute/source for scrape-like sources unless official API documentation allows more.
- RSS: max 10 new items/run until source health is stable across 3 successful runs.
- Public APIs with unclear rate policy: first page only until terms/rate policy confirmed.
- Bulk downloads: occasional aggregate snapshots only; no high-frequency polling.

Audit log required per run:
- run_id, timestamp, source_id, source_family, allowed_access_method, access_terms_ref, credential_ref_env name if applicable, request count, item count, gate_status, data_classification=public, pii_present=none, external_action_type=none, errors, stop reason, and source_health.

Success metric:
- Metadata-only opportunity/demand signals collected without 403/429/login/captcha/ToS ambiguity, without PII/secrets, and with enough fields for ProductOps/Scout scoring.

Stop condition:
- Stop and mark needs_review on HTTP 403/429, login wall, captcha, robots/terms ambiguity, schema break, credential error, non-public data exposure, raw PII in payload, required account creation, or any flow asking to submit/apply/contact/register/pay.

Escalation threshold:
- Tier 2 required before: mass audience use, outbound messaging, sponsor pitch/listing, affiliate enrollment, marketplace account creation, tax/bank/KYC entry, government bid/submission, binding contract, raw PII export, or customer charge.

## Family lane decisions

| Family | Decision | Active cap | Rationale / blocker | Gate-ready language |
|---|---:|---:|---|---|
| public_job_demand | APPROVE limited metadata collection for Remotive, Arbeitnow, WWR; WATCH for Greenhouse; ENV-GATED for USAJOBS | Remotive/Arbeitnow first page daily; WWR 10 RSS items/run; Greenhouse 0 until named slug list; USAJOBS 0 until env key configured | Lowest-risk commercial lane if separated from outreach. Job postings are demand signals only, not permission to contact. | Collect only employer/role/source/date/tags. No recruiter/candidate data. No contact scraping. Outreach requires separate Small B2B Outreach gate with suppression/opt-out/account caps. |
| affiliate_sponsor | WATCH / schema-only; no collector automation beyond manual public page notes | 0 automated; manual notes only | Sponsor/affiliate programs often require account creation, tax/KYC, disclosures, marketplace terms, and claims proof. | Capture public categories/pricing/disclosure requirements only. No signup, application, sponsor listing, KYC/tax/bank action, or advertiser contact until Affiliate/Sponsor Enrollment gate and proof packet exist. |
| state_local_procurement | WATCH / manual public metadata only | 0 automated except manually verified public solicitation metadata | Procurement has registration, certification, insurance/bond, deadline, and bid-integrity risk. | Record public solicitation title, agency, URL, due date, visible budget/category only. No portal account, document download behind login, registration, questions to buyer, or bid/submission without Government Opportunity Tier 2 review. |
| subcontract_prime_portals | WATCH / source-map only | 0 automated supplier-flow actions | Prime portals can trigger NDA, supplier profile, clearance, certification, and partner representations. | Extract public resource links and stated requirements only. No supplier account, NDA, intake form, partner claim, or outreach. Flag clearance/certification/registration requirements. |
| grants | WATCH for NSF/EERE; APPROVE Grants.gov XML only after extract URL/file format/terms confirmed | Grants XML weekly max after confirmation; NSF/EERE manual only | Grant eligibility and application claims are legal/reputation-sensitive; agency pages may be navigation-only. | Collect public grant metadata only: opp ID, title, agency, due date, eligibility category, URL. No application, eligibility representation, budget, partner claim, or submission without Tier 2 review. |
| sam_usaspending | APPROVE existing SAM API with key; APPROVE USAspending API/dowload for award-intel metadata only | SAM existing daily cap 25; USAspending daily API cap 25; download occasional only | Official federal data sources are acceptable for intelligence, but bid/submission remains gated. | Use documented official endpoints only. Store public opportunity/award metadata. No internal v3 paths, no bid action, no registration, no capability/certification claims without proof. |
| rejected_or_watch_only | REJECT / disabled until manually reverified | 0 | 403, 404, defunct, or unstable URL conditions make automation unsafe. | Keep out of automated registry. Reconsider only with verified public URL, access terms, and manual source-health evidence. |

## Entry-level disposition

### Approved for metadata-only active collection under global gate
- remotive_remote_jobs_api — approve: official public API, public hiring-demand metadata only; cap first page daily until rate policy confirmed.
- arbeitnow_job_board_api — approve: official public API, first page daily; mark demand signal only.
- weworkremotely_remote_jobs_rss — approve: RSS feed, max 10 items/run until stable.
- sam_gov_v2_opportunities_search_reconfirm — approve existing documented v2 API only with SAM_GOV_API_KEY present; no bid/register action.
- usaspending_custom_award_download — approve for occasional aggregate award-history snapshots; prefer existing USAspending API for daily runs.
- grants_gov_xml_extract — conditional approve after manual confirmation of extract URL/file format/terms; weekly or lower cadence; no applications.
- sba_subcontracting_opportunities — approve source-map collection only: public links/requirements, no prime/supplier action.

### Watch / manual-only / not automated yet
- greenhouse_public_board_api_pattern — schema pattern only; may graduate only with explicit approved board slugs from public pages or approved target lists. No enumeration/brute force.
- usajobs_public_search_api — env-key gated; no collection until USAJOBS_API_KEY is configured and headers comply with official API docs.
- paved_advertisers — manual schema entry only; no advertiser account/listing.
- buysellads_advertisers — watch manual; redirect/homepage means weak stable evidence.
- rakuten_advertising_affiliate — manual schema entry only; no application/KYC/tax/bank.
- impact_affiliate_marketing — manual schema entry only; collect public compliance/disclosure requirements.
- flexoffers_affiliate_programs — manual schema entry only; flag tax/KYC/disclosure gates before enrollment.
- dc_water_procurement — manual public metadata only; no registration/download-gated docs/submission.
- procurement_maryland_gateway — watch manual/navigation only; do not automate eMMA login flows.
- nyc_passport_public_info — watch manual/navigation only until public solicitation path verified.
- virginia_eva — manual public search validation before automation; stop on login/captcha/registration.
- pennsylvania_emarketplace — manual public search validation; visible solicitation metadata only.
- northrop_suppliers — watch manual; no registration/outreach/NDA.
- lockheed_suppliers — watch manual; no supplier profile.
- saic_suppliers_small_business — watch manual; no intake forms/outreach.
- nsf_funding_opportunities — watch manual; reject opportunities if eligibility is academic/nonprofit-only.
- energy_eere_funding — watch manual/source-map only until stable page confirmed.

### Must remain schema_only/disabled until separate gate or re-verification
- greenhouse_public_board_api_pattern — schema_only until approved slug list exists.
- usajobs_public_search_api — disabled until USAJOBS_API_KEY and official-header gate are configured.
- affiliate_network_sponsor_watchlist family — disabled for automation; manual notes only until Affiliate/Sponsor Enrollment gate.
- state_local_procurement_portals family — disabled for automation; manual public metadata only until a specific portal has verified public endpoint and procurement gate.
- prime_subcontracting_portals family — disabled for automation except SBA public source-map extraction; no supplier workflows.
- local_smb_public_web_leads — remains schema_only/disabled; B2B outreach and public-contact handling require separate outreach/suppression gate.
- Any source requiring account creation, login, captcha bypass, KYC/tax/bank, NDA, supplier profile, bid bond/insurance, unverified certification, or submission deadline under 72h.

### Reject / keep out of automated registry
- caleprocure_ca — 403; manual browser verification required before any schema entry.
- fairfax_procurement — 403 from WSL; manual browser verification required.
- prince_georges_procurement — 403 from WSL; manual browser verification required.
- sam_gov_internal_v3_paths — internal/undocumented-looking paths returned 401/404; use only documented v2.
- fbo_gov — defunct/unresolvable; replaced by SAM.gov.
- passionfroot_advertise_pages — tested common advertiser URLs returned 404; retry only with verified URL.
- partnerize_affiliate_marketing_urls — tested common URLs returned 404; retry only with verified landing URL.

## Graduation language for active collection tickets

A source may graduate from schema/manual to active collection only when all of these are true:
1. Access method is official public API, RSS, public bulk download, or public HTML/manual review.
2. Collector owner records access_terms_ref and rate limit/cadence.
3. Collector output includes: source_id, source_family, allowed_access_method, access_terms_ref, gate_status=draft_only, external_action_type=none, data_classification=public, pii_present=none.
4. Data collected is public metadata only; no personal contact export, raw PII, secrets, credentials, forms, or gated documents.
5. Run cap and source-specific stop conditions are implemented.
6. Audit log is written per run.
7. Separate gated workflows exist for any downstream outreach, enrollment, application, bidding, registration, listing, payment, or customer promise.

## B2B outreach separation language

Job-board, procurement, award, grant, sponsor, affiliate, and supplier entries are discovery signals only. They do not authorize contact with companies, agencies, sponsors, affiliates, primes, employees, recruiters, buyers, or public officials. Any contact requires a separate outreach gate with approved sender/domain/account, truthful claims, suppression/opt-out handling, CRM logging, daily caps, stop-on-complaint/provider issue, and no scraped personal-contact export.

## Government / bid handling language

Federal, state/local, grant, and subcontracting sources may be used for market intelligence and opportunity triage only. No government registration, portal account, supplier profile, certification representation, bid/no-bid decision, Q&A submission, proposal, grant application, contract signature, insurance/bond action, or pricing commitment may occur without Tier 2 Government Opportunity review.

## Affiliate / sponsor handling language

Affiliate and sponsor sources may be used to map public program categories, sponsor fit, likely requirements, pricing model if public, and disclosure requirements. No affiliate enrollment, sponsor marketplace listing, advertiser outreach, tax/bank/KYC entry, audience metric claim, performance claim, or paid placement promise may occur without an Affiliate/Sponsor Enrollment gate and verified proof packet.

## Required registry hardening edits recommended

1. Add explicit `gate_status` to every candidate: approved_metadata_only, watch_manual, schema_only_disabled, env_key_required, rejected.
2. Add `external_action_cap: 0` to all sources by default.
3. Add source-specific `max_requests_per_run` and `max_items_per_run` fields instead of prose-only caps.
4. Add `pii_policy: public_metadata_only_no_personal_contact_export` to public_job_demand and local_smb lanes.
5. Add `family_action_boundary` fields for affiliate/sponsor, B2B outreach, and government/bid lanes so downstream workers cannot confuse discovery signals with external action approval.

## Final approval note

The proposed language is sufficient to let DataEng implement metadata-only collectors for the approved/conditional entries. It is not sufficient to authorize external action. Keep all sponsor/affiliate enrollment, B2B outreach, procurement/bid, grant application, supplier profile, registration, and payment actions gated separately.
