'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DEMO_TENANT_ID } from '../../../../lib/client';
import { setActiveIntakeId, setActiveRepairPlanId } from '../../../../lib/active-context';

/**
 * SCR-006 — Evidence Export page.
 * Anchors: RT-006 (BR-006), API-009, RT-013 (tenant scoping via header).
 *
 * Mounted at /intake/[id]/evidence. Triggers POST /v1/intake/:id/evidence-export
 * and renders the result panel: evidence_export_id, sha256, byte_size, s3_key,
 * presigned download link, manifest preview. Surfaces 412 plan_not_approved
 * (most common error path - the user needs to approve first), 404, 503.
 *
 * CP-8b: stamps intake_id (from route) into sessionStorage and, on success,
 * stamps the repair_plan_id from the response so the top-level Approve nav
 * link continues to deep-link correctly even after the evidence export.
 */

type ExportStatus = 'idle' | 'submitting' | 'done' | 'error';

interface ExportResponse {
  evidence_export_id: string;
  intake_id: string;
  repair_plan_id: string;
  s3_key: string;
  sha256: string;
  byte_size: number;
  presigned_url: string;
  presigned_expires_at: string;
  created_at: string;
}

export default function EvidenceExportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const intakeId = params?.id ?? '';

  if (intakeId) setActiveIntakeId(intakeId);

  const [ttl, setTtl] = useState<number>(300);
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [result, setResult] = useState<ExportResponse | null>(null);
  const [error, setError] = useState<string>('');

  async function runExport() {
    setStatus('submitting');
    setError('');
    setResult(null);
    try {
      const r = await fetch(`/api/v1/intake/${intakeId}/evidence-export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-id': DEMO_TENANT_ID },
        body: JSON.stringify({ presigned_ttl_seconds: ttl }),
      });
      const j = await r.json();
      if (r.ok) {
        const payload = j as ExportResponse;
        setResult(payload);
        setStatus('done');
        if (payload.repair_plan_id) setActiveRepairPlanId(payload.repair_plan_id);
      } else {
        setStatus('error');
        setError(JSON.stringify(j));
      }
    } catch (e) {
      setStatus('error');
      setError(String(e));
    }
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <section data-testid="scr-006-evidence">
      <button
        data-testid="back-to-intake"
        onClick={() => router.push('/')}
        className="mb-4 text-sm text-slate-600 hover:text-slate-900"
      >
        ← Back to intake
      </button>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Evidence Export (SCR-006)</h1>
      <p className="mb-6 text-sm text-slate-600">
        Generate an immutable ZIP bundle for intake{' '}
        <span className="font-mono">{intakeId}</span>. Requires the repair plan to be{' '}
        <span className="font-medium">approved</span>.
      </p>

      <div className="space-y-4 rounded border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="ttl" className="mb-1 block text-sm font-medium text-slate-700">
            Presigned URL TTL (seconds, 60..3600)
          </label>
          <input
            id="ttl"
            data-testid="ttl-input"
            type="number"
            min={60}
            max={3600}
            value={ttl}
            onChange={(e) => setTtl(Number(e.target.value))}
            className="w-40 rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          data-testid="run-export"
          onClick={runExport}
          disabled={status === 'submitting' || !intakeId}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {status === 'submitting' ? 'Building bundle…' : 'Generate evidence bundle'}
        </button>
      </div>

      <div className="mt-4 text-sm">
        Status: <span data-testid="export-status" className="font-mono">{status}</span>
      </div>

      {result ? (
        <div
          data-testid="export-result"
          className="mt-4 space-y-4 rounded border border-slate-200 bg-white p-6"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Export ID</div>
              <div data-testid="export-id" className="font-mono text-xs text-slate-900">
                {result.evidence_export_id}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">Size</div>
              <div data-testid="export-bytes" className="font-mono text-sm text-slate-900">
                {formatBytes(result.byte_size)}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">S3 key</div>
            <div data-testid="export-s3-key" className="break-all font-mono text-xs text-slate-700">
              {result.s3_key}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">SHA-256</div>
            <div
              data-testid="export-sha256"
              className="break-all font-mono text-xs text-slate-700"
            >
              {result.sha256}
            </div>
          </div>

          <div>
            <a
              data-testid="download-link"
              href={result.presigned_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              Download evidence bundle (ZIP)
            </a>
            <div className="mt-1 text-xs text-slate-500">
              Link expires at{' '}
              <span data-testid="export-expires" className="font-mono">
                {result.presigned_expires_at}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <pre data-testid="export-error" className="mt-4 rounded bg-red-50 p-4 text-xs text-red-700">
          {error}
        </pre>
      ) : null}
    </section>
  );
}
