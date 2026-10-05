import { defineConfig, devices } from "@playwright/test"

// The critical user flows in a real browser, against a production build (vite --mode e2e,
// which hands the editor to the tests as window.__structura). Chromium only: the people
// using Structura are on Edge, which is Chromium.
const PORT = 25400

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        // A Chromium already on this machine instead of Playwright's download, if you point at one.
        launchOptions: process.env.STRUCTURA_CHROMIUM ? { executablePath: process.env.STRUCTURA_CHROMIUM } : {},
      },
    },
  ],
  webServer: {
    command: `npm run build -- --mode e2e && npm run preview -- --mode e2e --port ${PORT} --strictPort`,
    cwd: "..",
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
