import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4173',
    // Las pruebas interceptan fallos de red de forma deliberada. Un SW de una
    // ejecución previa puede responder antes que page.route y falsear el caso.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  expect: {
    timeout: 10_000,
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1',
        port: 4173,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'chromium-mobile-landscape',
      use: { ...devices['Pixel 7 landscape'] },
    },
  ],
});
