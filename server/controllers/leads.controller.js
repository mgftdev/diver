import { leadSchema, formatIssues } from '../validators/lead.schema.js';
import * as leadsService from '../services/leads.service.js';
import { badRequest } from '../lib/errors.js';

export async function create(req, res) {
  const parsed = leadSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw badRequest('Some fields need fixing.', formatIssues(parsed.error));
  }

  const result = await leadsService.submitLead(parsed.data, {
    referer: req.get('referer'),
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({
    ok: true,
    id: result.id,
    message: 'Thanks — we reply within one working day.',
  });
}

export async function index(req, res) {
  const limit = Math.min(Number.parseInt(req.query.limit ?? '50', 10) || 50, 200);
  const offset = Math.max(Number.parseInt(req.query.offset ?? '0', 10) || 0, 0);

  const { items, total } = await leadsService.listLeads({ limit, offset });
  res.json({ ok: true, total, limit, offset, items });
}
