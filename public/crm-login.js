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

async function safeRequest(path) {
  try {
    return { ok: true, body: await requestJson(`${CRM_API_BASE}${path}`, { headers: authHeaders() }) };
  } catch (error) {
    return { ok: false, error };
  }
}

async function loadCommandCenterData() {
  const entries = await Promise.all([
    ['dashboard', safeRequest('/dashboard')],
    ['commandCenter', safeRequest('/command-center')],
    ['brands', safeRequest('/brands')],
    ['domains', safeRequest('/domains')],
    ['lists', safeRequest('/lists')],
    ['segments', safeRequest('/segments')],
    ['campaigns', safeRequest('/campaigns')],
    ['integrations', safeRequest('/integrations')],
    ['queryTemplates', safeRequest('/query-templates')],
    ['spgOffers', safeRequest('/spg/offers')],
    ['spgOfferWall', safeRequest('/spg/offer-wall/public?surface=home')],
    ['spgSources', safeRequest('/spg/sources')],
    ['spgAccounts', safeRequest('/spg/offer-accounts')],
    ['spgCandidates', safeRequest('/spg/offer-candidates')],
    ['spgProof', safeRequest('/spg/proof/network-readiness')],
    ['opportunityDashboard', safeRequest('/opportunity-desk/dashboard')],
    ['opportunities', safeRequest('/opportunity-desk/opportunities')],
    ['opportunitySources', safeRequest('/opportunity-desk/sources')],
    ['opportunityDigest', safeRequest('/opportunity-desk/digest')],
    ['audit', safeRequest('/audit?limit=20')],
  ]);
  return Object.fromEntries(entries.map(([key, promise]) => [key, promise]));
}

function dataOf(result, key, fallback) {
  return result?.ok ? (key ? result.body?.[key] : result.body) ?? fallback : fallback;
}

function renderModules(data) {
  const dashboard = dataOf(data.dashboard, null, {});
  const commandCenter = dataOf(data.commandCenter, null, {});
  const brands = dataOf(data.brands, 'records', []);
  const domains = dataOf(data.domains, 'records', []);
  const lists = dataOf(data.lists, 'records', []);
  const segments = dataOf(data.segments, 'records', []);
  const campaigns = dataOf(data.campaigns, 'records', []);
  const integrations = dataOf(data.integrations, 'records', []);
  const queryTemplates = dataOf(data.queryTemplates, 'records', []);
  const spgOffers = dataOf(data.spgOffers, 'offers', []);
  const spgWall = dataOf(data.spgOfferWall, 'offers', []);
  const spgSources = dataOf(data.spgSources, 'sources', []);
  const spgAccounts = dataOf(data.spgAccounts, 'accounts', []);
  const spgCandidates = dataOf(data.spgCandidates, 'offer_candidates', []);
  const spgProof = dataOf(data.spgProof, null, {});
  const oppDash = dataOf(data.opportunityDashboard, null, {});
  const opportunities = dataOf(data.opportunities, 'opportunities', []);
  const oppSources = dataOf(data.opportunitySources, 'sources', []);
  const digest = dataOf(data.opportunityDigest, 'digest', {});
  const auditEvents = dataOf(data.audit, 'events', []);
  const counts = commandCenter.counts || {};

  return `
    <nav class="crm-tabs" aria-label="CRM modules">
      <a href="#crm-overview">Overview</a>
      <a href="#contact-war-room">Contact War Room</a>
      <a href="#campaign-manager">Campaign Manager</a>
      <a href="#spg-offers">SPG Offers</a>
      <a href="#opportunity-desk">Opportunity Desk</a>
      <a href="#compliance-gates">Gates</a>
      <a href="#audit-log">Audit</a>
    </nav>
    <section id="crm-overview" class="cards four admin-grid">
      ${card('Mass sending', dashboard?.service?.massSendingEnabled === false ? 'NO-SEND' : 'CHECK', 'Provider push/export remain gated.', 'error')}
      ${card('Command records', formatCount(Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0)), 'Seeded CRM operating records.', 'success')}
      ${card('SPG monetized offers', formatCount(spgOffers.length || spgWall.length), 'Published/approved offer inventory visible to CRM.', spgOffers.length || spgWall.length ? 'success' : 'neutral')}
      ${card('Opportunities', formatCount(oppDash?.counts?.opportunities || opportunities.length), 'SAM/jobs/affiliate/network desk.', opportunities.length ? 'success' : 'neutral')}
    </section>
    ${section('Contact War Room', 'Audience legality + profitability sorting', `
      <div class="cards three admin-grid">
        ${card('Lists', formatCount(lists.length || counts.lists), 'Safe query sources only.')}
        ${card('Segments', formatCount(segments.length || counts.segments), 'Tiered, suppressed, bounded previews.')}
        ${card('Legacy source', compact(commandCenter.legacySource?.status), 'Read-only. Full pulls blocked.', statusTone(commandCenter.legacySource?.status))}
      </div>
      ${rows(lists, [
        { label: 'List', value: (r) => r.name },
        { label: 'Channel', value: (r) => r.channel },
        { label: 'Usable', value: (r) => r.usableCount },
        { label: 'Risk', value: (r) => r.riskLevel },
        { label: 'Source', value: (r) => r.safeQuerySource },
      ])}
      ${rows(segments, [
        { label: 'Segment', value: (r) => r.name },
        { label: 'Channel', value: (r) => r.channel },
        { label: 'Risk tier', value: (r) => r.riskTier },
        { label: 'Status', value: (r) => r.status },
        { label: 'Materialize', value: (r) => r.materializationAllowed ? 'allowed' : 'blocked' },
      ])}
    `)}
    ${section('Campaign Manager', 'Draft-only journeys, simulators, send gates', `
      <div class="cards three admin-grid">
        ${card('Campaigns', formatCount(campaigns.length || counts.campaigns), 'Draft-only until gates pass.')}
        ${card('Pilot status', compact(commandCenter.pilotReadiness?.overallStatus), compact(commandCenter.pilotReadiness?.brandDomain), statusTone(commandCenter.pilotReadiness?.overallStatus))}
        ${card('Sender domain', compact(commandCenter.pilotReadiness?.senderDomain?.status), compact(commandCenter.pilotReadiness?.senderDomain?.reason), statusTone(commandCenter.pilotReadiness?.senderDomain?.status))}
      </div>
      ${rows(campaigns, [
        { label: 'Campaign', value: (r) => r.name },
        { label: 'Brand', value: (r) => r.brandId || r.brandDomain },
        { label: 'Channel', value: (r) => r.channel },
        { label: 'Segment', value: (r) => r.targetSegment },
        { label: 'Approval', value: (r) => r.approvalStatus },
      ])}
    `)}
    ${section('SPG Offers', 'Monetized-only inventory + network proof', `
      <div class="cards four admin-grid">
        ${card('Offers', formatCount(spgOffers.length), 'Admin/public offer records.')}
        ${card('Homepage wall', formatCount(spgWall.length), 'Cards route /offers → /go.')}
        ${card('Candidates', formatCount(spgCandidates.length), 'Daily source/RSS/trend candidates.')}
        ${card('Accounts', formatCount(spgAccounts.length), 'Affiliate/source account records.')}
      </div>
      ${rows(spgOffers.slice(0, 10), [
        { label: 'Offer', value: (r) => r.title || r.name || r.slug },
        { label: 'Network', value: (r) => r.network || r.network_name || r.monetization_basis },
        { label: 'Approval', value: (r) => r.approval_status || r.status },
        { label: 'Landing', value: (r) => r.public_landing_url || r.landing_url },
        { label: 'Redirect', value: (r) => r.redirect_url || r.go_link },
      ])}
      ${rows(spgAccounts, [
        { label: 'Account', value: (r) => r.network_name || r.name },
        { label: 'Status', value: (r) => r.approval_status || r.status },
        { label: 'Credential', value: (r) => r.credential_ref || 'secret-ref only' },
        { label: 'Next action', value: (r) => r.next_action },
      ])}
      <p class="trust-note">Network readiness: ${escapeHtml(compact(spgProof?.status || spgProof?.readiness_status || spgProof?.summary || 'collecting proof'))}</p>
    `)}
    ${section('Opportunity Desk', 'AI Decision Desk for SAM, jobs, networks and sponsors', `
      <div class="cards four admin-grid">
        ${card('Sources', formatCount(oppDash?.counts?.sources || oppSources.length), 'SAM/job/network/RSS registries.')}
        ${card('Open', formatCount(oppDash?.counts?.open || opportunities.filter((o) => o.status === 'open').length), 'Potential pursue/watch items.')}
        ${card('External actions', oppDash?.externalActionsEnabled === false ? 'BLOCKED' : 'CHECK', 'AI drafts only. No submission/spend.', 'error')}
        ${card('Digest', compact(digest?.date || 'daily'), compact(digest?.scope || 'all sources'))}
      </div>
      ${rows(opportunities, [
        { label: 'Opportunity', value: (r) => r.title },
        { label: 'Source', value: (r) => r.source_family || r.source_id },
        { label: 'Type', value: (r) => r.opportunity_type },
        { label: 'Score', value: (r) => r.latest_score?.total_score || r.score || r.priority_score },
        { label: 'Decision', value: (r) => r.recommendation || r.status || r.gate_status },
      ])}
    `)}
    ${section('Compliance Gates', 'No-send controls and approval blockers', `
      <div class="cards three admin-grid">
        ${card('Suppression', compact(commandCenter.pilotReadiness?.suppression?.status), compact(commandCenter.pilotReadiness?.suppression?.missingOrBlockingReasons), statusTone(commandCenter.pilotReadiness?.suppression?.status))}
        ${card('Compliance', compact(commandCenter.pilotReadiness?.compliance?.status), compact(commandCenter.pilotReadiness?.compliance?.missingOrBlockingReasons), statusTone(commandCenter.pilotReadiness?.compliance?.status))}
        ${card('Blocked actions', 'send / export / push', compact(commandCenter.pilotReadiness?.blockedActions?.reasons), 'error')}
      </div>
      ${rows(integrations, [
        { label: 'Integration', value: (r) => r.name },
        { label: 'Kind', value: (r) => r.kind },
        { label: 'Status', value: (r) => r.status },
        { label: 'Secrets', value: (r) => r.secretsStoredExternally ? 'external only' : 'check' },
      ])}
      ${rows(queryTemplates, [
        { label: 'Template', value: (r) => r.name },
        { label: 'Source', value: (r) => r.sourceSystem },
        { label: 'Purpose', value: (r) => r.purpose },
        { label: 'Preview max', value: (r) => r.maxPreviewRows },
        { label: 'Full pull', value: (r) => r.fullTablePullAllowed ? 'blocked violation' : 'blocked' },
      ])}
    `)}
    ${section('Brands + Domains', 'Operating records', `
      ${rows(brands, [
        { label: 'Brand', value: (r) => r.name },
        { label: 'Domain', value: (r) => r.domain },
        { label: 'Vertical', value: (r) => r.vertical },
        { label: 'Status', value: (r) => r.status },
      ])}
      ${rows(domains, [
        { label: 'Domain', value: (r) => r.domain },
        { label: 'Type', value: (r) => r.domainType },
        { label: 'DNS', value: (r) => r.dnsStatus },
        { label: 'SSL', value: (r) => r.sslStatus },
        { label: 'Sender', value: (r) => r.senderReadiness },
      ])}
    `)}
    ${section('Audit Log', 'Recent CRM activity', rows(auditEvents, [
      { label: 'Time', value: (r) => r.createdAt || r.timestamp },
      { label: 'Actor', value: (r) => r.actorId },
      { label: 'Action', value: (r) => r.action },
      { label: 'Resource', value: (r) => `${r.resourceType || ''} ${r.resourceId || ''}`.trim() },
    ]), '<button id="crm-refresh" class="button ghost" type="button">Refresh</button>')}
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
        <h1>Command Center</h1>
        <p class="lede">${escapeHtml(session.email)} · ${escapeHtml(session.role)} · loading modules…</p>
      </div>
      <button id="crm-logout" class="button ghost" type="button">Log out</button>
    </div>
    <div class="card"><p class="trust-note">Loading Contact War Room, Campaign Manager, SPG Offers, Opportunity Desk, gates and audit…</p></div>
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
        <h1>Command Center</h1>
        <p class="lede">${escapeHtml(session.email)} · ${escapeHtml(session.role)} · private Mehyar Media CRM</p>
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
