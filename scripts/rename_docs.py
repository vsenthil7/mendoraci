"""Rename docs in two sets per user instruction (13:34, 17/05/2026).
Set A: *_20260517_1130.{md,xlsx} -> drop the date.
Set B: *_20260517_1208.md -> drop the date.
Each set is one commit + push. Uses git mv to preserve history.
"""
import subprocess, sys
from pathlib import Path

REPO = Path(r"C:\Users\v_sen\Documents\Projects\0008_AT_Hack0020_MendoraCI_IBM_Bob\mendoraci")
DOCS = REPO / "docs"

def run(args, **kw):
    print(f"$ {' '.join(args)}")
    r = subprocess.run(args, cwd=REPO, capture_output=True, text=True, **kw)
    if r.stdout: print(r.stdout.rstrip())
    if r.stderr: print(r.stderr.rstrip(), file=sys.stderr)
    return r.returncode

def rename_set(pattern_fragment: str, set_label: str):
    matches = [f for f in DOCS.iterdir() if f.is_file() and pattern_fragment in f.name]
    matches.sort(key=lambda p: p.name)
    print(f"\n=== {set_label}: {len(matches)} files ===")
    if not matches:
        print("  (no files matched - aborting set)")
        return 0
    for f in matches:
        new_name = f.name.replace(pattern_fragment, "")
        new_path = f.with_name(new_name)
        print(f"  {f.name}  ->  {new_name}")
        if new_path.exists() and new_path != f:
            print(f"    SKIP (target already exists)")
            continue
        rc = run(["git", "mv", f"docs/{f.name}", f"docs/{new_name}"])
        if rc != 0:
            return rc
    return 0

def commit_and_push(message_lines):
    args = ["git", "commit"]
    for line in message_lines:
        args += ["-m", line]
    rc = run(args)
    if rc != 0:
        return rc
    return run(["git", "push"])

def which_arg():
    return sys.argv[1] if len(sys.argv) > 1 else "all"

if __name__ == "__main__":
    arg = which_arg()
    if arg in ("1130", "all"):
        rc = rename_set("_20260517_1130", "Set A (1130 baseline)")
        if rc != 0: sys.exit(rc)
        rc = commit_and_push([
            "docs(rename): CP-0c-A drop date from 1130 baseline doc filenames",
            "24 files renamed via git mv (history preserved).",
            "Pattern: *_20260517_1130.(md|xlsx) -> *.(md|xlsx).",
            "Both source-of-truth packs (1130 baseline + 1208 enhancements) stay in repo.",
        ])
        if rc != 0: sys.exit(rc)
    if arg in ("1208", "all"):
        rc = rename_set("_20260517_1208", "Set B (1208 enhancements)")
        if rc != 0: sys.exit(rc)
        rc = commit_and_push([
            "docs(rename): CP-0c-B drop date from 1208 enhancement doc filenames",
            "10 files renamed via git mv (history preserved).",
            "Pattern: *_20260517_1208.md -> *.md.",
            "Filename hygiene: code anchors point at content not version-stamped paths.",
        ])
        if rc != 0: sys.exit(rc)
    print("\nDone.")
