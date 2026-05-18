export function renderOpportunityDeskHtml() {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mehyar Media CRM · Opportunity Desk</title>
  <style>
    :root {
      color-scheme: dark light;
      --bg: #080b12;
      --panel: rgba(16, 24, 39, 0.88);
      --panel-strong: #111827;
      --ink: #eef4ff;
      --muted: #9aa8bf;
      --line: rgba(148, 163, 184, 0.22);
      --accent: #83e6c3;
      --accent-2: #8ab4ff;
      --warn: #ffd166;
      --danger: #ff8a8a;
      --ok: #7ee787;
      --shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
      --radius: 22px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f5f7fb;
        --panel: rgba(255, 255, 255, 0.9);
        --panel-strong: #ffffff;
        --ink: #101828;
        --muted: #526071;
        --line: rgba(15, 23, 42, 0.14);
        --shadow: 0 22px 70px rgba(15, 23, 42, 0.12);
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(131, 230, 195, 0.22), transparent 34rem),
        radial-gradient(circle at top right, rgba(138, 180, 255, 0.2), transparent 38rem),
        var(--bg);
      color: var(--ink);
      min-height: 100vh;
    }
    a { color: inherit; }
    button, input, select, textarea { font: inherit; }
    button {
      border: 0;
      border-radius: 999px;
      padding: 0.72rem 1rem;
      color: #061018;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      font-weight: 800;
      cursor: pointer;
    }
    button.secondary { color: var(--ink); background: transparent; border: 1px solid var(--line); }
    button.danger { background: rgba(255, 138, 138, 0.18); color: var(--danger); border: 1px solid rgba(255, 138, 138, 0.34); }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .shell { width: min(1500px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 56px; }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: end;
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: calc(var(--radius) + 10px);
      background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
      box-shadow: var(--shadow);
    }
    .eyebrow { color: var(--accent); font-weight: 900; letter-spacing: 0.13em; text-transform: uppercase; font-size: 0.78rem; }
    h1 { margin: 8px 0 10px; font-size: clamp(2.1rem, 5vw, 5.2rem); line-height: 0.9; letter-spacing: -0.07em; max-width: 920px; }
    h2, h3 { margin: 0; letter-spacing: -0.03em; }
    p { color: var(--muted); line-height: 1.55; }
    .hero p { max-width: 760px; margin: 0; font-size: 1.05rem; }
    .auth-card { min-width: min(420px, 100%); padding: 18px; border-radius: var(--radius); background: var(--panel); border: 1px solid var(--line); }
    .auth-grid { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; margin-top: 12px; }
    input, select, textarea {
      width: 100%;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--panel-strong);
      color: var(--ink);
      padding: 0.74rem 0.86rem;
      min-height: 44px;
    }
    .status-line { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 12px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.62rem; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 0.82rem; font-weight: 800; }
    .pill.ok { color: var(--ok); border-color: rgba(126, 231, 135, 0.35); }
    .pill.warn { color: var(--warn); border-color: rgba(255, 209, 102, 0.36); }
    .pill.danger { color: var(--danger); border-color: rgba(255, 138, 138, 0.36); }
    .metrics { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin: 18px 0; }
    .metric, .panel, .queue, .detail, .memo-card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: 0 12px 34px rgba(0,0,0,0.1); }
    .metric { padding: 16px; }
    .metric strong { display: block; font-size: 2rem; letter-spacing: -0.05em; }
    .metric span { color: var(--muted); font-weight: 800; font-size: 0.82rem; }
    .filters { position: sticky; top: 0; z-index: 4; margin: 18px 0; display: grid; grid-template-columns: 1.3fr repeat(5, minmax(130px, 1fr)) auto; gap: 10px; padding: 12px; background: color-mix(in srgb, var(--bg) 72%, transparent); backdrop-filter: blur(18px); border: 1px solid var(--line); border-radius: 18px; }
    .digest { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr); gap: 14px; margin: 18px 0; align-items: start; }
    .digest-list, .source-health { display: grid; gap: 10px; padding: 14px; }
    .digest-card { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 16px; background: color-mix(in srgb, var(--panel-strong) 74%, transparent); }
    .rank { width: 2rem; height: 2rem; display: grid; place-items: center; border-radius: 999px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #061018; font-weight: 950; }
    .source-row { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 16px; background: color-mix(in srgb, var(--panel-strong) 72%, transparent); }
    .source-row[data-health*="warning"], .source-row[data-health*="needs_review"] { border-color: rgba(255, 209, 102, 0.48); }
    .source-row[data-health*="blocked"], .source-row[data-health*="disabled"] { border-color: rgba(255, 138, 138, 0.48); }
    .workspace { display: grid; grid-template-columns: minmax(360px, 0.88fr) minmax(0, 1.12fr); gap: 16px; align-items: start; }
    .rails { display: grid; gap: 14px; }
    .queue { overflow: hidden; }
    .queue header, .detail header, .memo-card header, .panel header { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 15px 16px; border-bottom: 1px solid var(--line); }
    .queue-list { display: grid; gap: 8px; padding: 12px; max-height: 360px; overflow: auto; }
    .opp-card { text-align: left; width: 100%; border-radius: 16px; padding: 12px; background: color-mix(in srgb, var(--panel-strong) 74%, transparent); border: 1px solid var(--line); color: var(--ink); }
    .opp-card.active { outline: 2px solid var(--accent); }
    .opp-title { display: flex; justify-content: space-between; gap: 12px; align-items: start; font-weight: 900; }
    .opp-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 9px; }
    .detail { min-height: 780px; overflow: hidden; }
    .detail-body { display: grid; gap: 14px; padding: 16px; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .subpanel { padding: 14px; border: 1px solid var(--line); border-radius: 18px; background: color-mix(in srgb, var(--panel-strong) 72%, transparent); }
    .subpanel h3 { font-size: 1rem; margin-bottom: 8px; }
    .kv { display: grid; grid-template-columns: minmax(120px, 0.42fr) 1fr; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line); }
    .kv:last-child { border-bottom: 0; }
    .kv span:first-child { color: var(--muted); font-weight: 800; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .score-grid { display: grid; gap: 8px; }
    .bar { display: grid; grid-template-columns: 170px 1fr 44px; gap: 8px; align-items: center; font-size: 0.86rem; }
    .track { height: 9px; border-radius: 999px; background: rgba(148, 163, 184, 0.22); overflow: hidden; }
    .fill { height: 100%; width: var(--w); border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }
    pre { white-space: pre-wrap; overflow: auto; max-height: 330px; padding: 14px; border-radius: 16px; border: 1px solid var(--line); background: #060910; color: #dce8ff; }
    .empty { color: var(--muted); padding: 18px; text-align: center; }
    .blocked-banner { border: 1px solid rgba(255, 209, 102, 0.36); background: rgba(255, 209, 102, 0.1); color: var(--warn); border-radius: 16px; padding: 12px; font-weight: 800; }
    @media (max-width: 1050px) {
      .hero, .workspace, .digest { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: repeat(3, 1fr); }
      .filters { grid-template-columns: 1fr 1fr; }
      .auth-grid, .split { grid-template-columns: 1fr; }
    }
    @media (max-width: 620px) {
      .shell { width: min(100% - 20px, 1500px); padding-top: 10px; }
      .hero { padding: 18px; }
      h1 { font-size: 2.45rem; }
      .metrics, .filters { grid-template-columns: 1fr; position: static; }
      .detail { min-height: auto; }
      .bar { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero" aria-labelledby="page-title">
      <div>
        <div class="eyebrow">Mehyar Media CRM · Money Engine</div>
        <h1 id="page-title">Opportunity Desk</h1>
        <p>Internal decision dashboard for finding money, scoring fit, reading source evidence, generating AI go/no-go memos, and routing safe Kanban prep. No submissions, outreach, account creation, public publishing, raw PII export, or paid actions are authorized from this surface.</p>
        <div class="status-line">
          <span class="pill warn">External actions disabled</span>
          <span class="pill">Internal decision support only</span>
          <span class="pill">Evidence-first routing</span>
        </div>
      </div>
      <form class="auth-card" id="authForm" onsubmit="return false">
        <strong>Authenticated CRM session</strong>
        <p style="margin:6px 0 0">Use CRM credentials or paste an existing bearer token. Token is stored only in this browser tab.</p>
        <div class="auth-grid">
          <input id="email" autocomplete="username" placeholder="admin email" />
          <input id="password" type="password" autocomplete="current-password" placeholder="password" />
          <button id="loginBtn" type="button">Login</button>
        </div>
        <div style="margin-top:8px"><input id="token" type="password" autocomplete="off" spellcheck="false" placeholder="or paste bearer token" /></div>
        <div class="status-line"><span id="authStatus" class="pill danger">Not connected</span><button id="refreshBtn" type="button" class="secondary">Refresh desk</button></div>
      </form>
    </section>

    <section class="metrics" id="metrics" aria-label="Opportunity Desk metrics"></section>

    <section class="digest" aria-label="Daily Digest and source health">
      <article class="panel">
        <header><div><h2>Daily Digest</h2><p style="margin:4px 0 0">Top internal money moves ranked for first-cash path and evidence.</p></div><span class="pill warn">No external action</span></header>
        <div class="digest-list" id="dailyDigest"></div>
      </article>
      <article class="panel">
        <header><div><h2>Source health</h2><p style="margin:4px 0 0">Collector status and credential readiness by env-name only.</p></div><span class="pill">env names only</span></header>
        <div class="source-health" id="sourceHealth"></div>
      </article>
    </section>

    <section class="filters" aria-label="Opportunity filters">
      <input id="search" placeholder="Search buyer, title, owner, evidence…" />
      <select id="typeFilter" aria-label="Type filter"><option value="">All types</option></select>
      <select id="sourceFilter" aria-label="Specific source filter"><option value="">All sources</option></select>
      <select id="familyFilter" aria-label="Source family filter">
        <option value="">All families</option><option value="sam_gov">SAM</option><option value="grants_gov">Grants</option><option value="state_local">State/local</option><option value="affiliate">Affiliate</option><option value="sponsor">Sponsor</option><option value="job_board">Job</option><option value="postings">Postings</option><option value="marketplace">Marketplace</option>
      </select>
      <select id="statusFilter" aria-label="Status filter"><option value="">All statuses</option></select>
      <select id="gateFilter" aria-label="Gate filter"><option value="">All gates</option></select>
      <button id="clearFilters" type="button" class="secondary">Clear</button>
    </section>

    <section class="workspace">
      <div class="rails" id="rails" aria-label="Decision rails"></div>
      <article class="detail" id="detail" aria-live="polite"></article>
    </section>
  </main>

<script>
const API_BASE = '/crm/api';
const state = { token: '', dashboard: null, opportunities: [], sources: [], selectedId: null, latestScore: null, latestMemo: null, latestRoute: null };
const qs = (id) => document.getElementById(id);
const rails = [
  ['pursue_now', 'Pursue now', 'High-fit opportunities ready for internal prep', (o) => o.status === 'pursue'],
  ['watch', 'Watch', 'Useful signals that need more evidence or timing', (o) => o.status === 'watch' || o.status === 'new' || o.status === 'scored'],
  ['reject', 'Reject', 'Low-fit or kill-criteria opportunities', (o) => o.status === 'reject' || o.status === 'stale' || o.status === 'duplicate'],
  ['needs_partner', 'Needs partner', 'Requires partner capacity, clearance, or proof', (o) => o.status === 'needs_partner' || o.partner_needed],
  ['needs_boss_approval', 'Needs Boss approval', 'Gate, reputation, spend, or external-action risk', (o) => o.status === 'needs_approval' || !['not_required', 'approved'].includes(o.gate_status || 'not_required')]
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function money(value) { return value == null || value === '' ? 'Unknown' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value)); }
function short(value, n = 96) { const text = String(value || ''); return text.length > n ? text.slice(0, n - 1) + '…' : text; }
function sourceFor(opp) { return state.sources.find((source) => source.source_id === opp.source_id) || {}; }
function sourceFamily(opp) { return sourceFor(opp).source_family || opp.source_family || ''; }
function sourceLabel(opp) { const source = sourceFor(opp); return source.source_name || source.name || opp.source_id || opp.source_family || 'Unknown source'; }
function sourceKey(opp) { return opp.source_id || sourceFor(opp).source_id || sourceLabel(opp); }
function badge(value, kind = '') {
  const display = value === 0 || value === '0' ? 0 : (value || 'unknown');
  return '<span class="pill ' + kind + '">' + escapeHtml(display) + '</span>';
}
function setStatus(text, kind = '') { qs('authStatus').className = 'pill ' + kind; qs('authStatus').textContent = text; }
function authHeaders() { return state.token ? { authorization: 'Bearer ' + state.token } : {}; }

async function api(path, options = {}) {
  const url = path.startsWith('/api/') ? API_BASE + path.slice(4) : path;
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...authHeaders(), ...(options.headers || {}) },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || response.statusText || 'Request failed');
  return body;
}

async function login(event) {
  event?.preventDefault?.();
  try {
    if (qs('token').value.trim()) {
      state.token = qs('token').value.trim().replace(/^Bearer\s+/i, '');
      setStatus('Token loaded', 'ok');
      await loadDesk();
      return;
    }
    const email = qs('email').value.trim();
    const password = qs('password').value;
    const body = await api('/api/auth/login', { method: 'POST', body: { email, password }, headers: {} });
    state.token = body.session.id;
    qs('token').value = state.token;
    const connectedEmail = body.user?.email || body.session?.email || 'CRM user';
    setStatus('Connected as ' + connectedEmail, 'ok');
    await loadDesk();
  } catch (error) {
    setStatus(error.message, 'danger');
  }
}

async function loadDesk() {
  if (!state.token) { setStatus('Login required', 'danger'); return; }
  setStatus('Loading desk…', 'warn');
  const [dashboard, opportunities, sources] = await Promise.all([
    api('/api/opportunity-desk/dashboard'),
    api('/api/opportunity-desk/opportunities'),
    api('/api/opportunity-desk/sources')
  ]);
  state.dashboard = dashboard;
  state.opportunities = opportunities.opportunities || [];
  state.sources = sources.sources || [];
  state.latestScore = null;
  state.latestMemo = null;
  state.latestRoute = null;
  hydrateFilters();
  if (!state.selectedId && state.opportunities[0]) state.selectedId = state.opportunities[0].opportunity_id;
  setStatus('Connected · ' + state.opportunities.length + ' opportunities', 'ok');
  render();
}

function hydrateFilters() {
  const fill = (id, values) => {
    const el = qs(id); const current = el.value; const first = el.querySelector('option')?.outerHTML || '<option value="">All</option>';
    el.innerHTML = first + [...new Set(values.filter(Boolean))].sort().map((value) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>').join('');
    el.value = current;
  };
  fill('typeFilter', state.opportunities.map((o) => o.opportunity_type));
  fill('sourceFilter', state.opportunities.map((o) => sourceKey(o) + ' · ' + sourceLabel(o)));
  fill('statusFilter', state.opportunities.map((o) => o.status));
  fill('gateFilter', state.opportunities.map((o) => o.gate_status));
}

function filteredOpps() {
  const search = qs('search').value.trim().toLowerCase();
  const type = qs('typeFilter').value;
  const source = qs('sourceFilter').value;
  const family = qs('familyFilter').value;
  const status = qs('statusFilter').value;
  const gate = qs('gateFilter').value;
  return state.opportunities.filter((opp) => {
    const sourceChoice = sourceKey(opp) + ' · ' + sourceLabel(opp);
    const haystack = JSON.stringify({ ...opp, source_family: sourceFamily(opp), source_name: sourceLabel(opp) }).toLowerCase();
    return (!search || haystack.includes(search)) && (!type || opp.opportunity_type === type) && (!source || sourceChoice === source) && (!family || sourceFamily(opp) === family) && (!status || opp.status === status) && (!gate || opp.gate_status === gate);
  });
}

function render() {
  renderMetrics();
  renderDigest();
  renderSourceHealth();
  renderRails();
  renderDetail();
}
function renderMetrics() {
  const counts = state.dashboard?.counts || {};
  const risk = state.opportunities.filter((o) => !['not_required', 'approved'].includes(o.gate_status || 'not_required')).length;
  const routeable = state.opportunities.filter((o) => ['pursue', 'watch', 'needs_approval', 'needs_partner'].includes(o.status)).length;
  qs('metrics').innerHTML = [
    ['Opportunities', counts.opportunities ?? state.opportunities.length],
    ['Pursue', state.opportunities.filter((o) => o.status === 'pursue').length],
    ['Watch', state.opportunities.filter((o) => o.status === 'watch').length],
    ['Gate risk', risk],
    ['Sources', counts.sources ?? state.sources.length],
    ['Kanban drafts', counts.kanban_routes ?? 0]
  ].map(([label, value]) => '<div class="metric"><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + '</span></div>').join('');
}
function digestScore(opp) { return Number(opp.score || opp.weighted_score || opp.priority_score || 0); }
function renderDigest() {
  const top = [...state.opportunities].sort((a, b) => digestScore(b) - digestScore(a)).slice(0, 3);
  qs('dailyDigest').innerHTML = top.length ? top.map((opp, index) => '<button class="digest-card" type="button" data-select="' + escapeHtml(opp.opportunity_id) + '"><span class="rank">' + (index + 1) + '</span><span><strong>' + escapeHtml(short(opp.title, 88)) + '</strong><p style="margin:4px 0">' + escapeHtml(short(opp.first_cash_path || opp.next_best_action || opp.summary || 'Review source evidence and decide pursue/watch/reject.', 140)) + '</p><span class="status-line">' + badge(sourceFamily(opp) || opp.source_id) + badge('score ' + (digestScore(opp) || 'review')) + badge(opp.status || 'new') + '</span></span></button>').join('') : '<div class="empty">Login to load the daily digest.</div>';
}
function renderSourceHealth() {
  const rows = state.sources.slice(0, 8);
  qs('sourceHealth').innerHTML = rows.length ? rows.map((source) => {
    const envName = source.credential_ref_env || source.required_key_name || source.env_key_name || 'not_required';
    const health = source.source_health || source.health || 'needs_review';
    return '<div class="source-row" data-health="' + escapeHtml(health) + '"><strong>' + escapeHtml(source.source_name || source.source_id || 'Source') + '</strong><div class="status-line">' + badge(source.source_family || 'source') + badge(health, health === 'ok' ? 'ok' : health === 'blocked' ? 'danger' : 'warn') + badge('Key: ' + envName) + '</div><p style="margin:0">Access: ' + escapeHtml(source.access_method || source.allowed_access_method || 'unknown') + ' · Cadence: ' + escapeHtml(source.refresh_cadence || 'manual') + ' · Last run: ' + escapeHtml(source.last_run_at || 'missing') + '</p></div>';
  }).join('') : '<div class="empty">No source health records loaded yet.</div>';
}
function renderRails() {
  const opps = filteredOpps();
  qs('rails').innerHTML = rails.map(([key, title, help, predicate]) => {
    const list = opps.filter(predicate);
    return '<section class="queue" data-rail="' + key + '"><header><div><h2>' + title + '</h2><p style="margin:4px 0 0">' + help + '</p></div>' + badge(list.length) + '</header><div class="queue-list">' + (list.length ? list.map(renderOppCard).join('') : '<div class="empty">No matching opportunities.</div>') + '</div></section>';
  }).join('');
}
function renderOppCard(opp) {
  const active = opp.opportunity_id === state.selectedId ? ' active' : '';
  return '<button class="opp-card' + active + '" type="button" data-select="' + escapeHtml(opp.opportunity_id) + '"><div class="opp-title"><span>' + escapeHtml(short(opp.title, 72)) + '</span><span>' + escapeHtml(opp.score ?? '') + '</span></div><p style="margin:7px 0 0">' + escapeHtml(short(opp.buyer_org_name || opp.summary || 'Unknown buyer', 110)) + '</p><div class="opp-meta">' + badge(opp.opportunity_type) + badge(opp.status, opp.status === 'pursue' ? 'ok' : opp.status === 'reject' ? 'danger' : '') + badge(sourceFamily(opp) || opp.source_id) + '</div></button>';
}
function renderDetail() {
  const opp = state.opportunities.find((item) => item.opportunity_id === state.selectedId) || filteredOpps()[0];
  if (!opp) { qs('detail').innerHTML = '<div class="empty">Login and load opportunities to inspect details.</div>'; return; }
  const source = sourceFor(opp);
  const evidence = [...(opp.evidence_refs || []), opp.external_url].filter(Boolean);
  qs('detail').innerHTML = '<header><div><h2>' + escapeHtml(opp.title) + '</h2><p style="margin:4px 0 0">' + escapeHtml(opp.summary || 'No summary attached yet.') + '</p></div><div class="status-line">' + badge(opp.status) + badge(opp.gate_status, !['not_required','approved'].includes(opp.gate_status) ? 'warn' : 'ok') + '</div></header>' +
  '<div class="detail-body"><div class="blocked-banner">External action blocker: this UI only creates internal decisions, scores, memos, AI application prep, and sanitized Kanban route proposals. Approval gates are required before outreach/submission/account/spend actions.</div>' +
  '<div class="actions"><button data-action="score">Generate / refresh score</button><button data-action="memo" class="secondary">Create AI go/no-go memo</button><button data-action="application_plan" class="secondary">AI application helper</button><button data-action="route" class="secondary">Draft Kanban route</button><button data-action="pursue" class="secondary">Pursue now</button><button data-action="watch" class="secondary">Mark watch</button><button data-action="needs_partner" class="secondary">Needs partner</button><button data-action="needs_approval" class="secondary">Needs Boss approval</button><button data-action="reject" class="danger">Mark reject</button></div>' +
  '<div class="split"><section class="subpanel"><h3>Buyer intelligence</h3>' + kv('Buyer/org', opp.buyer_org_name) + kv('Domain', opp.buyer_domain || 'Unknown') + kv('Geography', opp.geography || opp.jurisdiction || 'Unknown') + kv('Revenue model', opp.revenue_model || 'Unknown') + kv('Expected value', money(opp.expected_value_usd)) + kv('Value basis', opp.expected_value_basis || 'Unknown') + kv('First cash window', opp.first_cash_window_days ? opp.first_cash_window_days + ' days' : 'Unknown') + kv('Due/deadline', opp.due_at || opp.due_date || 'Unknown') + kv('Owner', opp.route_owner_profile || opp.owner_profile) + '</section>' +
  '<section class="subpanel"><h3>Source evidence</h3>' + kv('Source name', sourceLabel(opp)) + kv('Source ID', opp.source_id) + kv('Source family', source.source_family || opp.source_family || opp.opportunity_type) + kv('Health', source.source_health || 'unknown') + kv('Access', source.access_method || source.allowed_access_method || 'unknown') + kv('Privacy', opp.privacy_pii_handling || 'public_org_only') + '<div style="margin-top:10px">' + (evidence.length ? evidence.map((ref) => '<div class="pill" style="margin:3px 4px 3px 0; max-width:100%; overflow:hidden">' + escapeHtml(short(ref, 82)) + '</div>').join('') : '<p>No source evidence attached.</p>') + '</div></section></div>' +
  '<div class="split"><section class="subpanel"><h3>Scoring breakdown</h3>' + renderScore() + '</section><section class="subpanel"><h3>Fit, proof, and gates</h3>' + kv('Fit tags', (opp.fit_tags || []).join(', ') || 'Missing') + kv('Required proof', (opp.proof_required || []).join(', ') || 'Missing') + kv('Required docs', (opp.required_docs || []).join(', ') || 'Missing') + kv('Eligibility', opp.eligibility || 'Unknown') + kv('Suppression', opp.suppression_status) + kv('External action', opp.external_action_type || 'none') + kv('Approval ref', opp.approval_ref || 'none') + '</section></div>' +
  '<section class="memo-card"><header><h3>How to apply / pursue safely</h3>' + badge('AI prep only') + '</header><div style="padding:14px"><pre>' + escapeHtml(applicationGuide(opp, evidence)) + '</pre></div></section>' +
  '<section class="memo-card"><header><h3>AI go/no-go memo</h3>' + badge(state.latestMemo?.human_review_status || 'not generated') + '</header><div style="padding:14px"><pre>' + escapeHtml(state.latestMemo?.memo_markdown || 'Generate an AI memo to see Reality, Fit, Buyer pain, First-cash path, Required proof, Missing fields, Compliance gates, Evidence refs, Recommendation, Next action, and Kill criteria.') + '</pre></div></section>' +
  '<section class="memo-card"><header><h3>Kanban route proposal</h3>' + badge(state.latestRoute?.route_status || 'not drafted') + '</header><div style="padding:14px"><pre>' + escapeHtml(state.latestRoute ? JSON.stringify(state.latestRoute.sanitized_kanban_draft, null, 2) : 'Route action creates a sanitized internal task draft only; it does not create a Kanban card or external side effect.') + '</pre></div></section></div>';
}
function kv(label, value) { return '<div class="kv"><span>' + escapeHtml(label) + '</span><span>' + escapeHtml(value ?? 'Unknown') + '</span></div>'; }
function applicationGuide(opp, evidence = []) {
  const missing = [];
  if (!evidence.length) missing.push('official source/evidence URL');
  if (!opp.eligibility) missing.push('eligibility');
  if (!opp.required_docs?.length) missing.push('required docs');
  if (!opp.due_at && !opp.due_date) missing.push('deadline');
  if (!opp.expected_value_usd) missing.push('value/commission basis');
  return [
    'Internal AI helper — not an application/submission.',
    '1. Verify source: open official source refs only; confirm terms, deadline, eligibility, and allowed channel.',
    '2. Collect missing info: ' + (missing.join(', ') || 'none detected; still human-review source before external action.'),
    '3. Package angle: ' + (opp.first_cash_path || opp.summary || 'Draft internal value proposition from evidence.'),
    '4. Draft assets: requirements checklist, proof packet, claim-safe response outline, pricing/value assumptions, risk notes.',
    '5. Approval gate: Boss/ComplyOps must approve before outreach, account creation, application, proposal, spend, KYC/tax/bank, or public claim.',
    '6. AI role: prepare checklist and draft text; operator verifies facts against evidence before any route.'
  ].join('\n');
}
function renderScore() {
  const score = state.latestScore;
  const opp = state.opportunities.find((item) => item.opportunity_id === state.selectedId) || {};
  if (!score && opp.fit_score_dimensions && Object.keys(opp.fit_score_dimensions).length) {
    return '<div class="status-line">' + badge('Collector score ' + (opp.score ?? 'unknown') + '/100', 'ok') + badge('Confidence ' + (opp.confidence ?? 'unknown')) + '</div><p>' + escapeHtml(opp.score_explanation || 'Collector-provided transparent score dimensions.') + '</p><div class="score-grid">' + Object.entries(opp.fit_score_dimensions).map(([key, value]) => '<div class="bar"><span>' + escapeHtml(key.replaceAll('_', ' ')) + '</span><div class="track"><div class="fill" style="--w:' + Math.max(0, Math.min(100, Number(value))) + '%"></div></div><strong>' + escapeHtml(value) + '</strong></div>').join('') + '</div>';
  }
  if (!score) return '<p>No generated score in this browser session. Use “Generate / refresh score” for transparent v1 dimensions.</p>';
  const dims = score.raw_dimension_scores || {};
  return '<div class="status-line">' + badge('Weighted ' + score.weighted_score + '/100', 'ok') + badge('Confidence ' + score.confidence_score + '/100') + badge(score.false_positive_risk + ' false-positive risk', score.false_positive_risk === 'high' ? 'danger' : 'warn') + '</div><p>' + escapeHtml(score.score_explanation || '') + '</p><div class="score-grid">' + Object.entries(dims).map(([key, value]) => '<div class="bar"><span>' + escapeHtml(key.replaceAll('_', ' ')) + '</span><div class="track"><div class="fill" style="--w:' + Math.max(0, Math.min(100, Number(value))) + '%"></div></div><strong>' + escapeHtml(value) + '</strong></div>').join('') + '</div>';
}

async function runAction(action) {
  const id = state.selectedId;
  if (!id) return;
  try {
    if (action === 'score') {
      const body = await api('/api/opportunity-desk/opportunities/' + encodeURIComponent(id) + '/score', { method: 'POST', body: {} });
      state.latestScore = body.score;
      await loadDesk();
      state.latestScore = body.score;
    }
    if (action === 'memo' || action === 'application_plan') {
      const body = await api('/api/opportunity-desk/opportunities/' + encodeURIComponent(id) + '/memos', { method: 'POST', body: action === 'application_plan' ? { memo_type: 'application_plan' } : {} });
      state.latestMemo = body.memo;
    }
    if (action === 'route') {
      const body = await api('/api/opportunity-desk/opportunities/' + encodeURIComponent(id) + '/route-kanban', { method: 'POST', body: { route_type: 'sales_prep', acceptance_criteria: ['Source evidence reviewed', 'No external outreach/submission', 'Compliance gates listed'] } });
      state.latestRoute = body.route;
    }
    if (['pursue', 'watch', 'reject', 'needs_partner', 'needs_approval'].includes(action)) {
      await api('/api/opportunity-desk/opportunities/' + encodeURIComponent(id) + '/decision', { method: 'POST', body: { decision: action, decision_reason: 'Internal Opportunity Desk UI decision; no external action.' } });
      const body = await api('/api/opportunity-desk/opportunities/' + encodeURIComponent(id), { method: 'PATCH', body: { status: action } });
      state.opportunities = state.opportunities.map((opp) => opp.opportunity_id === id ? body.opportunity : opp);
    }
    render();
  } catch (error) {
    setStatus(error.message, 'danger');
  }
}

document.addEventListener('click', (event) => {
  const select = event.target.closest('[data-select]');
  if (select) { state.selectedId = select.dataset.select; state.latestScore = null; state.latestMemo = null; state.latestRoute = null; render(); }
  const action = event.target.closest('[data-action]');
  if (action) runAction(action.dataset.action);
});
['search','typeFilter','sourceFilter','familyFilter','statusFilter','gateFilter'].forEach((id) => qs(id).addEventListener('input', render));
qs('clearFilters').addEventListener('click', () => { ['search','typeFilter','sourceFilter','familyFilter','statusFilter','gateFilter'].forEach((id) => qs(id).value = ''); render(); });
qs('authForm').addEventListener('submit', login);
qs('loginBtn').addEventListener('click', login);
qs('refreshBtn').addEventListener('click', loadDesk);
render();
</script>
</body>
</html>`;
}
