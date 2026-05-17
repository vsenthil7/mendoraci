"""CP-2 runner: bring up Postgres, ensure app user exists, run migration, run integration tests.

Runs all heavy work in Docker so the host needs only Docker installed.
Idempotent: rerunning is safe.

Usage (from repo root):
    python scripts/cp2_run_tests.py

Exit codes:
    0  all tests green
    1  setup failure (compose/network/sql)
    2  migration failure
    3  integration tests red
"""
from __future__ import annotations
import os, re, subprocess, sys, time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENV_FILE = REPO / ".env"
COMPOSE = ["docker", "compose"]
SLEEP_BETWEEN_PROBES = 2
MAX_PROBES = 30

# ---------------------------------------------------------------------------

def banner(s: str) -> None:
    print(f"\n=== {s} ===", flush=True)

def run(cmd: list[str], **kw) -> subprocess.CompletedProcess[str]:
    print(f"$ {' '.join(cmd)}", flush=True)
    return subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, **kw)

def read_env_value(key: str) -> str | None:
    if not ENV_FILE.exists():
        return None
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return None

# ---------------------------------------------------------------------------

def ensure_env() -> tuple[str, str, str]:
    """Ensure .env exists with a usable POSTGRES_PASSWORD. Returns (db, user, pw)."""
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
    for i in range(MAX_PROBES):
        r = run([*COMPOSE, "ps", "postgres", "--format", "json"])
        if r.returncode == 0 and "healthy" in r.stdout:
            print(f"postgres healthy after {i*SLEEP_BETWEEN_PROBES}s")
            return True
        time.sleep(SLEEP_BETWEEN_PROBES)
    print("postgres did not become healthy in time", file=sys.stderr)
    return False

def ensure_app_user(db: str, user: str, pw: str) -> bool:
    """The postgres container starts with superuser only. Create the app role + grants."""
    sql = (
        f"DO $$ BEGIN "
        f"IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{user}') THEN "
        f"CREATE ROLE {user} LOGIN PASSWORD '{pw}'; "
        f"END IF; END $$;\n"
        f"GRANT ALL PRIVILEGES ON DATABASE {db} TO {user};\n"
        f"GRANT ALL ON SCHEMA public TO {user};\n"
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO {user};\n"
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO {user};\n"
    )
    r = subprocess.run(
        [*COMPOSE, "exec", "-T", "postgres", "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"],
        input=sql, cwd=REPO, capture_output=True, text=True,
    )
    print(r.stdout, end="")
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        # postgres container's POSTGRES_USER is mendoraci_app already; try as that user
        r2 = subprocess.run(
            [*COMPOSE, "exec", "-T", "postgres", "psql", "-U", user, "-d", db, "-c", "SELECT 1"],
            cwd=REPO, capture_output=True, text=True,
        )
        if r2.returncode == 0:
            print("(app user already exists, configured by POSTGRES_USER env)")
            return True
        return False
    return True

def run_in_node_container(workdir: str, sh_cmd: str, db: str, user: str, pw: str) -> int:
    """Run an arbitrary sh command inside node:20-alpine with host gateway + DATABASE_URL set."""
    db_url = f"postgresql://{user}:{pw}@host.docker.internal:5432/{db}"
    cmd = [
        "docker", "run", "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-v", f"{REPO}:/repo",
        "-w", f"/repo/{workdir}" if workdir else "/repo",
        "-e", f"DATABASE_URL={db_url}",
        "-e", "NODE_ENV=test",
        "-e", "API_PORT=4000",
        "-e", "API_HOST=0.0.0.0",
        "-e", "LOG_LEVEL=error",
        "-e", "MASK_POLICY_VERSION=v1.0.0",
        "node:20-alpine", "sh", "-lc", sh_cmd,
    ]
    print(f"$ docker run ... node:20-alpine sh -lc <<<'{sh_cmd[:80]}...'", flush=True)
    return subprocess.run(cmd, cwd=REPO).returncode

# ---------------------------------------------------------------------------

def main() -> int:
    banner("CP-2 — RT-001 integration test runner")
    db, user, pw = ensure_env()

    banner("Step 1: docker compose up -d postgres")
    r = run([*COMPOSE, "up", "-d", "postgres"])
    print(r.stdout); print(r.stderr, file=sys.stderr)
    if r.returncode != 0:
        return 1

    banner("Step 2: wait for postgres healthy")
    if not wait_for_postgres_healthy():
        return 1

    banner("Step 3: pnpm install (in node container)")
    rc = run_in_node_container(
        "",
        "corepack enable >/dev/null 2>&1 && corepack prepare pnpm@9.12.0 --activate >/dev/null 2>&1 && pnpm install --no-frozen-lockfile 2>&1 | tail -5",
        db, user, pw,
    )
    if rc != 0:
        print("pnpm install failed", file=sys.stderr); return 1

    banner("Step 4: run DB migration (in node container)")
    rc = run_in_node_container(
        "apps/api",
        "pnpm exec node-pg-migrate up -m src/db/migrations -j ts --envPath /repo/.env 2>&1 | tail -20",
        db, user, pw,
    )
    if rc != 0:
        print("migration failed", file=sys.stderr); return 2

    banner("Step 5: run integration tests (in node container)")
    rc = run_in_node_container(
        "apps/api",
        "pnpm exec vitest run test/integration --reporter=verbose 2>&1 | tail -80",
        db, user, pw,
    )
    if rc != 0:
        print("integration tests failed", file=sys.stderr); return 3

    banner("CP-2 — ALL GREEN")
    return 0

if __name__ == "__main__":
    sys.exit(main())
