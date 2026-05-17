"""CP-2 runner: bring up Postgres, run migration, run integration tests.

ALL steps after `compose up` run inside ONE long-lived node container so
pnpm/corepack only need activating once. The container exits with the test rc.

Usage (from repo root):
    python scripts/cp2_run_tests.py

Exit codes:
    0  all tests green
    1  setup failure
    2  combined install/migrate/test failure (see container output)
"""
from __future__ import annotations
import subprocess, sys, time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENV_FILE = REPO / ".env"
COMPOSE = ["docker", "compose"]

def banner(s: str) -> None:
    print(f"\n=== {s} ===", flush=True)

def run(cmd: list[str], **kw) -> subprocess.CompletedProcess[str]:
    print(f"$ {' '.join(cmd)}", flush=True)
    return subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, **kw)

def read_env_value(key: str) -> str | None:
    if not ENV_FILE.exists(): return None
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return None

def ensure_env() -> tuple[str, str, str]:
    if not ENV_FILE.exists():
        sample = REPO / ".env.example"
        text = sample.read_text(encoding="utf-8").replace("__CHANGE_ME__", "devsecret123devsecret123")
        ENV_FILE.write_text(text, encoding="utf-8")
        print(f"Wrote {ENV_FILE} from .env.example with placeholder dev secret")
    pw = read_env_value("POSTGRES_PASSWORD") or "devsecret123devsecret123"
    if "__CHANGE_ME__" in pw:
        pw = "devsecret123devsecret123"
        text = ENV_FILE.read_text(encoding="utf-8").replace("__CHANGE_ME__", pw)
        ENV_FILE.write_text(text, encoding="utf-8")
    return ("mendoraci", "mendoraci_app", pw)

def wait_for_postgres_healthy() -> bool:
    for i in range(30):
        r = run([*COMPOSE, "ps", "postgres", "--format", "json"])
        if r.returncode == 0 and "healthy" in r.stdout:
            print(f"postgres healthy after {i*2}s")
            return True
        time.sleep(2)
    return False

def run_one_shot(db: str, user: str, pw: str) -> int:
    """Single docker run that installs, migrates, and tests. pnpm only activated once."""
    db_url = f"postgresql://{user}:{pw}@host.docker.internal:5432/{db}"
    # All-in-one shell script. set -e ensures any failure short-circuits.
    sh = (
        "set -e; "
        "echo '--- activate pnpm ---'; "
        "corepack enable; "
        "corepack prepare pnpm@9.12.0 --activate; "
        "export PATH=\"$PNPM_HOME:$PATH\"; "
        "which pnpm; pnpm --version; "
        "echo '--- pnpm install ---'; "
        "cd /repo; "
        "pnpm install --no-frozen-lockfile 2>&1 | tail -5; "
        "echo '--- build shared + mask-policy ---'; "
        "pnpm --filter @mendoraci/shared build; "
        "pnpm --filter @mendoraci/mask-policy build; "
        "echo '--- migrate ---'; "
        "cd /repo/apps/api; "
        "pnpm exec node-pg-migrate up -m src/db/migrations -j ts 2>&1 | tail -30; "
        "echo '--- integration tests ---'; "
        "pnpm exec vitest run test/integration --reporter=verbose 2>&1 | tail -120; "
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
    return subprocess.run(cmd, cwd=REPO).returncode

def main() -> int:
    banner("CP-2 — RT-001 integration test runner v2")
    db, user, pw = ensure_env()

    banner("Step 1: docker compose up -d postgres")
    r = run([*COMPOSE, "up", "-d", "postgres"])
    print(r.stdout); print(r.stderr, file=sys.stderr)
    if r.returncode != 0: return 1

    banner("Step 2: wait for postgres healthy")
    if not wait_for_postgres_healthy():
        print("postgres did not become healthy", file=sys.stderr); return 1

    banner("Step 3: one-shot container: install + migrate + integration tests")
    rc = run_one_shot(db, user, pw)
    if rc != 0:
        banner(f"FAILED with rc={rc}")
        return 2

    banner("CP-2 ALL GREEN — RT-001 tested-passing")
    return 0

if __name__ == "__main__":
    sys.exit(main())
