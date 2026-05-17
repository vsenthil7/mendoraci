/**
 * IBM Bob Shell CLI wrapper for runtime RCA inference.
 *
 * Anchors: RT-003 RCA (BR-003, BR-012), CP-5.
 *
 * Two modes controlled by USE_MOCK_BOB:
 *   - real (USE_MOCK_BOB=false): shell out to `bob` CLI inside the api container.
 *     Bob is installed by infra/docker/api.Dockerfile from
 *     https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell-${ver}.tgz.
 *     Prompt is piped to stdin (recommended path per docs, --prompt flag is
 *     deprecated in Bob 1.0.3+).
 *   - mock (USE_MOCK_BOB=true): deterministic JSON output based on the input
 *     log, used by integration tests so they don't depend on network or
 *     IBM credit/token usage.
 *
 * Real-call command:
 *   echo "<prompt>" | bob --auth-method api-key --trust --accept-license \
 *                          --hide-intermediary-output --chat-mode ask \
 *                          -o text
 *
 * Verified end-to-end at 21:50 BST on 2026-05-17: real Bob returned valid
 * JSON RCA in 18.2s for a OOM build log, even flagging a masked AWS key as
 * a secondary recommended action.
 */
import { spawn } from 'node:child_process';
import { RcaModelOutputV1, type RcaModelOutput } from '@mendoraci/shared';

export type BobProvider = 'bob' | 'mock-bob';

export interface BobCallResult {
  provider: BobProvider;
  model_id: string;
  output: RcaModelOutput;
  raw_text: string;
  latency_ms: number;
}

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
    super(`bob output not parseable as RCA JSON: ${parseDetail}`);
    this.name = 'BobParseError';
  }
}

/**
 * Run Bob CLI non-interactively. Returns parsed RCA JSON or throws a typed error.
 *
 * NOTE: Bob currently writes a small amount of session/banner text around the
 * model output. We extract the first {...} JSON block from stdout before
 * validating against the schema. The smoke test in scripts/bob_container_smoke.sh
 * shows Bob outputs the JSON cleanly with `-o text --hide-intermediary-output`.
 */
async function callRealBob(opts: BobCallOptions): Promise<BobCallResult> {
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
  return new Promise<BobCallResult>((resolve, reject) => {
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

      // Extract first JSON object from stdout. Bob may surround it with whitespace.
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
          new BobParseError(
            stdout,
            `JSON.parse failed: ${(e as Error).message}`,
          ),
        );
        return;
      }

      const result = RcaModelOutputV1.safeParse(parsed);
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

    // Write the prompt and close stdin.
    child.stdin.write(opts.prompt);
    child.stdin.end();
  });
}

/**
 * Mock-Bob: deterministic output for tests. Inspects the prompt for known
 * markers (OOM, secret/credential, build) and returns a tuned fake RCA so
 * assertions can match on real-looking content without burning real Bob credits.
 */
function callMockBob(opts: BobCallOptions): BobCallResult {
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

  // Bonus: detect masked-secret markers in the prompt and surface as action.
  if (/AKIA\*\*\*\*|akia\*\*\*\*/.test(opts.prompt)) {
    recommended_actions.push(
      'Rotate the exposed AWS access key (masked as AKIA****) immediately',
    );
  }

  // Ensure at least one of each.
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

/**
 * Public entrypoint. Dispatches to real Bob or mock-Bob based on USE_MOCK_BOB.
 */
export async function runRca(opts: BobCallOptions): Promise<BobCallResult> {
  const useMock = (process.env.USE_MOCK_BOB ?? 'true').toLowerCase() !== 'false';
  if (useMock) return callMockBob(opts);
  return callRealBob(opts);
}

/**
 * Build the prompt sent to Bob. Centralised here so tests can assert on its
 * shape and prompt-engineering changes are versioned in one place.
 */
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
