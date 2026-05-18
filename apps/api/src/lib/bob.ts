/**
 * IBM Bob Shell CLI wrapper for runtime LLM inference (RCA + Repair Plan).
 *
 * Anchors: RT-003 RCA (CP-5), RT-004 Repair Plan (CP-6); BR-003, BR-004, BR-012.
 *
 * Two modes controlled by USE_MOCK_BOB:
 *   - real (USE_MOCK_BOB=false): shell out to `bob` CLI inside the api container.
 *     Bob is installed by infra/docker/api.Dockerfile from
 *     https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell-${ver}.tgz.
 *     Prompt is piped to stdin (recommended path per docs; --prompt flag is
 *     deprecated in Bob 1.0.3+).
 *   - mock (USE_MOCK_BOB=true): deterministic JSON output keyed off prompt
 *     markers, used by integration tests so they don't depend on network or
 *     IBM Bob credit/token usage.
 *
 * Real-call command:
 *   echo "<prompt>" | bob --auth-method api-key --trust --accept-license \
 *                          --hide-intermediary-output --chat-mode <mode> \
 *                          -o text
 *
 * Verified end-to-end at 21:50 BST on 2026-05-17: real Bob returned valid
 * JSON RCA in 18.2s for an OOM build log, even flagging a masked AWS key as
 * a secondary recommended action.
 */
import { spawn } from 'node:child_process';
import { z } from 'zod';
import {
  RcaModelOutputV1,
  type RcaModelOutput,
  RepairPlanModelOutputV1,
  type RepairPlanModelOutput,
} from '@mendoraci/shared';

export type BobProvider = 'bob' | 'mock-bob';

export interface BobCallResultBase<T> {
  provider: BobProvider;
  model_id: string;
  output: T;
  raw_text: string;
  latency_ms: number;
}

export type BobCallResult = BobCallResultBase<RcaModelOutput>;

export interface BobCallOptions {
  prompt: string;
  timeoutMs?: number;
  chatMode?: 'plan' | 'code' | 'advanced' | 'ask';
}

const DEFAULT_TIMEOUT_MS = Number(process.env.BOB_TIMEOUT_MS ?? 60_000);
const BOB_CLI_PATH = process.env.BOB_CLI_PATH ?? 'bob';
const BOB_MODEL_ID = process.env.BOB_MODEL_ID ?? 'bob-default';

export class BobTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`bob call exceeded ${timeoutMs}ms`);
    this.name = 'BobTimeoutError';
  }
}

export class BobInvocationError extends Error {
  constructor(
    public exitCode: number | null,
    public stderr: string,
    public stdout: string,
  ) {
    super(`bob exited ${exitCode}: ${stderr.slice(0, 200) || stdout.slice(0, 200)}`);
    this.name = 'BobInvocationError';
  }
}

export class BobParseError extends Error {
  constructor(
    public rawText: string,
    public parseDetail: string,
  ) {
    super(`bob output not parseable as JSON: ${parseDetail}`);
    this.name = 'BobParseError';
  }
}

/**
 * Generic Bob CLI invocation. Pipes `prompt` to stdin, reads stdout, extracts
 * the first JSON object, validates against `schema`, returns typed output.
 * All non-success paths throw a typed error. The route layer maps:
 *   BobTimeoutError      -> 504 bob_timeout
 *   BobInvocationError   -> 503 bob_unavailable
 *   BobParseError        -> 502 bob_bad_output
 */
async function callRealBobGeneric<T>(
  opts: BobCallOptions,
  schema: z.ZodType<T>,
): Promise<BobCallResultBase<T>> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const chatMode = opts.chatMode ?? 'ask';

  if (!process.env.BOBSHELL_API_KEY) {
    throw new BobInvocationError(
      null,
      'BOBSHELL_API_KEY not set in api container env',
      '',
    );
  }

  const args = [
    '--auth-method',
    'api-key',
    '--trust',
    '--accept-license',
    '--hide-intermediary-output',
    '--chat-mode',
    chatMode,
    '-o',
    'text',
  ];

  const start = Date.now();
  return new Promise<BobCallResultBase<T>>((resolve, reject) => {
    const child = spawn(BOB_CLI_PATH, args, {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new BobTimeoutError(timeoutMs));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new BobInvocationError(null, err.message, stdout));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const latency_ms = Date.now() - start;

      if (code !== 0) {
        reject(new BobInvocationError(code, stderr, stdout));
        return;
      }

      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        reject(new BobParseError(stdout, 'no JSON object found in stdout'));
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        reject(
          new BobParseError(stdout, `JSON.parse failed: ${(e as Error).message}`),
        );
        return;
      }

      const result = schema.safeParse(parsed);
      if (!result.success) {
        reject(
          new BobParseError(
            stdout,
            `schema validation failed: ${result.error.issues
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; ')}`,
          ),
        );
        return;
      }

      resolve({
        provider: 'bob',
        model_id: BOB_MODEL_ID,
        output: result.data,
        raw_text: stdout,
        latency_ms,
      });
    });

    child.stdin.write(opts.prompt);
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// RCA (RT-003)
// ---------------------------------------------------------------------------

function callMockBobRca(opts: BobCallOptions): BobCallResult {
  const start = Date.now();
  const lower = opts.prompt.toLowerCase();

  let root_cause = 'Unable to determine root cause from the provided log.';
  let confidence: 'low' | 'medium' | 'high' = 'low';
  const evidence_snippets: string[] = [];
  const recommended_actions: string[] = [];

  if (lower.includes('oom') || lower.includes('out of memory') || lower.includes('process killed')) {
    root_cause =
      'Out-of-memory error caused the build process to be killed during execution.';
    confidence = 'high';
    evidence_snippets.push('OOM error: process killed');
    recommended_actions.push(
      'Increase memory allocation for the CI runner or build container',
    );
    recommended_actions.push(
      'Profile memory usage to identify the offending step or dependency',
    );
  } else if (lower.includes('timeout') || lower.includes('timed out')) {
    root_cause = 'Build step exceeded its configured timeout.';
    confidence = 'medium';
    evidence_snippets.push('timeout exceeded');
    recommended_actions.push('Increase the step timeout or break the step into smaller units');
  } else {
    root_cause = 'Build failed at an unspecified step in the log.';
    confidence = 'low';
    evidence_snippets.push('build failed');
    recommended_actions.push('Review the full build log around the failure point');
  }

  if (/AKIA\*\*\*\*|akia\*\*\*\*/.test(opts.prompt)) {
    recommended_actions.push(
      'Rotate the exposed AWS access key (masked as AKIA****) immediately',
    );
  }

  if (evidence_snippets.length === 0) evidence_snippets.push('build failed at step');
  if (recommended_actions.length === 0) recommended_actions.push('Review the failing step in detail');

  const output: RcaModelOutput = {
    root_cause,
    confidence,
    evidence_snippets,
    recommended_actions,
  };
  return {
    provider: 'mock-bob',
    model_id: 'mock-bob-v1',
    output,
    raw_text: JSON.stringify(output),
    latency_ms: Math.max(1, Date.now() - start),
  };
}

export async function runRca(opts: BobCallOptions): Promise<BobCallResult> {
  const useMock = (process.env.USE_MOCK_BOB ?? 'true').toLowerCase() !== 'false';
  if (useMock) return callMockBobRca(opts);
  return callRealBobGeneric<RcaModelOutput>(opts, RcaModelOutputV1);
}

export function buildRcaPrompt(args: {
  maskedLogPreview: string;
  intakeId: string;
  branch?: string;
  commitSha?: string;
}): string {
  const meta = [
    `intake_id: ${args.intakeId}`,
    args.branch ? `branch: ${args.branch}` : null,
    args.commitSha ? `commit_sha: ${args.commitSha}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'You are an SRE assistant performing root-cause analysis on a CI/CD build failure.',
    '',
    'Context (already-masked log excerpt; secrets shown as ****):',
    args.maskedLogPreview,
    '',
    meta ? `Metadata:\n${meta}` : '',
    '',
    'Return STRICT JSON only - no markdown fences, no preamble, no trailing prose.',
    'Use exactly this shape:',
    '{"root_cause":"<one sentence>","confidence":"low|medium|high","evidence_snippets":["<short snippet>"],"recommended_actions":["<action>"]}',
    'evidence_snippets must contain 1-8 entries quoting from the log.',
    'recommended_actions must contain 1-8 entries.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Repair Plan (RT-004)
// ---------------------------------------------------------------------------

export type RepairPlanCallResult = BobCallResultBase<RepairPlanModelOutput>;

function callMockBobRepairPlan(
  opts: BobCallOptions,
  rcaContext: {
    rootCause: string;
    confidence: 'low' | 'medium' | 'high';
    recommendedActions: string[];
  },
): RepairPlanCallResult {
  const start = Date.now();
  const promptLower = opts.prompt.toLowerCase();
  const rcLower = rcaContext.rootCause.toLowerCase();

  const steps: RepairPlanModelOutput['steps'] = [];
  let overall_risk: 'low' | 'medium' | 'high' = 'medium';
  let est_total_effort: 'XS' | 'S' | 'M' | 'L' | 'XL' = 'M';
  let summary = `Repair plan derived from RCA: ${rcaContext.rootCause}`;
  let rollback_strategy = 'Revert the merge commit and re-run the failed CI job to confirm rollback.';

  const isOom =
    rcLower.includes('out-of-memory') || rcLower.includes('memory') || promptLower.includes('oom');
  const isTimeout = rcLower.includes('timeout') || promptLower.includes('timeout');
  const isSecret =
    rcaContext.recommendedActions.some((a) => /AKIA|aws key|rotate/i.test(a)) ||
    /AKIA\*\*\*\*/.test(opts.prompt);

  if (isOom) {
    overall_risk = 'medium';
    est_total_effort = 'M';
    summary = 'Address the OOM by raising the CI runner memory ceiling and profiling the heaviest build step.';
    steps.push({
      title: 'Raise CI runner memory limit',
      description:
        'Bump the build job memory request in the CI config from the current ceiling to the next tier so the process is not killed at line ~421.',
      type: 'config-change',
      files: ['.github/workflows/build.yml'],
      est_effort: 'XS',
      risk: 'low',
    });
    steps.push({
      title: 'Add memory profiling step',
      description:
        'Insert a memory-profile capture (heap snapshot or /usr/bin/time -v) around the failing step so the next failure has data.',
      type: 'code-edit',
      files: ['scripts/profile-build-memory.sh', '.github/workflows/build.yml'],
      est_effort: 'S',
      risk: 'low',
    });
    steps.push({
      title: 'Investigate dependency bloat',
      description:
        'Run `npm ls --all` (or equivalent for the language stack) to identify if a recent dependency upgrade pulled in heavy transitive deps.',
      type: 'investigation',
      est_effort: 'S',
      risk: 'low',
    });
    rollback_strategy =
      'If the memory bump destabilises pricing, revert the CI config change; if a dep upgrade is the cause, pin to the prior version.';
  } else if (isTimeout) {
    overall_risk = 'low';
    est_total_effort = 'S';
    summary = 'Raise the step timeout and split the long-running step into smaller stages.';
    steps.push({
      title: 'Increase step timeout',
      description: 'Raise the step timeout in the CI workflow from its current value to 2x.',
      type: 'config-change',
      files: ['.github/workflows/build.yml'],
      est_effort: 'XS',
      risk: 'low',
    });
    steps.push({
      title: 'Split monolithic step',
      description:
        'Decompose the failing step into 2-3 smaller jobs that can be parallelised and individually retried.',
      type: 'code-edit',
      files: ['.github/workflows/build.yml'],
      est_effort: 'M',
      risk: 'medium',
    });
  } else {
    overall_risk = 'low';
    est_total_effort = 'S';
    summary = 'Reproduce the failure locally, add targeted logging, and gate the offending area with a focused test.';
    steps.push({
      title: 'Reproduce locally',
      description: 'Pull the failing CI inputs and reproduce the failure on a developer machine.',
      type: 'investigation',
      est_effort: 'S',
      risk: 'low',
    });
    steps.push({
      title: 'Add a regression test',
      description: 'Once reproduced, codify the failure as a unit/integration test that fails red before the fix.',
      type: 'test-add',
      est_effort: 'S',
      risk: 'low',
    });
  }

  if (isSecret) {
    overall_risk = 'high';
    steps.unshift({
      title: 'Rotate exposed AWS credential',
      description:
        'The masked log shows an AKIA**** key. Rotate the IAM access key immediately, audit recent usage in CloudTrail, and ensure CI no longer prints credentials.',
      type: 'config-change',
      files: ['ci/credentials.md'],
      est_effort: 'S',
      risk: 'high',
    });
    rollback_strategy =
      'Credential rotation is one-way; if access breaks, restore from the new key issued during rotation rather than the old one.';
  }

  // Ensure at least one step.
  if (steps.length === 0) {
    steps.push({
      title: 'Manual triage',
      description: 'Open the full build log and bisect to the failing step manually.',
      type: 'investigation',
      est_effort: 'XS',
      risk: 'low',
    });
  }

  const output: RepairPlanModelOutput = {
    summary,
    overall_risk,
    steps,
    rollback_strategy,
    est_total_effort,
  };

  return {
    provider: 'mock-bob',
    model_id: 'mock-bob-v1',
    output,
    raw_text: JSON.stringify(output),
    latency_ms: Math.max(1, Date.now() - start),
  };
}

export async function runRepairPlan(
  opts: BobCallOptions,
  rcaContext: {
    rootCause: string;
    confidence: 'low' | 'medium' | 'high';
    recommendedActions: string[];
  },
): Promise<RepairPlanCallResult> {
  const useMock = (process.env.USE_MOCK_BOB ?? 'true').toLowerCase() !== 'false';
  if (useMock) return callMockBobRepairPlan(opts, rcaContext);
  return callRealBobGeneric<RepairPlanModelOutput>(opts, RepairPlanModelOutputV1);
}

export function buildRepairPlanPrompt(args: {
  rcaSummary: string;
  rcaConfidence: 'low' | 'medium' | 'high';
  recommendedActions: string[];
  evidenceSnippets: string[];
  intakeId: string;
  branch?: string;
  commitSha?: string;
}): string {
  const meta = [
    `intake_id: ${args.intakeId}`,
    args.branch ? `branch: ${args.branch}` : null,
    args.commitSha ? `commit_sha: ${args.commitSha}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'You are an SRE assistant producing a concrete repair plan to fix a CI/CD build failure.',
    '',
    'Root-Cause Analysis input:',
    `  root_cause: ${args.rcaSummary}`,
    `  confidence: ${args.rcaConfidence}`,
    `  recommended_actions: ${JSON.stringify(args.recommendedActions)}`,
    `  evidence_snippets: ${JSON.stringify(args.evidenceSnippets)}`,
    '',
    meta ? `Metadata:\n${meta}` : '',
    '',
    'Return STRICT JSON only — no markdown fences, no preamble, no trailing prose.',
    'Use exactly this shape:',
    '{',
    '  "summary": "<two-to-three sentences explaining the plan>",',
    '  "overall_risk": "low|medium|high",',
    '  "steps": [',
    '    {',
    '      "title": "<short title>",',
    '      "description": "<one or two sentences>",',
    '      "type": "code-edit|config-change|infra-change|rollback|investigation|dependency-update|test-add|other",',
    '      "files": ["<optional path or paths>"],',
    '      "est_effort": "XS|S|M|L|XL",',
    '      "risk": "low|medium|high"',
    '    }',
    '  ],',
    '  "rollback_strategy": "<one paragraph>",',
    '  "est_total_effort": "XS|S|M|L|XL"',
    '}',
    'Constraints:',
    '  - steps array: 1-12 entries, ordered from highest leverage first.',
    '  - Each step is small and actionable so a human reviewer can approve it line by line.',
    '  - If the RCA cites a leaked credential, the first step MUST be credential rotation.',
  ].join('\n');
}
