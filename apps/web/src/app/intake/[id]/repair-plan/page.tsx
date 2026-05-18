'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DEMO_TENANT_ID } from '../../../../lib/client';

/**
 * SCR-004 — Repair Plan page.
 * Anchors: RT-004 (BR-004), API-005, RT-013 (tenant scoping via header).
 *
 * Mounted at /intake/[id]/repair-plan. Triggers POST /v1/intake/:id/repair-plan
 * and renders the structured plan: summary, overall risk badge, ordered steps
 * (title + description + type + files + effort + risk), rollback strategy.
 * Surfaces 412 rca_required (no RCA yet), 404 intake_not_found, 503/504 Bob
 * failures. Each step has data-testid hooks for Pw assertions.
 */

type PlanStatus = 'idle' | 'submitting' | 'done' | 'error';

interface Step {
  step_id?: string;
  rank?: number;
  title: string;
  description: string;
  type: string;
  files?: string[];
  est_effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  risk: 'low' | 'medium' | 'high';
}

interface PlanResponse {
  repair_plan_id: string;
  rca_finding_id: string;
  intake_id: string;
  provider: 'bob' | 'mock-bob';
  model_id: string;
  output: {
    summary: string;
    overall_risk: 'low' | 'medium' | 'high';
    steps: Step[];
    rollback_strategy: string;
    est_total_effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  };
  bob_latency_ms: number;
  created_at: string;
}

const riskColor: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
};

export default function RepairPlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const intakeId = params?.id ?? '';

  const [chatMode, setChatMode] = useState<'plan' | 'code' | 'advanced' | 'ask'>('plan');
  const [status, setStatus] = useState<PlanStatus>('idle');
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string>('');

  async function runPlan() {
    setStatus('submitting');
    setError('');
    setPlan(null);
    try {
      const r = await fetch(`/api/v1/intake/${intakeId}/repair-plan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-id': DEMO_TENANT_ID },
        body: JSON.stringify({ chat_mode: chatMode }),
      });
      const j = await r.json();
      if (r.ok) {
        setPlan(j as PlanResponse);
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
    <section data-testid="scr-004-repair-plan">
      <button
        data-testid="back-to-intake"
        onClick={() => router.push('/')}
        className="mb-4 text-sm text-slate-600 hover:text-slate-900"
      >
        ← Back to intake
      </button>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Repair Plan (SCR-004)</h1>
      <p className="mb-6 text-sm text-slate-600">
        Generate a step-by-step repair plan for intake{' '}
        <span className="font-mono">{intakeId}</span>. Requires a completed RCA finding.
      </p>

      <div className="space-y-4 rounded border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="plan-chat-mode" className="mb-1 block text-sm font-medium text-slate-700">
            Bob chat mode
          </label>
          <select
            id="plan-chat-mode"
            data-testid="plan-chat-mode-select"
            value={chatMode}
            onChange={(e) => setChatMode(e.target.value as typeof chatMode)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="plan">plan (default - structured planning)</option>
            <option value="ask">ask</option>
            <option value="code">code</option>
            <option value="advanced">advanced</option>
          </select>
        </div>

        <button
          data-testid="run-plan"
          onClick={runPlan}
          disabled={status === 'submitting' || !intakeId}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {status === 'submitting' ? 'Asking Bob…' : 'Generate repair plan'}
        </button>
      </div>

      <div className="mt-4 text-sm">
        Status: <span data-testid="plan-status" className="font-mono">{status}</span>
      </div>

      {plan ? (
        <div data-testid="plan-result" className="mt-4 space-y-4 rounded border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Provider</div>
              <div data-testid="plan-provider" className="font-mono text-sm text-slate-900">
                {plan.provider} ({plan.model_id})
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">Latency</div>
              <div data-testid="plan-latency" className="font-mono text-sm text-slate-900">
                {plan.bob_latency_ms} ms
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Summary</div>
            <div data-testid="plan-summary" className="text-base text-slate-900">
              {plan.output.summary}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Overall risk</div>
              <span
                data-testid="plan-overall-risk"
                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${riskColor[plan.output.overall_risk]}`}
              >
                {plan.output.overall_risk}
              </span>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Total effort</div>
              <span
                data-testid="plan-total-effort"
                className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800"
              >
                {plan.output.est_total_effort}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
              Steps ({plan.output.steps.length})
            </div>
            <ol data-testid="plan-steps" className="space-y-3">
              {plan.output.steps.map((s, i) => (
                <li
                  key={i}
                  data-testid={`plan-step-${i}`}
                  className="rounded border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div
                        data-testid={`plan-step-${i}-title`}
                        className="font-medium text-slate-900"
                      >
                        {i + 1}. {s.title}
                      </div>
                      <div
                        data-testid={`plan-step-${i}-description`}
                        className="mt-1 text-sm text-slate-700"
                      >
                        {s.description}
                      </div>
                      {s.files && s.files.length > 0 ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Files:{' '}
                          {s.files.map((f, j) => (
                            <span key={j} className="mr-2 font-mono">
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
                        {s.type}
                      </span>
                      <span
                        data-testid={`plan-step-${i}-risk`}
                        className={`rounded px-2 py-0.5 font-medium ${riskColor[s.risk]}`}
                      >
                        {s.risk}
                      </span>
                      <span
                        data-testid={`plan-step-${i}-effort`}
                        className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700"
                      >
                        {s.est_effort}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              Rollback strategy
            </div>
            <div data-testid="plan-rollback" className="text-sm text-slate-700">
              {plan.output.rollback_strategy}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <pre data-testid="plan-error" className="mt-4 rounded bg-red-50 p-4 text-xs text-red-700">
          {error}
        </pre>
      ) : null}
    </section>
  );
}
