import { config } from '../config.js';
import * as repository from '../repositories/leads.repository.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Capacity for the current month: total slots from config, minus the leads
 * already marked "booked" in the store. The hero and the form both read this
 * so the number on the page is never a hard-coded lie.
 */
export async function getAvailability() {
  const booked = await repository.countBookedThisMonth();
  const total = config.capacity.monthlySlots;
  const slotsLeft = Math.max(total - booked, 0);
  const now = new Date();

  return {
    month: MONTHS[now.getUTCMonth()],
    year: now.getUTCFullYear(),
    totalSlots: total,
    slotsLeft,
    acceptingWork: slotsLeft > 0,
  };
}
