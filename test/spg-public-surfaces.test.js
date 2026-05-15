import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  approvedOffers,
  claimSafeCopy,
  publicSurfaces,
  quizResultStacks,
  toolsByJobBacklog,
  trendOfferLanes,
} from '../src/spg/public-surfaces.js';

const publicDir = new URL('../public', import.meta.url).pathname;
const html = (route) => readFileSync(join(publicDir, route), 'utf8');

const requiredStaticRoutes = [
  'index.html',
  'ai-tool-stack-quiz.html',
  'starter-kits/solopreneur-automation.html',
  'tools-by-job/index.html',
  'savings-finder.html',
  'ai-readiness-score.html',
  'deals.html',
  'trends.html',
  'templates.html',
  'reactivation.html',
  'thank-you.html',
  'crm-command-center-ux.html',
  'preferences.html',
  'unsubscribe.html',
  'privacy.html',
  'terms.html',
  'affiliate-disclosure.html',
];

test('StuffPrettyGood public surface data covers required MVP routes', () => {
  assert.ok(publicSurfaces.length >= 10);
  assert.equal(quizResultStacks.length, 8);
  assert.equal(toolsByJobBacklog.length, 20);
  for (const surface of publicSurfaces) {
    assert.ok(surface.events.length > 0, `${surface.name} missing CRM events`);
    assert.ok(surface.purpose.length > 12, `${surface.name} missing purpose`);
  }
});

test('all required static pages exist and expose disclosure/preferences/unsubscribe paths', () => {
  for (const route of requiredStaticRoutes) {
    assert.ok(existsSync(join(publicDir, route)), `${route} missing`);
    const page = html(route);
    assert.match(page, /Affiliate disclosure/i, `${route} missing affiliate disclosure`);
    assert.match(page, /href="\/privacy\.html"/, `${route} missing privacy link`);
    assert.match(page, /href="\/preferences\.html"/, `${route} missing preference link`);
    assert.match(page, /href="\/unsubscribe\.html"/, `${route} missing unsubscribe link`);
  }
});

test('quiz captures required fields and result taxonomy with claim-safe copy', () => {
  const quiz = html('ai-tool-stack-quiz.html');
  for (const field of ['role_persona', 'business_type', 'team_size', 'current_tools', 'budget_range', 'top_pain_priority', 'automation_goal', 'urgency', 'preferred_channel', 'quiz_email']) {
    assert.match(quiz, new RegExp(`id="${field}"`), `quiz missing ${field}`);
  }
  for (const result of quizResultStacks) {
    assert.match(quiz, new RegExp(result.slug), `quiz missing result ${result.slug}`);
    const resultPage = html(`ai-tool-stack-quiz/results/${result.slug}.html`);
    assert.match(resultPage, /data-result-variant=/);
    assert.match(resultPage, /not proof|not guaranteed|starting points/i);
    assert.ok((resultPage.match(/href="\/go\//g) || []).length >= 5, `${result.slug} missing /go links`);
  }
});

test('tools-by-job backlog generates 20 claim-safe page specs with CRM maps', () => {
  const index = html('tools-by-job/index.html');
  for (const job of toolsByJobBacklog) {
    assert.match(index, new RegExp(job.slug), `index missing ${job.slug}`);
    assert.ok(job.persona);
    assert.ok(job.keywordIntent);
    assert.ok(job.affiliateCategory);
    assert.ok(job.crmEventMap.includes('quiz_cta_clicked'));
    assert.ok(job.claimRules.length > 10);
    assert.ok(job.killMetric.length > 10);
    const page = html(`tools-by-job/${job.slug}.html`);
    assert.match(page, /CRM event map/i);
    assert.match(page, /Take the quiz/i);
    assert.match(page, /href="\/go\//);
    assert.doesNotMatch(page, /proven best|#1|make money fast|guaranteed (income|revenue|savings|sales|leads)/i);
  }
});

test('trending offer lanes populate Google Trends-driven pages with signup hooks', () => {
  assert.ok(trendOfferLanes.length >= 10);
  const trends = html('trends.html');
  assert.match(trends, /Google Trends powered offer map/i);
  assert.match(trends, /trend_email/);
  assert.match(trends, /Affiliate disclosure/i);
  for (const lane of trendOfferLanes) {
    assert.ok(lane.seed);
    assert.ok(lane.monetize);
    assert.ok(Array.isArray(lane.queries));
    assert.doesNotMatch(lane.offer, /guaranteed|#1|proven best/i);
    const page = html(`trends/${lane.slug}.html`);
    assert.match(page, new RegExp(lane.seed, 'i'));
    assert.match(page, /Save this preference|trend_lane_email/i);
    assert.match(page, /manual Amazon links|affiliate disclosure|no copied merchant content/i);
  }
});

test('starter, savings, readiness, weekly, template, preference and unsubscribe flows map required events', () => {
  const checks = [
    ['starter-kits/solopreneur-automation.html', ['business_stage', 'current_stack', 'missing_capability', 'setup_interest']],
    ['savings-finder.html', ['savings_assessment_started', 'confidence_band', 'audit_interest_consented']],
    ['ai-readiness-score.html', ['readiness_score', 'top_use_cases', 'booking_interest_consented']],
    ['deals.html', ['weekly_optin_completed', 'topic_preference', 'frequency_preference']],
    ['templates.html', ['template_download_started', 'license', 'paid_interest']],
    ['reactivation.html', ['return_credit_interest', 'private drops', 'ai/business offers', 'stuffprettygood updates', 'Unsubscribe everything', 'NO-SEND']],
    ['thank-you.html', ['Preference Saved', 'next_step_clicked', 'Unsubscribe']],
    ['crm-command-center-ux.html', ['Contact War Room', 'Sponsor pilot', 'Offer manager', 'Test simulator', 'Metrics dashboard', 'NO-SEND']],
    ['preferences.html', ['brand_optout', 'global_optout', 'frequency']],
    ['unsubscribe.html', ['suppression_created', 'global_unsubscribe', 'brand_unsubscribe']],
  ];
  for (const [route, needles] of checks) {
    const page = html(route);
    for (const needle of needles) assert.match(page, new RegExp(needle, 'i'), `${route} missing ${needle}`);
  }
});

test('/go pages are disclosure-visible placeholders for every approved offer', () => {
  for (const offer of approvedOffers) {
    const page = html(`go/${offer.slug}.html`);
    assert.match(page, new RegExp(offer.name));
    assert.match(page, /affiliate disclosure/i);
    assert.match(page, /Production redirect must record/i);
    assert.match(page, /disclosure_seen/i);
  }
});

test('frontend app redacts raw PII-like keys before CRM event dispatch', () => {
  const app = html('app.js');
  assert.match(app, /email\|phone\|name\|password\|secret\|token\|invoice\|payment/i);
  assert.match(app, /\[redacted\]/);
  assert.doesNotMatch(app, /console\.log\(/, 'frontend must not log raw form data');
  assert.match(claimSafeCopy.privacyPromise, /Do not enter passwords, secrets/i);
});
