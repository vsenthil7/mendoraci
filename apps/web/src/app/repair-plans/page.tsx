'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEMO_TENANT_ID } from '../../lib/client';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildSearch,
  statusBadgeClass,
  riskBadgeClass,
  formatRelative,
  useDebouncedValue,
} from '../../lib/list-utils';

/**
 * SCR-009 — Repair plans list page (CP-9.3b).
 *
 * Anchors:
 *   - CP-9 enterprise list views (UI phase of RT-007)
 *   - API-012 GET /v1/repair-plans (CP-9.1e)
 *
 * Tests: tests/playwright/scr-009-repair-plans-list.spec.ts
 *
 * Filters: q (summary ILIKE), status, overall_risk, est_total_effort,
 *          provider, intake_id, from/to.
 * Columns: when / intake / status-badge / risk-badge / effort / step_count /
 *          last_approval (action+actor+when) / open.
 *
 * Router-replace guard pattern from CP-9.3a applied from the start.
 */

type Row = {
  repair_plan_id: string;
  intake_id: string;
  intake_provider: string;
  intake_run_id: string;
  intake_branch: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  summary: string;
  overall_risk: 'low' | 'medium' | 'high';
  est_total_effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  step_count: number;
  provider: string;
  model_id: string;
  bob_latency_ms: number;
  last_approval_action: 'submit' | 'approve' | 'reject' | null;
  last_approval_actor: string | null;
  last_approval_at: string | null;
  created_at: string;
};

type ListResp = { items: Row[]; next_cursor: string | null };

const STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;
const RISKS = ['low', 'medium', 'high'] as const;
const EFFORTS = ['XS', 'S', 'M', 'L', 'XL'] as const;

export default function RepairPlansListPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebouncedValue(q, 250);
  const [status, setStatus] = useState(sp.get('status') ?? '');
  const [overallRisk, setOverallRisk] = useState(sp.get('overall_risk') ?? '');
  const [effort, setEffort] = useState(sp.get('est_total_effort') ?? '');
  const [intakeId, setIntakeId] = useState(sp.get('intake_id') ?? '');
  const [provider, setProvider] = useState(sp.get('provider') ?? '');
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
      q: dq,
      status,
      overall_risk: overallRisk,
      est_total_effort: effort,
      intake_id: intakeId,
      provider,
      from,
      to,
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    }),
    [dq, status, overallRisk, effort, intakeId, provider, from, to, limit, cursor],
  );

  // CP-9.3a router-replace guard: only push to history if URL actually changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextSearch = buildSearch(filters);
    const currentSearch = window.location.search;
    if (nextSearch !== currentSearch) {
      router.replace(`/repair-plans${nextSearch}`, { scroll: false });
    }
  }, [filters, router]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelection(new Set());
    try {
      const qs = new URLSearchParams();
      if (dq) qs.set('q', dq);
      if (status) qs.set('status', status);
      if (overallRisk) qs.set('overall_risk', overallRisk);
      if (effort) qs.set('est_total_effort', effort);
      if (intakeId) qs.set('intake_id', intakeId);
      if (provider) qs.set('provider', provider);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      qs.set('limit', String(Math.min(MAX_LIMIT, Math.max(1, limit))));
      if (cursor) qs.set('cursor', cursor);
      const r = await fetch(`/api/v1/repair-plans?${qs.toString()}`, {
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
  }, [dq, status, overallRisk, effort, intakeId, provider, from, to, limit, cursor]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const filterFingerprint = `${dq}|${status}|${overallRisk}|${effort}|${intakeId}|${provider}|${from}|${to}|${limit}`;
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

  const allSelected = rows.length > 0 && rows.every((r) => selection.has(r.repair_plan_id));
  const toggleAll = () => {
    if (allSelected) setSelection(new Set());
    else setSelection(new Set(rows.map((r) => r.repair_plan_id)));
  };
  const toggleRow = (id: string) =>
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section data-testid="scr-009-repair-plans-list">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Repair plans</h1>
          <p className="text-sm text-slate-600">
            AI-generated repair plans for ingested CI failures. Filter, gate by status, drill into intake.
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
          Search summary
          <input
            data-testid="filter-q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. memory limit…"
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Status
          <select
            data-testid="filter-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          >
            <option value="">(any)</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Overall risk
          <select
            data-testid="filter-overall-risk"
            value={overallRisk}
            onChange={(e) => setOverallRisk(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          >
            <option value="">(any)</option>
            {RISKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Effort
          <select
            data-testid="filter-effort"
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          >
            <option value="">(any)</option>
            {EFFORTS.map((e2) => (
              <option key={e2} value={e2}>
                {e2}
              </option>
            ))}
          </select>
        </label>
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
          Provider
          <input
            data-testid="filter-provider"
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="bob / mock-bob"
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
              <th className="px-3 py-2 text-left">Summary</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Risk</th>
              <th className="px-3 py-2 text-left">Effort</th>
              <th className="px-3 py-2 text-right">Steps</th>
              <th className="px-3 py-2 text-left">Last approval</th>
              <th className="px-3 py-2 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} data-testid={`row-skeleton-${i}`} className="border-t border-slate-100">
                  {Array.from({ length: 10 }).map((__, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-3 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr data-testid="error-row">
                <td colSpan={10} className="px-3 py-6 text-center text-sm text-rose-700">
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
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-500">
                  <div className="mx-auto max-w-md">
                    <div className="mb-2 text-base font-medium text-slate-700">No repair plans yet</div>
                    <div className="mb-4">
                      Repair plans are generated from RCAs. Run an RCA and trigger a plan generation.
                    </div>
                    <a
                      data-testid="empty-cta"
                      href="/intakes"
                      className="inline-block rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Go to Intakes
                    </a>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.repair_plan_id}
                  data-testid={`plan-row-${row.repair_plan_id}`}
                  data-repair-plan-id={row.repair_plan_id}
                  data-intake-id={row.intake_id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2">
                    <input
                      data-testid={`row-checkbox-${row.repair_plan_id}`}
                      type="checkbox"
                      checked={selection.has(row.repair_plan_id)}
                      onChange={() => toggleRow(row.repair_plan_id)}
                      aria-label={`Select plan ${row.repair_plan_id}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <span title={row.created_at}>{formatRelative(row.created_at)}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    <div className="font-mono">{row.intake_run_id}</div>
                    <div className="text-slate-400">
                      {row.intake_provider}
                      {row.intake_branch ? ` · ${row.intake_branch}` : ''}
                    </div>
                  </td>
                  <td className="max-w-md px-3 py-2 text-slate-700">
                    <div className="line-clamp-2" title={row.summary}>
                      {row.summary}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      data-testid={`plan-status-${row.repair_plan_id}`}
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${statusBadgeClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      data-testid={`plan-risk-${row.repair_plan_id}`}
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${riskBadgeClass(row.overall_risk)}`}
                    >
                      {row.overall_risk}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.est_total_effort}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.step_count}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {row.last_approval_action ? (
                      <>
                        <div>
                          <span className="font-medium">{row.last_approval_action}</span>
                          {row.last_approval_actor ? ` · ${row.last_approval_actor}` : ''}
                        </div>
                        {row.last_approval_at ? (
                          <div className="text-slate-400">{formatRelative(row.last_approval_at)}</div>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      data-testid={`row-open-${row.repair_plan_id}`}
                      href={`/intake/${row.intake_id}/repair-plan`}
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
