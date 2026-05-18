/**
 * MendoraCI API — Fastify entrypoint.
 *
 * Anchors:
 *   - RT-001 CI Log Intake (API-001, API-002)
 *   - RT-002 Repo Linking (API-003) — CP-4
 *   - RT-003 Root-Cause Analysis (API-004) — CP-5
 *   - RT-004 Repair Plan (API-005) — CP-6
 *   - RT-005 Approval Workflow (API-006..008) — CP-7
 *   - RT-006 Evidence Export (API-009) — CP-8
 *   - CP-9 List endpoints (API-010..014) — Intakes, RCA, Plans, Approvals, Evidence-exports
 *   - RT-008 Mask Policy v1 pre-persist (BR-008, mandatory)
 *   - RT-013 Multi-Tenant Isolation (RLS via SET LOCAL app.tenant_id)
 *   - RT-015 Idempotency & Replay (Idempotency-Key header required on writes)
 */
import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { intakeRoutes } from './routes/intake.js';
import { repoLinkRoutes } from './routes/repo-link.js';
import { rcaRoutes } from './routes/rca.js';
import { repairPlanRoutes } from './routes/repair-plan.js';
import { approvalRoutes } from './routes/approval.js';
import { evidenceExportRoutes } from './routes/evidence-export.js';
import { intakesListRoutes } from './routes/intakes-list.js';
import { rcaListRoutes } from './routes/rca-list.js';
import { healthRoutes } from './routes/health.js';
import { dbPlugin } from './lib/db.js';
import { tenantContextPlugin } from './middleware/tenant-context.js';
import { errorHandler } from './middleware/error-handler.js';

export interface AppConfig {
  databaseUrl: string;
  port: number;
  host: string;
  logLevel: string;
  maskPolicyVersion: string;
}

export function loadConfig(): AppConfig {
  return {
    databaseUrl: process.env.DATABASE_URL ?? '',
    port: Number(process.env.API_PORT ?? 4000),
    host: process.env.API_HOST ?? '0.0.0.0',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    maskPolicyVersion: process.env.MASK_POLICY_VERSION ?? 'v1.0.0',
  };
}

export async function buildApp(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    bodyLimit: 100 * 1024 * 1024,
    trustProxy: true,
  });

  app.decorate('config', config);

  await app.register(sensible);
  await app.register(dbPlugin, { connectionString: config.databaseUrl });
  await app.register(tenantContextPlugin);
  await app.register(healthRoutes);
  await app.register(intakeRoutes, { prefix: '/v1' });
  await app.register(repoLinkRoutes, { prefix: '/v1' });
  await app.register(rcaRoutes, { prefix: '/v1' });
  await app.register(repairPlanRoutes, { prefix: '/v1' });
  await app.register(approvalRoutes, { prefix: '/v1' });
  await app.register(evidenceExportRoutes, { prefix: '/v1' });
  await app.register(intakesListRoutes, { prefix: '/v1' });
  await app.register(rcaListRoutes, { prefix: '/v1' });

  app.setErrorHandler(errorHandler);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

/* c8 ignore start -- entrypoint, exercised via docker compose up not unit tests */
async function main() {
  const config = loadConfig();
  const app = await buildApp(config);
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`MendoraCI API listening on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
/* c8 ignore stop */
