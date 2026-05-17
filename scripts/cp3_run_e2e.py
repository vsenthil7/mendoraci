"""CP-3 Playwright runner — runs E2E inside the mendoraci-test compose service.

Pipeline:
  1. docker compose up -d  (full stack: postgres + redis + minio + api + web)
  2. wait for api healthy + web responding
  3. docker compose --profile test build test  (Playwright image)
  4. docker compose --profile test run --rm test  (runs all specs across 3 browsers)
  5. report goes to ./playwright-report/

Run from repo root:
    python scripts/cp3_run_e2e.py
"""
from __future__ import annotations
import json, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

def banner(s: str) -> None:
    print(f"\n=== {s} ===", flush=True)

def run(cmd: list[str], **kw) -> int:
    print(f"$ {' '.join(cmd)}", flush=True)
    return subprocess.run(cmd, cwd=REPO, **kw).returncode

def http_ok(url: str, timeout_s: int = 5) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout_s) as r:
            return 200 <= r.status < 500
    except (urllib.error.URLError, ConnectionResetError, OSError):
        return False

def wait_api(timeout_s: int = 120) -> bool:
    for i in range(timeout_s // 2):
        if http_ok("http://localhost:4000/health"):
            print(f"api healthy after {i*2}s")
            return True
        time.sleep(2)
    return False

def wait_web(timeout_s: int = 180) -> bool:
    # Next.js dev mode compiles on first request — be patient.
    for i in range(timeout_s // 3):
        if http_ok("http://localhost:3000", timeout_s=15):
            print(f"web responding after {i*3}s")
            return True
        time.sleep(3)
    return False

def main() -> int:
    banner("CP-3 E2E runner — Playwright in Docker against live stack")

    banner("Step 1: docker compose up -d")
    if run(["docker", "compose", "up", "-d"]) != 0:
        return 1

    banner("Step 2: wait for api + web ready")
    if not wait_api():
        print("api not healthy in time", file=sys.stderr); return 1
    if not wait_web():
        print("web not responding in time", file=sys.stderr); return 1

    banner("Step 3: build playwright test image")
    if run(["docker", "compose", "--profile", "test", "build", "test"]) != 0:
        return 2

    banner("Step 4: run playwright (chromium + firefox + webkit)")
    rc = run([
        "docker", "compose", "--profile", "test", "run", "--rm",
        "-T", "test",
        "pnpm", "exec", "playwright", "test",
        "--config=tests/playwright/playwright.config.ts",
        "--reporter=list,html",
    ])
    if rc != 0:
        banner(f"PLAYWRIGHT FAILED (rc={rc}) — see ./playwright-report/index.html")
        return 3

    banner("ALL E2E GREEN — TEST-Pw-001/002/003 tested-passing")
    print("Report: ./playwright-report/index.html")
    return 0

if __name__ == "__main__":
    sys.exit(main())
