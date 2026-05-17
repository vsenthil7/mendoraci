# creation/ — Record demo video

Coordinates the Playwright spec at `tests/playwright/demo/scr-001-demo.spec.ts`
to record a captioned, narration-free 1-minute walkthrough of MendoraCI's
SCR-001 intake + mask flow.

Ported from `forensa/demovideo/creation/` (sibling hackathon project).

## What it does (4 steps)

1. Pre-flight: docker compose stack up (web + api + postgres + minio)
2. Run the playwright spec with `DEMO=1` (slow-motion + captions + video on)
3. Trim leading 1.0s blank frame with ffmpeg
4. Archive the video to `demo/mendoraci-1min-{timestamp}.{webm,mp4}` + `demo/_backup/`

## Run

```powershell
pwsh ./demovideo/creation/run-creation.ps1
```

## Modular touch-points

- Spec source: `tests/playwright/demo/scr-001-demo.spec.ts`
- Caption helper: `tests/playwright/demo/caption-overlay.ts`
- Config: `tests/playwright/playwright.demo.config.ts`
- Isolated runner: `demovideo/.runner/` (own Playwright install)
- Video archive: `demo/` (active) + `demo/_backup/` (history, gitignored)

## What you'll see in the recording (timeline)

| Time | Content |
|---|---|
| 0:00–0:08 | Title card: "MendoraCI — Governed AI for CI/CD reliability" |
| 0:08–0:18 | BDD scene card: Given / When / Then for SCR-001 |
| 0:18–0:30 | Live SCR-001 page with pill caption "Mask Policy v1 runs BEFORE persist" |
| 0:30–0:45 | Submit button clicked, response renders, AKIA → AKIA**** |
| 0:45–0:55 | Success pill: "✓ Status: masked · Mask Policy v1.0.0 · Zero secret leaks" |
| 0:55–1:00 | Closing card with repo URL |

Final duration: ~50s (target 60s). To extend, edit `durationMs` and `waitForTimeout(...)` values in the spec.
