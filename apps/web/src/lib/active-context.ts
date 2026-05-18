/**
 * Active-workflow context — tracks the most-recent intake_id and repair_plan_id
 * in sessionStorage so the top-level NavLinks can deep-link the user into the
 * stage they care about (RCA, Plan, Approve, Evidence) without a separate
 * "active object" API.
 *
 * Each SCR page calls setActiveIntakeId() or setActiveRepairPlanId() after a
 * successful API response. The NavLinks component listens to the
 * `mendoraci:active-changed` custom event to refresh without a full reload.
 *
 * sessionStorage (not localStorage) is intentional: it scopes to the browser
 * tab, so opening a second tab doesn't accidentally clobber the first tab's
 * workflow.
 */

const INTAKE_KEY = 'mendoraci.active_intake_id';
const PLAN_KEY = 'mendoraci.active_repair_plan_id';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

function broadcast(): void {
  if (!isBrowser()) return;
  try {
    window.dispatchEvent(new CustomEvent('mendoraci:active-changed'));
  } catch {
    /* noop */
  }
}

export function setActiveIntakeId(id: string): void {
  if (!isBrowser() || !id) return;
  try {
    sessionStorage.setItem(INTAKE_KEY, id);
    broadcast();
  } catch {
    /* noop */
  }
}

export function setActiveRepairPlanId(id: string): void {
  if (!isBrowser() || !id) return;
  try {
    sessionStorage.setItem(PLAN_KEY, id);
    broadcast();
  } catch {
    /* noop */
  }
}

export function getActiveIntakeId(): string {
  if (!isBrowser()) return '';
  try {
    return sessionStorage.getItem(INTAKE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function getActiveRepairPlanId(): string {
  if (!isBrowser()) return '';
  try {
    return sessionStorage.getItem(PLAN_KEY) ?? '';
  } catch {
    return '';
  }
}
