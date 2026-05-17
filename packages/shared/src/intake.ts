import { z } from 'zod';

/**
 * MendoraCI shared schemas — single source of truth for API contracts.
 * Anchored to docs/MendoraCI_APIContractSpec_20260517_1130.md.
 */

export const ProviderEnum = z.enum(['github', 'jenkins', 'circleci', 'gitlab', 'buildkite']);
export type Provider = z.infer<typeof ProviderEnum>;

export const ArtifactTypeEnum = z.enum(['log', 'junit_xml', 'workflow_yaml', 'env_snapshot']);
export type ArtifactType = z.infer<typeof ArtifactTypeEnum>;

export const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024;

// API-001 POST /intake
export const IntakeRequestV1 = z.object({
  provider: ProviderEnum,
  run_id: z.string().min(1).max(256),
  attempt_id: z.string().min(1).max(64),
  repo_url: z.string().url().optional(),
  artifact: z.object({
    type: ArtifactTypeEnum,
    body_base64: z.string().min(1),
  }),
  metadata: z
    .object({
      branch: z.string().max(256).optional(),
      commit_sha: z.string().max(64).optional(),
      actor: z.string().max(128).optional(),
    })
    .partial()
    .optional(),
});
export type IntakeRequest = z.infer<typeof IntakeRequestV1>;

export const IntakeStatusEnum = z.enum([
  'received',
  'masking',
  'masked',
  'classifying',
  'rca-done',
  'plan-ready',
  'awaiting-approval',
  'approved',
  'rejected',
  'exported',
  'blocked',
]);
export type IntakeStatus = z.infer<typeof IntakeStatusEnum>;

export const IntakeResponseV1 = z.object({
  intake_id: z.string().uuid(),
  status: IntakeStatusEnum,
  mask_policy_version: z.string(),
  received_at: z.string(),
});
export type IntakeResponse = z.infer<typeof IntakeResponseV1>;

// API-002 GET /intake/{id}
export const IntakeDetailV1 = z.object({
  intake_id: z.string().uuid(),
  status: IntakeStatusEnum,
  body_masked_preview: z.string(),
  intake_meta: z.object({
    provider: ProviderEnum,
    run_id: z.string(),
    attempt_id: z.string(),
    branch: z.string().nullable(),
    commit_sha: z.string().nullable(),
    actor: z.string().nullable(),
    size_bytes: z.number().int().nonnegative(),
    received_at: z.string(),
  }),
  lineage_chain: z.record(z.string(), z.string()),
  mask_policy_version: z.string(),
});
export type IntakeDetail = z.infer<typeof IntakeDetailV1>;

// Common error envelope
export const ApiErrorV1 = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    validation_errors: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorV1>;
