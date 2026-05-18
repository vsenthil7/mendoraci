'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEMO_TENANT_ID } from '../../lib/client';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildSearch,
  confidenceBadgeClass,
  formatRelative,
  useDebouncedValue,
} from '../../lib/list-utils';

/**
 * SCR-008 — RCA findings list page (CP-9.3a).
 *
 * Anchors:
 *   - CP-9 enterprise list views (UI phase of RT-007)
 *   - API-011 GET /v1/rca-findings (CP-9.1d)
 *
 * Tests: tests/playwright/scr-008-rca-list.spec.ts
 *
 * Mirror of /intakes (SCR-007) but listing RCA findings with:
 *   - Intake context columns (provider, run_id, branch)
 *   - Confidence color-coded badge (low/medium/high)
 *   - Evidence + recommended-action counts
 *   - bob_latency_ms inline (perf hint for ops)
 * Filters: q (on root_cause), confidence, intake_id, provider, from/to
 *
 * NOTE on URL sync (firefox + webkit fix discovered in CP-9.3a Pw-010c on
 * webkit): the previous version called router.replace() unconditionally
 * on every filter change. When loaded with `/rca?confidence=high` and the
 * default-limit normalisation kicked in, that replaced the URL to
 * `/rca?confidence=high&limit=50` immediately after page load. In Playwright
 * webkit, this gets reported as "Navigation to A is interrupted by another
 * navigation to A&limit=50". Real users would also see an extra browser
 * history entry. Fix: only call router.replace() when the resulting URL
 * actually differs from window.location's current search.
 */

type Row = {
  rca_finding_id: string;
  intake_id: string;
  intake_provider: string;
  intake_run_id: string;
  intake_branch: string | null;
  provider: string;
  model_id: string;
  root_cause: string;
  confidence: 'low' | 'medium' | 'high';
  evidence_count: number;
  recommended_actions_count: number;
  bob_latency_ms: number;
  created_at: string;
};

type ListResp = { items: Row[]; next_cursor: string | null };

const CONFIDENCES = ['low', 'medium', 'high'] as const;

export default function RcaListPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // --- Filter state mirrors URL ---
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebouncedValue(q, 250);
  const [confidence, setConfidence] = useState(sp.get('confidence') ?? '');
  const [intakeId, setIntakeId] = useState(sp.get('intake_id') ?? '');
  const [provider, setProvider] = useState(sp.get('provider') ?? '');
  const [from, setFrom] = useState(sp.get('from') ?? '');
  const [to, setTo] = useState(sp.get('to') ?? '');
  const [limit, setLimit] = useState<number>(Number(sp.get('limit') ?? DEFAULT_LIMIT));
  const [cursor, setCursor] = useState<string | null>(sp.get('cursor'));
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);

  // --- Data state ---
  const [rows, setRows] = useState<Row[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const filters = useMemo(
    () => ({
      q: dq,
      confidence,
      intake_id: intakeId,
      provider,
      from,
      to,
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    }),
    [dq, confidence, intakeId, provider, from, to, limit, cursor],
  );

  // Only push to history if the URL actually changes; this prevents an extra
  // history entry on first mount (e.g. when the URL has no `limit=` and we
  // would otherwise add `&limit=50`) and also prevents Playwright webkit from
  // reporting a "navigation interrupted by another navigation" because of the
  // initial-load normalisation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextSearch = buildSearch(filters);
    const currentSearch = window.location.search;
    if (nextSearch !== currentSearch) {
      router.replace(`/rca${nextSearch}`, { scroll: false });
    }
  }, [filters, router]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelection(new Set());
    try {
      const qs = new URLSearchParams();
      if (dq) qs.set('q', dq);
      if (confidence) qs.set('confidence', confidence);
      if (intakeId) qs.set('intake_id', intakeId);
      if (provider) qs.set('provider', provider);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      qs.set('limit', String(Math.min(MAX_LIMIT, Math.max(1, limit))));
      if (cursor) qs.set('cursor', cursor);
      const r = await fetch(`/api/v1/rca-findings?${qs.toString()}`, {
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
  }, [dq, confidence, intakeId, provider, from, to, limit, cursor]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const filterFingerprint = `${dq}|${confidence}|${intakeId}|${provider}|${from}|${to}|${limit}`;
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

  const allSelected = rows.length > 0 && rows.every((r) => selection.has(r.rca_finding_id));
  const toggleAll = () => {
    if (allSelected) setSelection(new Set());
    else setSelection(new Set(rows.map((r) => r.rca_finding_id)));
  };
  const toggleRow = (id: string) =>
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section data-testid="scr-008-rca-list">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">RCA findings</h1>
          <p className="text-sm text-slate-600">
            AI-generated root-cause analyses for ingested CI failures. Filter and drill into intake.
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

      {/* FILTER BAR */}
      <div
        data-testid="filter-bar"
        className="mb-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 md:grid-cols-4"
      >
        <label className="text-xs font-medium text-slate-700">
          Search root cause
          <input
            data-testid="filter-q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. OOM…"
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Confidence
          <select
            data-testid="filter-confidence"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            className="mt-1 block w-full rounded border-slate-300 px-2 py-1 text-sm font-normal"
          >
            <option value="">(any)</option>
            {CONFIDENCES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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

      {/* TOOLBAR */}
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

      {/* TABLE */}
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
              <th className="px-3 py-2 text-left">Model</th>
              <th className="px-3 py-2 text-left">Confidence</th>
              <th className="px-3 py-2 text-left">Root cause</th>
              <th className="px-3 py-2 text-right">Evidence</th>
              <th className="px-3 py-2 text-right">Actions</th>
              <th className="px-3 py-2 text-right">Bob ms</th>
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
                    <div className="mb-2 text-base font-medium text-slate-700">No RCA findings yet</div>
                    <div className="mb-4">
                      RCAs are generated from intakes. Submit an intake and trigger a root-cause run.
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
                  key={row.rca_finding_id}
                  data-testid={`rca-row-${row.rca_finding_id}`}
                  data-rca-finding-id={row.rca_finding_id}
                  data-intake-id={row.intake_id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2">
                    <input
                      data-testid={`row-checkbox-${row.rca_finding_id}`}
                      type="checkbox"
                      checked={selection.has(row.rca_finding_id)}
                      onChange={() => toggleRow(row.rca_finding_id)}
                      aria-label={`Select RCA ${row.rca_finding_id}`}
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
                  <td className="px-3 py-2 text-slate-700">
                    <div>{row.model_id}</div>
                    <div className="text-xs text-slate-400">{row.provider}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      data-testid={`confidence-${row.rca_finding_id}`}
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${confidenceBadgeClass(row.confidence)}`}
                    >
                      {row.confidence}
                    </span>
                  </td>
                  <td className="max-w-md px-3 py-2 text-slate-700">
                    <div className="line-clamp-2" title={row.root_cause}>
                      {row.root_cause}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.evidence_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.recommended_actions_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{row.bob_latency_ms}</td>
                  <td className="px-3 py-2 text-right">
                    <a
                      data-testid={`row-open-${row.rca_finding_id}`}
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
