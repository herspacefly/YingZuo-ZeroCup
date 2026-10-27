import { defineConfig, devices } from '@playwright/test';

// Exercise the same relative-base production build at both hosting locations.
// A supplied origin reuses these checks against an already deployed site.
const published = process.env.YINGZUO_PAGES_URL;
const locations = published
  ? [{ name: 'published', baseURL: published }]
  : [{ name: 'root', baseURL: 'http://127.0.0.1:4175/' },
     { name: 'pages', baseURL: 'http://127.0.0.1:4176/YingZuo-ZeroCup/' }];

export default defineConfig({
  testDir: './tests/deployment',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Published checks traverse several cold CDN pages; this is not a load-time SLA.
  timeout: published ? 180000 : 60000,
  expect: { timeout: published ? 30000 : 5000 },
  reporter: process.env.YINGZUO_PAGES_REPORT
    ? [['list'], ['json', { outputFile: process.env.YINGZUO_PAGES_REPORT }]] : 'list',
  use: { trace: 'retain-on-failure', reducedMotion: 'reduce', launchOptions: { args: ['--enable-unsafe-swiftshader'] } },
  projects: locations.flatMap(location => [
    { name: `${location.name}-desktop`, use: { ...devices['Desktop Chrome'], baseURL: location.baseURL, viewport: { width: 1440, height: 900 } } },
    { name: `${location.name}-mobile`, use: { ...devices['Pixel 7'], baseURL: location.baseURL, viewport: { width: 390, height: 844 } } },
  ]),
  webServer: published ? undefined : [
    { command: 'npm run preview -- --port 4175 --strictPort --base /', url: 'http://127.0.0.1:4175/', reuseExistingServer: false },
    { command: 'npm run preview -- --port 4176 --strictPort --base /YingZuo-ZeroCup/', url: 'http://127.0.0.1:4176/YingZuo-ZeroCup/', reuseExistingServer: false },
  ],
});
