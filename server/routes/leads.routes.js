import { Router } from 'express';
import * as controller from '../controllers/leads.controller.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { leadLimiter } from '../middleware/rateLimit.js';

export const leadRoutes = Router();

// Public: the booking form on the landing page.
leadRoutes.post('/leads', leadLimiter, controller.create);

// Private: the inbox at /admin.html.
leadRoutes.get('/leads', adminAuth, controller.index);
