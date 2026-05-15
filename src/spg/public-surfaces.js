import { trendOfferLanes } from './trending-offers.js';
export { trendOfferLanes } from './trending-offers.js';

export const complianceLinks = [
  { label: 'Affiliate disclosure', href: '/affiliate-disclosure.html' },
  { label: 'Privacy', href: '/privacy.html' },
  { label: 'Terms', href: '/terms.html' },
  { label: 'Preferences', href: '/preferences.html' },
  { label: 'Unsubscribe', href: '/unsubscribe.html' },
];

export const crmEvents = {
  home: ['surface_viewed', 'utility_cta_clicked', 'weekly_optin_started', 'disclosure_seen'],
  quiz: ['quiz_started', 'quiz_step_answered', 'quiz_completed', 'result_variant', 'preference_fields', 'disclosure_seen', 'setup_interest_consented'],
  rolePage: ['role_page_viewed', 'content_topic', 'engagement_depth', 'quiz_cta_clicked', 'offer_clicked', 'disclosure_seen'],
  starterKit: ['starter_kit_viewed', 'checklist_downloaded', 'business_stage', 'current_stack', 'missing_capability', 'setup_interest_consented', 'source_page'],
  savingsFinder: ['savings_assessment_started', 'savings_assessment_completed', 'stack_categories', 'alternative_clicked', 'audit_interest_consented', 'confidence_band'],
  readinessScore: ['readiness_started', 'readiness_completed', 'readiness_score', 'top_use_cases', 'budget_range', 'booking_interest_consented', 'lead_score'],
  weekly: ['weekly_archive_viewed', 'weekly_optin_completed', 'topic_preference', 'frequency_preference', 'optin_source'],
  trends: ['trend_page_viewed', 'trend_lane_viewed', 'trend_offer_clicked', 'weekly_optin_started', 'topic_preference', 'disclosure_seen'],
  templates: ['template_library_viewed', 'template_download_started', 'template_id', 'license_accepted', 'paid_interest', 'required_tools', 'setup_interest_consented'],
  preferences: ['preference_center_viewed', 'preferences_updated', 'channel_preference', 'frequency_preference', 'brand_optout', 'global_optout'],
  reactivation: ['reactivation_page_viewed', 'return_credit_claim_started', 'return_credit_claimed', 'private_drop_interest', 'ai_business_offer_interest', 'stuffprettygood_updates_optin', 'preferences_updated', 'global_unsubscribe'],
  thankYou: ['thank_you_viewed', 'next_step_clicked', 'preference_state_visible'],
  unsubscribe: ['unsubscribe_viewed', 'suppression_created', 'global_unsubscribe', 'brand_unsubscribe'],
  adminUx: ['admin_dashboard_viewed', 'blocked_state_seen', 'proof_packet_opened', 'simulation_opened', 'scale_kill_decision_viewed'],
  go: ['go_link_clicked', 'offer_slug', 'referring_surface', 'affiliate_disclosure_seen'],
};

export const approvedOffers = [
  { slug: 'chatgpt', name: 'ChatGPT', category: 'AI assistant', disclosure: 'May be affiliate/tracked if a partner program is approved.', riskTier: 'low', status: 'pending_approval' },
  { slug: 'claude', name: 'Claude', category: 'AI assistant', disclosure: 'Tracked recommendation only after offer approval.', riskTier: 'low', status: 'pending_approval' },
  { slug: 'notion', name: 'Notion', category: 'workspace', disclosure: 'Affiliate status must be confirmed before monetized routing.', riskTier: 'low', status: 'pending_approval' },
  { slug: 'zapier', name: 'Zapier', category: 'automation', disclosure: 'May earn referral if approved.', riskTier: 'low', status: 'pending_approval' },
  { slug: 'canva', name: 'Canva', category: 'creative ops', disclosure: 'May be affiliate/tracked if approved.', riskTier: 'low', status: 'pending_approval' },
  { slug: 'hubspot', name: 'HubSpot', category: 'CRM', disclosure: 'Partner/affiliate routing requires approval and claim review.', riskTier: 'medium', status: 'pending_approval' },
  { slug: 'make', name: 'Make', category: 'automation', disclosure: 'May be affiliate/tracked if approved.', riskTier: 'low', status: 'pending_approval' },
  { slug: 'quickbooks', name: 'QuickBooks', category: 'finance ops', disclosure: 'Finance category needs conservative, non-advice copy.', riskTier: 'medium', status: 'pending_approval' },
];

export const quizResultStacks = [
  { slug: 'creator-operator', persona: 'Creator / operator', categories: ['AI assistant', 'content planning', 'design', 'scheduler', 'analytics'], cta: 'Build a weekly content operating system.' },
  { slug: 'solo-consultant', persona: 'Solo consultant', categories: ['AI assistant', 'CRM', 'proposal', 'calendar', 'automation'], cta: 'Turn leads, proposals, and follow-up into a simple stack.' },
  { slug: 'local-business-lead-gen', persona: 'Local business lead-gen', categories: ['CRM', 'reviews', 'booking', 'forms', 'automation'], cta: 'Capture and follow up with local leads safely.' },
  { slug: 'ecommerce-ops', persona: 'Ecommerce ops', categories: ['support', 'email capture', 'analytics', 'listing content', 'automation'], cta: 'Clean up repetitive store operations.' },
  { slug: 'agency-delivery', persona: 'Agency delivery', categories: ['project hub', 'AI assistant', 'SOP templates', 'client reporting', 'automation'], cta: 'Standardize delivery without claiming magic.' },
  { slug: 'recruiter-sales', persona: 'Recruiter / sales', categories: ['CRM', 'research', 'sequence drafting', 'calendar', 'notes'], cta: 'Research and follow-up faster with consent-safe systems.' },
  { slug: 'admin-office', persona: 'Admin / office', categories: ['docs', 'calendar', 'forms', 'knowledge base', 'automation'], cta: 'Reduce admin repetition with low-risk tools.' },
  { slug: 'beginner-budget', persona: 'Beginner budget', categories: ['free AI assistant', 'notes', 'forms', 'spreadsheet CRM', 'basic automation'], cta: 'Start with a low-cost stack before buying more software.' },
];

export const toolsByJobBacklog = [
  ['realtors', 'Best AI tools for realtors', 'lead follow-up, listing descriptions, local market notes', 'CRM + writing assistant + scheduler', 'claim-review: no guaranteed closings'],
  ['recruiters', 'Best AI tools for recruiters', 'candidate research, outreach drafting, notes', 'research + CRM + scheduling', 'claim-review: no hiring or compliance promises'],
  ['local-service-businesses', 'Best AI tools for local service businesses', 'lead intake, reviews, quotes', 'CRM + forms + review requests', 'avoid guaranteed lead or revenue claims'],
  ['ecommerce-operators', 'Best AI tools for ecommerce operators', 'support, listings, reporting', 'support + analytics + content ops', 'avoid guaranteed conversion claims'],
  ['consultants', 'Best AI tools for consultants', 'proposals, research, delivery', 'AI assistant + proposal + CRM', 'avoid income promises'],
  ['agencies', 'Best AI tools for agencies', 'delivery, reporting, client ops', 'project hub + reporting + SOPs', 'avoid replacement/employment claims'],
  ['coaches', 'Best AI tools for coaches', 'content, scheduling, client follow-up', 'scheduler + CRM + content', 'avoid health/therapy claims'],
  ['creators', 'Best AI tools for creators', 'content planning, editing, distribution', 'content + design + analytics', 'avoid virality promises'],
  ['sales-teams', 'Best AI tools for sales teams', 'research, notes, follow-up', 'CRM + research + notes', 'avoid guaranteed pipeline claims'],
  ['admin-assistants', 'Best AI tools for admin assistants', 'calendar, docs, repetitive tasks', 'docs + forms + automation', 'avoid job replacement framing'],
  ['accountants-bookkeepers', 'Best AI tools for accountants and bookkeepers', 'workflow, docs, client intake', 'finance ops + docs + CRM', 'claim-review: no financial advice'],
  ['restaurant-owners', 'Best AI tools for restaurant owners', 'local marketing, scheduling, reviews', 'reviews + social + scheduling', 'avoid demand/revenue guarantees'],
  ['real-estate-investors', 'Best AI tools for real estate investors', 'research, task management, documents', 'research + docs + CRM', 'claim-review: no investment advice'],
  ['solo-lawyers-legal-ops', 'Best AI tools for solo lawyers and legal ops', 'intake, docs, scheduling', 'intake + docs + knowledge base', 'claim-review: non-legal-advice only'],
  ['medical-office-admin', 'Best AI tools for medical office admin', 'intake, scheduling, admin docs', 'forms + scheduler + knowledge base', 'claim-review: non-medical-advice, no PHI collection'],
  ['shopify-stores', 'Best AI tools for Shopify stores', 'product content, support, analytics', 'store ops + content + support', 'avoid sales guarantee claims'],
  ['course-creators', 'Best AI tools for course creators', 'curriculum, content, community', 'AI assistant + LMS ops + email capture', 'avoid income promises'],
  ['property-managers', 'Best AI tools for property managers', 'maintenance intake, docs, communication', 'forms + scheduling + CRM', 'avoid legal/housing compliance advice'],
  ['insurance-agents', 'Best AI tools for insurance agents', 'client follow-up, docs, reminders', 'CRM + docs + calendar', 'claim-review: no insurance advice'],
  ['construction-contractors', 'Best AI tools for construction contractors', 'quotes, scheduling, job docs', 'forms + scheduler + CRM', 'avoid guaranteed bid win claims'],
].map(([slug, title, intent, affiliateCategory, claimRules], index) => ({
  slug,
  title,
  persona: title.replace('Best AI tools for ', ''),
  keywordIntent: intent,
  affiliateCategory,
  cta: 'Take the AI Tool Stack Quiz',
  crmEventMap: ['role_page_viewed', 'content_topic', 'engagement_depth', 'quiz_cta_clicked', 'offer_clicked'],
  claimRules,
  killMetric: index < 10 ? 'quiz CTA click < 1% after indexing window' : '/go click < 2% after optimization window',
}));

export const publicSurfaces = [
  { route: '/', name: 'Home', purpose: 'Practical AI tools, workflow software, savings, and solopreneur stacks worth trying.', events: crmEvents.home, offers: ['quiz', 'starter-kit', 'weekly'] },
  { route: '/ai-tool-stack-quiz.html', name: 'AI Tool Stack Quiz', purpose: '2-minute role-specific stack matching without sensitive data.', events: crmEvents.quiz, offers: quizResultStacks.map((r) => r.slug) },
  { route: '/starter-kits/solopreneur-automation.html', name: 'Solopreneur Automation Starter Kit', purpose: 'Practical 7-tool checklist, free download, explicit setup consent only.', events: crmEvents.starterKit, offers: ['free-checklist', 'setup-interest'] },
  { route: '/tools-by-job/index.html', name: 'Tools by Job', purpose: 'Index and template for role pages.', events: crmEvents.rolePage, offers: toolsByJobBacklog.map((p) => p.slug) },
  { route: '/savings-finder.html', name: 'Software Savings Finder', purpose: 'User-entered stack assessment, no invoice upload or guaranteed savings.', events: crmEvents.savingsFinder, offers: ['audit-interest'] },
  { route: '/ai-readiness-score.html', name: 'AI Readiness Score', purpose: 'Directional diagnostic, no ROI guarantee.', events: crmEvents.readinessScore, offers: ['setup-audit-interest'] },
  { route: '/deals.html', name: 'Weekly Stuff Worth Trying', purpose: 'On-site Google Trends-informed deal archive and opt-in path, no send until gates.', events: crmEvents.weekly, offers: ['newsletter-optin', ...trendOfferLanes.slice(0, 8).map((lane) => lane.slug)] },
  { route: '/trends.html', name: 'Trending Offer Lanes', purpose: 'Google Trends-powered offer population map for StuffPrettyGood signup capture and safe affiliate sourcing.', events: crmEvents.trends, offers: trendOfferLanes.map((lane) => lane.slug) },
  { route: '/templates.html', name: 'Template Marketplace Shell', purpose: 'Free templates and paid-interest waitlist only.', events: crmEvents.templates, offers: ['free-template', 'paid-interest'] },
  { route: '/reactivation.html', name: 'Reactivation Return-Credit Hub', purpose: 'Claim return credit, private drops, AI/business offers, updates, or unsubscribe without pressure.', events: crmEvents.reactivation, offers: ['return-credit', 'private-drops', 'ai-business-offers', 'updates', 'unsubscribe-everything'] },
  { route: '/thank-you.html', name: 'Thank You / Preference Saved', purpose: 'Confirms preference state and gives the safest next step without implying a send happened.', events: crmEvents.thankYou, offers: ['quiz', 'starter-kit', 'preferences'] },
  { route: '/preferences.html', name: 'Preference Center', purpose: 'Topics, role, channel, frequency, opt-in state, brand/global opt-out.', events: crmEvents.preferences, offers: [] },
  { route: '/unsubscribe.html', name: 'Unsubscribe', purpose: 'Global/brand suppression event path.', events: crmEvents.unsubscribe, offers: [] },
  { route: '/crm-command-center-ux.html', name: 'CRM Command Center UX Prototype', purpose: 'Operator UX prototype for Contact War Room, tier status, sponsor pilot, offer manager, simulator, metrics, and no-send gates.', events: crmEvents.adminUx, offers: [] },
  { route: '/go/:slug', name: 'Tracked /go redirect', purpose: 'Disclosure-visible tracked redirect placeholder.', events: crmEvents.go, offers: approvedOffers.map((o) => o.slug) },
];

export const claimSafeCopy = {
  affiliateDisclosure: 'StuffPrettyGood may earn a commission or referral credit if you use some links. Recommendations are practical starting points, not guarantees, rankings, or professional advice.',
  privacyPromise: 'We collect only the fields needed to match useful tools, save preferences, and record consent. Do not enter passwords, secrets, health details, payment data, or other sensitive information.',
  noSendPromise: 'Newsletter and offer sends remain opt-in and dry-run until unsubscribe, suppression, provider, and audit gates are approved.',
};

export function surfaceRoutes() {
  return publicSurfaces.map((surface) => surface.route);
}

export function getRolePage(slug) {
  return toolsByJobBacklog.find((page) => page.slug === slug);
}
