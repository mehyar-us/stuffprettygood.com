const TOKEN_KEY = 'mehyarmedia-crm-session-token';

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
  loginCard.hidden = false;
  authedPanel.hidden = true;
  authedPanel.innerHTML = '';
}

function showDashboard({ session, dashboard, commandCenter }) {
  loginCard.hidden = true;
  authedPanel.hidden = false;
  const blocked = dashboard?.service?.massSendingEnabled === false ? 'NO-SEND' : 'CHECK';
  const counts = commandCenter?.counts || {};
  authedPanel.innerHTML = `
    <div class="crm-auth-topline">
      <div>
        <p class="eyebrow">Signed in</p>
        <h1>Command Center</h1>
        <p class="lede">${escapeHtml(session.email)} · ${escapeHtml(session.role)}</p>
      </div>
      <button id="crm-logout" class="button ghost" type="button">Log out</button>
    </div>
    <div class="cards three admin-grid">
      <article class="card"><p class="eyebrow">Safety</p><h2>${escapeHtml(blocked)}</h2><p>Mass sending, provider push, and exports remain gated.</p></article>
      <article class="card"><p class="eyebrow">Database</p><h2>${escapeHtml(dashboard?.database?.status || 'unknown')}</h2><p>Connection details stay sanitized.</p></article>
      <article class="card"><p class="eyebrow">Records</p><h2>${escapeHtml(Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0))}</h2><p>Aggregate command-center count only.</p></article>
    </div>
  `;
  document.getElementById('crm-logout')?.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    setStatus('Signed out.', 'neutral');
  });
}

async function loadSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return showLogin();
  try {
    const sessionResult = await requestJson('/api/auth/session', { headers: authHeaders() });
    const [dashboard, commandCenter] = await Promise.all([
      requestJson('/api/dashboard', { headers: authHeaders() }),
      requestJson('/api/command-center', { headers: authHeaders() }),
    ]);
    showDashboard({ session: sessionResult.session, dashboard, commandCenter });
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
    const result = await requestJson('/api/auth/login', {
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
