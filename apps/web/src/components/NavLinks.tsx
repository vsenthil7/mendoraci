'use client';
import { useEffect, useState } from 'react';

/**
 * Top-level nav. Each stage link routes to the deep-linked page for the
 * "active" intake (or repair plan) tracked in sessionStorage. SCR-001 stamps
 * sessionStorage on intake creation, SCR-004 stamps the repair_plan_id, etc.
 * If no active intake yet, links navigate to / so the user can create one.
 *
 * Why client-side state: the deep-linked routes need a UUID in the path
 * (/intake/[id]/rca, /repair-plan/[id]/approve, ...). Layout is a server
 * component by default and can't read sessionStorage; this client component
 * fills that gap.
 */
export function NavLinks() {
  const [intakeId, setIntakeId] = useState<string>('');
  const [repairPlanId, setRepairPlanId] = useState<string>('');

  useEffect(() => {
    const refresh = () => {
      try {
        setIntakeId(sessionStorage.getItem('mendoraci.active_intake_id') ?? '');
        setRepairPlanId(sessionStorage.getItem('mendoraci.active_repair_plan_id') ?? '');
      } catch {
        // sessionStorage can be blocked in some sandboxes; degrade to no active id
      }
    };
    refresh();
    // Cross-component updates broadcast a custom event so the nav refreshes
    // without a full page reload.
    window.addEventListener('mendoraci:active-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('mendoraci:active-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const rcaHref = intakeId ? `/intake/${intakeId}/rca` : '/';
  const planHref = intakeId ? `/intake/${intakeId}/repair-plan` : '/';
  const approveHref = repairPlanId ? `/repair-plan/${repairPlanId}/approve` : '/';
  const evidenceHref = intakeId ? `/intake/${intakeId}/evidence` : '/';

  const linkClass = (enabled: boolean) =>
    enabled
      ? 'mr-3 text-blue-700 hover:text-blue-900 hover:underline'
      : 'mr-3 text-slate-400 cursor-not-allowed';

  return (
    <nav data-testid="top-nav" className="flex items-center text-sm">
      <a
        data-testid="nav-intake"
        href="/"
        className="mr-3 text-slate-700 hover:text-slate-900 hover:underline"
      >
        Intake (SCR-001)
      </a>
      <span className="mr-3 text-slate-300">·</span>
      <a
        data-testid="nav-rca"
        href={rcaHref}
        aria-disabled={!intakeId}
        className={linkClass(!!intakeId)}
        title={intakeId ? 'Open RCA for active intake' : 'Create an intake first'}
      >
        RCA
      </a>
      <a
        data-testid="nav-plan"
        href={planHref}
        aria-disabled={!intakeId}
        className={linkClass(!!intakeId)}
        title={intakeId ? 'Open Repair Plan for active intake' : 'Create an intake first'}
      >
        Plan
      </a>
      <a
        data-testid="nav-approve"
        href={approveHref}
        aria-disabled={!repairPlanId}
        className={linkClass(!!repairPlanId)}
        title={repairPlanId ? 'Open approver for active plan' : 'Generate a repair plan first'}
      >
        Approve
      </a>
      <a
        data-testid="nav-evidence"
        href={evidenceHref}
        aria-disabled={!intakeId}
        className={linkClass(!!intakeId)}
        title={intakeId ? 'Open evidence export for active intake' : 'Create an intake first'}
      >
        Evidence
      </a>
      <span data-testid="nav-analytics" className="text-slate-400" title="CP-9+">
        Analytics (CP-9+)
      </span>
    </nav>
  );
}
