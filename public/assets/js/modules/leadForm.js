import { api, ApiError } from './api.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mirrors server/validators/lead.schema.js so mistakes surface before a round trip. */
function validate(values) {
  const errors = {};

  if (values.name.trim().length < 2) errors.name = 'Tell us what to call you.';
  if (!EMAIL.test(values.email.trim())) errors.email = 'That email address looks wrong.';

  if (values.profileUrl.trim()) {
    try {
      new URL(values.profileUrl.trim());
    } catch {
      errors.profileUrl = 'Paste a full link, including https://';
    }
  }

  if (values.message.length > 1500) errors.message = 'Keep it under 1500 characters.';

  return errors;
}

export function initLeadForm() {
  const form = document.querySelector('#lead-form');
  if (!form) return;

  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[data-submit]');
  const submitLabel = form.querySelector('[data-submit-label]');
  const openedAt = Date.now();

  const setStatus = (message, tone = 'neutral') => {
    const tones = {
      neutral: 'text-mist',
      error: 'text-red-400',
      success: 'text-flare-hi',
    };
    status.textContent = message;
    status.className = `min-h-6 text-center text-[13.5px] ${tones[tone]}`;
  };

  const clearErrors = () => {
    form.querySelectorAll('[data-error-for]').forEach((hint) => {
      hint.hidden = true;
      hint.textContent = '';
    });
    form.querySelectorAll('.field-error').forEach((field) => {
      field.classList.remove('field-error');
      field.removeAttribute('aria-invalid');
    });
  };

  const showErrors = (errors) => {
    let first = null;

    Object.entries(errors).forEach(([field, message]) => {
      const hint = form.querySelector(`[data-error-for="${field}"]`);
      const input = form.elements[field];

      if (hint) {
        hint.textContent = message;
        hint.hidden = false;
      }
      if (input) {
        input.classList.add('field-error');
        input.setAttribute('aria-invalid', 'true');
        first ??= input;
      }
    });

    first?.focus();
  };

  // Clear a field's error as soon as the person starts fixing it.
  form.addEventListener('input', (event) => {
    const field = event.target;
    if (!field.name) return;
    field.classList.remove('field-error');
    field.removeAttribute('aria-invalid');
    const hint = form.querySelector(`[data-error-for="${field.name}"]`);
    if (hint) hint.hidden = true;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();

    const values = {
      name: form.elements.name.value,
      email: form.elements.email.value,
      profileUrl: form.elements.profileUrl.value,
      plan: form.elements.plan.value,
      message: form.elements.message.value,
      honeypot: form.elements.honeypot.value,
      elapsedMs: Date.now() - openedAt,
    };

    const errors = validate(values);
    if (Object.keys(errors).length > 0) {
      showErrors(errors);
      setStatus('Check the highlighted fields.', 'error');
      return;
    }

    submit.disabled = true;
    submitLabel.textContent = 'Sending…';
    setStatus('');

    try {
      const result = await api.submitLead(values);

      form.reset();
      setStatus(result.message ?? 'Thanks — we reply within one working day.', 'success');
      submitLabel.textContent = 'Request sent';
      submit.disabled = true;
    } catch (error) {
      submit.disabled = false;
      submitLabel.textContent = 'Request a set';

      if (error instanceof ApiError && error.details?.length) {
        showErrors(Object.fromEntries(error.details.map((d) => [d.field, d.message])));
        setStatus('Check the highlighted fields.', 'error');
        return;
      }

      setStatus(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong. Write to hi@doubletake.studio instead.',
        'error',
      );
    }
  });
}
