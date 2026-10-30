const grid = document.querySelector('#job-grid');
const status = document.querySelector('#status');
const searchInput = document.querySelector('#search');
const typeFilter = document.querySelector('#type-filter');
const resultCount = document.querySelector('#result-count');
const dialog = document.querySelector('#apply-dialog');
const form = document.querySelector('#application-form');
let requestController;
let debounceTimer;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function jobCard(job) {
  const skills = job.skills.map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('');
  const date = new Date(`${job.postedAt}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `<article class="job-card"><div class="job-card-top"><span class="job-type">${escapeHtml(job.type)}</span><span class="job-date">Posted ${escapeHtml(date)}</span></div><h3>${escapeHtml(job.title)}</h3><p class="company">${escapeHtml(job.company)}</p><p class="job-description">${escapeHtml(job.description)}</p><div class="job-meta"><span>⌖ ${escapeHtml(job.location)}</span></div><div class="job-card-bottom"><div class="skill-list">${skills}</div><button class="apply-button" type="button" data-apply="${escapeHtml(job.id)}">Apply <span aria-hidden="true">↗</span></button></div></article>`;
}
async function loadJobs() {
  if (requestController) requestController.abort();
  requestController = new AbortController();
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (typeFilter.value) params.set('type', typeFilter.value);
  grid.setAttribute('aria-busy', 'true');
  status.textContent = 'Finding opportunities…';
  status.classList.remove('error-state');
  try {
    const response = await fetch(`/api/internships?${params}`, { signal: requestController.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(response.status === 429 ? 'We’re getting lots of requests. Please wait a moment and try again.' : 'Opportunities could not load. Please try again.');
    const data = await response.json();
    grid.innerHTML = data.items.map(jobCard).join('');
    resultCount.textContent = `${data.total} ${data.total === 1 ? 'opportunity' : 'opportunities'}`;
    status.textContent = data.total ? '' : 'No matches just yet. Try another search or field.';
  } catch (error) {
    if (error.name === 'AbortError') return;
    grid.innerHTML = '';
    resultCount.textContent = '';
    status.textContent = error.message || 'Something went wrong. Please try again.';
    status.classList.add('error-state');
    const retry = document.createElement('button');
    retry.className = 'retry-button'; retry.type = 'button'; retry.textContent = 'Try again'; retry.addEventListener('click', loadJobs);
    status.append(' ', retry);
  } finally { grid.setAttribute('aria-busy', 'false'); }
}
searchInput.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(loadJobs, 250); });
typeFilter.addEventListener('change', loadJobs);
grid.addEventListener('click', event => {
  const button = event.target.closest('[data-apply]');
  if (!button) return;
  const job = [...grid.querySelectorAll('.job-card')].find(card => card.querySelector(`[data-apply="${CSS.escape(button.dataset.apply)}"]`));
  const title = job?.querySelector('h3')?.textContent || 'Selected opportunity';
  form.elements.internshipId.value = button.dataset.apply;
  document.querySelector('#selected-role').textContent = title;
  clearFormMessages();
  dialog.showModal();
  form.elements.fullName.focus();
});
function clearFormMessages() {
  form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
  const message = document.querySelector('#form-status');
  message.textContent = ''; message.className = 'form-status';
}
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
form.elements.coverLetter.addEventListener('input', event => { document.querySelector('#letter-count').textContent = event.target.value.length; });
form.addEventListener('submit', async event => {
  event.preventDefault(); clearFormMessages();
  if (!form.reportValidity()) return;
  const submit = form.querySelector('[type="submit"]');
  const formStatus = document.querySelector('#form-status');
  submit.disabled = true; submit.textContent = 'Sending…';
  const payload = Object.fromEntries(new FormData(form));
  try {
    const response = await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (response.status === 422) {
      for (const [field, message] of Object.entries(data.fields || {})) {
        const input = form.elements[field];
        const error = form.querySelector(`[data-error="${field}"]`);
        if (input && error) { input.setAttribute('aria-invalid', 'true'); error.textContent = message; }
      }
      formStatus.textContent = data.error || 'Please check your answers.';
      formStatus.classList.add('form-error');
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Your application could not be sent. Please try again.');
    formStatus.textContent = 'You’re in! Your application is safely in our demo inbox.';
    formStatus.classList.add('form-success');
    submit.textContent = 'Application received ✓';
    setTimeout(() => { dialog.close(); form.reset(); document.querySelector('#letter-count').textContent = '0'; submit.disabled = false; submit.innerHTML = 'Send my application <span aria-hidden="true">↗</span>'; }, 1800);
  } catch (error) {
    formStatus.textContent = error.message || 'Connection problem. Check your internet and try again.';
    formStatus.classList.add('form-error');
  } finally { if (submit.textContent === 'Sending…') { submit.disabled = false; submit.innerHTML = 'Send my application <span aria-hidden="true">↗</span>'; } }
});
loadJobs();
