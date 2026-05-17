import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    let dbOk = false;
    try {
      const c = await app.pg.connect();
      try {
        await c.query('SELECT 1');
        dbOk = true;
      } finally {
        c.release();
      }
    } catch {
      dbOk = false;
    }
    return {
      status: dbOk ? 'ok' : 'degraded',
      service: 'mendoraci-api',
      version: '0.1.0',
      db: dbOk ? 'ok' : 'down',
      mask_policy_version: app.config.maskPolicyVersion,
      time: new Date().toISOString(),
    };
  });
};
