'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DEMO_TENANT_ID } from '../../../../lib/client';

/**
 * SCR-003 — Root-Cause Analysis page.
 * Anchors: RT-003 (BR-003, BR-012), API-004, RT-013 (tenant scoping via header).
 *
 * Mounted at /intake/[id]/rca. Triggers POST /v1/intake/:id/rca and renders
 * the structured RCA finding (root cause, confidence, evidence, recommended
 * actions). Surfaces 404 intake_not_found, 412 mask_preview_unavailable,
 * 503 bob_unavailable, 504 bob_timeout from the API.
 */

type RcaStatus = 'idle' | 'submitting' | 'done' | 'error';

interface RcaOutput {
  root_cause: string;
  confidence: 'low' | 'medium' | 'high';
  evidence_snippets: string[];
  recommended_actions: string[];
}

interface RcaResponse {
  rca_finding_id: string;
  intake_id: string;
  provider: 'bob' | 'mock-bob';
  model_id: string;
  output: RcaOutput;
  bob_latency_ms: number;
  created_at: string;
}

export default function RcaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const intakeId = params?.id ?? '';

  const [chatMode, setChatMode] = useState<'plan' | 'code' | 'advanced' | 'ask'>('ask');
  const [status, setStatus] = useState<RcaStatus>('idle');
  const [rca, setRca] = useState<RcaResponse | null>(null);
  const [error, setError] = useState<string>('');

  async function runRca() {
    setStatus('submitting');
    setError('');
    setRca(null);
    try {
      const r = await fetch(`/api/v1/intake/${intakeId}/rca`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-id': DEMO_TENANT_ID },
        body: JSON.stringify({ chat_mode: chatMode }),
      });
      const j = await r.json();
      if (r.ok) {
        setRca(j as RcaResponse);
        setStatus('done');
      } else {
        setStatus('error');
        setError(JSON.stringify(j));
      }
    } catch (e) {
      setStatus('error');
      setError(String(e));
    }
  }

  return (
    <section data-testid="scr-003-rca">
      <button
        data-testid="back-to-intake"
        onClick={() => router.push('/')}
        className="mb-4 text-sm text-slate-600 hover:text-slate-900"
      >
        ← Back to intake
      </button>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Root-Cause Analysis (SCR-003)</h1>
      <p className="mb-6 text-sm text-slate-600">
        Run RCA on intake <span className="font-mono">{intakeId}</span> using IBM Bob. The masked
        log preview is sent to Bob — raw secrets are never transmitted.
      </p>

      <div className="space-y-4 rounded border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="chat-mode" className="mb-1 block text-sm font-medium text-slate-700">
            Bob chat mode
          </label>
          <select
            id="chat-mode"
            data-testid="chat-mode-select"
            value={chatMode}
            onChange={(e) => setChatMode(e.target.value as typeof chatMode)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ask">ask (default - inference only)</option>
            <option value="plan">plan</option>
            <option value="code">code</option>
            <option value="advanced">advanced</option>
          </select>
        </div>

        <button
          data-testid="run-rca"
          onClick={runRca}
          disabled={status === 'submitting' || !intakeId}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {status === 'submitting' ? 'Asking Bob…' : 'Run RCA'}
        </button>
      </div>

      <div className="mt-4 text-sm">
        Status: <span data-testid="rca-status" className="font-mono">{status}</span>
      </div>

      {rca ? (
        <div data-testid="rca-result" className="mt-4 space-y-4 rounded border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Provider</div>
              <div
                data-testid="rca-provider"
                className="font-mono text-sm text-slate-900"
              >
                {rca.provider} ({rca.model_id})
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">Latency</div>
              <div data-testid="rca-latency" className="font-mono text-sm text-slate-900">
                {rca.bob_latency_ms} ms
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Root cause</div>
            <div data-testid="rca-root-cause" className="text-base text-slate-900">
              {rca.output.root_cause}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Confidence</div>
            <div data-testid="rca-confidence" className="font-mono text-sm text-slate-900">
              {rca.output.confidence}
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              Evidence ({rca.output.evidence_snippets.length})
            </div>
            <ul data-testid="rca-evidence" className="list-disc space-y-1 pl-5 text-sm">
              {rca.output.evidence_snippets.map((s, i) => (
                <li key={i} data-testid={`rca-evidence-${i}`} className="font-mono text-slate-700">
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              Recommended actions ({rca.output.recommended_actions.length})
            </div>
            <ol data-testid="rca-actions" className="list-decimal space-y-1 pl-5 text-sm">
              {rca.output.recommended_actions.map((a, i) => (
                <li key={i} data-testid={`rca-action-${i}`} className="text-slate-700">
                  {a}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      {error ? (
        <pre data-testid="rca-error" className="mt-4 rounded bg-red-50 p-4 text-xs text-red-700">
          {error}
        </pre>
      ) : null}
    </section>
  );
}
