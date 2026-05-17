"""CP-3 Playwright runner — runs E2E inside the mendoraci-test compose service.

CP-3e: force-rebuild web + recreate the container every run, so we never
silently run against stale dev image. (Previous run shipped CP-3d fix to git
but docker reused the cached web image -> 12 same failures.)

Pipeline:
  1. docker compose build --no-cache web   (forces fresh COPY of apps/web)
  2. docker compose up -d --force-recreate web  (kill any old container)
  3. docker compose up -d                  (bring up everything else)
  4. wait for api healthy + web responding
  5. health-gate: confirm the running web has the CP-3d fix in its bundle
  6. docker compose --profile test build test  (Playwright image)
  7. docker compose --profile test run --rm test
  8. report goes to ./playwright-report/
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

def http_body(url: str, timeout_s: int = 10) -> str:
    try:
        with urllib.request.urlopen(url, timeout=timeout_s) as r:
            return r.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, ConnectionResetError, OSError) as e:
        return f"<error: {e}>"

def wait_api(timeout_s: int = 120) -> bool:
    for i in range(timeout_s // 2):
        if http_ok("http://localhost:4000/health"):
            print(f"api healthy after {i*2}s")
            return True
        time.sleep(2)
    return False

def wait_web(timeout_s: int = 180) -> bool:
    for i in range(timeout_s // 3):
        if http_ok("http://localhost:3000", timeout_s=15):
            print(f"web responding after {i*3}s")
            return True
        time.sleep(3)
    return False

def main() -> int:
    banner("CP-3e E2E runner — force-rebuild web every run")

    banner("Step 1: docker compose build --no-cache web (force fresh page.tsx)")
    if run(["docker", "compose", "build", "--no-cache", "web"]) != 0:
        return 1

    banner("Step 2: docker compose up -d --force-recreate web")
    if run(["docker", "compose", "up", "-d", "--force-recreate", "web"]) != 0:
        return 1

    banner("Step 3: docker compose up -d (the rest)")
    if run(["docker", "compose", "up", "-d"]) != 0:
        return 1

    banner("Step 4: wait for api + web ready")
    if not wait_api():
        print("api not healthy in time", file=sys.stderr); return 1
    if not wait_web():
        print("web not responding in time", file=sys.stderr); return 1

    banner("Step 5: health-gate — verify CP-3d fix is in the running bundle")
    # Next.js dev mode compiles on first request; do a goto / first so the page bundle exists.
    _ = http_body("http://localhost:3000/", timeout_s=30)
    # Grab the page HTML; the fallback helper name 'randomIdempotencyKey' will appear in the dev bundle.
    home = http_body("http://localhost:3000/", timeout_s=15)
    if "randomIdempotencyKey" in home or "getRandomValues" in home:
        print("CP-3d fix present in page source ✓")
    else:
        # The HTML may not inline the source; this is best-effort. Print first 400 chars for sanity.
        print("Note: could not detect CP-3d fix in inlined HTML (Next dev may chunk-split).", flush=True)
        print("Page head preview:", home[:400].replace("\n", " ")[:400], flush=True)

    banner("Step 6: build playwright test image")
    if run(["docker", "compose", "--profile", "test", "build", "test"]) != 0:
        return 2

    banner("Step 7: run playwright (chromium + firefox + webkit)")
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
