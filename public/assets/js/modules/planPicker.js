/**
 * The button on each plan card jumps to the booking form with that plan
 * already selected, so nobody has to re-state what they just clicked.
 */
export function initPlanPicker() {
  const select = document.querySelector('#lead-plan');
  const form = document.querySelector('#book');
  if (!select || !form) return;

  document.querySelectorAll('[data-plan]').forEach((button) => {
    button.addEventListener('click', () => {
      const plan = button.dataset.plan;
      if ([...select.options].some((option) => option.value === plan)) {
        select.value = plan;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }

      form.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Focus the first empty field once the scroll has settled.
      window.setTimeout(() => {
        const name = document.querySelector('#lead-name');
        if (name && !name.value) name.focus({ preventScroll: true });
      }, 500);
    });
  });
}
