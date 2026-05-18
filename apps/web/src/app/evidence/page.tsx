'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEMO_TENANT_ID } from '../../lib/client';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildSearch,
  formatRelative,
} from '../../lib/list-utils';

/**
 * SCR-011 — Evidence exports list page (CP-9.3d).
 *
 * Anchors:
 *   - CP-9 enterprise list views (UI phase of RT-007)
 *   - API-014 GET /v1/evidence-exports (CP-9.1f)
 *
 * Tests: tests/playwright/scr-011-evidence-list.spec.ts
 *
 * Filters: intake_id, repair_plan_id, from/to.
 * Columns: when / intake / plan / sha256 (truncated mono) / size /
 *          bucket/key / open.
 *
 * Router-replace guard from start (CP-9.3a pattern).
 *
 * NOTE: this page does NOT call evidence-detail to fetch presigned_url for
 * each row; the "Open →" link routes to /intake/[id]/evidence which already
 * handles presign-on-demand for download (SCR-006).
 */

type Row = {
  evidence_export_id: string;
  intake_id: string;
  repair_plan_id: string;
  intake_provider: string;
  intake_run_id: string;
  s3_bucket: string;
  s3_key: string;
  sha256: string;
  byte_size: number;
  created_at: string;
};

type ListResp = { items: Row[]; next_cursor: string | null };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function EvidenceListPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [intakeId, setIntakeId] = useState(sp.get('intake_id') ?? '');
  const [repairPlanId, setRepairPlanId] = useState(sp.get('repair_plan_id') ?? '');
  const [from, setFrom] = useState(sp.get('from') ?? '');
  const [to, setTo] = useState(sp.get('to') ?? '');
  const [limit, setLimit] = useState<number>(Number(sp.get('limit') ?? DEFAULT_LIMIT));
  const [cursor, setCursor] = useState<string | null>(sp.get('cursor'));
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);

  const [rows, setRows] = useState<Row[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const filters = useMemo(
    () => ({
      intake_id: intakeId,
      repair_plan_id: repairPlanId,
      from,
      to,
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    }),
    [intakeId, repairPlanId, from, to, limit, cursor],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextSearch = buildSearch(filters);
    const currentSearch = window.location.search;
    if (nextSearch !== currentSearch) {
      router.replace(`/evidence${nextSearch}`, { scroll: false });
    }
  }, [filters, router]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelection(new Set());
    try {
      const qs = new URLSearchParams();
      if (intakeId) qs.set('intake_id', intakeId);
      if (repairPlanId) qs.set('repair_plan_id', repairPlanId);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      qs.set('limit', String(Math.min(MAX_LIMIT, Math.max(1, limit))));
      if (cursor) qs.set('cursor', cursor);
      const r = await fetch(`/api/v1/evidence-exports?${qs.toString()}`, {
        headers: { 'x-tenant-id': DEMO_TENANT_ID },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(`HTTP ${r.status}: ${JSON.stringify(j)}`);
        setRows([]);
        setNextCursor(null);
        return;
      }
      const j: ListResp = await r.json();
      setRows(j.items);
      setNextCursor(j.next_cursor);
    } catch (e) {
      setError(String(e));
      setRows([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [intakeId, repairPlanId, from, to, limit, cursor]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const filterFingerprint = `${intakeId}|${repairPlanId}|${from}|${to}|${limit}`;
  useEffect(() => {
    setCursor(null);
    setCursorStack([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFingerprint]);

  const onNextPage = () => {
    if (!nextCursor) return;
    setCursorStack((s) => [...s, cursor]);
    setCursor(nextCursor);
  };
  const onPrevPage = () => {
    if (cursorStack.length === 0) return;
    const prev = cursorStack[cursorStack.length - 1] ?? null;
    setCursorStack((s) => s.slice(0, -1));
    setCursor(prev);
  };

  const allSelected = rows.length > 0 && rows.every((r) => selection.has(r.evidence_export_id));
  const toggleAll = () => {
    if (allSelected) setSelection(new Set());
    else setSelection(new Set(rows.map((r) => r.evidence_export_id)));
  };
  const toggleRow = (id: string) =>
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalBytes = rows.reduce((acc, r) => acc + r.byte_size, 0);

  return (
    <section data-testid="scr-011-evidence-list">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Evidence exports</h1>
          <p className="text-sm text-slate-600">
            Audit-grade ZIP bundles uploaded to MinIO with SHA-256 chain. Drill in to download.
          </p>
        </div>
        <a
          data-testid="link-back-intakes"
          href="/intakes"
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Intakes
        </a>
      </div>

      <div
        data-testid="filter-bar"
        className="mb-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 md:grid-cols-4"
      >
        <label className="text-xs font-medium text-slate-700">
          Intake ID
          <input
            data-testid="filter-intake-id"
            type="text"
            value={intakeId}
            onChange={(e) => setIntakeId(e.target.value)}
            placeholder="uuid"
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Repair plan ID
          <input
            data-testid="filter-repair-plan-id"
            type="text"
            value={repairPlanId}
            onChange={(e) => setRepairPlanId(e.target.value)}
            placeholder="uuid"
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          From
          <input
            data-testid="filter-from"
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          To
          <input
            data-testid="filter-to"
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          />
        </label>
      </div>

      <div className="mb-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span data-testid="row-count" className="text-slate-600">
            {rows.length} on this page
          </span>
          {rows.length > 0 ? (
            <span data-testid="row-total-bytes" className="text-xs text-slate-500">
              · {formatBytes(totalBytes)} total on this page
            </span>
          ) : null}
          {selection.size > 0 ? (
            <span
              data-testid="selection-count"
              className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-200"
            >
              {selection.size} selected
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">
            Page size
            <select
              data-testid="filter-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="ml-1 rounded border-slate-300 px-1 py-0.5 text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <button
            data-testid="page-prev"
            onClick={onPrevPage}
            disabled={cursorStack.length === 0}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            ‹ Prev
          </button>
          <button
            data-testid="page-next"
            onClick={onNextPage}
            disabled={!nextCursor}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next ›
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="w-8 px-3 py-2 text-left">
                <input
                  data-testid="select-all"
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all rows on this page"
                />
              </th>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">Intake</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">SHA-256</th>
              <th className="px-3 py-2 text-right">Size</th>
              <th className="px-3 py-2 text-left">Bucket / key</th>
              <th className="px-3 py-2 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} data-testid={`row-skeleton-${i}`} className="border-t border-slate-100">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-3 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr data-testid="error-row">
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-rose-700">
                  <div>{error}</div>
                  <button
                    data-testid="retry-button"
                    onClick={() => void fetchList()}
                    className="mt-2 rounded border border-rose-300 bg-white px-3 py-1 text-xs text-rose-800"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr data-testid="empty-row">
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">
                  <div className="mx-auto max-w-md">
                    <div className="mb-2 text-base font-medium text-slate-700">No evidence exports yet</div>
                    <div className="mb-4">
                      Evidence bundles are created after a plan is approved. Approve a plan and generate one.
                    </div>
                    <a
                      data-testid="empty-cta"
                      href="/repair-plans"
                      className="inline-block rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Go to Repair plans
                    </a>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.evidence_export_id}
                  data-testid={`evidence-row-${row.evidence_export_id}`}
                  data-evidence-export-id={row.evidence_export_id}
                  data-intake-id={row.intake_id}
                  data-repair-plan-id={row.repair_plan_id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2">
                    <input
                      data-testid={`row-checkbox-${row.evidence_export_id}`}
                      type="checkbox"
                      checked={selection.has(row.evidence_export_id)}
                      onChange={() => toggleRow(row.evidence_export_id)}
                      aria-label={`Select evidence ${row.evidence_export_id}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <span title={row.created_at}>{formatRelative(row.created_at)}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    <div className="font-mono">{row.intake_run_id}</div>
                    <div className="text-slate-400">{row.intake_provider}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {row.repair_plan_id.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2">
                    <span
                      data-testid={`sha256-${row.evidence_export_id}`}
                      className="font-mono text-xs text-slate-500"
                      title={row.sha256}
                    >
                      {row.sha256.slice(0, 12)}…
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {formatBytes(row.byte_size)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    <div title={row.s3_bucket}>{row.s3_bucket}</div>
                    <div className="text-slate-400" title={row.s3_key}>
                      {row.s3_key.split('/').slice(-1)[0]}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      data-testid={`row-open-${row.evidence_export_id}`}
                      href={`/intake/${row.intake_id}/evidence`}
                      className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      Open →
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
