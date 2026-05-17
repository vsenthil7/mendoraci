#!/usr/bin/env python3
"""Quick verifier: run E2E in compose, capture exit code, parse summary line."""
import subprocess, sys, re, time
from pathlib import Path

REPO = Path(r"C:\Users\v_sen\Documents\Projects\0008_AT_Hack0020_MendoraCI_IBM_Bob\mendoraci")

cmd = [
    "docker", "compose", "--profile", "test", "run", "--rm", "-T", "test",
    "pnpm", "exec", "playwright", "test",
    "--config=tests/playwright/playwright.config.ts",
    "--reporter=list",
]
print("$ " + " ".join(cmd), flush=True)
t0 = time.time()
p = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
print(f"\nrc={p.returncode}  duration={time.time()-t0:.1f}s")
print("\n=== STDOUT (last 80 lines) ===")
print("\n".join(p.stdout.splitlines()[-80:]))
if p.stderr:
    print("\n=== STDERR (last 40 lines) ===")
    print("\n".join(p.stderr.splitlines()[-40:]))
sys.exit(p.returncode)
