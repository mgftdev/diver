import rateLimit from 'express-rate-limit';

/** Generous enough for a real person retrying a form, tight enough to bore a script. */
export const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    error: { code: 'rate_limited', message: 'Too many requests. Try again in a few minutes.' },
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
