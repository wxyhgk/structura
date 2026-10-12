import { expect, test, type Page } from "@playwright/test"

// The publishable package on pages without React or a bundler (packages/react/examples),
// served as plain files from packages/react, as a CDN serves it; see playwright.config.ts.
const PACKAGE = "http://127.0.0.1:25401"

type Handle = { getMolfile(): string; getDocument(): string; run(ops: unknown[]): { ok: boolean } }

/** Opens an example, collecting any error the page reports; waits for its editor unless it starts without one. */
async function openExample(page: Page, name: string, { editor = true } = {}) {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()))
  await page.goto(`${PACKAGE}/examples/${name}`)
  if (editor) await expect(page.locator(".chem-app")).toBeVisible()
  return errors
}

test("a plain <script> mounts the editor, and its handle and callbacks work", async ({ page }) => {
  const errors = await openExample(page, "script.html")
  await page.getByRole("button", { name: "放一个苯环" }).click()
  await expect(page.locator("#status")).toHaveText("改动次数：1")
  await expect(page.locator("#output")).toContainText("V2000")
  // fit() right after run() fits the ring just added, not the empty page before it.
  await expect(page.getByText(/^6 原子 · /)).not.toHaveText("6 原子 · 100%")
  const atoms = await page.evaluate(() => JSON.parse((window as unknown as { editor: Handle }).editor.getDocument()).drawing.molecule.atoms.length)
  expect(atoms).toBe(6)
  await page.getByRole("button", { name: "取 CDXML" }).click()
  await expect(page.locator("#output")).toContainText("<CDXML")
  expect(errors).toEqual([])
})

test("the editor's own styles stay inside it: the host page keeps its look", async ({ page }) => {
  await openExample(page, "script.html")
  const margin = await page.evaluate(() => getComputedStyle(document.body).margin)
  const button = await page.evaluate(() => getComputedStyle(document.getElementById("benzene")!).borderTopStyle)
  expect(margin).toBe("0px")
  expect(button).not.toBe("none")
})

test("as ES modules: the editor, and chem-structura/core drawing what is in it", async ({ page }) => {
  const errors = await openExample(page, "module.html")
  const ran = await page.evaluate(() => (window as unknown as { editor: Handle }).editor.run([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).ok)
  expect(ran).toBe(true)
  await expect(page.locator("#formula")).toHaveText("分子式：C6H6")
  await expect(page.locator("#picture svg")).toBeVisible()
  expect(errors).toEqual([])
})

test("the editor drawn with the mouse reports back through the standalone handle", async ({ page }) => {
  await openExample(page, "module.html")
  const canvas = (await page.getByTestId("canvas").boundingBox())!
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2)
  await expect(page.locator("#formula")).toHaveText(/分子式：C2H6/)
})

test("molecules on a page open in the editor on a click, and saving redraws the card", async ({ page }) => {
  const errors = await openExample(page, "gallery.html", { editor: false })
  const card = page.locator(".molecule", { hasText: "布洛芬" })
  await expect(card.locator(".facts")).toHaveText("C13H18O2 · 206.28")
  await card.click()
  await expect(page.getByText("编辑：布洛芬")).toBeVisible()
  // The page's own classes do not reach the editor: its palette keeps two columns of tools.
  const tools = await page.locator("#sheet-editor aside .grid-cols-2").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)
  expect(tools).toBe(2)
  await page.evaluate(() => (window as unknown as { editor: Handle }).editor.run([{ op: "set_element", atom: 1, el: "N" }]))
  await expect(page.getByText("有未保存的修改")).toBeVisible()
  await page.getByRole("button", { name: "保存" }).click()
  await expect(page.locator("#sheet")).toBeHidden()
  await expect(card.locator(".facts")).toHaveText("C12H17NO2 · 207.27")
  // Kept in this browser: a reload shows the edit, 重置示例 forgets it.
  await page.reload()
  await expect(card.locator(".facts")).toHaveText("C12H17NO2 · 207.27")
  await page.getByRole("button", { name: "重置示例" }).click()
  await expect(card.locator(".facts")).toHaveText("C13H18O2 · 206.28")
  expect(errors).toEqual([])
})

test("a generic formula on the page opens with its variables, and 取消 without changes just closes", async ({ page }) => {
  await openExample(page, "gallery.html", { editor: false })
  await expect(page.locator(".molecule", { hasText: "通式 I" }).locator(".facts")).toHaveText("通式 · R1、R2")
  await page.locator(".molecule", { hasText: "通式 I" }).click()
  const variables = await page.evaluate(() => Object.keys(JSON.parse((window as unknown as { editor: Handle }).editor.getDocument()).drawing.variables))
  expect(variables).toEqual(["R1", "R2"])
  await page.getByRole("button", { name: "取消" }).click()
  await expect(page.locator("#sheet")).toBeHidden()
})

/**
 * A page whose own styles are everything an editor could trip on: rules on bare tag names, on
 * classes the editor also uses (Tailwind's names), a root font size, inherited text styles,
 * and a rule with an id in it.
 */
const HOSTILE_CSS = `
  html { font-size: 10px }
  body { font: italic 30px/3 serif; color: red; letter-spacing: 3px; text-transform: uppercase; text-align: center; cursor: wait }
  * { box-sizing: content-box }
  div { padding: 7px; margin: 3px; border: 1px solid red; background: pink }
  span { display: block; padding: 4px }
  button { background: yellow; padding: 20px; border: 3px solid blue; border-radius: 0; font-size: 22px; min-width: 120px }
  aside, header, nav, section, footer { display: block; padding: 16px; border: 2px solid green; width: 300px }
  .grid { gap: 40px; grid-template-columns: 1fr }
  .flex { flex-direction: column; gap: 30px }
  .hidden { display: block }
  .relative, .absolute { position: static }
  .text-sm, .text-xs { font-size: 40px }
  input { width: 300px; padding: 10px }
  [role="menuitem"] { padding: 25px }
  #host div { padding: 9px }
`

/** The editor in a sized box on an otherwise empty page, with the page's own CSS. */
async function editorOn(page: Page, css: string) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
    <link rel="stylesheet" href="${PACKAGE}/dist/style.css"><style>${css}</style></head>
    <body style="margin:0"><div id="host" style="width:1100px;height:700px;margin:0;padding:0;border:0;box-sizing:border-box"></div>
    <script src="${PACKAGE}/dist/chem-structura.iife.js"></script>
    <script>window.editor = ChemStructura.mount("#host"); window.editor.run([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])</script>
    </body></html>`)
  await expect(page.locator(".chem-app")).toBeVisible()
}

/** Where the editor's parts are and how its text is set, relative to its box; then the same with the 文件 menu open. */
async function layout(page: Page) {
  const measure = () =>
    page.evaluate(() => {
      const host = document.getElementById("host")!.getBoundingClientRect()
      const parts: Record<string, string> = {
        root: ".chem-app",
        menuBar: ".chem-app header",
        palette: ".chem-app aside",
        tools: ".chem-app aside .grid-cols-2",
        firstTool: ".chem-app .tool-button",
        canvas: "[data-testid=canvas]",
        menu: "[role=menu]",
        menuItem: "[role=menuitem]",
      }
      return Object.fromEntries(
        Object.entries(parts).flatMap(([name, selector]) => {
          const element = document.querySelector(selector)
          if (!element) return []
          const box = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          const round = (n: number) => Math.round(n * 2) / 2
          return [[name, { x: round(box.x - host.x), y: round(box.y - host.y), width: round(box.width), height: round(box.height), font: `${style.fontSize} ${style.fontStyle} ${style.letterSpacing} ${style.textTransform}`, colour: style.color, background: style.backgroundColor }]]
        }),
      )
    })
  const closed = await measure()
  await page.getByRole("button", { name: "文件", exact: true }).click()
  await expect(page.getByRole("menu")).toBeVisible()
  // Measured once it has finished zooming in.
  await page.getByRole("menu").evaluate((menu) => Promise.all(menu.getAnimations({ subtree: true }).map((animation) => animation.finished)))
  const open = await measure()
  await page.keyboard.press("Escape")
  return { closed, open }
}

test("the page's own styles do not reach into the editor: it looks the same on a page full of them", async ({ page }) => {
  await editorOn(page, "")
  const clean = await layout(page)
  await editorOn(page, HOSTILE_CSS)
  const hostile = await layout(page)
  expect(Object.keys(hostile.open)).toContain("menuItem")
  expect(hostile).toEqual(clean)
})
