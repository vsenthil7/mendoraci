import { z } from 'zod';

/**
 * MendoraCI shared schemas — Repo Linking (RT-002).
 * Anchored to docs/MendoraCI_APIContractSpec.md and docs/MendoraCI_DataModelERD.md.
 */

export const RepoProviderEnum = z.enum(['github', 'gitlab', 'bitbucket', 'azure-devops']);
export type RepoProvider = z.infer<typeof RepoProviderEnum>;

// API-003 POST /v1/intake/:id/link-repo  request
export const RepoLinkRequestV1 = z.object({
  repo_provider: RepoProviderEnum,
  repo_url: z.string().url().max(2048),
  default_branch: z.string().min(1).max(256).optional(),
  // Optional structured commit metadata captured at link time.
  // Real implementation would fetch via provider API in CP-5; for CP-4
  // we accept the client-supplied snapshot for unit-testable behaviour.
  commits: z
    .array(
      z.object({
        commit_sha: z
          .string()
          .min(7)
          .max(64)
          .regex(/^[0-9a-f]+$/i, 'commit_sha must be hex'),
        message: z.string().max(8192),
        author: z.string().max(256),
        authored_at: z.string().datetime().optional(),
        parents: z.array(z.string()).max(8).optional(),
      }),
    )
    .max(50)
    .optional(),
});
export type RepoLinkRequest = z.infer<typeof RepoLinkRequestV1>;

export const RepoLinkResponseV1 = z.object({
  repo_link_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  repo_provider: RepoProviderEnum,
  repo_url: z.string().url(),
  default_branch: z.string().nullable(),
  linked_at: z.string(),
  commits_captured: z.number().int().nonnegative(),
});
export type RepoLinkResponse = z.infer<typeof RepoLinkResponseV1>;

// GET /v1/intake/:id/repo
export const RepoLinkDetailV1 = z.object({
  repo_link_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  repo_provider: RepoProviderEnum,
  repo_url: z.string().url(),
  default_branch: z.string().nullable(),
  linked_at: z.string(),
  commits: z.array(
    z.object({
      commit_sha: z.string(),
      message: z.string(),
      author: z.string(),
      authored_at: z.string().nullable(),
      parents: z.array(z.string()),
    }),
  ),
});
export type RepoLinkDetail = z.infer<typeof RepoLinkDetailV1>;
