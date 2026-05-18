import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync(new URL('../db/007_spg_amazon_offer_inventory_schema.sql', import.meta.url), 'utf8');
const contract = readFileSync(new URL('../docs/spg-amazon-offer-inventory-contract.md', import.meta.url), 'utf8');
const seed = JSON.parse(readFileSync(new URL('../data/spg-amazon-offer-inventory-seed.json', import.meta.url), 'utf8'));

test('Amazon offer inventory seed contains exactly the top-25 money-page offers with required fields', () => {
  assert.equal(seed.offers.length, 25);
  for (const offer of seed.offers) {
    for (const field of [
      'slug', 'title', 'category', 'amazon_query', 'amazon_search_url', 'store_id_tag_ref',
      'image', 'fallback_asset', 'best_for', 'buyer_criteria', 'risk_level', 'last_checked',
      'approval_state', 'publish_state', 'offers_path', 'go_path', 'click_counters', 'source_attribution',
      'score', 'confidence', 'scoring_inputs', 'missing_data', 'false_positive_risk'
    ]) {
      assert.ok(Object.hasOwn(offer, field), `${offer.slug} missing ${field}`);
    }
    assert.equal(offer.store_id_tag_ref, 'mehyarmedia-20');
    assert.equal(offer.offers_path, `/offers/${offer.slug}`);
    assert.equal(offer.go_path, `/go/${offer.slug}`);
    assert.equal(offer.click_counters.raw_pii_stored, false);
    assert.match(offer.amazon_search_url, /tag=mehyarmedia-20/);
  }
});

test('Amazon offer inventory schema covers image rights, fallback assets, route paths, counters, attribution, and gates', () => {
  for (const field of [
    'amazon_offer_inventory', 'slug', 'title', 'category', 'amazon_query', 'store_id_tag_ref',
    'image_url', 'image_source', 'image_license', 'image_status', 'generated_original_fallback_asset',
    'best_for', 'buyer_criteria', 'risk_level', 'last_checked', 'approval_state', 'publish_state',
    'offers_path', 'go_path', 'click_count', 'signup_count', 'source_attribution', 'score',
    'confidence', 'scoring_inputs', 'scoring_weights', 'missing_data', 'false_positive_risks'
  ]) {
    assert.ok(migration.includes(field), `migration missing ${field}`);
    assert.ok(contract.includes(field), `contract missing ${field}`);
  }
  assert.match(migration, /amazon_offer_inventory_public_ready/);
  assert.match(migration, /offers_path = '\/offers\/' \|\| slug/);
  assert.match(migration, /go_path = '\/go\/' \|\| slug/);
});

test('Amazon seed and schema are secret, PII, and Amazon-image safe by default', () => {
  assert.equal(seed.safety.no_raw_pii, true);
  assert.equal(seed.safety.no_raw_secret_values, true);
  assert.equal(seed.safety.tag_reference_is_name_only, true);
  assert.doesNotMatch(`${JSON.stringify(seed)}
${migration}
${contract}`, /reader@example\.com|AKIA[0-9A-Z]{16}|sk_live_[A-Za-z0-9]+|pk_live_[A-Za-z0-9]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/i);
  assert.match(migration, /amazon_offer_inventory_no_unapproved_amazon_images/);
  for (const offer of seed.offers) {
    assert.notEqual(offer.image.status, 'approved');
    assert.match(offer.image.source, /amazon_images_prohibited/);
    assert.equal(offer.publish_state, 'hold_for_webdev_generation_and_compliance_gate');
  }
});

test('Amazon seed covers audit categories needed for image-led SPG money pages', () => {
  const categories = new Set(seed.offers.map((offer) => offer.category));
  for (const category of [
    'ai-recorders', 'digital-notebooks', 'usb-mics', 'portable-power-stations', 'solar-kits',
    'air-purifiers', 'walking-pads', 'robot-vacuums', 'pet-tech', 'travel-tech',
    'wellness-recovery', 'desk-gear', 'meal-prep'
  ]) {
    assert.ok(categories.has(category), `missing ${category}`);
  }
});
