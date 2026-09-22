import path from 'node:path';
import express from 'express';
import compression from 'compression';
import { config } from './config.js';
import { security } from './middleware/security.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRoutes } from './routes/index.js';
import { logger } from './lib/logger.js';

export function createApp() {
  const app = express();

  // Trust the first proxy so rate limiting sees the real client IP behind
  // nginx, Fly, Render and friends.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(security);
  app.use(compression());
  app.use(express.json({ limit: '32kb' }));

  if (!config.isProduction) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api')) {
          logger.info(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`);
        }
      });
      next();
    });
  }

  app.use('/api', apiLimiter, apiRoutes);

  // three.js for the dotted surface, served straight from the installed package so
  // the version is pinned by package.json and there is no copy to keep in sync.
  // three.module.js imports ./three.core.js, which resolves under the same prefix.
  app.use(
    '/vendor/three',
    express.static(path.join(config.paths.root, 'node_modules', 'three', 'build'), {
      maxAge: config.isProduction ? '30d' : 0,
      immutable: config.isProduction,
    }),
  );

  app.use(
    express.static(config.paths.public, {
      extensions: ['html'],
      maxAge: config.isProduction ? '1h' : 0,
      setHeaders(res, filePath) {
        // Hashed-free asset names: keep the CSS bundle fresh across deploys.
        if (filePath.endsWith('site.css')) res.setHeader('cache-control', 'no-cache');
      },
    }),
  );

  // Anything not an API route and not a file falls back to the landing page.
  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.accepts('html')) {
      res.sendFile(path.join(config.paths.public, 'index.html'));
      return;
    }
    next();
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
