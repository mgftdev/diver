import { createApp } from './app.js';
import { config, assertConfig } from './config.js';
import { logger } from './lib/logger.js';

assertConfig(logger);

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info(`Double Take is up on http://localhost:${config.port} (${config.env})`);
});

const shutdown = (signal) => {
  logger.info(`${signal} received — closing server.`);
  server.close(() => process.exit(0));
  // Don't hang forever on a stuck keep-alive connection.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection:', reason));
