// Browser + screenshot tests for Cafe Log.
//   npm test                     run everything
//   npm run test:update-screens  re-take the reference screenshots after an intended look change
//   npm run test:report          open the last HTML report (shows screenshot diffs side by side)
const { defineConfig } = require('@playwright/test');

// Sizes match the app added to the home screen (full screen, no Safari bars).
const iphone14Pro = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const ipadA16 = { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' };

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    // Tight on purpose so pastel colour changes are caught: each pixel may shift at most 5% in colour,
    // and at most 0.01% of the screen may differ (anti-aliasing). Looser settings missed a star-colour change.
    toHaveScreenshot: { threshold: 0.05, maxDiffPixelRatio: 0.0001, animations: 'disabled', caret: 'hide' },
  },
  snapshotPathTemplate: 'tests/screens/{projectName}/{arg}{ext}',
  fullyParallel: true,
  // one retry for timing hiccups when many browsers run at once; anything that needed it is listed as "flaky"
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tools/serve.js',
    env: { PORT: '5174' },
    url: 'http://localhost:5174',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'iphone-safari', use: { browserName: 'webkit', ...iphone14Pro } },
    { name: 'ipad-safari', use: { browserName: 'webkit', ...ipadA16 } },
    { name: 'ipad-landscape-safari', use: { browserName: 'webkit', ...ipadA16, viewport: { width: 1180, height: 820 } } },
    // Chrome engine, iPhone size: catches anything engine-specific and checks offline/install support
    { name: 'iphone-chrome', use: { browserName: 'chromium', channel: 'chrome', ...iphone14Pro }, testIgnore: /visual/ },
  ],
});
