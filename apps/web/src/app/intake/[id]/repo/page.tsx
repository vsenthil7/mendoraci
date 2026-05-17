'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DEMO_TENANT_ID } from '../../../../lib/client';

/**
 * SCR-002 — Repo Linking form.
 * Anchors: RT-002 (BR-002), API-003, RT-013 (tenant scoping via header).
 *
 * Mounted at /intake/[id]/repo. Captures repo_provider + repo_url + optional
 * default_branch. Submits to POST /v1/intake/:id/link-repo. Surfaces
 * 409 repo_already_linked and 404 intake_not_found from the API.
 */

type LinkStatus = 'idle' | 'submitting' | 'linked' | 'error';

export default function RepoLinkPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const intakeId = params?.id ?? '';

  const [provider, setProvider] = useState<'github' | 'gitlab' | 'bitbucket' | 'azure-devops'>('github');
  const [repoUrl, setRepoUrl] = useState('https://github.com/acme/widget');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [status, setStatus] = useState<LinkStatus>('idle');
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string>('');

  async function submit() {
    setStatus('submitting');
    setError('');
    setResponse(null);
    try {
      const r = await fetch(`/api/v1/intake/${intakeId}/link-repo`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': DEMO_TENANT_ID,
        },
        body: JSON.stringify({
          repo_provider: provider,
          repo_url: repoUrl,
          default_branch: defaultBranch || undefined,
        }),
      });
      const j = await r.json();
      setResponse(j);
      if (r.ok) {
        setStatus('linked');
      } else {
        setStatus('error');
        setError(JSON.stringify(j));
      }
    } catch (e) {
      setStatus('error');
      setError(String(e));
    }
  }

  return (
    <section data-testid="scr-002-link-repo">
      <button
        data-testid="back-to-intake"
        onClick={() => router.push('/')}
        className="mb-4 text-sm text-slate-600 hover:text-slate-900"
      >
        ← Back to intake
      </button>

      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Link Repository (SCR-002)</h1>
      <p className="mb-6 text-sm text-slate-600">
        Link a source repo to intake <span className="font-mono">{intakeId}</span> so RCA can
        correlate failures to commits.
      </p>

      <div className="space-y-4 rounded border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="provider" className="mb-1 block text-sm font-medium text-slate-700">
            Repo provider
          </label>
          <select
            id="provider"
            data-testid="provider-select"
            value={provider}
            onChange={(e) => setProvider(e.target.value as typeof provider)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
            <option value="bitbucket">Bitbucket</option>
            <option value="azure-devops">Azure DevOps</option>
          </select>
        </div>

        <div>
          <label htmlFor="repo-url" className="mb-1 block text-sm font-medium text-slate-700">
            Repository URL
          </label>
          <input
            id="repo-url"
            data-testid="repo-url-input"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/org/repo"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="default-branch" className="mb-1 block text-sm font-medium text-slate-700">
            Default branch (optional)
          </label>
          <input
            id="default-branch"
            data-testid="default-branch-input"
            type="text"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            placeholder="main"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          data-testid="submit-link"
          onClick={submit}
          disabled={status === 'submitting' || !repoUrl || !intakeId}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {status === 'submitting' ? 'Linking…' : 'Link repository'}
        </button>
      </div>

      <div className="mt-4 text-sm">
        Status: <span data-testid="link-status" className="font-mono">{status}</span>
      </div>

      {response ? (
        <pre
          data-testid="link-response"
          className="mt-4 overflow-auto rounded bg-slate-900 p-4 text-xs text-slate-100"
        >
          {JSON.stringify(response, null, 2)}
        </pre>
      ) : null}
      {error ? (
        <pre data-testid="link-error" className="mt-4 rounded bg-red-50 p-4 text-xs text-red-700">
          {error}
        </pre>
      ) : null}
    </section>
  );
}
