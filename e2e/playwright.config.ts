import { defineConfig, devices } from "@playwright/test"

// The critical user flows in a real browser, against a production build (vite --mode e2e,
// which hands the editor to the tests as window.__structura). Chromium only: the people
// using Structura are on Edge, which is Chromium. The publishable package is built too, and
// its plain-HTML examples served as files (standalone.spec.ts).
const PORT = 25400
const PACKAGE_PORT = 25401 // standalone.spec.ts uses it too

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
  webServer: [
    {
      command: `npm run build -- --mode e2e && npm run preview -- --mode e2e --port ${PORT} --strictPort`,
      cwd: "..",
      // No chem2office, whatever this machine has: 导出 Word makes pictures, the same everywhere.
      // (The editable path is backend/tests/word.test.ts's, with a stand-in chem2office.)
      env: { CHEM2OFFICE_DIR: "/nonexistent/chem2office" },
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npm run build -w chem-structura && node e2e/serve-package.ts ${PACKAGE_PORT}`,
      cwd: "..",
      url: `http://127.0.0.1:${PACKAGE_PORT}/examples/script.html`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
