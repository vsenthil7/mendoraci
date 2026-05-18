'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DEMO_TENANT_ID } from '../../../../lib/client';
import { setActiveIntakeId, setActiveRepairPlanId } from '../../../../lib/active-context';

/**
 * SCR-005 — Approver page.
 * Anchors: RT-005 (BR-005), API-006..008, RT-013 (tenant scoping via header).
 *
 * Mounted at /repair-plan/[id]/approve. Loads the current approvals log via
 * GET /v1/repair-plan/:id/approvals, surfaces the state-machine state, and
 * exposes Submit / Approve / Reject buttons whose availability depends on
 * `current_status`. Each button POSTs the corresponding endpoint and refreshes
 * the log.
 *
 * State machine:
 *   draft     -> Submit  -> submitted
 *   submitted -> Approve -> approved
 *   submitted -> Reject  -> rejected
 *   approved/rejected -> terminal (no buttons enabled)
 *
 * CP-8b: when approval reaches 'approved', renders a link to SCR-006 evidence
 * export. Also stamps repair_plan_id + intake_id (from log payload) into
 * sessionStorage for the top-nav.
 */

type Action = 'submit' | 'approve' | 'reject';
type Status = 'draft' | 'submitted' | 'approved' | 'rejected';

interface LogEntry {
  approval_id: string;
  action: Action;
  prior_status: Status;
  new_status: Status;
  actor: string;
  note: string | null;
  created_at: string;
}

interface LogResponse {
  repair_plan_id: string;
  intake_id: string;
  current_status: Status;
  entries: LogEntry[];
}

const statusColor: Record<Status, string> = {
  draft: 'bg-slate-100 text-slate-800',
  submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const actionColor: Record<Action, string> = {
  submit: 'bg-blue-100 text-blue-800',
  approve: 'bg-green-100 text-green-800',
  reject: 'bg-red-100 text-red-800',
};

export default function ApproverPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const repairPlanId = params?.id ?? '';

  // Stamp the route-supplied repair_plan_id into nav state so the Approve
  // top-nav link works even on a deep-linked landing.
  if (repairPlanId) setActiveRepairPlanId(repairPlanId);

  const [log, setLog] = useState<LogResponse | null>(null);
  const [loadError, setLoadError] = useState<string>('');
  const [approver, setApprover] = useState('alice@acme.test');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string>('');

  async function refresh() {
    setLoadError('');
    try {
      const r = await fetch(`/api/v1/repair-plan/${repairPlanId}/approvals`, {
        headers: { 'x-tenant-id': DEMO_TENANT_ID },
      });
      const j = await r.json();
      if (r.ok) {
        const payload = j as LogResponse;
        setLog(payload);
        // Once we know the linked intake_id, stamp it so Evidence top-nav
        // can deep-link from here.
        if (payload.intake_id) setActiveIntakeId(payload.intake_id);
      } else {
        setLoadError(JSON.stringify(j));
        setLog(null);
      }
    } catch (e) {
      setLoadError(String(e));
    }
  }

  useEffect(() => {
    if (repairPlanId) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairPlanId]);

  async function transition(action: Action) {
    setPending(action);
    setActionError('');
    try {
      const body: Record<string, unknown> = {};
      if (action === 'submit') {
        if (note) body.note = note;
      } else if (action === 'approve') {
        body.approver = approver;
        if (note) body.note = note;
      } else {
        body.approver = approver;
        body.reason = reason;
      }
      const r = await fetch(`/api/v1/repair-plan/${repairPlanId}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-id': DEMO_TENANT_ID },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        setActionError(JSON.stringify(j));
      } else {
        setNote('');
        setReason('');
      }
      await refresh();
    } catch (e) {
      setActionError(String(e));
    } finally {
      setPending(null);
    }
  }

  const cur = log?.current_status ?? null;
  const canSubmit = cur === 'draft';
  const canApprove = cur === 'submitted';
  const canReject = cur === 'submitted';
  const isTerminal = cur === 'approved' || cur === 'rejected';

  return (
    <section data-testid="scr-005-approver">
      <button
        data-testid="back-to-intake"
        onClick={() => router.push('/')}
        className="mb-4 text-sm text-slate-600 hover:text-slate-900"
      >
        ← Back to intake
      </button>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Approve repair plan (SCR-005)</h1>
      <p className="mb-6 text-sm text-slate-600">
        Repair plan <span className="font-mono">{repairPlanId}</span>. Approver actions are
        captured as immutable audit rows.
      </p>

      {/* Current status panel */}
      <div className="mb-4 rounded border border-slate-200 bg-white p-6">
        <div className="text-xs uppercase tracking-wide text-slate-500">Current status</div>
        {cur ? (
          <span
            data-testid="current-status"
            className={`mt-1 inline-block rounded px-2 py-0.5 text-sm font-medium ${statusColor[cur]}`}
          >
            {cur}
          </span>
        ) : (
          <div data-testid="current-status" className="font-mono text-sm text-slate-400">
            loading…
          </div>
        )}
        {isTerminal ? (
          <div data-testid="terminal-notice" className="mt-2 text-xs text-slate-600">
            This plan is in a terminal state; no further transitions are allowed.
          </div>
        ) : null}
        {cur === 'approved' && log?.intake_id ? (
          <div className="mt-3">
            <a
              data-testid="link-to-evidence"
              href={`/intake/${log.intake_id}/evidence`}
              className="text-blue-700 underline hover:text-blue-900"
            >
              Generate evidence bundle (SCR-006) →
            </a>
          </div>
        ) : null}
      </div>

      {/* Action panel */}
      <div className="mb-4 space-y-3 rounded border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="approver" className="mb-1 block text-sm font-medium text-slate-700">
            Approver (required for approve/reject)
          </label>
          <input
            id="approver"
            data-testid="approver-input"
            type="text"
            value={approver}
            onChange={(e) => setApprover(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="note" className="mb-1 block text-sm font-medium text-slate-700">
            Note (optional)
          </label>
          <input
            id="note"
            data-testid="note-input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional comment for submit or approve"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="reason" className="mb-1 block text-sm font-medium text-slate-700">
            Reason (required for reject)
          </label>
          <input
            id="reason"
            data-testid="reason-input"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reject reason"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            data-testid="submit-button"
            onClick={() => transition('submit')}
            disabled={!canSubmit || pending !== null}
            className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40"
          >
            {pending === 'submit' ? '…' : 'Submit'}
          </button>
          <button
            data-testid="approve-button"
            onClick={() => transition('approve')}
            disabled={!canApprove || pending !== null || !approver}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-40"
          >
            {pending === 'approve' ? '…' : 'Approve'}
          </button>
          <button
            data-testid="reject-button"
            onClick={() => transition('reject')}
            disabled={!canReject || pending !== null || !approver || !reason}
            className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-40"
          >
            {pending === 'reject' ? '…' : 'Reject'}
          </button>
        </div>
      </div>

      {/* Audit log */}
      <div className="rounded border border-slate-200 bg-white p-6">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
          Audit log ({log?.entries.length ?? 0})
        </div>
        {log?.entries.length === 0 ? (
          <div data-testid="audit-empty" className="text-sm text-slate-500">
            No transitions yet.
          </div>
        ) : (
          <ol data-testid="audit-log" className="space-y-2">
            {log?.entries.map((e, i) => (
              <li
                key={e.approval_id}
                data-testid={`audit-entry-${i}`}
                className="flex items-start justify-between gap-3 rounded border border-slate-200 p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      data-testid={`audit-entry-${i}-action`}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${actionColor[e.action]}`}
                    >
                      {e.action}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {e.prior_status} → {e.new_status}
                    </span>
                  </div>
                  <div
                    data-testid={`audit-entry-${i}-actor`}
                    className="mt-1 text-xs text-slate-700"
                  >
                    by {e.actor}
                    {e.note ? <> · {e.note}</> : null}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(e.created_at).toISOString()}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {loadError ? (
        <pre data-testid="load-error" className="mt-4 rounded bg-red-50 p-4 text-xs text-red-700">
          {loadError}
        </pre>
      ) : null}
      {actionError ? (
        <pre data-testid="action-error" className="mt-4 rounded bg-red-50 p-4 text-xs text-red-700">
          {actionError}
        </pre>
      ) : null}
    </section>
  );
}
