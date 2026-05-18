'use client';
import { useCallback, useEffect, useState } from 'react';
import { DEMO_TENANT_ID } from '../../lib/client';
import { formatRelative, statusBadgeClass } from '../../lib/list-utils';

/**
 * SCR-012 — Dashboard page (CP-9.4).
 *
 * Anchors:
 *   - CP-9 enterprise list views (RT-007 final UI piece)
 *   - Re-uses API-010..014 list endpoints with windowed filters
 *
 * Tests: tests/playwright/scr-012-dashboard.spec.ts
 *
 * 4 KPI tiles + recent activity stream:
 *   Tile 1: Intakes in last 24h    -> GET /v1/intakes?from=24h-ago&limit=200
 *   Tile 2: Plans pending approval -> GET /v1/repair-plans?status=submitted&limit=200
 *   Tile 3: RCAs in last 24h       -> GET /v1/rca-findings?from=24h-ago&limit=200
 *   Tile 4: Evidence bundles 7d    -> GET /v1/evidence-exports?from=7d-ago&limit=200
 *
 * Recent activity: latest 10 approval audit rows via GET /v1/approvals?limit=10.
 */

type Tile = {
  label: string;
  hint: string;
  value: number | null;
  loading: boolean;
  error: string | null;
  href: string;
};

type ActivityRow = {
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

export default function DashboardPage() {
  const [tile1, setTile1] = useState<Tile>({
    label: 'Intakes (last 24h)',
    hint: 'CI failures ingested in the past day',
    value: null,
    loading: true,
    error: null,
    href: '/intakes',
  });
  const [tile2, setTile2] = useState<Tile>({
    label: 'Plans awaiting approval',
    hint: 'Submitted, not yet approved or rejected',
    value: null,
    loading: true,
    error: null,
    href: '/repair-plans?status=submitted',
  });
  const [tile3, setTile3] = useState<Tile>({
    label: 'RCAs (last 24h)',
    hint: 'Root-cause analyses generated',
    value: null,
    loading: true,
    error: null,
    href: '/rca',
  });
  const [tile4, setTile4] = useState<Tile>({
    label: 'Evidence bundles (7d)',
    hint: 'Audit ZIPs created in the past week',
    value: null,
    loading: true,
    error: null,
    href: '/evidence',
  });
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const fetchCount = useCallback(
    async (path: string, qs: URLSearchParams, setter: (t: (prev: Tile) => Tile) => void) => {
      try {
        setter((prev) => ({ ...prev, loading: true, error: null }));
        qs.set('limit', '200');
        const r = await fetch(`${path}?${qs.toString()}`, {
          headers: { 'x-tenant-id': DEMO_TENANT_ID },
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setter((prev) => ({ ...prev, loading: false, error: `HTTP ${r.status}: ${JSON.stringify(j)}`, value: null }));
          return;
        }
        const j: { items: unknown[] } = await r.json();
        setter((prev) => ({ ...prev, loading: false, value: j.items.length, error: null }));
      } catch (e) {
        setter((prev) => ({ ...prev, loading: false, error: String(e), value: null }));
      }
    },
    [],
  );

  const fetchActivity = useCallback(async () => {
    try {
      setActivityLoading(true);
      setActivityError(null);
      const r = await fetch('/api/v1/approvals?limit=10', {
        headers: { 'x-tenant-id': DEMO_TENANT_ID },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setActivityError(`HTTP ${r.status}: ${JSON.stringify(j)}`);
        setActivity([]);
        return;
      }
      const j: { items: ActivityRow[] } = await r.json();
      setActivity(j.items);
    } catch (e) {
      setActivityError(String(e));
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    const oneDayAgoIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    void fetchCount('/api/v1/intakes', new URLSearchParams({ from: oneDayAgoIso }), setTile1);
    void fetchCount('/api/v1/repair-plans', new URLSearchParams({ status: 'submitted' }), setTile2);
    void fetchCount('/api/v1/rca-findings', new URLSearchParams({ from: oneDayAgoIso }), setTile3);
    void fetchCount(
      '/api/v1/evidence-exports',
      new URLSearchParams({ from: sevenDaysAgoIso }),
      setTile4,
    );
    void fetchActivity();
  }, [fetchCount, fetchActivity]);

  const refreshAll = () => {
    const now = Date.now();
    const oneDayAgoIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    void fetchCount('/api/v1/intakes', new URLSearchParams({ from: oneDayAgoIso }), setTile1);
    void fetchCount('/api/v1/repair-plans', new URLSearchParams({ status: 'submitted' }), setTile2);
    void fetchCount('/api/v1/rca-findings', new URLSearchParams({ from: oneDayAgoIso }), setTile3);
    void fetchCount(
      '/api/v1/evidence-exports',
      new URLSearchParams({ from: sevenDaysAgoIso }),
      setTile4,
    );
    void fetchActivity();
  };

  const tiles = [tile1, tile2, tile3, tile4];

  return (
    <section data-testid="scr-012-dashboard">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Operational health at a glance. Counts are over a rolling window; click a tile to drill in.
          </p>
        </div>
        <button
          data-testid="refresh-button"
          onClick={refreshAll}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ↻ Refresh
        </button>
      </div>

      {/* KPI TILES */}
      <div data-testid="kpi-tiles" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {tiles.map((t, i) => (
          <a
            key={t.label}
            data-testid={`tile-${i + 1}`}
            data-tile-label={t.label}
            href={t.href}
            className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t.label}
            </div>
            <div
              data-testid={`tile-${i + 1}-value`}
              className="mt-2 text-3xl font-semibold tabular-nums text-slate-900"
            >
              {t.loading ? (
                <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-100" />
              ) : t.error ? (
                <span className="text-base font-normal text-rose-700">err</span>
              ) : (
                <span>{t.value}</span>
              )}
            </div>
            <div className="mt-1 text-xs text-slate-500">{t.hint}</div>
          </a>
        ))}
      </div>

      {/* RECENT ACTIVITY */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Recent approval activity</h2>
          <a
            data-testid="activity-see-all"
            href="/approvals"
            className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
          >
            See all →
          </a>
        </div>
        <div data-testid="activity-stream">
          {activityLoading ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500" data-testid="activity-loading">
              Loading…
            </div>
          ) : activityError ? (
            <div className="px-4 py-6 text-center text-sm text-rose-700" data-testid="activity-error">
              {activityError}
            </div>
          ) : activity.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500" data-testid="activity-empty">
              No approval activity yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activity.map((row) => (
                <li
                  key={row.approval_id}
                  data-testid={`activity-row-${row.approval_id}`}
                  data-approval-id={row.approval_id}
                  className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <span
                    data-testid={`activity-action-${row.approval_id}`}
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${actionBadgeClass(row.action)}`}
                  >
                    {row.action}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-slate-700">
                      <span className="font-medium">{row.actor}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono text-xs text-slate-500">
                        {row.intake_run_id}
                      </span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-600" title={row.plan_summary}>
                      {row.plan_summary}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className={`inline-flex items-center rounded px-1 py-0.5 ${statusBadgeClass(row.prior_status)}`}>
                        {row.prior_status}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className={`inline-flex items-center rounded px-1 py-0.5 ${statusBadgeClass(row.new_status)}`}>
                        {row.new_status}
                      </span>
                      {row.note ? (
                        <span className="text-slate-500" title={row.note}>
                          · {row.note}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-slate-400" title={row.created_at}>
                    {formatRelative(row.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
