import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Tenant context middleware.
 *
 * For CP-2 (RT-001 happy path) we accept the tenant_id from a header
 *   X-Tenant-Id: <uuid>
 * as the minimum viable surface. Real JWT-based auth lands in CP-5 (RT-013/014).
 *
 * This middleware:
 *   1. Reads X-Tenant-Id from the request.
 *   2. Validates it as a UUID.
 *   3. Attaches it to request.tenantId for handlers + db.withTenant().
 *
 * Anchors: RT-013 Multi-Tenant Isolation, RT-014 Role/Permission Model (stub).
 */

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

const tenantContextAsync: FastifyPluginAsync = async (app) => {
  app.decorateRequest('tenantId', '');

  app.addHook('preHandler', async (request: FastifyRequest) => {
    // Health endpoint is exempt.
    if (request.url === '/health' || request.url.startsWith('/health?')) return;

    const headerTenant = request.headers['x-tenant-id'];
    const value = Array.isArray(headerTenant) ? headerTenant[0] : headerTenant;

    if (!value || typeof value !== 'string' || !isUuid(value)) {
      throw app.httpErrors.unauthorized('missing_or_invalid_tenant_id');
    }

    request.tenantId = value;
  });
};

export const tenantContextPlugin = fp(tenantContextAsync, { name: 'tenant-context' });
