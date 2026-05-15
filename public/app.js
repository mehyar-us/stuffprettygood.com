const nav = document.querySelector('.nav');
document.querySelector('.nav-toggle')?.addEventListener('click', (event) => {
  const open = nav.classList.toggle('open');
  event.currentTarget.setAttribute('aria-expanded', String(open));
});

const applyTheme = (theme) => {
  const preferred = theme || localStorage.getItem('spg-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = preferred;
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.textContent = preferred === 'dark' ? 'Light' : 'Dark';
    button.setAttribute('aria-label', `Switch to ${preferred === 'dark' ? 'light' : 'dark'} theme`);
  });
};
applyTheme();
document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('spg-theme', next);
    applyTheme(next);
  });
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
    const existing = form.querySelector('.form-success');
    if (existing) existing.remove();
    const success = document.createElement('p');
    success.className = 'trust-note form-success';
    success.textContent = 'Saved in preview mode. Production persistence must write consent, preference, and suppression records before any message is sent.';
    form.append(success);
  });
});
document.querySelectorAll('[data-go-slug]').forEach((link) => {
  link.addEventListener('click', () => safeEvent('go_link_clicked', { offer_slug: link.getAttribute('data-go-slug') }));
});
