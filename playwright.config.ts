import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const local = `http://localhost:${PORT}`;
// BASE_URL set explicitly = smoke-test a deployment. Otherwise serve the
// working tree, so a PR is tested against its own changes.
const external = process.env.BASE_URL;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: external || local,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  ...(external ? {} : {
    webServer: {
      command: 'node scripts/serve.mjs',
      url: local,
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
    },
  }),
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
