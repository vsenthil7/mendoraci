"""CP-2 runner v3 — assumes full stack is already up via `docker compose up -d`.
Runs the integration tests against the live API container via host port 5432 (postgres)
and host port 4000 (api).
"""
from __future__ import annotations
import subprocess, sys, time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENV_FILE = REPO / ".env"

def banner(s: str) -> None: print(f"\n=== {s} ===", flush=True)

def read_env_value(key: str) -> str | None:
    if not ENV_FILE.exists(): return None
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return None

def main() -> int:
    banner("CP-2 runner v3 — integration tests against live docker stack")
    pw = read_env_value("POSTGRES_PASSWORD") or "devsecret123devsecret123"
    db_url = f"postgresql://mendoraci_app:{pw}@host.docker.internal:5432/mendoraci"

    sh = (
        "set -e; "
        "corepack enable; "
        "corepack prepare pnpm@9.12.0 --activate; "
        "export PATH=\"$PNPM_HOME:$PATH\"; "
        "cd /repo; "
        "pnpm install --no-frozen-lockfile 2>&1 | tail -3; "
        "pnpm --filter @mendoraci/shared build; "
        "pnpm --filter @mendoraci/mask-policy build; "
        "cd /repo/apps/api; "
        "echo '--- vitest integration ---'; "
        "pnpm exec vitest run test/integration --reporter=verbose; "
    )
    cmd = [
        "docker", "run", "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-v", f"{REPO}:/repo",
        "-w", "/repo",
        "-e", f"DATABASE_URL={db_url}",
        "-e", "NODE_ENV=test",
        "-e", "LOG_LEVEL=error",
        "-e", "MASK_POLICY_VERSION=v1.0.0",
        "-e", "PNPM_HOME=/usr/local/share/pnpm",
        "node:20-alpine", "sh", "-c", sh,
    ]
    rc = subprocess.run(cmd, cwd=REPO).returncode
    if rc != 0:
        banner(f"INTEGRATION TESTS FAILED (rc={rc})")
        return rc
    banner("INTEGRATION TESTS GREEN — RT-001 tested-passing")
    return 0

if __name__ == "__main__":
    sys.exit(main())
