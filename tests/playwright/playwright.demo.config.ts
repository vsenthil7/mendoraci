import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config tuned for DEMO RECORDING (not regression testing).
 */

const WEB = process.env.WEB_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results-demo',
  use: {
    baseURL: WEB,
    trace: 'off',
    screenshot: 'off',
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      slowMo: 600,
    },
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
  ],
  expect: { timeout: 10_000 },
});
