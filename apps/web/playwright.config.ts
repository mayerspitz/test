import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT ?? '8787';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  // The real server, serving the built web app, against a mock AccuWeather upstream.
  webServer: {
    command: 'pnpm --filter @windwise/server e2e:serve',
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { E2E_PORT: port },
  },
});
