/**
 * Migration 004 — CP-6 RT-004 Repair Plan.
 * Anchored to docs/MendoraCI_DataModelERD.md (DB-007 repair_plans, DB-008 repair_steps).
 *
 * - repair_plans is one most-recent-per-intake (multiple allowed for audit
 *   trail, GET returns the most recent like rca_findings).
 * - repair_steps is many-to-one with rank ordering.
 * - Both tables have tenant_id with RLS FORCE matching RT-013 pattern proven
 *   correct in CP-4b and re-proven in CP-5 (TEST-007 + TEST-009).
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // ---- DB-007 repair_plans -------------------------------------------------
  pgm.createTable('repair_plans', {
    repair_plan_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    rca_finding_id: {
      type: 'uuid',
      notNull: true,
      references: '"rca_findings"',
      onDelete: 'CASCADE',
    },
    intake_id: {
      type: 'uuid',
      notNull: true,
      references: '"intake_meta"',
      onDelete: 'CASCADE',
    },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"', onDelete: 'RESTRICT' },
    provider: {
      type: 'text',
      notNull: true,
      check: "provider IN ('bob','mock-bob')",
    },
    model_id: { type: 'varchar(128)', notNull: true },
    summary: { type: 'text', notNull: true },
    overall_risk: {
      type: 'text',
      notNull: true,
      check: "overall_risk IN ('low','medium','high')",
    },
    rollback_strategy: { type: 'text', notNull: true },
    est_total_effort: {
      type: 'text',
      notNull: true,
      check: "est_total_effort IN ('XS','S','M','L','XL')",
    },
    raw_model_output: { type: 'text' },
    bob_latency_ms: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    created_by: { type: 'varchar(128)' },
  });
  pgm.createIndex('repair_plans', 'tenant_id');
  pgm.createIndex('repair_plans', 'intake_id');
  pgm.createIndex('repair_plans', 'rca_finding_id');

  // ---- DB-008 repair_steps -------------------------------------------------
  pgm.createTable('repair_steps', {
    step_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    repair_plan_id: {
      type: 'uuid',
      notNull: true,
      references: '"repair_plans"',
      onDelete: 'CASCADE',
    },
    intake_id: { type: 'uuid', notNull: true, references: '"intake_meta"', onDelete: 'CASCADE' },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"', onDelete: 'RESTRICT' },
    rank: { type: 'integer', notNull: true, default: 0 },
    title: { type: 'varchar(256)', notNull: true },
    description: { type: 'text', notNull: true },
    step_type: {
      type: 'text',
      notNull: true,
      check:
        "step_type IN ('code-edit','config-change','infra-change','rollback','investigation','dependency-update','test-add','other')",
    },
    files: { type: 'jsonb', notNull: true, default: '[]' },
    est_effort: {
      type: 'text',
      notNull: true,
      check: "est_effort IN ('XS','S','M','L','XL')",
    },
    risk: {
      type: 'text',
      notNull: true,
      check: "risk IN ('low','medium','high')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('repair_steps', 'tenant_id');
  pgm.createIndex('repair_steps', 'repair_plan_id');

  // ---- RLS policies (matches RT-013 pattern) -------------------------------
  for (const t of ['repair_plans', 'repair_steps']) {
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
  pgm.dropTable('repair_steps', { ifExists: true, cascade: true });
  pgm.dropTable('repair_plans', { ifExists: true, cascade: true });
};
