import { Router } from 'express';
import * as controller from '../controllers/availability.controller.js';

export const availabilityRoutes = Router();

availabilityRoutes.get('/availability', controller.show);
