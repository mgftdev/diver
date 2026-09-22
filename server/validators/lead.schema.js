import { z } from 'zod';

export const PLANS = ['take', 'scene', 'premiere', 'one-off', 'not-sure'];

/** Shape of POST /api/leads. Trimmed and length-capped before it reaches the store. */
export const leadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Tell us what to call you.')
    .max(80, 'That name is too long.'),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('That email address looks wrong.')
    .max(160),

  profileUrl: z
    .string()
    .trim()
    .url('Paste a full link, including https://')
    .max(300)
    .optional()
    .or(z.literal('')),

  plan: z.enum(PLANS, { message: 'Pick one of the plans.' }),

  message: z
    .string()
    .trim()
    .max(1500, 'Keep it under 1500 characters.')
    .optional()
    .or(z.literal('')),

  // Anti-spam, never shown to a human. A filled honeypot or a form submitted
  // faster than a person can type both look like a bot.
  honeypot: z.string().max(0, 'Rejected.').optional().or(z.literal('')),
  elapsedMs: z.coerce.number().int().nonnegative().optional(),
});

export function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '_form',
    message: issue.message,
  }));
}
