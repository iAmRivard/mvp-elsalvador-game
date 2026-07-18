import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Un runner CI debe medir una sesión MapLibre/WebGL sin competir con otra.
  workers: process.env.CI ? 1 : 2,
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4173',
    // Las pruebas interceptan fallos de red de forma deliberada. Un SW de una
    // ejecución previa puede responder antes que page.route y falsear el caso.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  expect: {
    timeout: 10_000,
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        // Lanzar Vite directamente evita que el wrapper de npm deje un hijo
        // activo en Windows cuando Playwright cierra el servidor enfocado.
        command:
          'node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1',
        port: 4173,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: 'chromium-desktop',
      testIgnore: [/pwa\.spec\.ts/, /onboarding-full\.spec\.ts/],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      testIgnore: [/pwa\.spec\.ts/, /onboarding-full\.spec\.ts/],
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'chromium-mobile-landscape',
      testIgnore: [/pwa\.spec\.ts/, /onboarding-full\.spec\.ts/],
      use: { ...devices['Pixel 7 landscape'] },
    },
    {
      name: 'chromium-pwa',
      testMatch: /pwa\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        serviceWorkers: 'allow',
      },
    },
    {
      name: 'chromium-onboarding',
      testMatch: /onboarding-full\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 392, height: 850 },
      },
    },
  ],
});
