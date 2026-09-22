import { api } from './api.js';

/**
 * The hero and the form both claim how many slots are left this month.
 * The markup ships with a sensible number so the page is never blank, and
 * this replaces it with what the server actually says.
 */
export async function initAvailability() {
  const monthEl = document.querySelector('[data-availability-month]');
  const slotsEl = document.querySelector('[data-availability-slots]');
  if (!monthEl && !slotsEl) return;

  try {
    const data = await api.availability();

    if (monthEl) monthEl.textContent = data.month;
    if (slotsEl) slotsEl.textContent = String(data.slotsLeft);

    if (!data.acceptingWork) {
      const status = document.querySelector('[data-form-status]');
      if (status) {
        status.textContent = `${data.month} is full — requests now go on the waiting list for next month.`;
        status.className = 'min-h-6 text-center text-[13.5px] text-flare-hi';
      }
    }
  } catch {
    // Keep whatever the HTML shipped with; a dead endpoint is not worth an
    // error message in the hero.
  }
}
