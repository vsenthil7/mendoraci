/**
 * Migration 001 — CP-2 RT-001 / RT-008 / RT-013 / RT-015 foundation.
 * Anchored to docs/MendoraCI_DataModelERD.md §2-§6.
 *
 * Creates: tenants, raw_intake (DB-001), intake_meta (DB-002), idempotency_keys.
 * Enables RLS FORCE with `app.tenant_id` GUC pattern.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createExtension('uuid-ossp', { ifNotExists: true });
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // ---- tenants --------------------------------------------------------------
  pgm.createTable('tenants', {
    tenant_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(256)', notNull: true },
    region: { type: 'varchar(32)', notNull: true, default: 'us-east-1' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // ---- raw_intake (DB-001) --------------------------------------------------
  pgm.createTable('raw_intake', {
    intake_id: { type: 'uuid', primaryKey: true },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"', onDelete: 'RESTRICT' },
    body_masked: { type: 'text', notNull: true },
    mask_policy_version: { type: 'varchar(16)', notNull: true },
    received_at: { type: 'timestamptz', notNull: true },
    provider: {
      type: 'text',
      notNull: true,
      check: "provider IN ('github','jenkins','circleci','gitlab','buildkite')",
    },
    size_bytes: { type: 'bigint', notNull: true, check: 'size_bytes >= 0' },
    lineage_chain: { type: 'jsonb', notNull: true, default: '{}' },
  });
  pgm.createIndex('raw_intake', 'tenant_id');
  pgm.createIndex('raw_intake', 'received_at');
  pgm.createIndex('raw_intake', 'lineage_chain', { method: 'gin' });

  // ---- intake_meta (DB-002) -------------------------------------------------
  pgm.createTable('intake_meta', {
    intake_id: {
      type: 'uuid',
      primaryKey: true,
      references: '"raw_intake"',
      onDelete: 'CASCADE',
    },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"', onDelete: 'RESTRICT' },
    provider: { type: 'text', notNull: true },
    run_id: { type: 'varchar(256)', notNull: true },
    attempt_id: { type: 'varchar(64)', notNull: true },
    repo_url: { type: 'text' },
    branch: { type: 'varchar(256)' },
    commit_sha: { type: 'varchar(64)' },
    actor: { type: 'varchar(128)' },
    size_bytes: { type: 'bigint', notNull: true },
    received_at: { type: 'timestamptz', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      check:
        "status IN ('received','masking','masked','classifying','rca-done','plan-ready','awaiting-approval','approved','rejected','exported','blocked')",
    },
    input_sha256: { type: 'varchar(64)', notNull: true },
    output_sha256: { type: 'varchar(64)', notNull: true },
  });
  pgm.createIndex('intake_meta', 'tenant_id');

  // ---- idempotency_keys (RT-015) -------------------------------------------
  pgm.createTable('idempotency_keys', {
    id: { type: 'bigserial', primaryKey: true },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"', onDelete: 'RESTRICT' },
    idempotency_key: { type: 'varchar(256)', notNull: true },
    dedupe_key: { type: 'varchar(512)', notNull: true },
    intake_id: { type: 'uuid', notNull: true, references: '"raw_intake"', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    expires_at: { type: 'timestamptz', notNull: true },
  });
  pgm.sql(
    `CREATE UNIQUE INDEX idempotency_keys_active_uq
       ON idempotency_keys (tenant_id, dedupe_key)
       WHERE expires_at > '2026-01-01'::timestamptz`,
  );
  pgm.createIndex('idempotency_keys', 'expires_at');

  // ---- RLS policies --------------------------------------------------------
  for (const t of ['raw_intake', 'intake_meta', 'idempotency_keys']) {
    pgm.sql(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
    pgm.sql(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY;`);
    pgm.sql(
      `CREATE POLICY tenant_isolation_${t} ON ${t}
         USING (tenant_id::text = current_setting('app.tenant_id', true))
         WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));`,
    );
  }
};

exports.down = (pgm) => {
  for (const t of ['idempotency_keys', 'intake_meta', 'raw_intake', 'tenants']) {
    pgm.dropTable(t, { ifExists: true, cascade: true });
  }
};
