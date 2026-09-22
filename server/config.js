import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 3000),

  paths: {
    root: rootDir,
    public: path.join(rootDir, 'public'),
    data: path.join(rootDir, 'data'),
    leads: path.join(rootDir, 'data', 'leads.ndjson'),
  },

  admin: {
    token: process.env.ADMIN_TOKEN ?? '',
  },

  capacity: {
    monthlySlots: toInt(process.env.MONTHLY_SLOTS, 4),
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    chatId: process.env.TELEGRAM_CHAT_ID ?? '',
    get enabled() {
      return Boolean(this.botToken && this.chatId);
    },
  },

  get isProduction() {
    return this.env === 'production';
  },
};

export function assertConfig(logger) {
  if (!config.admin.token) {
    logger.warn('ADMIN_TOKEN is empty — the lead inbox endpoint will refuse every request.');
  }
  if (config.isProduction && config.admin.token === 'change-me-before-deploying') {
    throw new Error('Refusing to start in production with the example ADMIN_TOKEN.');
  }
  if (!config.telegram.enabled) {
    logger.info('Telegram notifications are off (no bot token or chat id).');
  }
}
