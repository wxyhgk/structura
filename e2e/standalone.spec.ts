import { expect, test, type Page } from "@playwright/test"
import { fileURLToPath } from "node:url"

// The publishable package on pages without React or a bundler (packages/react/examples),
// served as plain files from packages/react, as a CDN serves it; see playwright.config.ts.
const PACKAGE = "http://127.0.0.1:25401"

type Handle = {
  getMolfile(): string
  getDocument(): string
  run(ops: unknown[]): { ok: boolean }
  getSvg(): string
  getPng(options?: { scale?: number }): Promise<Blob | null>
  getSmiles(): Promise<string>
  getInchiKey(): Promise<string>
  setSmiles(text: string): Promise<string[]>
}

/** RDKit's wasm, which the package fetches from jsDelivr, answered from node_modules instead: no network in tests. */
const RDKIT_WASM = fileURLToPath(new URL("../node_modules/@rdkit/rdkit/dist/RDKit_minimal.wasm", import.meta.url))
const localRDKit = (page: Page) => page.route("**/RDKit_minimal.wasm", (route) => route.fulfill({ path: RDKIT_WASM, contentType: "application/wasm" }))

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

/** The gallery example, its molecules read (RDKit, for the ones given as SMILES, from node_modules). */
async function openGallery(page: Page) {
  await localRDKit(page)
  const errors = await openExample(page, "gallery.html", { editor: false })
  await expect(page.locator("figure", { hasText: "咖啡因" }).locator(".facts")).toHaveText("C8H10N4O2 · 194.19")
  return errors
}

const facts = (page: Page, name: string) => page.locator("figure", { hasText: name }).locator(".facts")

test("<chem-molecule editable>: a click opens the editor, 保存 redraws it and fires change", async ({ page }) => {
  const errors = await openGallery(page)
  await expect(facts(page, "布洛芬")).toHaveText("C13H18O2 · 206.28")
  await page.locator("chem-molecule[label=布洛芬]").click()
  await expect(page.getByText("编辑：布洛芬")).toBeVisible()
  // The page's own classes do not reach the editor: its palette keeps two columns of tools.
  const tools = await page.locator(".chem-sheet aside .grid-cols-2").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)
  expect(tools).toBe(2)
  const svg = await page.locator("chem-molecule[label=布洛芬] svg").innerHTML()
  // Drawn with the mouse: a click on empty canvas adds a bond (ethane), which the save takes along.
  const canvas = (await page.locator(".chem-sheet [data-testid=canvas]").boundingBox())!
  await page.mouse.click(canvas.x + 60, canvas.y + 60)
  await expect(page.getByText("有未保存的修改")).toBeVisible()
  const changed = page.evaluate(
    () => new Promise<string>((resolve) => document.querySelector("chem-molecule[label=布洛芬]")!.addEventListener("change", (event) => resolve((event as CustomEvent<{ molfile: string }>).detail.molfile), { once: true })),
  )
  await page.locator(".chem-sheet").getByRole("button", { name: "保存" }).click()
  await expect(page.locator(".chem-sheet")).toHaveCount(0)
  expect(await changed).toMatch(/^ 17 16 /m)
  await expect(facts(page, "布洛芬")).toHaveText("C15H24O2 · 236.35")
  expect(await page.locator("chem-molecule[label=布洛芬] svg").innerHTML()).not.toBe(svg)
  // Kept in this browser by the page: a reload shows the edit, 重置示例 forgets it.
  await page.reload()
  await expect(facts(page, "布洛芬")).toHaveText("C15H24O2 · 236.35")
  await page.getByRole("button", { name: "重置示例" }).click()
  await expect(facts(page, "布洛芬")).toHaveText("C13H18O2 · 206.28")
  expect(errors).toEqual([])
})

test("<chem-molecule>: a generic formula keeps its variables; 取消 changes nothing; without editable a click does nothing", async ({ page }) => {
  await openGallery(page)
  await expect(facts(page, "通式 I")).toHaveText("通式 · R1、R2")
  const formula = page.locator("chem-molecule[label='通式 I']")
  const before = await formula.evaluate((element) => (element as HTMLElement & { document: string }).document)
  await formula.press("Enter")
  await expect(page.getByText("编辑：通式 I")).toBeVisible()
  await page.locator(".chem-sheet").getByRole("button", { name: "取消" }).click()
  await expect(page.locator(".chem-sheet")).toHaveCount(0)
  expect(await formula.evaluate((element) => (element as HTMLElement & { document: string }).document)).toBe(before)
  expect(JSON.parse(before).drawing.variables).toHaveProperty("R2")
  // Read only: role img, no editor on a click.
  const benzene = page.locator("chem-molecule[label='苯（只读）']")
  await expect(benzene).toHaveAttribute("role", "img")
  await benzene.click()
  await expect(page.locator(".chem-sheet")).toHaveCount(0)
})

test("<chem-molecule name> in a form: drawn in, submitted as molfile, and reset to what the page gave", async ({ page }) => {
  await openGallery(page)
  const field = page.locator("form chem-molecule")
  await expect(field).toContainText("点击画结构")
  await field.click()
  const canvas = (await page.locator(".chem-sheet [data-testid=canvas]").boundingBox())!
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2)
  await page.locator(".chem-sheet").getByRole("button", { name: "保存" }).click()
  await page.getByRole("button", { name: "提交", exact: true }).click()
  await expect(page.locator("#submitted")).toContainText("V2000")
  await expect(page.locator("#submitted")).toContainText("  2  1  0")
  await page.getByRole("button", { name: "重置", exact: true }).click()
  await expect(field).toContainText("点击画结构")
  await page.getByRole("button", { name: "提交", exact: true }).click()
  await expect(page.locator("#submitted")).toHaveText("（空）")
})

test("<chem-molecule> from script: molfile and document set it without a change event; edit() is there for pages of their own", async ({ page }) => {
  await localRDKit(page)
  await page.goto(`${PACKAGE}/examples/script.html`)
  const result = await page.evaluate(async () => {
    const element = document.createElement("chem-molecule") as HTMLElement & { molfile: string; document: string; value: string }
    let changes = 0
    element.addEventListener("change", () => changes++)
    document.body.append(element)
    const benzene = (window as unknown as { ChemStructura: { drawingMolfile(d: unknown): string; applyOps(d: unknown, ops: unknown[]): { drawing: unknown }; emptyDrawing(): unknown } }).ChemStructura
    element.molfile = benzene.drawingMolfile(benzene.applyOps(benzene.emptyDrawing(), [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).drawing)
    return { atoms: JSON.parse(element.document).drawing.molecule.atoms.length, svg: element.querySelector("svg") !== null, value: element.value.includes("V2000"), changes, role: element.getAttribute("role") }
  })
  expect(result).toEqual({ atoms: 6, svg: true, value: true, changes: 0, role: "img" })
  // edit() on its own: opens over the page, resolves to null on 取消.
  const cancelled = page.evaluate(() => (window as unknown as { ChemStructura: { edit(o: object): Promise<unknown> } }).ChemStructura.edit({ title: "单独打开" }))
  await expect(page.getByText("单独打开")).toBeVisible()
  await page.locator(".chem-sheet").getByRole("button", { name: "取消" }).click()
  expect(await cancelled).toBeNull()
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

test("the handle gives SMILES, InChIKey, SVG and PNG, and takes SMILES as the host's own change", async ({ page }) => {
  await localRDKit(page)
  const errors = await openExample(page, "script.html")
  const problems = await page.evaluate(() => (window as unknown as { editor: Handle }).editor.setSmiles("Oc1ccccc1 phenol"))
  expect(problems).toEqual([])
  // Set by the host, so not reported back to it.
  await expect(page.locator("#status")).toHaveText("改动次数：0")
  const out = await page.evaluate(async () => {
    const editor = (window as unknown as { editor: Handle }).editor
    const png = await editor.getPng({ scale: 2 })
    return { smiles: await editor.getSmiles(), key: await editor.getInchiKey(), svg: editor.getSvg(), png: png && { type: png.type, size: png.size } }
  })
  expect(out.smiles).toBe("Oc1ccccc1")
  expect(out.key).toBe("ISWSIDIOOBJBQZ-UHFFFAOYSA-N")
  expect(out.svg).toMatch(/^<\?xml[\s\S]*<svg[\s\S]*>O<[\s\S]*<\/svg>\s*$/)
  expect(out.png?.type).toBe("image/png")
  expect(out.png?.size).toBeGreaterThan(1000)
  // An edit after it is reported as usual; blank SMILES clears, and an empty page has no picture.
  await page.getByRole("button", { name: "放一个苯环" }).click()
  await expect(page.locator("#status")).toHaveText("改动次数：1")
  const cleared = await page.evaluate(async () => {
    const editor = (window as unknown as { editor: Handle }).editor
    await editor.setSmiles("")
    return { svg: editor.getSvg(), png: await editor.getPng(), smiles: await editor.getSmiles() }
  })
  expect(cleared).toEqual({ svg: "", png: null, smiles: "" })
  expect(await page.evaluate(() => (window as unknown as { editor: Handle }).editor.setSmiles("not-smiles((("))).not.toEqual([])
  expect(errors).toEqual([])
})

test("update() swaps a mounted editor's options, keeping its drawing", async ({ page }) => {
  await openExample(page, "script.html")
  await page.getByRole("button", { name: "放一个苯环" }).click()
  await expect(page.locator("#status")).toHaveText("改动次数：1")
  await page.evaluate(() => {
    const host = window as unknown as { editor: Handle & { update(options: object): void }; seen: number }
    host.seen = 0
    host.editor.update({ onChange: () => host.seen++ })
    host.editor.run([{ op: "add_atom", el: "O", to: 1 }])
  })
  // The new onChange hears the next edit; the page's first one no longer does.
  await expect.poll(() => page.evaluate(() => (window as unknown as { seen: number }).seen)).toBe(1)
  await expect(page.locator("#status")).toHaveText("改动次数：1")
  expect(await page.evaluate(() => JSON.parse((window as unknown as { editor: Handle }).editor.getDocument()).drawing.molecule.atoms.length)).toBe(7)
})
