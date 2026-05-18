'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEMO_TENANT_ID } from '../../lib/client';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildSearch,
  statusBadgeClass,
  formatRelative,
  useDebouncedValue,
} from '../../lib/list-utils';

/**
 * SCR-010 — Approvals audit list page (CP-9.3c).
 *
 * Anchors:
 *   - CP-9 enterprise list views (UI phase of RT-007)
 *   - API-013 GET /v1/approvals (CP-9.1f)
 *
 * Tests: tests/playwright/scr-010-approvals-list.spec.ts
 *
 * Filters: action (submit/approve/reject), actor, repair_plan_id,
 *          intake_id, from/to.
 * Columns: when / intake / plan_summary / action-badge /
 *          prior_status → new_status / actor / note / open.
 *
 * Router-replace guard pattern from CP-9.3a applied from the start.
 */

type Row = {
  approval_id: string;
  repair_plan_id: string;
  intake_id: string;
  intake_provider: string;
  intake_run_id: string;
  plan_summary: string;
  action: 'submit' | 'approve' | 'reject';
  prior_status: 'draft' | 'submitted' | 'approved' | 'rejected';
  new_status: 'draft' | 'submitted' | 'approved' | 'rejected';
  actor: string;
  note: string | null;
  created_at: string;
};

type ListResp = { items: Row[]; next_cursor: string | null };

const ACTIONS = ['submit', 'approve', 'reject'] as const;

function actionBadgeClass(a: string): string {
  switch (a) {
    case 'submit':
      return 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200';
    case 'approve':
      return 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-300';
    case 'reject':
      return 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-300';
    default:
      return 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200';
  }
}

export default function ApprovalsListPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [actor, setActor] = useState(sp.get('actor') ?? '');
  const dActor = useDebouncedValue(actor, 250);
  const [action, setAction] = useState(sp.get('action') ?? '');
  const [repairPlanId, setRepairPlanId] = useState(sp.get('repair_plan_id') ?? '');
  const [intakeId, setIntakeId] = useState(sp.get('intake_id') ?? '');
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
      actor: dActor,
      action,
      repair_plan_id: repairPlanId,
      intake_id: intakeId,
      from,
      to,
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    }),
    [dActor, action, repairPlanId, intakeId, from, to, limit, cursor],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextSearch = buildSearch(filters);
    const currentSearch = window.location.search;
    if (nextSearch !== currentSearch) {
      router.replace(`/approvals${nextSearch}`, { scroll: false });
    }
  }, [filters, router]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelection(new Set());
    try {
      const qs = new URLSearchParams();
      if (dActor) qs.set('actor', dActor);
      if (action) qs.set('action', action);
      if (repairPlanId) qs.set('repair_plan_id', repairPlanId);
      if (intakeId) qs.set('intake_id', intakeId);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      qs.set('limit', String(Math.min(MAX_LIMIT, Math.max(1, limit))));
      if (cursor) qs.set('cursor', cursor);
      const r = await fetch(`/api/v1/approvals?${qs.toString()}`, {
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
  }, [dActor, action, repairPlanId, intakeId, from, to, limit, cursor]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const filterFingerprint = `${dActor}|${action}|${repairPlanId}|${intakeId}|${from}|${to}|${limit}`;
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

  const allSelected = rows.length > 0 && rows.every((r) => selection.has(r.approval_id));
  const toggleAll = () => {
    if (allSelected) setSelection(new Set());
    else setSelection(new Set(rows.map((r) => r.approval_id)));
  };
  const toggleRow = (id: string) =>
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section data-testid="scr-010-approvals-list">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Approvals</h1>
          <p className="text-sm text-slate-600">
            Audit log of every plan transition: who submitted, who approved or rejected, when, and why.
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
          Actor
          <input
            data-testid="filter-actor"
            type="text"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="alice@…"
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Action
          <select
            data-testid="filter-action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          >
            <option value="">(any)</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
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
              <th className="px-3 py-2 text-left">Plan summary</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Transition</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Note</th>
              <th className="px-3 py-2 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} data-testid={`row-skeleton-${i}`} className="border-t border-slate-100">
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-3 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr data-testid="error-row">
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-rose-700">
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
                <td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-500">
                  <div className="mx-auto max-w-md">
                    <div className="mb-2 text-base font-medium text-slate-700">No approval audit entries</div>
                    <div className="mb-4">
                      Approval rows are created when a plan is submitted, approved or rejected.
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
                  key={row.approval_id}
                  data-testid={`approval-row-${row.approval_id}`}
                  data-approval-id={row.approval_id}
                  data-repair-plan-id={row.repair_plan_id}
                  data-intake-id={row.intake_id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2">
                    <input
                      data-testid={`row-checkbox-${row.approval_id}`}
                      type="checkbox"
                      checked={selection.has(row.approval_id)}
                      onChange={() => toggleRow(row.approval_id)}
                      aria-label={`Select approval ${row.approval_id}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <span title={row.created_at}>{formatRelative(row.created_at)}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    <div className="font-mono">{row.intake_run_id}</div>
                    <div className="text-slate-400">{row.intake_provider}</div>
                  </td>
                  <td className="max-w-md px-3 py-2 text-slate-700">
                    <div className="line-clamp-2 text-xs" title={row.plan_summary}>
                      {row.plan_summary}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      data-testid={`action-${row.approval_id}`}
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${actionBadgeClass(row.action)}`}
                    >
                      {row.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`inline-flex items-center rounded px-1 py-0.5 ${statusBadgeClass(row.prior_status)}`}>
                      {row.prior_status}
                    </span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span
                      data-testid={`new-status-${row.approval_id}`}
                      className={`inline-flex items-center rounded px-1 py-0.5 ${statusBadgeClass(row.new_status)}`}
                    >
                      {row.new_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.actor}</td>
                  <td className="max-w-xs px-3 py-2 text-slate-600">
                    {row.note ? (
                      <div className="line-clamp-2 text-xs" title={row.note}>
                        {row.note}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      data-testid={`row-open-${row.approval_id}`}
                      href={`/repair-plan/${row.repair_plan_id}/approve`}
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
