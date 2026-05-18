# SPG Amazon offer inventory + image-rights contract

Task: t_51c156c8
Owner: DataEng
Seed file: `data/spg-amazon-offer-inventory-seed.json`
Migration draft: `db/007_spg_amazon_offer_inventory_schema.sql`
Status: additive schema + seed artifact for LeadFS/WebDev/ComplyOps review before production execution.

## Reality

StuffPrettyGood needs image-led Amazon-first money pages, but Amazon creative/content cannot be copied into public pages by default. This contract creates a durable inventory that stores offer metadata, routing paths, image-rights state, fallback owned/generated asset instructions, no-PII counters, and source attribution without exposing secrets or raw PII.

## Safety gates

- Store/tag is represented by name only: `mehyarmedia-20`.
- No raw secrets or credential values are stored.
- No raw PII is stored; counters are aggregate only.
- No Amazon product images, prices, reviews, ratings, availability, Prime/coupon language, or listing copy are stored.
- Rows default to `publish_state=hold_for_webdev_generation_and_compliance_gate` and `approval_state=data_seed_ready_compliance_review_required`.
- Public view eligibility requires `approval_state=approved_for_public_publish`, `publish_state in ('publish_ready','published')`, `image_status=approved`, and non-blocked risk.

## Durable row fields

Each row covers:

- `slug`, `title`, `category`
- `amazon_query`, generated `amazon_search_url`, `store_id_tag_ref`
- image-rights fields: `image_url`, `image_source`, `image_license`, `image_status`
- `generated_original_fallback_asset`
- `best_for`, `buyer_criteria`, `risk_level`, `risk_notes`
- `last_checked`, `approval_state`, `publish_state`
- `offers_path=/offers/<slug>`, `go_path=/go/<slug>`
- aggregate `click_count`, `signup_count`
- `source_attribution`
- exposed scoring: `score`, `confidence`, `scoring_inputs`, `scoring_weights`, `missing_data`, `false_positive_risks`

## Top-25 seed set

1. `ai-meeting-recorder-note-taker` — AI meeting recorder note taker (ai-recorders) → `/offers/ai-meeting-recorder-note-taker` / `/go/ai-meeting-recorder-note-taker`
2. `ai-voice-recorder-for-interviews` — AI voice recorder for interviews (ai-recorders) → `/offers/ai-voice-recorder-for-interviews` / `/go/ai-voice-recorder-for-interviews`
3. `e-ink-digital-notebook` — E-ink digital notebook (digital-notebooks) → `/offers/e-ink-digital-notebook` / `/go/e-ink-digital-notebook`
4. `smart-reusable-notebook` — Smart reusable notebook (digital-notebooks) → `/offers/smart-reusable-notebook` / `/go/smart-reusable-notebook`
5. `usb-c-podcast-microphone` — USB-C podcast microphone (usb-mics) → `/offers/usb-c-podcast-microphone` / `/go/usb-c-podcast-microphone`
6. `compact-usb-condenser-mic` — Compact USB condenser mic (usb-mics) → `/offers/compact-usb-condenser-mic` / `/go/compact-usb-condenser-mic`
7. `portable-power-station-300w` — Portable power station 300W (portable-power-stations) → `/offers/portable-power-station-300w` / `/go/portable-power-station-300w`
8. `portable-power-station-1000w` — Portable power station 1000W (portable-power-stations) → `/offers/portable-power-station-1000w` / `/go/portable-power-station-1000w`
9. `folding-solar-panel-kit` — Folding solar panel kit (solar-kits) → `/offers/folding-solar-panel-kit` / `/go/folding-solar-panel-kit`
10. `balcony-solar-starter-kit` — Balcony solar starter kit (solar-kits) → `/offers/balcony-solar-starter-kit` / `/go/balcony-solar-starter-kit`
11. `hepa-air-purifier-bedroom` — HEPA air purifier for bedroom (air-purifiers) → `/offers/hepa-air-purifier-bedroom` / `/go/hepa-air-purifier-bedroom`
12. `large-room-air-purifier` — Large-room air purifier (air-purifiers) → `/offers/large-room-air-purifier` / `/go/large-room-air-purifier`
13. `under-desk-walking-pad` — Under-desk walking pad (walking-pads) → `/offers/under-desk-walking-pad` / `/go/under-desk-walking-pad`
14. `folding-walking-pad-with-handle` — Folding walking pad with handle (walking-pads) → `/offers/folding-walking-pad-with-handle` / `/go/folding-walking-pad-with-handle`
15. `self-emptying-robot-vacuum` — Self-emptying robot vacuum (robot-vacuums) → `/offers/self-emptying-robot-vacuum` / `/go/self-emptying-robot-vacuum`
16. `robot-vacuum-mop-combo` — Robot vacuum mop combo (robot-vacuums) → `/offers/robot-vacuum-mop-combo` / `/go/robot-vacuum-mop-combo`
17. `gps-pet-tracker-collar` — GPS pet tracker collar (pet-tech) → `/offers/gps-pet-tracker-collar` / `/go/gps-pet-tracker-collar`
18. `automatic-pet-feeder-camera` — Automatic pet feeder with camera (pet-tech) → `/offers/automatic-pet-feeder-camera` / `/go/automatic-pet-feeder-camera`
19. `travel-esim-phone-plan` — Travel eSIM phone plan (travel-tech) → `/offers/travel-esim-phone-plan` / `/go/travel-esim-phone-plan`
20. `portable-luggage-scale` — Portable luggage scale (travel-tech) → `/offers/portable-luggage-scale` / `/go/portable-luggage-scale`
21. `red-light-therapy-panel` — Red light therapy panel (wellness-recovery) → `/offers/red-light-therapy-panel` / `/go/red-light-therapy-panel`
22. `massage-gun-recovery-tool` — Massage gun recovery tool (wellness-recovery) → `/offers/massage-gun-recovery-tool` / `/go/massage-gun-recovery-tool`
23. `ergonomic-monitor-arm` — Ergonomic monitor arm (desk-gear) → `/offers/ergonomic-monitor-arm` / `/go/ergonomic-monitor-arm`
24. `desk-cable-management-kit` — Desk cable management kit (desk-gear) → `/offers/desk-cable-management-kit` / `/go/desk-cable-management-kit`
25. `glass-meal-prep-containers` — Glass meal prep containers (meal-prep) → `/offers/glass-meal-prep-containers` / `/go/glass-meal-prep-containers`

## Category coverage

- `ai-recorders`: 2
- `air-purifiers`: 2
- `desk-gear`: 2
- `digital-notebooks`: 2
- `meal-prep`: 1
- `pet-tech`: 2
- `portable-power-stations`: 2
- `robot-vacuums`: 2
- `solar-kits`: 2
- `travel-tech`: 2
- `usb-mics`: 2
- `walking-pads`: 2
- `wellness-recovery`: 2

## Scoring model

Weights:

- buyer intent: 0.25
- Amazon fit: 0.20
- content monetization fit: 0.20
- rights readiness: 0.15
- risk penalty: 0.10
- category coverage: 0.10

Confidence is lower for regulated/health/power categories because public copy, safety claims, and product fit require manual review. Missing data and false-positive risks are explicit on every row.

## Acceptance queries

```sql
-- Top-25 seed rows present.
select count(*) as amazon_seed_rows from amazon_offer_inventory;
-- expect >= 25
```

```sql
-- Route contract intact.
select count(*) as bad_routes
from amazon_offer_inventory
where offers_path <> '/offers/' || slug
   or go_path <> '/go/' || slug;
-- expect 0
```

```sql
-- No unapproved Amazon imagery can go public.
select count(*) as unsafe_public_image_rows
from amazon_offer_inventory
where publish_state in ('publish_ready','published')
  and image_status <> 'approved';
-- expect 0
```

```sql
-- Tag reference is name-only and standardized.
select count(*) as bad_tag_refs
from amazon_offer_inventory
where store_id_tag_ref <> 'mehyarmedia-20';
-- expect 0
```

## Handoff

LeadFS/WebDev can map this seed into money-page generation, but public generation remains blocked until ComplyOps/WebDev approve image assets, disclosures, and live `/go` redirect health. DevOps should keep the true Amazon destination handling server-side when routes move from seed data to live redirect implementation.
