import { expect, test } from "@playwright/test"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { rolldown } from "rolldown"

// The React component as a server-rendering framework (Next.js, Remix…) uses it: the built
// package (packages/react/dist, made by the webServer in playwright.config.ts) renders to HTML
// in Node, then React takes that HTML over in the browser (hydration) without a mismatch.

const PACKAGE = "http://127.0.0.1:25401"
const DIST = fileURLToPath(new URL("../packages/react/dist/index.js", import.meta.url))
const MOLFILE = "\n  methanol\n\n  2  1  0  0  0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 C   0  0\n    1.5000    0.0000    0.0000 O   0  0\n  1  2  1  0\nM  END\n"

/** The page (answered by the test, beside the package's files): the server's HTML, and a script that hydrates it with the same props. */
let page_: { html: string; script: string }

test.beforeAll(async () => {
  const { StructuraEditor } = await import(DIST)
  const html = renderToString(createElement(StructuraEditor, { initialMolfile: MOLFILE }))
  const dir = mkdtempSync(join(tmpdir(), "structura-ssr-"))
  const entry = join(dir, "client.mjs")
  writeFileSync(
    entry,
    `import { createElement } from "react"
     import { hydrateRoot } from "react-dom/client"
     import { StructuraEditor } from ${JSON.stringify(DIST)}
     hydrateRoot(document.getElementById("root"), createElement(StructuraEditor, { initialMolfile: ${JSON.stringify(MOLFILE)} }), {
       onRecoverableError: (error) => console.error("recoverable: " + error.message),
     })`,
  )
  const bundle = await rolldown({
    input: entry,
    platform: "browser",
    // The development build of React, which reports every mismatch.
    transform: { define: { "process.env.NODE_ENV": '"development"' } },
    resolve: { modules: [fileURLToPath(new URL("../node_modules", import.meta.url))] },
    logLevel: "silent",
  })
  const out = join(dir, "client.js")
  await bundle.write({ file: out, format: "iife", codeSplitting: false })
  page_ = { html, script: readFileSync(out, "utf8") }
})

test("rendered on a server, the editor is taken over in the browser without a mismatch, drawing included", async ({ page }) => {
  expect(page_.html).toContain("chem-app")
  const problems: string[] = []
  page.on("console", (message) => message.type() === "error" && problems.push(message.text()))
  page.on("pageerror", (error) => problems.push(error.message))
  await page.route(`${PACKAGE}/ssr/`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../dist/style.css"></head>
        <body style="margin:0"><div id="root" style="width:1100px;height:700px">${page_.html}</div><script src="client.js"></script></body></html>`,
    }),
  )
  await page.route(`${PACKAGE}/ssr/client.js`, (route) => route.fulfill({ contentType: "text/javascript", body: page_.script }))
  await page.goto(`${PACKAGE}/ssr/`)
  // Alive: the drawing appears once hydrated, and the editor answers.
  await expect(page.getByText("2 原子", { exact: false })).toBeVisible()
  await expect(page.locator("[data-testid=canvas] text").first()).toBeVisible()
  await page.getByRole("button", { name: "文件", exact: true }).click()
  await expect(page.getByRole("menu")).toBeVisible()
  expect(problems).toEqual([])
})
