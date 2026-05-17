# MendoraCI Demo Video Pipeline

Captioned, narration-free 1-minute walkthrough recorded via Playwright.
Ported from the Forensa sibling project's pipeline at
`0007_AT_Hack0018_Forensa_TechEx_Veea_Google/forensa/demovideo/`.

Scoped to the one working screen (SCR-001 intake + mask) and a 1-minute duration.

## Folder layout

```
demovideo/
  README.md                                 # this file
  creation/
    run-creation.ps1                        # 4-step orchestrator
    README.md                               # creation-specific docs
  results/
    creation/
      latest.txt                            # pointer to most recent recording (gitignored)
  .runner/                                  # isolated Playwright install (gitignored)
```

## Source files the recording drives

```
tests/playwright/playwright.demo.config.ts                      # repo-level config
tests/playwright/demo/scr-001-demo.spec.ts                      # captioned 1-min spec
tests/playwright/demo/caption-overlay.ts                        # BDD scene cards + title cards
demovideo/.runner/playwright.demo.config.ts                     # isolated-runner config (gitignored)
demovideo/.runner/specs/scr-001-demo.spec.ts                    # copy used by isolated runner
demovideo/.runner/specs/caption-overlay.ts                      # copy used by isolated runner
```

## Usage

```powershell
pwsh ./demovideo/creation/run-creation.ps1
```

The script:
1. Verifies `mendoraci-web` and `mendoraci-api` are up (`docker ps`)
2. Runs the captioned Playwright spec with `DEMO=1` (slowMo + video on)
3. Trims the leading 1.0s blank frame with ffmpeg
4. Archives to `demo/mendoraci-1min-{timestamp}.{webm,mp4}` and `demo/_backup/`

## Outputs

- Active recording: `demo/mendoraci-1min-{timestamp}.mp4` (committed via `git add -f`)
- WebM source: `demo/mendoraci-1min-{timestamp}.webm` (gitignored)
- Backup: `demo/_backup/` (gitignored)
- Pointer: `demovideo/results/creation/latest.txt` (gitignored)

## Prerequisites

- Docker Desktop running, `docker compose up -d` complete
- `apps/web` reachable at `http://localhost:3000`
- `apps/api` reachable at `http://localhost:4000`
- Node 18+ on host (for the isolated Playwright runner)
- ffmpeg on PATH

## First-time setup

The isolated runner installs its own Playwright at `demovideo/.runner/` (kept out of the pnpm workspace to avoid collisions). One-time:

```powershell
Set-Location demovideo/.runner
npm install
.\node_modules\.bin\playwright.cmd install chromium
```

Subsequent runs just use `pwsh ./demovideo/creation/run-creation.ps1`.
