"""CP-2 runner v4 — run integration tests INSIDE the live mendoraci-api container.
This eliminates network resolution variance (postgres reachable as 'postgres' hostname).
"""
from __future__ import annotations
import subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

def banner(s: str) -> None: print(f"\n=== {s} ===", flush=True)

def main() -> int:
    banner("CP-2 runner v4 — integration tests inside live mendoraci-api container")
    # exec into the api container; it already has node, pnpm, deps installed,
    # and resolves 'postgres' via docker DNS.
    cmd = [
        "docker", "compose", "exec", "-T",
        "-e", "NODE_ENV=test",
        "-e", "LOG_LEVEL=error",
        "api",
        "sh", "-c",
        "cd /app/apps/api && pnpm exec vitest run test/integration --reporter=verbose",
    ]
    rc = subprocess.run(cmd, cwd=REPO).returncode
    if rc != 0:
        banner(f"INTEGRATION TESTS FAILED (rc={rc})")
        return rc
    banner("INTEGRATION TESTS GREEN")
    return 0

if __name__ == "__main__":
    sys.exit(main())
