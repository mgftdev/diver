import crypto from 'node:crypto';
import { config } from '../config.js';
import { unauthorized } from '../lib/errors.js';

/** Constant-time compare so the token cannot be guessed by timing the response. */
function matches(candidate, expected) {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function adminAuth(req, res, next) {
  const expected = config.admin.token;
  if (!expected) throw unauthorized('Admin access is not configured on this server.');

  const header = req.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const provided = req.get('x-admin-token') || bearer;

  if (!provided || !matches(provided, expected)) throw unauthorized();

  next();
}
