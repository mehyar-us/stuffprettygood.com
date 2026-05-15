
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
