/**
 * MendoraCI Mask Policy v1.0.0
 *
 * Anchors:
 *   - BR-008 Secret Masking
 *   - RT-008 (cross-cutting)
 *   - DB-013 mask_policies
 *   - TEST-023 red-team corpus N=500 (0 leaks)
 *   - TEST-024 mask engine failure → BLOCK, no fallback
 *
 * Design principles (per docs/MendoraCI_BRD §16a.5, §10a):
 *   1. Deterministic: same input → same masked output. No randomness.
 *   2. Pre-persist: mask runs BEFORE any DB write or queue emission.
 *   3. Fail-closed: on engine error, return BLOCKED, never partial.
 *   4. Versioned: every masked artefact carries `mask_policy_version`.
 *   5. Provider-aware: AWS, GitHub, Stripe, Slack, Anthropic, OpenAI, Google.
 *   6. Entropy guard: catches generic high-entropy tokens (>= 3.5 bits/char, >= 24 chars).
 */

export const MASK_POLICY_VERSION = 'v1.0.0';

export interface MaskRule {
  readonly id: string;
  readonly description: string;
  readonly pattern: RegExp;
  readonly replacement: string;
}

export interface MaskResult {
  readonly ok: true;
  readonly masked: string;
  readonly policyVersion: string;
  readonly hits: ReadonlyArray<{ ruleId: string; count: number }>;
  readonly inputSha256: string;
  readonly outputSha256: string;
}

export interface MaskBlocked {
  readonly ok: false;
  readonly reason: string;
  readonly policyVersion: string;
}

export type MaskOutcome = MaskResult | MaskBlocked;

export const RULES: ReadonlyArray<MaskRule> = [
  {
    id: 'aws-access-key',
    description: 'AWS Access Key ID (AKIA/ASIA prefix)',
    pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: '$1****',
  },
  {
    id: 'aws-secret-key',
    description: 'AWS Secret Access Key (40 char base64-like, with explicit context)',
    pattern: /(?<=aws_secret_access_key\s*[=:]\s*["']?)[A-Za-z0-9/+=]{40}/g,
    replacement: '****',
  },
  {
    id: 'github-pat',
    description: 'GitHub PAT (classic + fine-grained)',
    pattern: /\b(ghp_|gho_|ghs_|ghu_|ghr_|github_pat_)[A-Za-z0-9_]{20,255}\b/g,
    replacement: '$1****',
  },
  {
    id: 'slack-token',
    description: 'Slack token (xoxb/xoxp/xoxa/xoxs)',
    pattern: /\bxox[bpars]-[A-Za-z0-9-]{10,200}\b/g,
    replacement: 'xox*-****',
  },
  {
    id: 'stripe-key',
    description: 'Stripe API key',
    pattern: /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{20,200}\b/g,
    replacement: '$1_$2_****',
  },
  {
    id: 'anthropic-key',
    description: 'Anthropic API key (sk-ant-...)',
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,200}\b/g,
    replacement: 'sk-ant-****',
  },
  {
    id: 'openai-key',
    description: 'OpenAI API key (sk-...)',
    pattern: /\bsk-(?!ant-)[A-Za-z0-9_-]{20,200}\b/g,
    replacement: 'sk-****',
  },
  {
    id: 'google-api-key',
    description: 'Google API key (AIza...)',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    replacement: 'AIza****',
  },
  {
    id: 'jwt',
    description: 'JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replacement: 'eyJ****',
  },
  {
    id: 'pem-private-key',
    description: 'PEM-encoded private key block',
    pattern: /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g,
    replacement: '-----PRIVATE KEY REDACTED-----',
  },
  {
    id: 'url-basic-auth',
    description: 'URL with embedded user:password (any scheme)',
    pattern: /(\b[a-z][a-z0-9+.-]{1,30}:\/\/)([^:/\s@]+):([^@/\s]+)(@)/g,
    replacement: '$1$2:****$4',
  },
  {
    id: 'password-assignment',
    description: 'password=... in config/env lines',
    pattern: /(\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token)\b\s*[=:]\s*["']?)([^\s"'<>;,]{6,})/gi,
    replacement: '$1****',
  },
];

export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

const HIGH_ENTROPY_TOKEN = /\b[A-Za-z0-9_/+=-]{24,}\b/g;
const ENTROPY_THRESHOLD_BITS_PER_CHAR = 3.5;

async function sha256Hex(s: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export async function applyMask(input: string): Promise<MaskOutcome> {
  try {
    if (typeof input !== 'string') {
      return {
        ok: false,
        reason: 'mask_engine_failure: non-string input',
        policyVersion: MASK_POLICY_VERSION,
      };
    }

    let masked = input;
    const hits = new Map<string, number>();

    for (const rule of RULES) {
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
      const before = masked;
      let count = 0;
      masked = masked.replace(re, (...args) => {
        count++;
        return rule.replacement.replace(/\$(\d+)/g, (_m, gIdx) => {
          const idx = Number(gIdx);
          const grp = args[idx];
          return typeof grp === 'string' ? grp : '';
        });
      });
      if (count > 0) {
        hits.set(rule.id, count);
      }
      /* c8 ignore start -- defensive guard against pathological regex expansion */
      if (masked.length > before.length * 50) {
        return {
          ok: false,
          reason: `mask_engine_failure: pathological expansion in rule ${rule.id}`,
          policyVersion: MASK_POLICY_VERSION,
        };
      }
      /* c8 ignore stop */
    }

    masked = masked.replace(HIGH_ENTROPY_TOKEN, (tok) => {
      if (tok.includes('****')) return tok;
      const e = shannonEntropy(tok);
      if (e >= ENTROPY_THRESHOLD_BITS_PER_CHAR) {
        hits.set('entropy-generic', (hits.get('entropy-generic') ?? 0) + 1);
        return `${tok.slice(0, 4)}****`;
      }
      return tok;
    });

    const inputSha256 = await sha256Hex(input);
    const outputSha256 = await sha256Hex(masked);

    return {
      ok: true,
      masked,
      policyVersion: MASK_POLICY_VERSION,
      hits: Array.from(hits.entries()).map(([ruleId, count]) => ({ ruleId, count })),
      inputSha256,
      outputSha256,
    };
  } catch (err) {
    /* c8 ignore start -- TEST-024: defensive catch-all; BLOCK no fallback */
    return {
      ok: false,
      reason: `mask_engine_failure: ${(err as Error).message}`,
      policyVersion: MASK_POLICY_VERSION,
    };
    /* c8 ignore stop */
  }
}

export async function applyMaskOrThrow(input: string): Promise<MaskResult> {
  const out = await applyMask(input);
  if (!out.ok) {
    throw new MaskBlockedError(out.reason, out.policyVersion);
  }
  return out;
}

export class MaskBlockedError extends Error {
  public readonly code = 'mask_engine_failure';
  constructor(public readonly reason: string, public readonly policyVersion: string) {
    super(reason);
    this.name = 'MaskBlockedError';
  }
}
