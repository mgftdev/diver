import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const escapeHtml = (value = '') =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Posts a new lead into Telegram. Failures are logged and swallowed on
 * purpose: a notification outage must never lose the lead we already stored.
 */
export async function notifyNewLead(lead) {
  if (!config.telegram.enabled) return { sent: false, reason: 'disabled' };

  const lines = [
    '<b>New booking request</b>',
    `<b>Plan:</b> ${escapeHtml(lead.plan)}`,
    `<b>Name:</b> ${escapeHtml(lead.name)}`,
    `<b>Email:</b> ${escapeHtml(lead.email)}`,
    lead.profileUrl ? `<b>Profile:</b> ${escapeHtml(lead.profileUrl)}` : null,
    lead.message ? `\n${escapeHtml(lead.message)}` : null,
  ].filter(Boolean);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegram.chatId,
          text: lines.join('\n'),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      logger.warn('Telegram rejected the notification:', response.status, await response.text());
      return { sent: false, reason: `http_${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    logger.warn('Telegram notification failed:', error.message);
    return { sent: false, reason: 'network' };
  }
}
