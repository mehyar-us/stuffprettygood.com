const TOKEN_KEY = 'mehyarmedia-crm-session-token';
const CRM_API_BASE = '/crm-api';

const form = document.getElementById('crm-login-form');
const status = document.getElementById('crm-login-status');
const loginCard = document.querySelector('[data-auth-state="logged-out"]');
const authedPanel = document.getElementById('crm-authenticated-panel');

const setStatus = (message, tone = 'neutral') => {
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let body = {};
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(body.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

function showLogin() {
  document.body.dataset.crmState = 'logged-out';
  loginCard.hidden = false;
  authedPanel.hidden = true;
  authedPanel.innerHTML = '';
}

const formatCount = (value) => Number(value || 0).toLocaleString();

const statusTone = (value = '') => {
  const normalized = String(value).toLowerCase();
  if (normalized.includes('ready') || normalized.includes('active') || normalized.includes('healthy') || normalized.includes('approved')) return 'success';
  if (normalized.includes('blocked') || normalized.includes('denied') || normalized.includes('failed') || normalized.includes('not_')) return 'error';
  return 'neutral';
};

const compact = (value, fallback = '—') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
  if (typeof value === 'object') return Object.entries(value).slice(0, 4).map(([key, item]) => `${key}: ${Array.isArray(item) ? item.length : item}`).join(' · ') || fallback;
  return String(value).replaceAll('_', ' ');
};

function card(label, value, note = '', tone = 'neutral') {
  return `<article class="card crm-metric-card" data-tone="${escapeHtml(tone)}"><p class="eyebrow">${escapeHtml(label)}</p><h2>${escapeHtml(value)}</h2>${note ? `<p>${escapeHtml(note)}</p>` : ''}</article>`;
}

function rows(records = [], columns = []) {
  if (!records.length) return `<p class="trust-note">No records yet. Use the matching create/intake workflow or seed required records.</p>`;
  return `<div class="table-wrap"><table class="crm-table"><thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody>${records.slice(0, 12).map((record) => `<tr>${columns.map((column) => `<td>${escapeHtml(compact(column.value(record)))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function section(title, eyebrow, body, actions = '') {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `<section id="${escapeHtml(id)}" class="crm-module"><div class="crm-module-head"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2></div>${actions}</div>${body}</section>`;
}

function jobCard(job = {}) {
  const latest = job.latest_run || {};
  const env = Array.isArray(job.env_status) ? job.env_status : [];
  const missing = env.filter((item) => !item.available).length;
  const status = job.running ? 'running' : (latest.status || 'idle');
  return `<article class="job-card card" data-job-status="${escapeHtml(status)}">
    <div class="job-card-top">
      <div>
        <p class="eyebrow">${escapeHtml(job.owner || 'ops')}</p>
        <h3>${escapeHtml(job.label || job.job_id)}</h3>
      </div>
      <span class="status ${escapeHtml(status)}">${escapeHtml(status)}</span>
    </div>
    <p>${escapeHtml(job.description || '')}</p>
    <div class="job-meta">
      <span>Schedule: ${escapeHtml(job.schedule || 'manual')}</span>
      <span>Artifact: ${escapeHtml(job.expected_artifact || '—')}</span>
      <span>Env: ${missing ? `${missing} missing` : 'ready by key name'}</span>
    </div>
    <div class="job-env-row">${env.map((item) => `<span class="pill" data-ready="${item.available ? 'yes' : 'no'}">${escapeHtml(item.label)} ${item.available ? '✓' : 'needs key'}</span>`).join('')}</div>
    <div class="job-card-actions">
      <button class="button primary job-run-button" type="button" data-job-id="${escapeHtml(job.job_id)}">Run now</button>
      ${latest.run_id ? `<button class="button ghost job-log-button" type="button" data-run-id="${escapeHtml(latest.run_id)}">View latest log</button>` : ''}
    </div>
    <p class="trust-note">Last run: ${escapeHtml(latest.started_at || 'never')} · ${escapeHtml(latest.finished_at || 'not finished')} · ${escapeHtml(latest.command_ref || job.command_ref || 'allowlist')}</p>
  </article>`;
}

function envSummary(jobs = []) {
  const statuses = jobs.flatMap((job) => job.env_status || []);
  const unique = new Map(statuses.map((item) => [item.label, item]));
  return [...unique.values()].map((item) => `${item.available ? '✓' : '⚠'} ${item.label}`).join(' · ') || 'No job env requirements.';
}

function logModal(run) {
  return `<div class="job-log-modal card" role="dialog" aria-modal="true" aria-label="Job log">
    <div class="crm-module-head"><div><p class="eyebrow">Job log</p><h2>${escapeHtml(run.label || run.job_id || 'Run')}</h2></div><button id="job-log-close" class="button ghost" type="button">Close</button></div>
    <p class="trust-note">${escapeHtml(run.status)} · ${escapeHtml(run.started_at)} → ${escapeHtml(run.finished_at || 'running')} · ${escapeHtml(run.command_ref)}</p>
    <pre class="job-log-output">${escapeHtml(run.log_excerpt || 'No log captured yet.')}</pre>
  </div>`;
}

function opportunityScore(record = {}) {
  return Number(
    record.latest_score?.total_score
    || record.latest_score?.weighted_score
    || record.score?.overall_score
    || record.score?.total_score
    || record.score?.weighted_score
    || record.priority_score
    || (typeof record.score === 'number' ? record.score : 0)
    || 0
  );
}

function opportunityRecommendation(record = {}) {
  return record.recommendation || record.score?.recommendation || record.latest_score?.recommendation || record.next_best_action || record.status || record.gate_status || 'review';
}

function dailyPullNextActions(summary = {}) {
  const actions = Array.isArray(summary.next_actions) ? summary.next_actions : [];
  if (actions.length) return actions.slice(0, 4);
  return [
    { label: 'Route top opportunity for ProductOps review', href: '#opportunity-desk', route_type: 'review' },
    { label: 'Create SPG offer proof review card', href: '#spg-offers', route_type: 'review' },
    { label: 'Open source-health fix card', href: '#daily-money-dashboard', route_type: 'data_quality' },
  ];
}

async function safeRequest(path) {
  try {
    return { ok: true, body: await requestJson(`${CRM_API_BASE}${path}`, { headers: authHeaders() }) };
  } catch (error) {
    return { ok: false, error };
  }
}

async function loadCommandCenterData() {
  const requests = [
    ['dashboard', '/dashboard'],
    ['commandCenter', '/command-center'],
    ['brands', '/brands'],
    ['domains', '/domains'],
    ['lists', '/lists'],
    ['segments', '/segments'],
    ['campaigns', '/campaigns'],
    ['integrations', '/integrations'],
    ['queryTemplates', '/query-templates'],
    ['spgOffers', '/spg/offers'],
    ['spgOfferWall', '/spg/offer-wall/public?surface=home'],
    ['spgSources', '/spg/sources'],
    ['spgAccounts', '/spg/offer-accounts'],
    ['spgCandidates', '/spg/offer-candidates'],
    ['spgProof', '/spg/proof/network-readiness'],
    ['dailyPull', '/daily-pull/summary'],
    ['jobs', '/jobs'],
    ['opportunityDashboard', '/opportunity-desk/dashboard'],
    ['opportunityOperations', '/opportunity-desk/operations'],
    ['opportunities', '/opportunity-desk/opportunities'],
    ['opportunitySources', '/opportunity-desk/sources'],
    ['opportunitySourceRuns', '/opportunity-desk/source-runs'],
    ['opportunityDigest', '/opportunity-desk/digest'],
    ['audit', '/audit?limit=20'],
  ];
  const entries = await Promise.all(requests.map(async ([key, path]) => [key, await safeRequest(path)]));
  return Object.fromEntries(entries);
}

function dataOf(result, key, fallback) {
  return result?.ok ? (key ? result.body?.[key] : result.body) ?? fallback : fallback;
}

function sourceRunFor(source = {}, runs = []) {
  const id = source.source_id || source.id || source.name || source.source_name || source.source_family;
  return runs.find((run) => run.source_id === id || run.source_family === source.source_family || run.source_family === source.family) || {};
}

function sourceLedgerRows({ jobs = [], oppSources = [], sourceRuns = [], spgSources = [], dailyPull = {}, spgAccounts = [] }) {
  const rows = [];
  for (const source of oppSources) {
    const run = sourceRunFor(source, sourceRuns);
    rows.push({
      source: source.source_name || source.name || source.source_id,
      class: source.source_family || source.family || 'opportunity',
      credential: source.credential_ref || source.access_method || source.required_key_name || 'public/no secret',
      lastPull: run.finished_at || source.last_run_at || source.updated_at || 'missing',
      status: run.status || source.source_health || source.latest_run_status || 'pending',
      records: run.opportunity_count || run.records_seen || source.records_seen || 0,
      proof: source.artifact_path || run.artifact_path || source.source_url || 'source registry',
      allowed: source.allowed_actions || source.allowed_action || 'collect + score only',
    });
  }
  for (const source of spgSources) {
    rows.push({
      source: source.name || source.source_name || source.source_id || source.url,
      class: source.source_type || source.family || 'spg offer feed',
      credential: source.credential_ref || source.required_key_name || 'public/no secret',
      lastPull: source.last_seen_at || source.updated_at || dailyPull.generated_at || 'missing',
      status: source.status || source.approval_status || 'pending',
      records: source.records_seen || source.item_count || 0,
      proof: source.artifact_path || source.url || 'spg source registry',
      allowed: source.allowed_actions || 'discovery only',
    });
  }
  for (const account of spgAccounts) {
    rows.push({
      source: account.network_name || account.name,
      class: 'affiliate/network account',
      credential: account.credential_ref || 'secret-ref only',
      lastPull: account.last_verified_at || account.updated_at || 'pending',
      status: account.approval_status || account.status || 'pending',
      records: account.offer_count || 0,
      proof: account.login_url || account.dashboard_url || 'account record',
      allowed: account.next_action || 'verify account',
    });
  }
  for (const job of jobs) {
    rows.push({
      source: job.label || job.job_id,
      class: 'job/collector',
      credential: (job.env_status || []).map((item) => item.label).join(', ') || 'none',
      lastPull: job.latest_run?.finished_at || job.latest_run?.started_at || 'never',
      status: job.running ? 'running' : (job.latest_run?.status || 'idle'),
      records: job.latest_run?.summary?.records || job.latest_run?.summary?.opportunities || 0,
      proof: job.expected_artifact || job.command_ref || 'allowlist',
      allowed: 'manual rerun',
    });
  }
  if (!rows.length) {
    rows.push({ source: 'No verified source records yet', class: 'missing', credential: '—', lastPull: '—', status: 'missing', records: 0, proof: 'Run Daily Pull Everything', allowed: 'Jobs Control → run collector' });
  }
  return rows;
}

function revenueActionQueue({ opportunities = [], spgOffers = [], spgCandidates = [], jobs = [], dailyPull = {}, oppOps = {} }) {
  const actions = [];
  for (const opp of [...(oppOps.top_first_cash_opportunities || []), ...opportunities].slice(0, 8)) {
    actions.push({
      priority: opportunityScore(opp) || opp.priority || 0,
      lane: opp.source_family || opp.money_lane || opp.source_id || 'opportunity',
      action: opp.title || 'Review opportunity',
      why: opp.summary || opp.description || opp.company_fit || 'Artifact-backed opportunity needs go/no-go review.',
      owner: opp.route_owner_profile || opp.owner || 'Scout → ProductOps',
      status: opportunityRecommendation(opp),
      proof: opp.artifact_path || opp.source_url || opp.source_id || 'opportunity artifact',
    });
  }
  if (spgOffers.length) {
    actions.push({ priority: 80, lane: 'StuffPrettyGood', action: `Promote top ${Math.min(10, spgOffers.length)} monetized SPG offers`, why: 'Amazon/affiliate offer inventory exists; push highest-fit offers into public rails and track clicks.', owner: 'WebDev + LeadFS', status: 'pursue', proof: 'SPG offer records + /offers→/go QA' });
  }
  if (spgCandidates.length) {
    actions.push({ priority: 65, lane: 'Offer intake', action: `Review ${spgCandidates.length} SPG offer candidates`, why: 'Candidates are not revenue until monetization and disclosure gates approve them.', owner: 'Scout + ComplyOps', status: 'watch', proof: 'SPG candidate artifact' });
  }
  const failedJobs = jobs.filter((job) => (job.latest_run?.status || '').includes('fail') || (job.env_status || []).some((item) => !item.available));
  for (const job of failedJobs.slice(0, 4)) {
    actions.push({ priority: 90, lane: 'Ops blocker', action: `Fix ${job.label || job.job_id}`, why: 'Daily revenue engine depends on clean source collection and env readiness.', owner: job.owner || 'DevOps', status: 'blocked', proof: job.expected_artifact || job.command_ref || 'job allowlist' });
  }
  for (const action of dailyPullNextActions(dailyPull)) {
    actions.push({ priority: 55, lane: action.route_type || 'daily pull', action: action.label, why: 'Generated from latest daily pull summary.', owner: 'Hot Zero', status: 'review', proof: action.href || 'daily-pull/latest.json' });
  }
  return actions.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)).slice(0, 12);
}

function actionCards(actions = []) {
  if (!actions.length) return '<p class="trust-note">No revenue actions yet. Run Daily Pull Everything, then review Source Ledger blockers.</p>';
  return `<div class="revenue-queue">${actions.map((item, index) => `<article class="revenue-action-card card" data-status="${escapeHtml(item.status || 'review')}">
    <div class="queue-rank">${index + 1}</div>
    <div>
      <p class="eyebrow">${escapeHtml(item.lane || 'money lane')} · ${escapeHtml(item.status || 'review')}</p>
      <h3>${escapeHtml(item.action || 'Review action')}</h3>
      <p>${escapeHtml(item.why || 'No rationale recorded yet.')}</p>
      <div class="tag-row"><span class="pill">Owner: ${escapeHtml(item.owner || 'unassigned')}</span><span class="pill">Proof: ${escapeHtml(item.proof || 'missing')}</span><span class="pill">Priority: ${escapeHtml(item.priority || '—')}</span></div>
    </div>
  </article>`).join('')}</div>`;
}

function renderModules(data) {
  const commandCenter = dataOf(data.commandCenter, null, {});
  const spgOffers = dataOf(data.spgOffers, 'offers', []);
  const spgWall = dataOf(data.spgOfferWall, 'offers', []);
  const spgSources = dataOf(data.spgSources, 'sources', []);
  const spgAccounts = dataOf(data.spgAccounts, 'accounts', []);
  const spgCandidates = dataOf(data.spgCandidates, 'offer_candidates', []);
  const dailyPull = dataOf(data.dailyPull, 'summary', {});
  const jobs = dataOf(data.jobs, 'jobs', []);
  const oppDash = dataOf(data.opportunityDashboard, null, {});
  const oppOps = dataOf(data.opportunityOperations, null, {});
  const opportunities = dataOf(data.opportunities, 'opportunities', []);
  const oppSources = dataOf(data.opportunitySources, 'sources', []);
  const sourceRuns = dataOf(data.opportunitySourceRuns, 'source_runs', []);
  const digest = dataOf(data.opportunityDigest, 'digest', {});
  const auditEvents = dataOf(data.audit, 'events', []);
  const healthCounts = dailyPull.opportunity_source_health || oppOps.source_health || {};
  const ledgerRows = sourceLedgerRows({ jobs, oppSources, sourceRuns, spgSources, dailyPull, spgAccounts });
  const actions = revenueActionQueue({ opportunities, spgOffers, spgCandidates, jobs, dailyPull, oppOps });
  const topOpportunities = [...opportunities].sort((a, b) => opportunityScore(b) - opportunityScore(a)).slice(0, 12);

  return `
    <nav class="crm-tabs truth-tabs" aria-label="CRM modules">
      <a href="#source-ledger">Source Ledger</a>
      <a href="#jobs-control">Jobs Control</a>
      <a href="#opportunity-desk">Opportunity Desk</a>
      <a href="#revenue-action-queue">Revenue Action Queue</a>
      <a href="#evidence-audit">Evidence</a>
    </nav>

    <section class="truth-hero card" aria-label="Truth-first CRM status">
      <div>
        <p class="eyebrow">Truth-first Revenue OS</p>
        <h2>No fake counts. Only source-backed money moves.</h2>
        <p class="lede">This dashboard shows what was pulled, what can be rerun safely, which opportunities are backed by artifacts, and what action should happen next.</p>
      </div>
      <div class="cards four admin-grid truth-summary">
        ${card('Daily pull', compact(dailyPull.status || 'missing'), dailyPull.generated_at ? `Updated ${dailyPull.generated_at}` : 'Run Daily Pull Everything', statusTone(dailyPull.status))}
        ${card('Source health', `${formatCount(healthCounts.ok)} ok`, `${formatCount(healthCounts.warning)} warning · ${formatCount(healthCounts.skipped)} skipped`, Number(healthCounts.warning || 0) ? 'neutral' : 'success')}
        ${card('Opportunities', formatCount(oppDash?.counts?.opportunities || opportunities.length), 'Artifact-backed records only.', opportunities.length ? 'success' : 'neutral')}
        ${card('Revenue actions', formatCount(actions.length), 'Internal actions. No external commitments.', actions.length ? 'success' : 'neutral')}
      </div>
    </section>

    ${section('Source Ledger', 'Verified upstream data, credential readiness by name only, and source proof', `
      <div class="cards four admin-grid">
        ${card('Ledger rows', formatCount(ledgerRows.length), 'Sources, jobs, affiliate accounts and feeds.')}
        ${card('SPG offers', formatCount(spgOffers.length || spgWall.length), `${formatCount(spgCandidates.length)} candidates`, spgOffers.length ? 'success' : 'neutral')}
        ${card('Source runs', formatCount(sourceRuns.length), 'Latest collector artifacts.')}
        ${card('Legacy audience', compact(commandCenter.legacySource?.status || 'blocked/missing'), 'Count-only until evidence gate.', 'error')}
      </div>
      ${rows(ledgerRows, [
        { label: 'Source', value: (r) => r.source },
        { label: 'Class', value: (r) => r.class },
        { label: 'Credential', value: (r) => r.credential },
        { label: 'Last pull', value: (r) => r.lastPull },
        { label: 'Status', value: (r) => r.status },
        { label: 'Records', value: (r) => r.records },
        { label: 'Proof', value: (r) => r.proof },
        { label: 'Allowed', value: (r) => r.allowed },
      ])}
      <p class="trust-note">Credential readiness uses env key names only. No raw keys, no raw PII, no false audience records.</p>
    `)}

    ${section('Jobs Control', 'Safely rerun approved collectors, scrapers, builds and QA', `
      <div class="cards four admin-grid">
        ${card('Allowed jobs', formatCount(jobs.length), 'Server-side allowlist only.', 'success')}
        ${card('Running now', formatCount(jobs.filter((job) => job.running).length), 'Long jobs continue after click.', jobs.some((job) => job.running) ? 'neutral' : 'success')}
        ${card('Env readiness', jobs.some((job) => (job.env_status || []).some((item) => !item.available)) ? 'CHECK' : 'READY', envSummary(jobs), jobs.some((job) => (job.env_status || []).some((item) => !item.available)) ? 'neutral' : 'success')}
        ${card('External actions', 'BLOCKED', 'Collect/build/QA only. No bids, outreach, SMS, email, spend or provider push.', 'error')}
      </div>
      <div class="jobs-grid">
        ${jobs.length ? jobs.map(jobCard).join('') : '<p class="trust-note">No jobs returned by /crm-api/jobs.</p>'}
      </div>
      <div id="job-run-output" class="job-run-output" aria-live="polite"></div>
    `)}

    ${section('Opportunity Desk', 'Artifact-backed opportunities and AI decision signals', `
      <div class="cards four admin-grid">
        ${card('Opportunity count', formatCount(oppOps?.counts?.opportunities || oppDash?.counts?.opportunities || opportunities.length), compact(oppOps?.opportunity_counts?.by_status || {}))}
        ${card('Last run', compact(oppOps?.last_run?.generated_at || dailyPull.generated_at || 'unknown'), compact(oppOps?.last_run?.status || 'status unknown'), statusTone(oppOps?.last_run?.status || ''))}
        ${card('Source families', formatCount(oppOps?.counts?.sources || oppDash?.counts?.sources || oppSources.length), compact(oppOps?.source_health || dailyPull.opportunity_source_health || {}))}
        ${card('External actions', oppDash?.externalActionsEnabled === false ? 'BLOCKED' : 'CHECK', 'AI drafts only; Boss approval required.', 'error')}
      </div>
      ${rows(topOpportunities, [
        { label: 'Opportunity', value: (r) => r.title },
        { label: 'Source', value: (r) => r.source_family || r.source_id },
        { label: 'Deadline', value: (r) => r.due_date || r.deadline || r.close_date },
        { label: 'Fit', value: (r) => r.company_fit || r.fit_reason },
        { label: 'Score', value: (r) => opportunityScore(r) || '—' },
        { label: 'Decision', value: (r) => opportunityRecommendation(r) },
        { label: 'Proof', value: (r) => r.artifact_path || r.source_url || r.notice_id || r.source_id },
      ])}
      ${rows((oppOps?.source_runs?.latest_runs || sourceRuns).slice(0, 8), [
        { label: 'Run', value: (r) => r.source_id || r.source_family },
        { label: 'Status', value: (r) => r.status || r.source_health_after },
        { label: 'Finished', value: (r) => r.finished_at },
        { label: 'Count', value: (r) => r.opportunity_count || r.records_seen },
        { label: 'Issue', value: (r) => r.error || r.skip_reason || r.source_health_reason },
      ])}
      <p class="trust-note">Digest scope: ${escapeHtml(compact(digest?.scope || 'all sources'))}. No bid/application/outreach can be submitted from this UI.</p>
    `)}

    ${section('Revenue Action Queue', 'The daily money queue: pursue, fix, review, or block', `
      ${actionCards(actions)}
      <div class="crm-action-row" aria-label="Internal next actions">
        ${dailyPullNextActions(dailyPull).map((action) => `<a class="button ghost" href="${escapeHtml(action.href || '#revenue-action-queue')}" data-kanban-only="true" data-route-type="${escapeHtml(action.route_type || 'review')}">${escapeHtml(action.label)} · internal only</a>`).join('')}
      </div>
      <p class="trust-note">Queue entries are internal recommendations. They do not contact buyers, submit applications, send messages, spend money, or publish provider actions.</p>
    `)}

    ${section('Evidence Audit', 'Recent auditable CRM activity and source proof trail', `
      ${rows(auditEvents, [
        { label: 'Time', value: (r) => r.createdAt || r.timestamp },
        { label: 'Actor', value: (r) => r.actorId },
        { label: 'Action', value: (r) => r.action },
        { label: 'Resource', value: (r) => `${r.resourceType || ''} ${r.resourceId || ''}`.trim() },
      ])}
    `, '<button id="crm-refresh" class="button ghost" type="button">Refresh</button>')}
  `;
}
async function showDashboard({ session }) {
  document.body.dataset.crmState = 'authenticated';
  loginCard.hidden = true;
  authedPanel.hidden = false;
  authedPanel.innerHTML = `
    <div class="crm-auth-topline">
      <div>
        <p class="eyebrow">Signed in</p>
        <h1>Revenue OS</h1>
        <p class="lede">${escapeHtml(session.email)} · ${escapeHtml(session.role)} · loading Source Ledger, Jobs Control, Opportunity Desk and Revenue Queue…</p>
      </div>
      <button id="crm-logout" class="button ghost" type="button">Log out</button>
    </div>
    <div class="card"><p class="trust-note">Loading truth-first modules. No fake records are shown while source artifacts load…</p></div>
  `;
  document.getElementById('crm-logout')?.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    setStatus('Signed out.', 'neutral');
  });
  const data = await loadCommandCenterData();
  authedPanel.innerHTML = `
    <div class="crm-auth-topline">
      <div>
        <p class="eyebrow">Signed in</p>
        <h1>Revenue OS</h1>
        <p class="lede">${escapeHtml(session.email)} · ${escapeHtml(session.role)} · private Mehyar Media truth-first CRM</p>
      </div>
      <button id="crm-logout" class="button ghost" type="button">Log out</button>
    </div>
    ${renderModules(data)}
  `;
  document.getElementById('crm-logout')?.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    setStatus('Signed out.', 'neutral');
  });
  document.getElementById('crm-refresh')?.addEventListener('click', () => loadSession());
  bindJobControls();
}

function setJobOutput(html) {
  const output = document.getElementById('job-run-output');
  if (output) output.innerHTML = html;
}

async function bindJobControls() {
  for (const button of document.querySelectorAll('.job-run-button')) {
    button.addEventListener('click', async () => {
      const jobId = button.getAttribute('data-job-id');
      button.disabled = true;
      button.textContent = 'Starting…';
      try {
        const result = await requestJson(`${CRM_API_BASE}/jobs/run`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ job_id: jobId }),
        });
        setJobOutput(`<div class="card"><p class="eyebrow">Job started</p><h3>${escapeHtml(result.run.label || jobId)}</h3><p class="trust-note">Run ID: ${escapeHtml(result.run.run_id)} · status ${escapeHtml(result.run.status)}. Refresh in a moment to see completion/logs.</p></div>`);
        setTimeout(() => loadSession(), 1800);
      } catch (error) {
        setJobOutput(`<div class="card"><p class="eyebrow">Job failed to start</p><h3>${escapeHtml(jobId)}</h3><p class="trust-note">${escapeHtml(error.message)}</p></div>`);
        button.disabled = false;
        button.textContent = 'Run now';
      }
    });
  }
  for (const button of document.querySelectorAll('.job-log-button')) {
    button.addEventListener('click', async () => {
      const runId = button.getAttribute('data-run-id');
      try {
        const result = await requestJson(`${CRM_API_BASE}/jobs/runs/${encodeURIComponent(runId)}`, { headers: authHeaders() });
        setJobOutput(logModal(result.run));
        document.getElementById('job-log-close')?.addEventListener('click', () => setJobOutput(''));
      } catch (error) {
        setJobOutput(`<div class="card"><p class="eyebrow">Log unavailable</p><p class="trust-note">${escapeHtml(error.message)}</p></div>`);
      }
    });
  }
}

async function loadSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return showLogin();
  try {
    const sessionResult = await requestJson(`${CRM_API_BASE}/auth/session`, { headers: authHeaders() });
    await showDashboard({ session: sessionResult.session });
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
  }
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  setStatus('Checking credentials…');
  try {
    const result = await requestJson(`${CRM_API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
      }),
    });
    localStorage.setItem(TOKEN_KEY, result.session.id);
    setStatus('Signed in.', 'success');
    await loadSession();
  } catch (error) {
    localStorage.removeItem(TOKEN_KEY);
    setStatus(error.status === 401 ? 'Invalid credentials.' : 'Login failed. Try again.', 'error');
  }
});

loadSession();
