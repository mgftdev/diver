import { Router } from 'express';
import { healthRoutes } from './health.routes.js';
import { availabilityRoutes } from './availability.routes.js';
import { leadRoutes } from './leads.routes.js';

/** Everything here is mounted under /api by app.js. */
export const apiRoutes = Router();

apiRoutes.use(healthRoutes);
apiRoutes.use(availabilityRoutes);
apiRoutes.use(leadRoutes);
