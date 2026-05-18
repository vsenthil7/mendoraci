/**
 * Shared list-view helpers for CP-9 enterprise list pages.
 *
 * - readFilters / writeFilters: round-trip filter state through the URL's
 *   query string so refresh / share-link / browser-back all "just work"
 * - useDebouncedValue: 250 ms debounce on free-text search inputs so we
 *   don't fire a network call per keystroke
 * - badgeClass: color-coded Tailwind classes for status / risk / confidence
 *
 * Keeping these in /lib lets every list page (intakes, rca, plans,
 * approvals, evidence-exports) share the same UX without duplication.
 */
import { useEffect, useState } from 'react';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

/**
 * Read a typed map of filters from URLSearchParams. Unknown keys are
 * preserved (caller decides whether to keep). Empty-string values are
 * dropped to keep the URL clean.
 */
export function readFiltersFromSearch(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const sp = new URLSearchParams(search);
  sp.forEach((v, k) => {
    if (v !== '' && v != null) out[k] = v;
  });
  return out;
}

/** Build a URL query string from a filter map (skips empty / undefined). */
export function buildSearch(filters: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v != null && v !== '') sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** 250 ms debounce hook for typing in the free-text search box. */
export function useDebouncedValue<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Color tokens for status / risk / confidence badges. Tailwind classes are
 * hard-coded so they survive purging.
 */
export function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'draft':
      return 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200';
    case 'submitted':
      return 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200';
    case 'approved':
      return 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-300';
    case 'rejected':
      return 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-300';
    default:
      return 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200';
  }
}

export function riskBadgeClass(risk: string | null | undefined): string {
  switch (risk) {
    case 'low':
      return 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200';
    case 'medium':
      return 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300';
    case 'high':
      return 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-300';
    default:
      return 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200';
  }
}

export function confidenceBadgeClass(c: string | null | undefined): string {
  // Same scale as risk but inverted semantics: high = good
  switch (c) {
    case 'high':
      return 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200';
    case 'medium':
      return 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300';
    case 'low':
      return 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-300';
    default:
      return 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200';
  }
}

export function booleanBadgeClass(b: boolean | null | undefined): string {
  return b
    ? 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200'
    : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200';
}

export function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}
