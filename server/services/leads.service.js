import * as repository from '../repositories/leads.repository.js';
import { notifyNewLead } from './notifier.service.js';
import { badRequest } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/** A form filled faster than this was almost certainly not filled by hand. */
const MIN_FILL_MS = 1200;

export async function submitLead(input, context = {}) {
  if (input.honeypot) throw badRequest('Rejected.');
  if (typeof input.elapsedMs === 'number' && input.elapsedMs < MIN_FILL_MS) {
    throw badRequest('That was too quick — please try again.');
  }

  const lead = await repository.create({
    name: input.name,
    email: input.email,
    profileUrl: input.profileUrl || null,
    plan: input.plan,
    message: input.message || null,
    status: 'new',
    source: context.referer ?? 'direct',
    userAgent: context.userAgent ?? null,
  });

  logger.info(`Lead stored ${lead.id} (${lead.plan})`);

  // Fire and forget: the client is not kept waiting on Telegram.
  void notifyNewLead(lead);

  return { id: lead.id, createdAt: lead.createdAt };
}

export function listLeads({ limit, offset }) {
  return repository.list({ limit, offset });
}
