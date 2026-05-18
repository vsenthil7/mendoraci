/**
 * Migration 006 — CP-8 RT-006 Evidence Export.
 * Anchored to docs/MendoraCI_DataModelERD.md (DB-010 evidence_exports).
 *
 * One export row per call; multiple exports per intake allowed for audit.
 * RLS FORCE on tenant_id matching the proven RT-013 pattern.
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('evidence_exports', {
    evidence_export_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    intake_id: {
      type: 'uuid',
      notNull: true,
      references: '"intake_meta"',
      onDelete: 'CASCADE',
    },
    repair_plan_id: {
      type: 'uuid',
      notNull: true,
      references: '"repair_plans"',
      onDelete: 'CASCADE',
    },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"', onDelete: 'RESTRICT' },
    s3_bucket: { type: 'varchar(128)', notNull: true },
    s3_key: { type: 'varchar(512)', notNull: true },
    sha256: { type: 'varchar(64)', notNull: true, check: "sha256 ~ '^[0-9a-f]{64}$'" },
    byte_size: { type: 'bigint', notNull: true, check: 'byte_size >= 0' },
    manifest: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    created_by: { type: 'varchar(128)' },
  });
  pgm.createIndex('evidence_exports', 'tenant_id');
  pgm.createIndex('evidence_exports', 'intake_id');
  pgm.createIndex('evidence_exports', 'repair_plan_id');
  pgm.createIndex('evidence_exports', 'created_at');

  pgm.sql(`ALTER TABLE evidence_exports ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`ALTER TABLE evidence_exports FORCE ROW LEVEL SECURITY;`);
  pgm.sql(
    `CREATE POLICY tenant_isolation_evidence_exports ON evidence_exports
       USING (tenant_id::text = current_setting('app.tenant_id', true))
       WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));`,
  );
};

exports.down = (pgm) => {
  pgm.dropTable('evidence_exports', { ifExists: true, cascade: true });
};
