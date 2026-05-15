import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  approvedOffers,
  claimSafeCopy,
  complianceLinks,
  crmEvents,
  publicSurfaces,
  quizResultStacks,
  toolsByJobBacklog,
} from '../src/spg/public-surfaces.js';

const outDir = new URL('../public', import.meta.url).pathname;
const ensure = (file) => mkdirSync(dirname(join(outDir, file)), { recursive: true });
const write = (file, html) => {
  ensure(file);
  writeFileSync(join(outDir, file), html, 'utf8');
};

const nav = `
<nav class="nav" aria-label="Primary">
  <a class="brand" href="/index.html">StuffPrettyGood</a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links">Menu</button>
  <div id="nav-links" class="nav-links">
    <a href="/ai-tool-stack-quiz.html">Quiz</a>
    <a href="/tools-by-job/index.html">Tools by Job</a>
    <a href="/starter-kits/solopreneur-automation.html">Starter Kit</a>
    <a href="/savings-finder.html">Savings Finder</a>
    <a href="/ai-readiness-score.html">AI Readiness</a>
    <a href="/templates.html">Templates</a>
    <a href="/reactivation.html">Return Credit</a>
    <a href="/deals.html">Deals</a>
    <a href="/preferences.html">Preferences</a>
    <a class="nav-cta" href="/ai-tool-stack-quiz.html">Take quiz</a>
  </div>
</nav>`;

const footer = `
<footer class="footer">
  <section class="disclosure" data-crm-event="disclosure_seen">
    <strong>Affiliate disclosure:</strong> ${claimSafeCopy.affiliateDisclosure}
  </section>
  <section class="foot-grid" aria-label="Compliance links">
    ${complianceLinks.map((link) => `<a href="${link.href}">${link.label}</a>`).join('')}
  </section>
  <p class="fineprint">No mass activation, no provider push, no export, and no send are available from this public MVP. We never ask for passwords, secrets, invoices, payment details, health details, or other sensitive information.</p>
</footer>`;

function page({ title, description, body, extraClass = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | StuffPrettyGood</title>
  <meta name="description" content="${description}">
  <link rel="stylesheet" href="/styles.css">
  <script type="module" src="/app.js"></script>
</head>
<body class="${extraClass}">
  <a class="skip-link" href="#main">Skip to content</a>
  ${nav}
  <main id="main">${body}</main>
  ${footer}
</body>
</html>`;
}

const eventList = (events) => `<ul class="event-list">${events.map((event) => `<li><code>${event}</code></li>`).join('')}</ul>`;
const goLink = (slug, label) => `<a class="go-link" href="/go/${slug}.html" data-go-slug="${slug}" data-crm-event="go_link_clicked">${label}</a>`;
const field = ({ id, label, type = 'text', options = [], required = false, hint = '' }) => {
  const req = required ? ' required' : '';
  if (type === 'select') {
    return `<label for="${id}">${label}</label><select id="${id}" name="${id}"${req}>${options.map((opt) => `<option>${opt}</option>`).join('')}</select>${hint ? `<p class="hint">${hint}</p>` : ''}`;
  }
  if (type === 'textarea') {
    return `<label for="${id}">${label}</label><textarea id="${id}" name="${id}"${req}></textarea>${hint ? `<p class="hint">${hint}</p>` : ''}`;
  }
  return `<label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}"${req}>${hint ? `<p class="hint">${hint}</p>` : ''}`;
};

write('index.html', page({
  title: 'Useful tools and workflows worth trying',
  description: 'Fresh-intent home for AI tools, workflow software, useful savings, and solopreneur stacks.',
  body: `
<section class="hero surface" data-surface="home" data-crm-events="${crmEvents.home.join(',')}">
  <p class="eyebrow">Fresh intent first. Practical utility before monetization.</p>
  <h1>Useful AI tools, workflow software, savings, and solopreneur stacks — matched to what you actually do.</h1>
  <p class="lede">StuffPrettyGood helps operators choose the next useful tool without fake proof, hype, or dark-pattern opt-ins.</p>
  <div class="cta-row">
    <a class="button primary" href="/ai-tool-stack-quiz.html" data-crm-event="utility_cta_clicked">Take the AI Tool Stack Quiz</a>
    <a class="button" href="/starter-kits/solopreneur-automation.html" data-crm-event="utility_cta_clicked">Get the starter kit</a>
  </div>
  <p class="trust-note">Find a role-specific stack in two minutes. No guaranteed savings, no income promises, no fabricated reviews, no sensitive data collection.</p>
</section>
<section class="cards three">
  ${publicSurfaces.slice(1, 8).map((surface) => `<article class="card" data-crm-events="${surface.events.join(',')}"><p class="eyebrow">${surface.name}</p><h2>${surface.purpose}</h2><p>${surface.offers.length ? `Start here when you want ${surface.offers.slice(0, 2).join(' or ').replaceAll('-', ' ')}.` : 'Control your consent and preferences.'}</p><a href="${surface.route.replace('/:slug', '/chatgpt').replace('/results/:resultSlug', '/results/creator-operator').replace('/','/').replace(/\.html$/, '.html')}">Explore</a></article>`).join('')}
</section>
<section class="panel optin" data-crm-event="weekly_optin_started">
  <h2>Weekly Stuff Worth Trying</h2>
  <p>Opt into practical tools and templates only if you want them. The sending system remains dry-run until suppression, List-Unsubscribe, provider, and audit gates pass.</p>
  <form class="intent-form" data-form="weekly-optin">
    ${field({ id: 'weekly_role', label: 'What do you do?', type: 'select', options: ['Solopreneur', 'Agency owner', 'Creator', 'Local business', 'Ecommerce', 'Other'] })}
    ${field({ id: 'weekly_email', label: 'Email for explicit opt-in', type: 'email', hint: 'Optional in prototype. Frontend never logs raw email.' })}
    <label class="check"><input type="checkbox" required> I want weekly practical recommendations and understand I can unsubscribe anytime.</label>
    <button type="submit">Save preference</button>
  </form>
</section>`
}));

write('ai-tool-stack-quiz.html', page({
  title: 'AI Tool Stack Quiz',
  description: 'A 2-minute quiz that maps role, budget, pain, and urgency to a practical starting stack.',
  body: `
<section class="hero compact surface" data-surface="ai-tool-stack-quiz" data-crm-events="${crmEvents.quiz.join(',')}">
  <p class="eyebrow">2-minute utility quiz</p>
  <h1>Get a practical AI/tool stack based on your role, budget, and operating pain.</h1>
  <p class="lede">Directional recommendations only. We do not ask for passwords, invoices, payment details, or sensitive records.</p>
</section>
<form class="quiz grid-form" data-form="ai-tool-stack-quiz" data-crm-event="quiz_started">
  ${field({ id: 'role_persona', label: 'Role / persona', type: 'select', required: true, options: quizResultStacks.map((r) => r.persona) })}
  ${field({ id: 'business_type', label: 'Business type', type: 'select', required: true, options: ['Solo service', 'Agency', 'Local business', 'Ecommerce', 'Creator', 'Office/admin', 'Sales/recruiting', 'Not sure yet'] })}
  ${field({ id: 'team_size', label: 'Team size', type: 'select', required: true, options: ['1', '2-5', '6-20', '21-50', '50+'] })}
  ${field({ id: 'current_tools', label: 'Current tools (names only, no passwords)', type: 'textarea', hint: 'Do not enter account IDs, private client names, or secrets.' })}
  ${field({ id: 'budget_range', label: 'Monthly budget range', type: 'select', required: true, options: ['$0-$25', '$25-$100', '$100-$300', '$300+', 'Unknown'] })}
  ${field({ id: 'top_pain_priority', label: 'Top pain priority', type: 'select', required: true, options: ['Lead follow-up', 'Content production', 'Admin repetition', 'Client delivery', 'Reporting', 'Support', 'Software bloat'] })}
  ${field({ id: 'automation_goal', label: 'Automation goal', type: 'select', required: true, options: ['Save time', 'Reduce missed follow-up', 'Organize knowledge', 'Improve reporting', 'Launch a simple funnel'] })}
  ${field({ id: 'urgency', label: 'Urgency', type: 'select', required: true, options: ['This week', 'This month', 'Just researching'] })}
  ${field({ id: 'preferred_channel', label: 'Preferred follow-up channel', type: 'select', options: ['No follow-up', 'Email opt-in only', 'Preference center only'] })}
  ${field({ id: 'quiz_email', label: 'Optional email opt-in', type: 'email', hint: 'Explicit opt-in only; raw email is not printed or logged.' })}
  <label class="check"><input type="checkbox" name="disclosure_seen" required> I saw the affiliate disclosure and understand these are practical suggestions, not guaranteed outcomes.</label>
  <label class="check"><input type="checkbox" name="setup_interest_consented"> I consent to a MehyarSoft setup/audit inquiry if I ask for help.</label>
  <button type="submit">Show my stack</button>
</form>
<section class="cards two" aria-label="Result taxonomy">
  ${quizResultStacks.map((result) => `<article class="card result-card"><h2>${result.persona}</h2><p>${result.cta}</p><ul>${result.categories.map((cat) => `<li>${cat}</li>`).join('')}</ul><a href="/ai-tool-stack-quiz/results/${result.slug}.html">Preview result</a></article>`).join('')}
</section>`
}));

for (const result of quizResultStacks) {
  write(`ai-tool-stack-quiz/results/${result.slug}.html`, page({
    title: `${result.persona} result`,
    description: `Claim-safe recommendation stack for ${result.persona}.`,
    body: `
<section class="hero compact surface" data-surface="quiz-result" data-result-variant="${result.slug}" data-crm-events="quiz_completed,result_variant,preference_fields,disclosure_seen">
  <p class="eyebrow">Based on your answers</p>
  <h1>${result.persona}: recommended starting stack</h1>
  <p class="lede">${result.cta} These are starting points to evaluate, not proof that any one product is best for every business.</p>
</section>
<section class="cards two">
  ${result.categories.map((cat, idx) => {
    const offer = approvedOffers[idx % approvedOffers.length];
    return `<article class="card"><p class="eyebrow">${cat}</p><h2>${offer.name}</h2><p>May fit this category if the offer is approved and your requirements match.</p>${goLink(offer.slug, `Review ${offer.name}`)}</article>`;
  }).join('')}
</section>
<section class="panel"><h2>Want setup help?</h2><p>Ask for a MehyarSoft setup conversation only with explicit consent. No automatic provider push or export is available.</p><a class="button primary" href="/preferences.html#setup-interest">Save setup interest</a></section>`
  }));
}

write('tools-by-job/index.html', page({
  title: 'Best AI Tools by Job',
  description: 'Role-specific page index and content template backlog for 20 high-intent pages.',
  body: `
<section class="hero compact surface" data-surface="tools-by-job-index" data-crm-events="${crmEvents.rolePage.join(',')}">
  <p class="eyebrow">20-page SEO backlog</p>
  <h1>Recommended AI tools by job — with claim-safe copy and tracked intent.</h1>
  <p class="lede">Each page maps persona, keyword intent, affiliate category, CTA, CRM event map, claim rules, and kill metric.</p>
</section>
<section class="cards two backlog">
  ${toolsByJobBacklog.map((job, i) => `<article class="card"><p class="eyebrow">Page ${i + 1}</p><h2><a href="/tools-by-job/${job.slug}.html">${job.title}</a></h2><p><strong>Intent:</strong> ${job.keywordIntent}</p><p><strong>Affiliate category:</strong> ${job.affiliateCategory}</p><p><strong>Claim rules:</strong> ${job.claimRules}</p><p><strong>Kill metric:</strong> ${job.killMetric}</p></article>`).join('')}
</section>`
}));

for (const job of toolsByJobBacklog) {
  write(`tools-by-job/${job.slug}.html`, page({
    title: job.title,
    description: `${job.title} content template with CRM events and disclosure.`,
    body: `
<section class="hero compact surface" data-surface="tools-by-job" data-role="${job.slug}" data-crm-events="${crmEvents.rolePage.join(',')}">
  <p class="eyebrow">Role page template</p>
  <h1>${job.title}</h1>
  <p class="lede">Recommended tool categories for ${job.persona}; not a claim that these are universally best.</p>
</section>
<section class="article-layout">
  <article class="article-card">
    <h2>Role pain</h2><p>${job.keywordIntent}.</p>
    <h2>Recommended stack categories</h2><ul><li>${job.affiliateCategory}</li><li>AI assistant</li><li>Automation</li><li>Knowledge hub</li><li>Reporting or analytics</li></ul>
    <h2>Budget path</h2><p>Start with free or low-cost trials, verify actual use, then consolidate duplicates.</p>
    <h2>Implementation order</h2><ol><li>Pick one pain.</li><li>Choose one core workspace.</li><li>Connect one automation.</li><li>Measure whether it saves time or improves follow-up.</li></ol>
    <h2>Comparison rubric</h2><p>Ease, data sensitivity, integration fit, total cost, cancellation clarity, and support burden.</p>
    <h2>CRM event map</h2>${eventList(job.crmEventMap)}
  </article>
  <aside class="aside-card">
    <h2>Next step</h2><p>Take the quiz for a stack matched to your answers.</p><a class="button primary" href="/ai-tool-stack-quiz.html" data-crm-event="quiz_cta_clicked">Take the quiz</a>
    <h3>Approved-link placeholder</h3>${goLink(approvedOffers[0].slug, 'Review a tracked recommendation')}
    <p class="fineprint">${job.claimRules}</p>
  </aside>
</section>`
  }));
}

write('starter-kits/solopreneur-automation.html', page({
  title: 'Solopreneur Automation Starter Kit',
  description: 'Free 7-tool operating stack and checklist with explicit setup consent path.',
  body: `
<section class="hero compact surface" data-surface="solopreneur-automation-starter-kit" data-crm-events="${crmEvents.starterKit.join(',')}">
  <p class="eyebrow">Free starter kit</p>
  <h1>Start with a practical 7-tool operating stack and checklist.</h1>
  <p class="lede">For solopreneurs, freelancers, consultants, creators, coaches, and agency-of-one operators. No income guarantees or replacement claims.</p>
</section>
<section class="cards three">
  ${['AI assistant', 'CRM or pipeline', 'Calendar booking', 'Proposal/invoice workflow', 'Content hub', 'Automation bridge', 'Simple analytics'].map((tool, i) => `<article class="card"><p class="eyebrow">Tool ${i + 1}</p><h2>${tool}</h2><p>Evaluate fit, cost, support burden, and data sensitivity before committing.</p>${goLink(approvedOffers[i % approvedOffers.length].slug, 'Open tracked option')}</article>`).join('')}
</section>
<form class="intent-form" data-form="starter-kit-download">
  ${field({ id: 'business_stage', label: 'Business stage', type: 'select', options: ['Idea', 'First clients', 'Growing', 'Cleaning up ops'] })}
  ${field({ id: 'current_stack', label: 'Current stack (tool names only)', type: 'textarea' })}
  ${field({ id: 'missing_capability', label: 'Missing capability', type: 'select', options: ['CRM', 'Follow-up', 'Scheduling', 'Content', 'Automation', 'Reporting'] })}
  <label class="check"><input type="checkbox" name="downloaded_at" required> Give me the free checklist.</label>
  <label class="check"><input type="checkbox" name="setup_interest"> I explicitly consent to a setup inquiry if I request help.</label>
  <button type="submit">Access checklist</button>
</form>`
}));

write('savings-finder.html', page({
  title: 'Software Savings Finder',
  description: 'Lightweight assessment for possible software consolidation ideas; no guaranteed savings.',
  body: `
<section class="hero compact surface" data-surface="software-savings-finder" data-crm-events="${crmEvents.savingsFinder.join(',')}">
  <p class="eyebrow">Phase 2 utility</p>
  <h1>Find possible software bloat without uploading invoices.</h1>
  <p class="lede">Enter categories manually. Results may say “not enough data.” No guaranteed savings.</p>
</section>
<form class="grid-form" data-form="savings-finder">
  ${field({ id: 'stack_categories', label: 'Which categories do you pay for?', type: 'textarea', required: true, hint: 'Categories only; no invoice uploads, card data, or vendor account IDs.' })}
  ${field({ id: 'monthly_spend_band', label: 'Monthly spend band', type: 'select', options: ['$0-$100', '$100-$500', '$500-$2,000', '$2,000+', 'Unknown'] })}
  ${field({ id: 'duplicate_pain', label: 'Where do tools overlap?', type: 'select', options: ['CRM/email', 'Docs/project management', 'Automation', 'Support/chat', 'Analytics', 'Not sure'] })}
  <label class="check"><input type="checkbox" name="audit_interest_consented"> I consent to an audit inquiry if I ask for it.</label>
  <button type="submit">Show possible alternatives</button>
</form>
<section class="panel"><h2>Example result format</h2><p><strong>Confidence band:</strong> medium. Try consolidating duplicate notes/project tools before changing customer-facing systems.</p>${goLink('notion', 'Review workspace option')}</section>`
}));

write('ai-readiness-score.html', page({
  title: 'AI Readiness Score',
  description: 'Directional business diagnostic for top AI use cases; no ROI guarantee.',
  body: `
<section class="hero compact surface" data-surface="ai-readiness-score" data-crm-events="${crmEvents.readinessScore.join(',')}">
  <p class="eyebrow">Directional diagnostic</p>
  <h1>Get a directional AI readiness score and top use cases.</h1>
  <p class="lede">This is not ROI, legal, medical, financial, or compliance advice. It is a practical prioritization screen.</p>
</section>
<form class="grid-form" data-form="ai-readiness-score">
  ${field({ id: 'process_documentation', label: 'How documented are your workflows?', type: 'select', options: ['Not documented', 'Some notes', 'Mostly documented', 'SOPs exist'] })}
  ${field({ id: 'data_sensitivity', label: 'Data sensitivity', type: 'select', options: ['Low', 'Moderate', 'High / regulated', 'Not sure'] })}
  ${field({ id: 'budget_range', label: 'Budget range', type: 'select', options: ['$0-$100', '$100-$500', '$500+', 'Unknown'] })}
  ${field({ id: 'top_use_case', label: 'Top use case', type: 'select', options: ['Admin automation', 'Lead follow-up', 'Content', 'Support', 'Reporting'] })}
  <label class="check"><input type="checkbox" name="booking_interest_consented"> I consent to a setup/audit inquiry if I request one.</label>
  <button type="submit">Calculate directional score</button>
</form>
<section class="cards three"><article class="card"><h2>Low readiness</h2><p>Document workflows first.</p></article><article class="card"><h2>Medium readiness</h2><p>Test one low-risk automation.</p></article><article class="card"><h2>Higher readiness</h2><p>Build a governed pilot with clear owner approval.</p></article></section>`
}));

write('deals.html', page({
  title: 'Weekly Stuff Worth Trying',
  description: 'Opt-in deal/archive page with dry-run newsletter posture.',
  body: `
<section class="hero compact surface" data-surface="weekly-stuff-worth-trying" data-crm-events="${crmEvents.weekly.join(',')}">
  <p class="eyebrow">Opt-in only</p>
  <h1>Weekly Stuff Worth Trying archive.</h1>
  <p class="lede">Curated tools and workflows on-site first. Newsletter send remains draft/no-send until readiness gates pass.</p>
</section>
<section class="cards three">${approvedOffers.slice(0, 6).map((offer) => `<article class="card"><h2>${offer.name}</h2><p>${offer.category}. ${offer.disclosure}</p>${goLink(offer.slug, 'Open /go link')}</article>`).join('')}</section>
<form class="intent-form" data-form="weekly-optin"><h2>Opt in</h2>${field({ id: 'topic_preference', label: 'Topic preference', type: 'select', options: ['AI tools', 'Software savings', 'Solopreneur stacks', 'Templates'] })}${field({ id: 'frequency_preference', label: 'Frequency', type: 'select', options: ['Weekly', 'Twice monthly', 'Only major updates'] })}<label class="check"><input type="checkbox" required> I explicitly opt in and can unsubscribe anytime.</label><button type="submit">Save opt-in preference</button></form>`
}));

write('templates.html', page({
  title: 'AI Workflow Template Marketplace Shell',
  description: 'Free template library shell and paid-interest waitlist; no live charges.',
  body: `
<section class="hero compact surface" data-surface="template-marketplace" data-crm-events="${crmEvents.templates.join(',')}">
  <p class="eyebrow">Shell only</p>
  <h1>Free starter templates now. Paid-interest waitlist only.</h1>
  <p class="lede">No checkout, no live charges, no copied proprietary templates.</p>
</section>
<section class="cards three">${['Solo CRM spreadsheet', 'Weekly content operating checklist', 'Simple automation spec'].map((tpl, i) => `<article class="card"><p class="eyebrow">Free template ${i + 1}</p><h2>${tpl}</h2><p>License: personal/business internal use; do not resell as-is.</p><label class="check"><input type="checkbox"> Accept license</label><button data-crm-event="template_download_started">Download interest</button></article>`).join('')}</section>
<form class="intent-form" data-form="template-paid-interest"><label class="check"><input type="checkbox" name="paid_interest"> Tell me if paid template packs launch after approval.</label><label class="check"><input type="checkbox" name="setup_interest"> I consent to setup interest routing.</label><button type="submit">Save template preference</button></form>`
}));

write('reactivation.html', page({
  title: 'Return Credit and Preference Reset',
  description: 'Low-pressure reactivation page for return credit, private drops, AI/business offers, updates, or unsubscribe.',
  body: `
<section class="hero compact surface" data-surface="reactivation-return-credit" data-crm-events="${crmEvents.reactivation.join(',')}">
  <p class="eyebrow">Preference-first reactivation</p>
  <h1>Choose whether StuffPrettyGood should be useful to you again.</h1>
  <p class="lede">Claim a return-credit placeholder, ask for private drops, request AI/business offers, get StuffPrettyGood updates, or unsubscribe from everything. No guaranteed reward, no hidden send, no SMS.</p>
  <div class="cta-row"><a class="button primary" href="#claim">Claim return credit</a><a class="button" href="/unsubscribe.html">Unsubscribe everything</a></div>
</section>
<section class="cards three" aria-label="Reactivation choices">
  <article class="card"><p class="eyebrow">Option 1</p><h2>Return credit</h2><p>A future credit or perk placeholder if approved. No guaranteed dollar value is promised.</p></article>
  <article class="card"><p class="eyebrow">Option 2</p><h2>Private drops</h2><p>Opt into practical offers, sponsor-funded giveaways, or tool drops only if they match your preferences.</p></article>
  <article class="card"><p class="eyebrow">Option 3</p><h2>AI/business offers</h2><p>Get AI tools, templates, software savings, and MehyarSoft setup options after explicit interest.</p></article>
</section>
<form id="claim" class="grid-form" data-form="reactivation-return-credit">
  ${field({ id: 'return_credit_interest', label: 'Return-credit interest', type: 'select', options: ['Interested if approved', 'Private drops only', 'AI/business offers only', 'Updates only', 'Unsubscribe everything'] })}
  ${field({ id: 'reactivation_topic', label: 'What should we send, if anything?', type: 'select', options: ['AI tools', 'Software savings', 'Templates', 'Private drops', 'StuffPrettyGood updates', 'Nothing'] })}
  ${field({ id: 'preferred_channel', label: 'Preferred channel', type: 'select', options: ['Email opt-in only', 'Preference center only', 'No messages'] })}
  ${field({ id: 'reactivation_email', label: 'Email to update preferences', type: 'email', hint: 'Prototype redacts raw email in frontend events. Production must write suppression/preference audit server-side.' })}
  <label class="check"><input type="checkbox" name="affiliate_disclosure_seen" required> I saw the affiliate disclosure and understand offers may be tracked if approved.</label>
  <label class="check"><input type="checkbox" name="no_sms_acknowledged" required> I understand this is not SMS consent and no SMS should be sent from this form.</label>
  <button type="submit">Save reactivation preference</button>
</form>
<section class="panel status-panel"><h2>No-send state is intentional</h2><p><span class="status no-go">NO-SEND</span> Production must pass unsubscribe, suppression, provider, audit, and copy-review gates before any outbound reactivation send. This page is safe as an on-site preference capture surface.</p></section>`
}));

write('thank-you.html', page({
  title: 'Preference Saved',
  description: 'Thank-you page confirming preference capture and safe next steps.',
  body: `
<section class="hero compact surface" data-surface="thank-you" data-crm-events="${crmEvents.thankYou.join(',')}">
  <p class="eyebrow">Saved in prototype mode</p><h1>Your preference path is recorded.</h1><p class="lede">In production, the CRM must show your preference/suppression state and audit event before any send gate can pass.</p>
  <div class="cta-row"><a class="button primary" href="/ai-tool-stack-quiz.html" data-crm-event="next_step_clicked">Take the quiz</a><a class="button" href="/preferences.html" data-crm-event="next_step_clicked">Adjust preferences</a><a class="button" href="/unsubscribe.html" data-crm-event="next_step_clicked">Unsubscribe</a></div>
</section>`
}));

write('crm-command-center-ux.html', `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Mehyar Media CRM Login</title>
  <meta name="description" content="Private Mehyar Media CRM command center login.">
  <link rel="stylesheet" href="/styles.css">
  <script type="module" src="/crm-login.js?v=crm-opportunity-fix-20260515T1818"></script>
</head>
<body class="crm-login-body">
  <main id="main" class="crm-login-shell" aria-label="Mehyar Media CRM login">
    <section class="crm-login-card" data-auth-state="logged-out">
      <p class="eyebrow">Private CRM</p>
      <h1>Mehyar Media Command Center</h1>
      <p class="lede">Sign in to continue.</p>
      <form id="crm-login-form" class="grid-form compact" autocomplete="on">
        <label for="crm-email">Email</label>
        <input id="crm-email" name="email" type="email" autocomplete="username" required>
        <label for="crm-password">Password</label>
        <input id="crm-password" name="password" type="password" autocomplete="current-password" required>
        <button class="button primary" type="submit">Sign in</button>
        <p id="crm-login-status" class="trust-note" role="status" aria-live="polite"></p>
      </form>
    </section>
    <section id="crm-authenticated-panel" class="crm-login-card" hidden></section>
  </main>
</body>
</html>`);

write('preferences.html', page({
  title: 'Preference Center',
  description: 'Topics, role, business type, channel, frequency, opt-in state, and opt-out controls.',
  body: `
<section class="hero compact surface" data-surface="preferences" data-crm-events="${crmEvents.preferences.join(',')}">
  <p class="eyebrow">Control center</p><h1>Choose what you want from StuffPrettyGood.</h1><p class="lede">Update topics, role, business type, channels, frequency, opt-ins, and opt-outs.</p>
</section>
<form class="grid-form" data-form="preference-center">
  ${field({ id: 'topic', label: 'Topics', type: 'select', options: ['AI tools', 'Savings', 'Templates', 'Starter kits', 'All practical stuff'] })}
  ${field({ id: 'role', label: 'Role', type: 'select', options: ['Solopreneur', 'Agency', 'Creator', 'Local business', 'Ecommerce', 'Other'] })}
  ${field({ id: 'business_type', label: 'Business type', type: 'select', options: ['Service', 'Commerce', 'Media', 'Professional', 'Other'] })}
  ${field({ id: 'channel', label: 'Channel', type: 'select', options: ['Email opt-in only', 'Preference center only', 'No messages'] })}
  ${field({ id: 'frequency', label: 'Frequency', type: 'select', options: ['Weekly', 'Twice monthly', 'Major updates only', 'None'] })}
  <label class="check"><input type="checkbox" name="brand_optout"> Opt out of StuffPrettyGood messages.</label>
  <label class="check"><input type="checkbox" name="global_optout"> Global opt out across Mehyar Media owned media.</label>
  <button type="submit">Save preferences</button>
</form>`
}));

write('unsubscribe.html', page({
  title: 'Unsubscribe',
  description: 'Global and brand unsubscribe path that writes suppression events.',
  body: `
<section class="hero compact surface" data-surface="unsubscribe" data-crm-events="${crmEvents.unsubscribe.join(',')}">
  <p class="eyebrow">Suppression path</p><h1>Unsubscribe or globally opt out.</h1><p class="lede">This prototype maps the suppression event. Production must write suppression before any send gate can pass.</p>
</section>
<form class="intent-form" data-form="unsubscribe"><label class="check"><input type="checkbox" name="brand_unsubscribe"> Unsubscribe from StuffPrettyGood.</label><label class="check"><input type="checkbox" name="global_unsubscribe"> Global Mehyar Media opt-out.</label><button type="submit">Save unsubscribe request</button></form>`
}));

write('privacy.html', page({ title: 'Privacy', description: 'Privacy promise for StuffPrettyGood.', body: `<section class="hero compact"><h1>Privacy</h1><p>${claimSafeCopy.privacyPromise}</p><p>Frontend analytics must not log raw email, phone, passwords, payment data, sensitive records, or raw PII. CRM events should use consent-safe event names, preferences, and server-side identifiers.</p></section>` }));
write('terms.html', page({ title: 'Terms', description: 'Terms for StuffPrettyGood.', body: `<section class="hero compact"><h1>Terms</h1><p>StuffPrettyGood provides informational recommendations and tools for evaluation. It does not provide legal, medical, financial, tax, insurance, investment, or professional advice.</p><p>No outcome, savings, ranking, or income guarantee is made.</p></section>` }));
write('affiliate-disclosure.html', page({ title: 'Affiliate Disclosure', description: 'Affiliate disclosure for StuffPrettyGood.', body: `<section class="hero compact"><h1>Affiliate disclosure</h1><p>${claimSafeCopy.affiliateDisclosure}</p><p>Links marked through <code>/go</code> may be tracked. Offers must be approved before monetized routing.</p></section>` }));

for (const offer of approvedOffers) {
  write(`go/${offer.slug}.html`, page({
    title: `/go/${offer.slug}`,
    description: `Disclosure-visible tracked redirect placeholder for ${offer.name}.`,
    body: `<section class="hero compact surface" data-surface="go-link" data-go-slug="${offer.slug}" data-crm-events="${crmEvents.go.join(',')}"><p class="eyebrow">Tracked /go placeholder</p><h1>${offer.name}</h1><p>${offer.disclosure}</p><p>Status: ${offer.status}. Risk tier: ${offer.riskTier}. Production redirect must record referring surface and disclosure_seen before redirect.</p><a class="button primary" href="/affiliate-disclosure.html">Review affiliate disclosure</a></section>`
  }));
}

write('styles.css', `
:root { color-scheme: light dark; --bg: #fbf7ef; --panel: #fffaf1; --text: #1e1b16; --muted: #665f55; --line: #dfd3c2; --accent: #355c37; --accent-2: #a96325; --shadow: 0 24px 70px rgba(39, 29, 16, .12); }
@media (prefers-color-scheme: dark) { :root { --bg: #11100e; --panel: #1b1915; --text: #f7efe2; --muted: #cbbfae; --line: #39342c; --accent: #9dcc9f; --accent-2: #f0ac68; --shadow: 0 24px 70px rgba(0,0,0,.36); } }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; color: var(--text); background: radial-gradient(circle at top left, color-mix(in srgb, var(--accent-2) 18%, transparent), transparent 32rem), var(--bg); }
a { color: var(--accent); text-underline-offset: .2em; }
.skip-link { position: absolute; left: -999px; top: 1rem; background: var(--panel); padding: .6rem 1rem; border: 1px solid var(--line); }
.skip-link:focus { left: 1rem; z-index: 10; }
.nav { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem clamp(1rem, 4vw, 4rem); background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(16px); border-bottom: 1px solid var(--line); }
.brand { font-weight: 900; letter-spacing: -.04em; text-decoration: none; color: var(--text); }
.nav-links { display: flex; gap: .85rem; flex-wrap: wrap; align-items: center; }
.nav-links a { text-decoration: none; color: var(--muted); font-weight: 700; font-size: .92rem; }
.nav-links .nav-cta { color: var(--bg); background: var(--accent); border-radius: 999px; padding: .55rem .85rem; }
.nav-toggle { display: none; }
main { padding: clamp(1rem, 3vw, 3rem) clamp(1rem, 4vw, 4rem); }
.hero { min-height: 62vh; display: grid; align-content: center; max-width: 70rem; margin: 0 auto 2rem; padding: clamp(2rem, 6vw, 5rem); border: 1px solid var(--line); border-radius: 2rem; background: linear-gradient(135deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--panel) 72%, transparent)); box-shadow: var(--shadow); }
.hero.compact { min-height: 26rem; }
.eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: .78rem; font-weight: 900; color: var(--accent-2); }
h1 { font-size: clamp(2.25rem, 7vw, 5.9rem); line-height: .92; letter-spacing: -.07em; margin: .25rem 0 1rem; max-width: 14ch; }
.compact h1 { font-size: clamp(2.1rem, 5vw, 4.5rem); max-width: 17ch; }
h2 { line-height: 1.05; letter-spacing: -.04em; margin-top: 0; }
.lede { font-size: clamp(1.05rem, 2vw, 1.35rem); max-width: 52rem; color: var(--muted); }
.cta-row { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1.2rem 0; }
.button, button { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: .85rem 1.1rem; background: var(--panel); color: var(--text); font-weight: 800; text-decoration: none; cursor: pointer; }
.button.primary, button { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.cards { display: grid; gap: 1rem; max-width: 76rem; margin: 0 auto 2rem; }
.cards.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cards.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.card, .panel, .article-card, .aside-card, form { border: 1px solid var(--line); background: color-mix(in srgb, var(--panel) 92%, transparent); border-radius: 1.25rem; padding: 1.25rem; box-shadow: 0 12px 36px rgba(0,0,0,.06); }
.grid-form { max-width: 76rem; margin: 0 auto 2rem; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.intent-form, .panel { max-width: 54rem; margin: 0 auto 2rem; display: grid; gap: .85rem; }
label { font-weight: 800; }
input, select, textarea { width: 100%; margin-top: .35rem; padding: .85rem 1rem; border-radius: .85rem; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: inherit; }
textarea { min-height: 7rem; }
.check { display: flex; gap: .65rem; align-items: flex-start; font-weight: 650; }
.check input { width: auto; margin-top: .22rem; }
.hint, .fineprint, .trust-note { color: var(--muted); font-size: .92rem; }
.go-link { display: inline-flex; margin-top: .5rem; font-weight: 900; }
.tag-row { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .65rem; margin: .9rem 0; }
.tag-row > * { margin: 0; }
.sticker, .pill { display: inline-flex; align-items: center; max-width: 100%; border: 1px solid var(--line); border-radius: 999px; padding: .35rem .68rem; font-size: .82rem; font-weight: 900; line-height: 1.2; white-space: normal; }
.sticker { background: color-mix(in srgb, var(--accent-2) 16%, var(--panel)); color: var(--text); }
.pill { background: color-mix(in srgb, var(--panel) 84%, transparent); color: var(--muted); }
.offer-badge-row { gap: .55rem .75rem; margin: 1rem 0 1.15rem; }
.offer-badge-row .sticker, .offer-badge-row .pill { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--panel) 60%, transparent); }
.article-layout { max-width: 76rem; margin: 0 auto 2rem; display: grid; grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr); gap: 1rem; align-items: start; }
.event-list { display: flex; flex-wrap: wrap; gap: .5rem; padding: 0; list-style: none; }
.event-list li { border: 1px solid var(--line); border-radius: 999px; padding: .25rem .55rem; }
.footer { margin-top: 3rem; padding: 2rem clamp(1rem, 4vw, 4rem); border-top: 1px solid var(--line); background: color-mix(in srgb, var(--panel) 78%, transparent); }
.disclosure, .foot-grid { max-width: 76rem; margin: 0 auto 1rem; }
.foot-grid { display: flex; gap: 1rem; flex-wrap: wrap; }
.footer .fineprint { max-width: 76rem; margin-inline: auto; }
.status { display: inline-flex; align-items: center; border-radius: 999px; padding: .25rem .55rem; font-size: .78rem; font-weight: 950; letter-spacing: .06em; border: 1px solid currentColor; margin-right: .35rem; }
.status.no-go, .status.blocked { color: #b73526; }
.status.watch { color: var(--accent-2); }
.status-panel { border-style: dashed; }
.crm-login-body { min-height:100vh; display:grid; place-items:center; }
.crm-login-shell { width:min(100%,760px); padding:clamp(1rem,4vw,3rem); }
.crm-login-card { padding:clamp(1.25rem,4vw,2.4rem); border:1px solid var(--line); border-radius:2rem; background:color-mix(in srgb,var(--panel) 94%,transparent); box-shadow:var(--shadow); }
.crm-login-card input { width:100%; min-height:3rem; }
.crm-auth-topline { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:1rem; }
@media (max-width: 880px) { .nav { align-items: flex-start; } .nav-toggle { display: inline-flex; } .nav-links { display: none; width: 100%; flex-direction: column; align-items: flex-start; } .nav.open .nav-links { display: flex; } .cards.two, .cards.three, .grid-form, .article-layout { grid-template-columns: 1fr; } .hero { border-radius: 1.25rem; min-height: 42vh; } }
@media (max-width: 520px) { main { padding-inline: .85rem; } .hero, .card, .panel, form { padding: 1rem; } h1 { font-size: clamp(2rem, 16vw, 3.4rem); } .cta-row, .foot-grid { flex-direction: column; } }
`);

write('app.js', `
const nav = document.querySelector('.nav');
document.querySelector('.nav-toggle')?.addEventListener('click', (event) => {
  const open = nav.classList.toggle('open');
  event.currentTarget.setAttribute('aria-expanded', String(open));
});
const safeEvent = (name, detail = {}) => {
  const scrubbed = { ...detail };
  for (const key of Object.keys(scrubbed)) {
    if (/email|phone|name|password|secret|token|invoice|payment/i.test(key)) scrubbed[key] = '[redacted]';
  }
  window.dispatchEvent(new CustomEvent('spg:crm-event', { detail: { name, ...scrubbed } }));
};
document.querySelectorAll('form').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formName = form.getAttribute('data-form') || 'unknown_form';
    safeEvent('form_submitted', { form: formName });
    const success = document.createElement('p');
    success.className = 'trust-note';
    success.textContent = 'Preference captured in prototype mode. Production must write the mapped CRM event server-side.';
    form.append(success);
  });
});
document.querySelectorAll('[data-go-slug]').forEach((link) => {
  link.addEventListener('click', () => safeEvent('go_link_clicked', { offer_slug: link.getAttribute('data-go-slug') }));
});
`);

console.log(`Generated StuffPrettyGood static site in ${outDir}`);
