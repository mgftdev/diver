import { Router } from 'express';

export const healthRoutes = Router();

healthRoutes.get('/health', (req, res) => {
  res.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
