import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import pg from 'pg';

const { Pool } = pg;

export interface DbPluginOptions {
  connectionString: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    pg: pg.Pool;
    /**
     * Run a callback inside a transaction with RLS tenant_id set.
     * Every API handler that touches tenant data MUST use this.
     */
    withTenant<T>(
      tenantId: string,
      fn: (client: pg.PoolClient) => Promise<T>,
    ): Promise<T>;
  }
}

const dbPluginAsync: FastifyPluginAsync<DbPluginOptions> = async (app, opts) => {
  const pool = new Pool({
    connectionString: opts.connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Verify connection at startup.
  try {
    const c = await pool.connect();
    try {
      await c.query('SELECT 1');
    } finally {
      c.release();
    }
    app.log.info('Postgres pool ready');
  } catch (err) {
    app.log.error({ err }, 'Postgres connection failed at startup');
    throw err;
  }

  async function withTenant<T>(
    tenantId: string,
    fn: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // RLS: SET LOCAL is transaction-scoped and rolls back automatically.
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  app.decorate('pg', pool);
  app.decorate('withTenant', withTenant);

  app.addHook('onClose', async () => {
    await pool.end();
  });
};

export const dbPlugin = fp(dbPluginAsync, { name: 'db' });
