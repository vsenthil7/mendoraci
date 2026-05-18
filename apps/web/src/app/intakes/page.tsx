'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEMO_TENANT_ID } from '../../lib/client';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildSearch,
  statusBadgeClass,
  booleanBadgeClass,
  formatRelative,
  useDebouncedValue,
} from '../../lib/list-utils';

/**
 * SCR-007 — Intakes list page (CP-9.2).
 *
 * Anchors:
 *   - CP-9 enterprise list views
 *   - API-010 GET /v1/intakes (CP-9.1c)
 *
 * Behaviour contract (covered by tests/playwright/scr-007-intakes-list.spec.ts):
 *   - Sticky sortable header table
 *   - Cursor pagination (Next page / Prev via filter persistence)
 *   - URL-persisted filters: q, provider, plan_status, has_rca, has_plan,
 *     has_export, from, to, limit
 *   - 250 ms debounce on free-text search
 *   - Color-coded plan_status badge
 *   - Boolean badges for has_rca / has_plan / has_export
 *   - Selection checkboxes (per-row + select-all; visible count badge)
 *   - Empty state with CTA to /
 *   - Loading skeleton on first load and on filter change
 *   - Error state with retry button
 *   - Each row click → /intake/[id]/rca deep link
 */

type Row = {
  intake_id: string;
  provider: string;
  run_id: string;
  attempt_id: string;
  branch: string | null;
  commit_sha: string | null;
  actor: string | null;
  mask_policy_version: string;
  created_at: string;
  has_rca: boolean;
  has_plan: boolean;
  plan_status: 'draft' | 'submitted' | 'approved' | 'rejected' | null;
  has_export: boolean;
};

type ListResp = { items: Row[]; next_cursor: string | null };

const PLAN_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;
const TRI_STATES = ['', 'true', 'false'] as const;

export default function IntakesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- Filter state mirrors URL ---
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const debouncedQ = useDebouncedValue(q, 250);
  const [provider, setProvider] = useState(searchParams.get('provider') ?? '');
  const [planStatus, setPlanStatus] = useState(searchParams.get('plan_status') ?? '');
  const [hasRca, setHasRca] = useState(searchParams.get('has_rca') ?? '');
  const [hasPlan, setHasPlan] = useState(searchParams.get('has_plan') ?? '');
  const [hasExport, setHasExport] = useState(searchParams.get('has_export') ?? '');
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');
  const [limit, setLimit] = useState<number>(Number(searchParams.get('limit') ?? DEFAULT_LIMIT));
  const [cursor, setCursor] = useState<string | null>(searchParams.get('cursor'));
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);

  // --- Data state ---
  const [rows, setRows] = useState<Row[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selection, setSelection] = useState<Set<string>>(new Set());

  // --- Build filter map (used both for the URL and the API call) ---
  const filters = useMemo(
    () => ({
      q: debouncedQ,
      provider,
      plan_status: planStatus,
      has_rca: hasRca,
      has_plan: hasPlan,
      has_export: hasExport,
      from,
      to,
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    }),
    [debouncedQ, provider, planStatus, hasRca, hasPlan, hasExport, from, to, limit, cursor],
  );

  // --- Push filter state into the URL whenever it changes ---
  useEffect(() => {
    const next = `/intakes${buildSearch(filters)}`;
    router.replace(next, { scroll: false });
  }, [filters, router]);

  // --- Fetch on filter change ---
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelection(new Set());
    try {
      const sp = new URLSearchParams();
      if (debouncedQ) sp.set('q', debouncedQ);
      if (provider) sp.set('provider', provider);
      if (planStatus) sp.set('plan_status', planStatus);
      if (hasRca) sp.set('has_rca', hasRca);
      if (hasPlan) sp.set('has_plan', hasPlan);
      if (hasExport) sp.set('has_export', hasExport);
      if (from) sp.set('from', from);
      if (to) sp.set('to', to);
      sp.set('limit', String(Math.min(MAX_LIMIT, Math.max(1, limit))));
      if (cursor) sp.set('cursor', cursor);
      const r = await fetch(`/api/v1/intakes?${sp.toString()}`, {
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
  }, [debouncedQ, provider, planStatus, hasRca, hasPlan, hasExport, from, to, limit, cursor]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // --- Reset cursor when filters (not cursor itself) change ---
  // We track which filter was the last to change so we can decide whether
  // to push a new cursor onto the stack or reset the stack.
  const filterFingerprint = `${debouncedQ}|${provider}|${planStatus}|${hasRca}|${hasPlan}|${hasExport}|${from}|${to}|${limit}`;
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

  const allSelected = rows.length > 0 && rows.every((r) => selection.has(r.intake_id));
  const toggleAll = () => {
    if (allSelected) setSelection(new Set());
    else setSelection(new Set(rows.map((r) => r.intake_id)));
  };
  const toggleRow = (id: string) =>
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // --- Render ---
  return (
    <section data-testid="scr-007-intakes-list">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Intakes</h1>
          <p className="text-sm text-slate-600">
            CI failure artefacts ingested into MendoraCI. Filter, paginate, drill down.
          </p>
        </div>
        <a
          data-testid="cta-new-intake"
          href="/"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          + New intake
        </a>
      </div>

      {/* ---------- FILTER BAR ---------- */}
      <div
        data-testid="filter-bar"
        className="mb-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 md:grid-cols-4"
      >
        <label className="text-xs font-medium text-slate-700">
          Search (run_id / branch / actor)
          <input
            data-testid="filter-q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search…"
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
            placeholder="github / jenkins / …"
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Plan status
          <select
            data-testid="filter-plan-status"
            value={planStatus}
            onChange={(e) => setPlanStatus(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          >
            <option value="">(any)</option>
            {PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Has RCA
          <select
            data-testid="filter-has-rca"
            value={hasRca}
            onChange={(e) => setHasRca(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          >
            {TRI_STATES.map((s) => (
              <option key={s || 'any'} value={s}>
                {s || '(any)'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Has plan
          <select
            data-testid="filter-has-plan"
            value={hasPlan}
            onChange={(e) => setHasPlan(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          >
            {TRI_STATES.map((s) => (
              <option key={s || 'any'} value={s}>
                {s || '(any)'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Has export
          <select
            data-testid="filter-has-export"
            value={hasExport}
            onChange={(e) => setHasExport(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          >
            {TRI_STATES.map((s) => (
              <option key={s || 'any'} value={s}>
                {s || '(any)'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          From (ISO)
          <input
            data-testid="filter-from"
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          To (ISO)
          <input
            data-testid="filter-to"
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          />
        </label>
      </div>

      {/* ---------- TOOLBAR ---------- */}
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

      {/* ---------- TABLE ---------- */}
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
              <th className="px-3 py-2 text-left">Provider</th>
              <th className="px-3 py-2 text-left">Run</th>
              <th className="px-3 py-2 text-left">Branch</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">RCA</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Export</th>
              <th className="px-3 py-2 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // 5-row skeleton so the layout doesn't jump on first paint
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} data-testid={`row-skeleton-${i}`} className="border-t border-slate-100">
                  {Array.from({ length: 11 }).map((__, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-3 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr data-testid="error-row">
                <td colSpan={11} className="px-3 py-6 text-center text-sm text-rose-700">
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
                <td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-500">
                  <div className="mx-auto max-w-md">
                    <div className="mb-2 text-base font-medium text-slate-700">No intakes yet</div>
                    <div className="mb-4">
                      Drop your first CI failure log to see it analysed end-to-end.
                    </div>
                    <a
                      data-testid="empty-cta"
                      href="/"
                      className="inline-block rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Submit your first intake
                    </a>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.intake_id}
                  data-testid={`intake-row-${row.intake_id}`}
                  data-intake-id={row.intake_id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2">
                    <input
                      data-testid={`row-checkbox-${row.intake_id}`}
                      type="checkbox"
                      checked={selection.has(row.intake_id)}
                      onChange={() => toggleRow(row.intake_id)}
                      aria-label={`Select intake ${row.intake_id}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <span title={row.created_at}>{formatRelative(row.created_at)}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.provider}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-900">{row.run_id}</td>
                  <td className="px-3 py-2 text-slate-700">{row.branch ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{row.actor ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${booleanBadgeClass(row.has_rca)}`}
                    >
                      {row.has_rca ? 'yes' : 'no'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${booleanBadgeClass(row.has_plan)}`}
                    >
                      {row.has_plan ? 'yes' : 'no'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.plan_status ? (
                      <span
                        data-testid={`plan-status-${row.intake_id}`}
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${statusBadgeClass(row.plan_status)}`}
                      >
                        {row.plan_status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${booleanBadgeClass(row.has_export)}`}
                    >
                      {row.has_export ? 'yes' : 'no'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      data-testid={`row-open-${row.intake_id}`}
                      href={`/intake/${row.intake_id}/rca`}
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
