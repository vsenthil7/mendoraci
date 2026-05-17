"""CP-2c-5 runner — full verify loop for the error-handler fix.

Steps:
  1. docker compose build api (picks up new dist/)
  2. docker compose up -d (restart api + deps)
  3. wait for api healthy
  4. quick smoke: POST /v1/intake with no idempotency-key → expect 400 {error:{code:'idempotency_key_required'}}
  5. quick smoke: POST /v1/intake with no x-tenant-id → expect 401 {error:{code:'unauthorized'}}
  6. exec vitest inside the api container
  7. exit with rc=0 only if all integration tests green

Run from repo root:
    python scripts/cp2c5_verify.py
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

def run_capture(cmd: list[str]) -> tuple[int, str, str]:
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr

def wait_for_api(timeout_s: int = 60) -> bool:
    for i in range(timeout_s // 2):
        try:
            req = urllib.request.Request("http://localhost:4000/health")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    body = json.loads(resp.read())
                    if body.get("status") == "ok" and body.get("db") == "ok":
                        print(f"api healthy after {i*2}s")
                        return True
        except (urllib.error.URLError, ConnectionResetError, OSError):
            pass
        time.sleep(2)
    return False

def http_post(url: str, headers: dict[str, str], body: dict | bytes) -> tuple[int, dict | str]:
    data = body if isinstance(body, (bytes, bytearray)) else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, method="POST", headers=headers, data=data)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as he:
        raw = he.read().decode("utf-8")
        try:
            return he.code, json.loads(raw)
        except json.JSONDecodeError:
            return he.code, raw

def main() -> int:
    banner("CP-2c-5 verify — rebuild + smoke + integration")

    banner("Step 1: docker compose build api")
    if run(["docker", "compose", "build", "api"]) != 0:
        return 1

    banner("Step 2: docker compose up -d")
    if run(["docker", "compose", "up", "-d"]) != 0:
        return 1

    banner("Step 3: wait for api healthy")
    if not wait_for_api(120):
        print("api did not become healthy in 120s", file=sys.stderr)
        run(["docker", "compose", "logs", "--tail", "60", "api"])
        return 1

    banner("Step 4: smoke — missing idempotency-key → expect 400 + error.code")
    status, body = http_post(
        "http://localhost:4000/v1/intake",
        {"content-type": "application/json", "x-tenant-id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
        {"provider": "jenkins", "run_id": "x", "attempt_id": "x",
         "artifact": {"type": "log", "body_base64": ""}},
    )
    print(f"status={status} body={body}")
    if status != 400:
        print("smoke FAILED: expected 400", file=sys.stderr); return 2
    if not isinstance(body, dict) or "error" not in body or body["error"].get("code") != "idempotency_key_required":
        print("smoke FAILED: missing error.code='idempotency_key_required'", file=sys.stderr); return 2
    print("smoke 4 OK")

    banner("Step 5: smoke — missing x-tenant-id → expect 401 + error.code='unauthorized'")
    status, body = http_post(
        "http://localhost:4000/v1/intake",
        {"content-type": "application/json", "idempotency-key": "k-smoke-12345678"},
        {"provider": "jenkins", "run_id": "x", "attempt_id": "x",
         "artifact": {"type": "log", "body_base64": ""}},
    )
    print(f"status={status} body={body}")
    if status != 401:
        print("smoke FAILED: expected 401", file=sys.stderr); return 2
    if not isinstance(body, dict) or "error" not in body or body["error"].get("code") != "unauthorized":
        print("smoke FAILED: missing error.code='unauthorized'", file=sys.stderr); return 2
    print("smoke 5 OK")

    banner("Step 6: smoke — bad schema → expect 422 + error.code='validation_failed'")
    status, body = http_post(
        "http://localhost:4000/v1/intake",
        {"content-type": "application/json",
         "x-tenant-id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
         "idempotency-key": "k-smoke-22345678"},
        {"provider": "not-a-valid-ci", "run_id": "", "attempt_id": ""},
    )
    print(f"status={status} body={body}")
    if status != 422:
        print("smoke FAILED: expected 422", file=sys.stderr); return 2
    if not isinstance(body, dict) or body.get("error", {}).get("code") != "validation_failed":
        print("smoke FAILED: missing error.code='validation_failed'", file=sys.stderr); return 2
    print("smoke 6 OK")

    banner("Step 7: vitest integration inside the api container")
    rc = run([
        "docker", "compose", "exec", "-T",
        "-e", "NODE_ENV=test",
        "-e", "LOG_LEVEL=error",
        "api",
        "sh", "-c",
        "cd /app/apps/api && pnpm exec vitest run test/integration --reporter=verbose",
    ])
    if rc != 0:
        banner(f"INTEGRATION TESTS FAILED (rc={rc})")
        return 3

    banner("ALL GREEN — RT-001 + RT-013 + RT-015 tested-passing")
    return 0

if __name__ == "__main__":
    sys.exit(main())
