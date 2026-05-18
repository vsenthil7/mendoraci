/**
 * Migration 005 — CP-7 RT-005 Approval Workflow.
 *
 * - Adds `status` + `current_approval_id` to repair_plans (state machine column).
 * - Adds DB-009 approvals (audit trail of every transition).
 *
 * State machine guard is enforced at the route layer; the DB CHECK constraint
 * limits status to the 4 allowed values, but transition validity (e.g.
 * draft -> approved is illegal) is route logic so we can produce structured
 * 409 invalid_transition errors with prior_status + attempted_action.
 *
 * RLS FORCE on approvals; repair_plans already has RLS from CP-6.
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // ---- Extend repair_plans -------------------------------------------------
  pgm.addColumns('repair_plans', {
    status: {
      type: 'text',
      notNull: true,
      default: 'draft',
      check: "status IN ('draft','submitted','approved','rejected')",
    },
    current_approval_id: { type: 'uuid' },
  });
  pgm.createIndex('repair_plans', 'status');

  // ---- DB-009 approvals ----------------------------------------------------
  pgm.createTable('approvals', {
    approval_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    repair_plan_id: {
      type: 'uuid',
      notNull: true,
      references: '"repair_plans"',
      onDelete: 'CASCADE',
    },
    intake_id: { type: 'uuid', notNull: true, references: '"intake_meta"', onDelete: 'CASCADE' },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"', onDelete: 'RESTRICT' },
    action: {
      type: 'text',
      notNull: true,
      check: "action IN ('submit','approve','reject')",
    },
    prior_status: {
      type: 'text',
      notNull: true,
      check: "prior_status IN ('draft','submitted','approved','rejected')",
    },
    new_status: {
      type: 'text',
      notNull: true,
      check: "new_status IN ('draft','submitted','approved','rejected')",
    },
    actor: { type: 'varchar(128)', notNull: true },
    note: { type: 'text' },
    step_decisions: { type: 'jsonb', notNull: true, default: '[]' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('approvals', 'tenant_id');
  pgm.createIndex('approvals', 'repair_plan_id');
  pgm.createIndex('approvals', 'created_at');

  // ---- RLS policy ----------------------------------------------------------
  pgm.sql(`ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`ALTER TABLE approvals FORCE ROW LEVEL SECURITY;`);
  pgm.sql(
    `CREATE POLICY tenant_isolation_approvals ON approvals
       USING (tenant_id::text = current_setting('app.tenant_id', true))
       WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));`,
  );

  // FK from repair_plans.current_approval_id -> approvals.approval_id is
  // self-referential through approvals; we add it after approvals exists.
  pgm.addConstraint('repair_plans', 'repair_plans_current_approval_fk', {
    foreignKeys: {
      columns: 'current_approval_id',
      references: 'approvals(approval_id)',
      onDelete: 'SET NULL',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('repair_plans', 'repair_plans_current_approval_fk', { ifExists: true });
  pgm.dropTable('approvals', { ifExists: true, cascade: true });
  pgm.dropColumns('repair_plans', ['status', 'current_approval_id'], { ifExists: true });
};
