'use client';
import { useState } from 'react';

/**
 * SCR-001 — CI Log Intake (Phase 1 minimal).
 * Anchors: RT-001 (BR-001), RT-008 mask preview, RT-015 idempotency-key client-side.
 * Full three-pane wireframe (intake history table, detail drawer) is CP-3.
 */
export default function IntakePage() {
  const [status, setStatus] = useState<string>('idle');
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string>('');

  async function submitSample() {
    setStatus('uploading');
    setError('');
    setResponse(null);
    const body = {
      provider: 'jenkins',
      run_id: `run-${Date.now()}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: btoa(
          'INFO build 4421 starting\nAKIAIOSFODNN7EXAMPLE was the key\nOOM error at line 421: process killed\n',
        ),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'demo' },
    };
    try {
      const r = await fetch('/api/v1/intake', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `k-${crypto.randomUUID()}`,
          'x-tenant-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      setResponse(j);
      setStatus(r.ok ? 'submitted' : 'error');
      if (!r.ok) setError(JSON.stringify(j));
    } catch (e) {
      setStatus('error');
      setError(String(e));
    }
  }

  return (
    <section data-testid="scr-001-intake">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">CI Log Intake</h1>
      <p className="mb-6 text-sm text-slate-600">
        Drop a CI failure artefact below. Mask Policy v1 runs <em>before</em> persist.
      </p>

      <div
        data-testid="dropzone"
        className="mb-6 flex h-48 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-slate-500 transition hover:border-slate-500 hover:bg-slate-50"
        role="button"
        tabIndex={0}
        aria-label="Upload CI failure artefact"
      >
        Drop log here · or click to upload (CP-3 wires the file picker)
      </div>

      <button
        data-testid="submit-sample"
        onClick={submitSample}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Submit sample intake
      </button>

      <div className="mt-4 text-sm">
        Status: <span data-testid="intake-status" className="font-mono">{status}</span>
      </div>

      {response ? (
        <pre
          data-testid="intake-response"
          className="mt-4 overflow-auto rounded bg-slate-900 p-4 text-xs text-slate-100"
        >
          {JSON.stringify(response, null, 2)}
        </pre>
      ) : null}
      {error ? (
        <pre data-testid="intake-error" className="mt-4 rounded bg-red-50 p-4 text-xs text-red-700">
          {error}
        </pre>
      ) : null}
    </section>
  );
}
