import { describe, it, expect } from 'vitest';
import {
  applyMask,
  applyMaskOrThrow,
  MaskBlockedError,
  MASK_POLICY_VERSION,
  shannonEntropy,
} from '../src/index.js';
import { randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// Helpers — build synthetic test corpora (NEVER real secrets).
// ---------------------------------------------------------------------------

function randAlnum(len: number): string {
  const cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += cs[(bytes[i] ?? 0) % cs.length];
  return out;
}
function randUpperAlnum(len: number): string {
  const cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += cs[(bytes[i] ?? 0) % cs.length];
  return out;
}

interface Sample {
  raw: string;
  containsSecret: true;
  ruleExpected: string;
}

function buildRedTeamCorpus(count = 500): Sample[] {
  const samples: Sample[] = [];
  const generators: Array<() => Sample> = [
    () => ({ raw: `accessKeyId: AKIA${randUpperAlnum(16)}`, containsSecret: true, ruleExpected: 'aws-access-key' }),
    () => ({ raw: `aws_secret_access_key="${randAlnum(40)}"`, containsSecret: true, ruleExpected: 'aws-secret-key' }),
    () => ({ raw: `token: ghp_${randAlnum(36)}`, containsSecret: true, ruleExpected: 'github-pat' }),
    () => ({ raw: `Authorization: Bearer github_pat_${randAlnum(82)}`, containsSecret: true, ruleExpected: 'github-pat' }),
    () => ({ raw: `slack_bot_token=xoxb-${randAlnum(50)}`, containsSecret: true, ruleExpected: 'slack-token' }),
    () => ({ raw: `STRIPE_KEY=sk_live_${randAlnum(48)}`, containsSecret: true, ruleExpected: 'stripe-key' }),
    () => ({ raw: `ANTHROPIC_API_KEY=sk-ant-${randAlnum(95)}`, containsSecret: true, ruleExpected: 'anthropic-key' }),
    () => ({ raw: `OPENAI_API_KEY=sk-${randAlnum(48)}`, containsSecret: true, ruleExpected: 'openai-key' }),
    () => ({ raw: `GOOGLE_API_KEY=AIza${randAlnum(35)}`, containsSecret: true, ruleExpected: 'google-api-key' }),
    () => ({ raw: `cookie=session=eyJ${randAlnum(20)}.eyJ${randAlnum(40)}.${randAlnum(43)}`, containsSecret: true, ruleExpected: 'jwt' }),
    () => ({ raw: `password = "P@ssw0rd!_${randAlnum(12)}"`, containsSecret: true, ruleExpected: 'password-assignment' }),
    () => ({ raw: `dburl=postgres://admin:S3cr3t${randAlnum(8)}@db:5432/app`, containsSecret: true, ruleExpected: 'url-basic-auth' }),
    () => ({ raw: `-----BEGIN RSA PRIVATE KEY-----\n${randAlnum(64)}\n${randAlnum(64)}\n-----END RSA PRIVATE KEY-----`, containsSecret: true, ruleExpected: 'pem-private-key' }),
  ];
  for (let i = 0; i < count; i++) {
    const gen = generators[i % generators.length]!;
    const sample = gen();
    samples.push({
      raw: `[2026-05-17T12:00:00Z] INFO build_${i} env: ${sample.raw} \n other context here`,
      containsSecret: true,
      ruleExpected: sample.ruleExpected,
    });
  }
  return samples;
}

// ---------------------------------------------------------------------------
// TEST-023 — Red-team corpus N=500, 0 leaks.
// ---------------------------------------------------------------------------

describe('TEST-023: mask v1 red-team corpus N=500 (0 leaks)', () => {
  const corpus = buildRedTeamCorpus(500);

  const leakSignals: Array<{ name: string; re: RegExp }> = [
    { name: 'AKIA-key-fully-present', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
    { name: 'ghp-token-fully-present', re: /\b(ghp_|gho_|ghs_|ghu_|ghr_|github_pat_)[A-Za-z0-9_]{20,}\b/ },
    { name: 'xox-token-fully-present', re: /\bxox[bpars]-[A-Za-z0-9-]{10,}\b/ },
    { name: 'stripe-key-fully-present', re: /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{20,}\b/ },
    { name: 'anthropic-key-fully-present', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
    { name: 'openai-key-fully-present', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
    { name: 'google-key-fully-present', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
    { name: 'pem-block-fully-present', re: /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]{100,}-----END/ },
  ];

  it('processes all 500 samples and leaks nothing', async () => {
    let leaks = 0;
    const leakReport: Array<{ idx: number; signal: string }> = [];

    for (let i = 0; i < corpus.length; i++) {
      const sample = corpus[i]!;
      const result = await applyMask(sample.raw);
      expect(result.ok, `sample ${i} should mask successfully`).toBe(true);
      if (!result.ok) continue;

      for (const sig of leakSignals) {
        if (sig.re.test(result.masked)) {
          if (sig.name === 'openai-key-fully-present' && /\bsk-ant-/.test(sample.raw)) continue;
          leaks++;
          leakReport.push({ idx: i, signal: sig.name });
        }
      }
    }
    expect(leaks, `leak report: ${JSON.stringify(leakReport.slice(0, 5))}`).toBe(0);
  });

  it('replaces with the masked-token marker (****)', async () => {
    for (let i = 0; i < 20; i++) {
      const sample = corpus[i]!;
      const out = await applyMask(sample.raw);
      if (out.ok) {
        expect(out.masked.includes('****') || out.masked.includes('REDACTED')).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// TEST-024 — Mask engine failure → BLOCK, no fallback.
// ---------------------------------------------------------------------------

describe('TEST-024: mask engine failure → BLOCK, no fallback', () => {
  it('returns blocked outcome on non-string input', async () => {
    const out = await applyMask(123 as unknown as string);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toMatch(/mask_engine_failure/);
      expect(out.policyVersion).toBe(MASK_POLICY_VERSION);
    }
  });

  it('applyMaskOrThrow throws MaskBlockedError on engine failure', async () => {
    await expect(applyMaskOrThrow(undefined as unknown as string)).rejects.toBeInstanceOf(
      MaskBlockedError,
    );
  });

  it('never returns raw input on block', async () => {
    const out = await applyMask(null as unknown as string);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect('masked' in out).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Determinism + version pinning.
// ---------------------------------------------------------------------------

describe('Determinism + pinning', () => {
  it('produces identical output across runs (deterministic)', async () => {
    const sample =
      'AKIAIOSFODNN7EXAMPLE ghp_abcdefghijklmnopqrstuvwxyz0123456789 sk_live_abcdefghijklmnopqrstuvwx';
    const a = await applyMask(sample);
    const b = await applyMask(sample);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.masked).toBe(b.masked);
      expect(a.outputSha256).toBe(b.outputSha256);
    }
  });

  it('reports mask_policy_version on every result', async () => {
    const out = await applyMask('hello world');
    expect(out.policyVersion).toBe(MASK_POLICY_VERSION);
  });
});

// ---------------------------------------------------------------------------
// Entropy helper sanity.
// ---------------------------------------------------------------------------

describe('shannonEntropy', () => {
  it('returns 0 for empty', () => {
    expect(shannonEntropy('')).toBe(0);
  });
  it('returns ~0 for a single repeated char', () => {
    expect(shannonEntropy('aaaaaa')).toBeCloseTo(0, 5);
  });
  it('returns high entropy for random-looking strings', () => {
    expect(shannonEntropy('aB3xY7qP9kL2mN8vC4rT')).toBeGreaterThan(3.5);
  });
});

// ---------------------------------------------------------------------------
// Negative cases that must NOT be flagged (avoid over-mask).
// ---------------------------------------------------------------------------

describe('Negative — non-secret strings must not be over-masked', () => {
  it('plain prose passes through', async () => {
    const out = await applyMask('The build failed at step 4 with an OOM error.');
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.masked).toBe('The build failed at step 4 with an OOM error.');
      expect(out.hits.length).toBe(0);
    }
  });
  it('stack traces pass through', async () => {
    const trace = `Error: cannot read property 'foo' of undefined
    at parse (parser.py:142:8)
    at handle (handler.js:99:12)`;
    const out = await applyMask(trace);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.masked).toBe(trace);
  });
  it('long-but-low-entropy tokens are not flagged by entropy net', async () => {
    const out = await applyMask('aaaaaaaaaaaaaaaaaaaaaaaa is fine');
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.masked).toBe('aaaaaaaaaaaaaaaaaaaaaaaa is fine');
      const entropyHit = out.hits.find((h) => h.ruleId === 'entropy-generic');
      expect(entropyHit).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// applyMaskOrThrow success path + MaskBlockedError fields.
// ---------------------------------------------------------------------------

describe('applyMaskOrThrow + MaskBlockedError', () => {
  it('returns the masked result on success', async () => {
    const out = await applyMaskOrThrow('hello world AKIA1234567890ABCDEF');
    expect(out.ok).toBe(true);
    expect(out.masked).toContain('AKIA****');
    expect(out.policyVersion).toBe(MASK_POLICY_VERSION);
  });
  it('exposes code, reason, and policyVersion fields on the thrown error', async () => {
    try {
      await applyMaskOrThrow(null as unknown as string);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(MaskBlockedError);
      const err = e as MaskBlockedError;
      expect(err.code).toBe('mask_engine_failure');
      expect(err.reason).toMatch(/mask_engine_failure/);
      expect(err.policyVersion).toBe(MASK_POLICY_VERSION);
      expect(err.name).toBe('MaskBlockedError');
    }
  });
});

// ---------------------------------------------------------------------------
// Object input goes through typeof-string guard (not catch).
// ---------------------------------------------------------------------------

describe('Object input is rejected by typeof guard', () => {
  it('returns blocked for any non-string input including objects', async () => {
    const out = await applyMask({ foo: 'bar' } as unknown as string);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toMatch(/non-string input/);
    }
  });
});
