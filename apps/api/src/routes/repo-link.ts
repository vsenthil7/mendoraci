/**
 * Repo Linking routes — API-003.
 *
 * Anchors:
 *   - RT-002 Repo Linking (BR-002)
 *   - RT-013 Multi-Tenant Isolation (RLS via withTenant)
 *   - RT-014 Role/Permission (CP-10; for now, any tenant member can link)
 *   - DB-003 repo_links, DB-004 repo_commits
 *
 * Test anchors:
 *   - TEST-005 happy link with 3 commits -> 201
 *   - TEST-006 duplicate link -> 409 repo_already_linked
 *   - TEST-007 cross-tenant -> 404 intake_not_found (RLS)
 *
 * Endpoints:
 *   POST /v1/intake/:id/link-repo
 *   GET  /v1/intake/:id/repo
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  RepoLinkRequestV1,
  RepoLinkResponseV1,
  RepoLinkDetailV1,
} from '@mendoraci/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function err400(reply: any, code: string, message: string) {
  return reply.code(400).type('application/json').send({ error: { code, message } });
}
function err404(reply: any, code: string, message: string) {
  return reply.code(404).type('application/json').send({ error: { code, message } });
}
function err409(reply: any, code: string, message: string) {
  return reply.code(409).type('application/json').send({ error: { code, message } });
}
function err422Zod(
  reply: any,
  issues: ReadonlyArray<{ path: (string | number)[]; message: string }>,
) {
  return reply.code(422).type('application/json').send({
    error: {
      code: 'validation_failed',
      message: 'request_body_invalid',
      validation_errors: issues.map((i) => ({
        path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
        message: String(i.message ?? ''),
      })),
    },
  });
}

export const repoLinkRoutes: FastifyPluginAsync = async (app) => {
  // ---------------------------------------------------------------------------
  // POST /v1/intake/:id/link-repo
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/intake/:id/link-repo',
    async (request, reply) => {
      const { id: intakeId } = request.params;
      if (!UUID_RE.test(intakeId)) {
        return err400(reply, 'invalid_intake_id', 'intake_id must be a UUID');
      }

      const parsed = RepoLinkRequestV1.safeParse(request.body);
      if (!parsed.success) {
        return err422Zod(reply, parsed.error.issues);
      }
      const body = parsed.data;

      try {
        const result = await app.withTenant(request.tenantId, async (client) => {
          // 1. Intake must exist for this tenant. RLS makes cross-tenant rows invisible.
          const intakeCheck = await client.query<{ intake_id: string }>(
            `SELECT intake_id FROM intake_meta WHERE intake_id = $1 LIMIT 1`,
            [intakeId],
          );
          if (intakeCheck.rowCount === 0) {
            return { kind: 'not_found' as const };
          }

          // 2. Already linked? -> 409
          const existing = await client.query<{ repo_link_id: string }>(
            `SELECT repo_link_id FROM repo_links WHERE intake_id = $1 LIMIT 1`,
            [intakeId],
          );
          if (existing.rowCount && existing.rowCount > 0) {
            return { kind: 'conflict' as const };
          }

          // 3. Insert repo_link
          const linkRow = await client.query<{
            repo_link_id: string;
            linked_at: Date;
          }>(
            `INSERT INTO repo_links (intake_id, tenant_id, repo_provider, repo_url, default_branch)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING repo_link_id, linked_at`,
            [
              intakeId,
              request.tenantId,
              body.repo_provider,
              body.repo_url,
              body.default_branch ?? null,
            ],
          );
          const repoLinkId = linkRow.rows[0]!.repo_link_id;
          const linkedAt = linkRow.rows[0]!.linked_at;

          // 4. Insert commits (if any)
          let commitsCaptured = 0;
          if (body.commits && body.commits.length > 0) {
            for (const c of body.commits) {
              await client.query(
                `INSERT INTO repo_commits
                   (repo_link_id, intake_id, tenant_id, commit_sha, message, author, authored_at, parents)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                  repoLinkId,
                  intakeId,
                  request.tenantId,
                  c.commit_sha.toLowerCase(),
                  c.message,
                  c.author,
                  c.authored_at ?? null,
                  JSON.stringify(c.parents ?? []),
                ],
              );
              commitsCaptured++;
            }
          }

          return {
            kind: 'ok' as const,
            repoLinkId,
            linkedAt,
            commitsCaptured,
          };
        });

        if (result.kind === 'not_found') {
          return err404(reply, 'intake_not_found', 'no intake found for this id');
        }
        if (result.kind === 'conflict') {
          return err409(
            reply,
            'repo_already_linked',
            'this intake already has a repo link; unlink first to replace',
          );
        }

        const response = RepoLinkResponseV1.parse({
          repo_link_id: result.repoLinkId,
          intake_id: intakeId,
          repo_provider: body.repo_provider,
          repo_url: body.repo_url,
          default_branch: body.default_branch ?? null,
          linked_at: result.linkedAt.toISOString(),
          commits_captured: result.commitsCaptured,
        });
        return reply.code(201).send(response);
      } catch (e: any) {
        // Defensive: race on the UNIQUE(intake_id) -> map to 409 envelope
        if (e?.code === '23505') {
          return err409(reply, 'repo_already_linked', 'this intake already has a repo link');
        }
        throw e;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // GET /v1/intake/:id/repo
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/intake/:id/repo', async (request, reply) => {
    const { id: intakeId } = request.params;
    if (!UUID_RE.test(intakeId)) {
      return err400(reply, 'invalid_intake_id', 'intake_id must be a UUID');
    }

    const detail = await app.withTenant(request.tenantId, async (client) => {
      const link = await client.query<{
        repo_link_id: string;
        intake_id: string;
        repo_provider: string;
        repo_url: string;
        default_branch: string | null;
        linked_at: Date;
      }>(
        `SELECT repo_link_id, intake_id, repo_provider, repo_url, default_branch, linked_at
         FROM repo_links WHERE intake_id = $1 LIMIT 1`,
        [intakeId],
      );
      if (link.rowCount === 0) return null;

      const commits = await client.query<{
        commit_sha: string;
        message: string;
        author: string;
        authored_at: Date | null;
        parents: string[];
      }>(
        `SELECT commit_sha, message, author, authored_at, parents
         FROM repo_commits
         WHERE repo_link_id = $1
         ORDER BY authored_at DESC NULLS LAST, captured_at DESC`,
        [link.rows[0]!.repo_link_id],
      );

      return {
        link: link.rows[0]!,
        commits: commits.rows,
      };
    });

    if (!detail) {
      return err404(reply, 'repo_link_not_found', 'no repo link found for this intake');
    }

    const out = RepoLinkDetailV1.parse({
      repo_link_id: detail.link.repo_link_id,
      intake_id: detail.link.intake_id,
      repo_provider: detail.link.repo_provider,
      repo_url: detail.link.repo_url,
      default_branch: detail.link.default_branch,
      linked_at: detail.link.linked_at.toISOString(),
      commits: detail.commits.map((c) => ({
        commit_sha: c.commit_sha,
        message: c.message,
        author: c.author,
        authored_at: c.authored_at ? c.authored_at.toISOString() : null,
        parents: Array.isArray(c.parents) ? c.parents : [],
      })),
    });
    return reply.code(200).send(out);
  });
};
