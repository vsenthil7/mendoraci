/**
 * Migration 002 — CP-4 RT-002 Repo Linking.
 * Anchored to docs/MendoraCI_DataModelERD.md (DB-003 repo_links, DB-004 repo_commits).
 *
 * - repo_links is one-to-one with intake_id (FK + UNIQUE), so re-linking the same
 *   intake to a different repo is a 409 conflict (TEST-006).
 * - repo_commits is many-to-one to repo_links. Unique (repo_link_id, commit_sha).
 * - Both tables have tenant_id with RLS FORCE matching RT-013 pattern.
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // ---- DB-003 repo_links ---------------------------------------------------
  pgm.createTable('repo_links', {
    repo_link_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    intake_id: {
      type: 'uuid',
      notNull: true,
      references: '"intake_meta"',
      onDelete: 'CASCADE',
    },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"', onDelete: 'RESTRICT' },
    repo_provider: {
      type: 'text',
      notNull: true,
      check: "repo_provider IN ('github','gitlab','bitbucket','azure-devops')",
    },
    repo_url: { type: 'varchar(2048)', notNull: true },
    default_branch: { type: 'varchar(256)' },
    linked_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    linked_by: { type: 'varchar(128)' },
  });
  pgm.createIndex('repo_links', 'tenant_id');
  // One repo link per intake (TEST-006 dup → 409).
  pgm.addConstraint('repo_links', 'repo_links_intake_uq', { unique: ['intake_id'] });

  // ---- DB-004 repo_commits -------------------------------------------------
  pgm.createTable('repo_commits', {
    repo_commit_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    repo_link_id: {
      type: 'uuid',
      notNull: true,
      references: '"repo_links"',
      onDelete: 'CASCADE',
    },
    intake_id: { type: 'uuid', notNull: true, references: '"intake_meta"', onDelete: 'CASCADE' },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"', onDelete: 'RESTRICT' },
    commit_sha: { type: 'varchar(64)', notNull: true },
    message: { type: 'text', notNull: true },
    author: { type: 'varchar(256)', notNull: true },
    authored_at: { type: 'timestamptz' },
    parents: { type: 'jsonb', notNull: true, default: '[]' },
    captured_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('repo_commits', 'tenant_id');
  pgm.createIndex('repo_commits', 'repo_link_id');
  pgm.addConstraint('repo_commits', 'repo_commits_link_sha_uq', {
    unique: ['repo_link_id', 'commit_sha'],
  });

  // ---- RLS policies --------------------------------------------------------
  for (const t of ['repo_links', 'repo_commits']) {
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
  pgm.dropTable('repo_commits', { ifExists: true, cascade: true });
  pgm.dropTable('repo_links', { ifExists: true, cascade: true });
};
