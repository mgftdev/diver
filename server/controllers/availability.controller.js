import { getAvailability } from '../services/availability.service.js';

export async function show(req, res) {
  const availability = await getAvailability();
  res.set('cache-control', 'public, max-age=60');
  res.json({ ok: true, ...availability });
}
