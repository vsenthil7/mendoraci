/**
 * Migration 003 — CP-5 RT-003 Root-Cause Analysis.
 * Anchored to docs/MendoraCI_DataModelERD.md (DB-005 rca_findings, DB-006 rca_evidence).
 *
 * - rca_findings is one finding per (intake_id, provider, model_id) - re-running RCA
 *   with the same model produces a new finding row (immutable audit trail).
 * - rca_evidence is the per-snippet table referenced by rca_findings.
 * - Both tables have tenant_id with RLS FORCE matching RT-013 pattern proven in CP-4b.
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // ---- DB-005 rca_findings -------------------------------------------------
  pgm.createTable('rca_findings', {
    rca_finding_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
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
    root_cause: { type: 'text', notNull: true },
    confidence: {
      type: 'text',
      notNull: true,
      check: "confidence IN ('low','medium','high')",
    },
    recommended_actions: { type: 'jsonb', notNull: true, default: '[]' },
    raw_model_output: { type: 'text' },
    bob_latency_ms: { type: 'integer', notNull: true, default: 0 },
    prompt_tokens: { type: 'integer' },
    output_tokens: { type: 'integer' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    created_by: { type: 'varchar(128)' },
  });
  pgm.createIndex('rca_findings', 'tenant_id');
  pgm.createIndex('rca_findings', 'intake_id');

  // ---- DB-006 rca_evidence -------------------------------------------------
  pgm.createTable('rca_evidence', {
    evidence_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    rca_finding_id: {
      type: 'uuid',
      notNull: true,
      references: '"rca_findings"',
      onDelete: 'CASCADE',
    },
    intake_id: { type: 'uuid', notNull: true, references: '"intake_meta"', onDelete: 'CASCADE' },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"', onDelete: 'RESTRICT' },
    snippet: { type: 'text', notNull: true },
    source: {
      type: 'text',
      notNull: true,
      check: "source IN ('masked_log','commit_message','commit_diff')",
    },
    rank: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('rca_evidence', 'tenant_id');
  pgm.createIndex('rca_evidence', 'rca_finding_id');

  // ---- RLS policies (matches RT-013 pattern) -------------------------------
  for (const t of ['rca_findings', 'rca_evidence']) {
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
  pgm.dropTable('rca_evidence', { ifExists: true, cascade: true });
  pgm.dropTable('rca_findings', { ifExists: true, cascade: true });
};
