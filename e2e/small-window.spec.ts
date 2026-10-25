import { expect, test, type Page } from "@playwright/test"

// The editor in a small box, as pages embed it: the layout follows the box, not the window.
// The package's script on a page of its own, served beside the examples (see standalone.spec.ts).
const PACKAGE = "http://127.0.0.1:25401"

type Mounted = {
  getDocument(): string
  run(ops: unknown[]): { ok: boolean }
  update(options: object): void
}
type Page$ = { editor: Mounted; documents: string[]; files: Array<{ name: string; type: string; size: number }>; ChemStructura: { mount(target: string, options?: object): Mounted } }

/** A page holding one editor in a `width`×`height` box, mounted with `options` (functions as source text). */
async function boxed(page: Page, width: number, height: number, options = "{}") {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.route(`${PACKAGE}/examples/__boxed.html`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../dist/style.css"></head>
        <body style="margin:0"><div id="box" style="width:${width}px;height:${height}px"></div>
        <script src="../dist/chem-structura.iife.js"></script>
        <script>
          window.documents = []
          window.files = []
          window.editor = ChemStructura.mount("#box", Object.assign({ onDocumentChange: (text) => documents.push(text) }, ${options}))
        </script></body></html>`,
    }),
  )
  await page.goto(`${PACKAGE}/examples/__boxed.html`)
  await expect(page.locator(".chem-app")).toBeVisible()
  return errors
}

const layout = (page: Page) => page.locator(".chem-app").first().getAttribute("data-layout")
const atomCount = (page: Page) => page.evaluate(() => JSON.parse((window as unknown as Page$).editor.getDocument()).drawing.molecule.atoms.length as number)

test("the layout follows the editor's own box as it is resized, whatever the window", async ({ page }) => {
  const errors = await boxed(page, 1000, 700)
  expect(await layout(page)).toBe("full")
  await expect(page.getByTestId("document-title")).toBeVisible()
  await page.locator("#box").evaluate((box) => Object.assign((box as HTMLElement).style, { width: "600px", height: "450px" }))
  await expect.poll(() => layout(page)).toBe("compact")
  await page.locator("#box").evaluate((box) => Object.assign((box as HTMLElement).style, { width: "380px", height: "500px" }))
  await expect.poll(() => layout(page)).toBe("mini")
  // Mini: no menu bar or status bar; the menus behind ☰.
  await expect(page.getByTestId("document-title")).toHaveCount(0)
  await expect(page.getByTestId("formula")).toHaveCount(0)
  expect(errors).toEqual([])
})

test("compact: one row of menus that does not wrap, rotating behind ⋯, the formula's panes one at a time", async ({ page }) => {
  await boxed(page, 600, 450)
  const menuBar = page.locator("header").first()
  expect((await menuBar.boundingBox())!.height).toBeLessThanOrEqual(32)
  for (const label of ["文件", "编辑", "结构", "查看", "帮助"]) expect((await menuBar.getByText(label, { exact: true }).boundingBox())!.height).toBeLessThanOrEqual(24)
  await page.evaluate(() => (window as unknown as Page$).editor.run([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]))
  await page.getByRole("button", { name: "更多" }).click()
  await expect(page.getByRole("menuitem", { name: /顺时针 15°/ })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("tab", { name: "通式" }).click()
  const panes = page.getByRole("tablist", { name: "通式", exact: true })
  await expect(panes).toBeVisible()
  await expect(page.getByTestId("resultsPane")).toHaveCount(0)
  await panes.getByRole("tab", { name: "生成结果" }).click()
  await expect(page.getByTestId("resultsPane")).toBeVisible()
})

test("mini: ☰ holds every menu and the switch to 通式; nothing spills out of the box", async ({ page }) => {
  await boxed(page, 360, 480)
  expect(await layout(page)).toBe("mini")
  const wide = await page.locator(".chem-app").evaluate((app) => [...app.querySelectorAll("*")].filter((element) => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX === "visible").length)
  expect(wide).toBe(0)
  await page.getByRole("button", { name: "菜单" }).click()
  for (const label of ["文件", "编辑", "结构", "查看", "帮助"]) await expect(page.getByRole("menuitem", { name: label })).toBeVisible()
  await page.getByRole("menuitemradio", { name: "通式" }).click()
  await expect(page.getByTestId("markush-workspace")).toBeVisible()
})

test("mini: 放大编辑 opens the structure in the sheet, and what is saved there comes back as an edit", async ({ page }) => {
  await boxed(page, 360, 480)
  await page.evaluate(() => (window as unknown as Page$).editor.run([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]))
  const before = await page.evaluate(() => (window as unknown as Page$).documents.length)
  await page.getByRole("button", { name: "放大编辑" }).click()
  const sheet = page.locator(".chem-sheet")
  await expect(sheet).toBeVisible()
  // The sheet's editor is full size, and has no 放大编辑 of its own.
  await expect(sheet.locator(".chem-app")).toHaveAttribute("data-layout", "full")
  await expect(sheet.getByRole("button", { name: "放大编辑" })).toHaveCount(0)
  const canvas = (await sheet.getByTestId("canvas").boundingBox())!
  await page.mouse.click(canvas.x + 60, canvas.y + 60)
  await sheet.getByRole("button", { name: "保存" }).click()
  await expect(sheet).toHaveCount(0)
  expect(await atomCount(page)).toBe(8)
  // Taken as the user's own edit: reported, and undoable.
  expect(await page.evaluate(() => (window as unknown as Page$).documents.length)).toBeGreaterThan(before)
  await page.getByRole("button", { name: "撤销" }).click()
  await expect.poll(() => atomCount(page)).toBe(6)
})

test("mount() options: ui leaves parts out, onExpand undefined offers no 放大编辑, and layout holds whatever the size", async ({ page }) => {
  await boxed(page, 1000, 700, `{ ui: { menuBar: false, statusBar: false, workspaces: false }, layout: "mini", onExpand: undefined }`)
  expect(await layout(page)).toBe("mini")
  await expect(page.getByRole("button", { name: "菜单" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "放大编辑" })).toHaveCount(0)
  await page.evaluate(() => (window as unknown as Page$).editor.update({ ui: { toolbar: false, palette: false }, layout: "full" }))
  await expect(page.getByTestId("toolbar")).toHaveCount(0)
  await expect(page.getByTestId("document-title")).toBeVisible()
  await expect(page.getByRole("tab", { name: "通式" })).toBeVisible()
})

test("onFile takes what the editor saves and exports, instead of a download; false lets it download", async ({ page }) => {
  await boxed(page, 1000, 700, `{ onFile: (file) => { files.push({ name: file.name, type: file.type, size: file.data.size }); return file.name.endsWith(".svg") ? false : undefined } }`)
  await page.evaluate(() => (window as unknown as Page$).editor.run([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]))
  let downloads = 0
  page.on("download", () => downloads++)
  await page.getByRole("button", { name: "文件" }).click()
  await page.getByRole("menuitem", { name: "导出 MOL" }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as Page$).files)).toEqual([expect.objectContaining({ name: "未命名.mol", type: "chemical/x-mdl-molfile" })])
  expect(downloads).toBe(0)
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "文件" }).click()
  await page.getByRole("menuitem", { name: /导出 SVG/ }).click()
  expect((await download).suggestedFilename()).toBe("未命名.svg")
})

test("an input method's Enter picks its characters: it does not commit the atom's label", async ({ page }) => {
  await boxed(page, 1000, 700)
  // A click draws a bond from where it lands; Enter over that atom opens its label.
  const canvas = (await page.getByTestId("canvas").boundingBox())!
  const at = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 }
  await page.mouse.click(at.x, at.y)
  await page.mouse.move(at.x + 1, at.y)
  await page.mouse.move(at.x, at.y)
  await page.keyboard.press("Enter")
  const field = page.getByRole("textbox", { name: "原子标签" })
  await expect(field).toBeVisible()
  await field.fill("Cl")
  await field.evaluate((input) => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, isComposing: true })))
  await expect(field).toBeVisible()
  await field.press("Enter")
  await expect(field).toHaveCount(0)
})
