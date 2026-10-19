import { expect, test, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
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

test("edit(): Escape is 取消 once the editor has nothing to stop or deselect, asking first when there are changes", async ({ page }) => {
  const errors = await openGallery(page)
  const card = page.locator("chem-molecule[label=布洛芬]")
  await card.click()
  const sheet = page.locator(".chem-sheet")
  await expect(sheet).toBeVisible()
  // Nothing selected: one Escape closes (no tool switch to press through first).
  await page.keyboard.press("Escape")
  await expect(sheet).toHaveCount(0)
  // Focus is back on the element it came from.
  await expect(card).toBeFocused()
  // With a change: Escape asks; "no" keeps the sheet, "yes" closes it and keeps nothing.
  await card.press("Enter")
  const canvas = (await page.locator(".chem-sheet [data-testid=canvas]").boundingBox())!
  await page.mouse.click(canvas.x + 60, canvas.y + 60)
  await expect(page.getByText("有未保存的修改")).toBeVisible()
  // A selection is the editor's to clear first.
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Escape")
  await expect(sheet).toBeVisible()
  const asked: string[] = []
  page.once("dialog", (dialog) => (asked.push(dialog.message()), dialog.dismiss()))
  await page.keyboard.press("Escape")
  await expect.poll(() => asked).toEqual(["修改还没保存，确定放弃吗？"])
  await expect(sheet).toBeVisible()
  page.once("dialog", (dialog) => dialog.accept())
  // Escape on the bar's buttons, which are not the editor's, cancels too.
  await sheet.getByRole("button", { name: "保存" }).focus()
  await page.keyboard.press("Escape")
  await expect(sheet).toHaveCount(0)
  await expect(facts(page, "布洛芬")).toHaveText("C13H18O2 · 206.28")
  expect(errors).toEqual([])
})

test("edit(): the page behind is inert while it is open, focus starts in the editor, and Tab stays in", async ({ page }) => {
  await openGallery(page)
  const card = page.locator("chem-molecule[label=布洛芬]")
  await card.click()
  await expect(page.locator(".chem-sheet")).toBeVisible()
  expect(await page.evaluate(() => document.activeElement?.classList.contains("chem-app"))).toBe(true)
  expect(await page.evaluate(() => document.querySelector("main")!.inert)).toBe(true)
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest(".chem-sheet, .chem-overlay"))).toBe(true)
  }
  await page.locator(".chem-sheet").getByRole("button", { name: "取消" }).click()
  expect(await page.evaluate(() => document.querySelector("main")!.inert)).toBe(false)
  await expect(card).toBeFocused()
})

test("<chem-molecule>: a double click or held Enter opens one editor, and nothing is left unhandled", async ({ page }) => {
  const errors = await openGallery(page)
  const card = page.locator("chem-molecule[label=布洛芬]")
  await card.dblclick()
  await expect(page.locator(".chem-sheet")).toHaveCount(1)
  await page.locator(".chem-sheet").getByRole("button", { name: "取消" }).click()
  // Enter thrice on it, before the first has opened anything.
  await card.evaluate((element) => {
    for (let i = 0; i < 3; i++) element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  })
  await expect(page.locator(".chem-sheet")).toHaveCount(1)
  // Another element clicked while an editor is open (from script, say) is just dropped.
  await page.locator("chem-molecule[label=阿司匹林]").evaluate((element) => (element as HTMLElement).click())
  await expect(page.locator(".chem-sheet")).toHaveCount(1)
  await page.locator(".chem-sheet").getByRole("button", { name: "取消" }).click()
  await page.waitForTimeout(100)
  expect(errors).toEqual([])
})

/** A page of the test's own beside the package's files: an ES module importing the standalone build. */
async function modulePage(page: Page, body: string) {
  await page.route(`${PACKAGE}/test/page.html`, (route) =>
    route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../dist/style.css"></head><body>${body}</body></html>` }),
  )
  await page.route(`${PACKAGE}/test/RDKit_minimal.*`, (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop()!
    return route.fulfill({ path: fileURLToPath(new URL(`../node_modules/@rdkit/rdkit/dist/${file}`, import.meta.url)), contentType: file.endsWith(".js") ? "text/javascript" : "application/wasm" })
  })
  const fetched: string[] = []
  page.on("request", (request) => request.url().endsWith(".wasm") && fetched.push(request.url()))
  const warnings: string[] = []
  page.on("console", (message) => message.type() === "warning" && warnings.push(message.text()))
  await page.goto(`${PACKAGE}/test/page.html`)
  return { fetched, warnings }
}

test("configureRDKit({ wasmUrl }) right after the import is in time for <chem-molecule smiles>", async ({ page }) => {
  const { fetched, warnings } = await modulePage(
    page,
    `<chem-molecule smiles="c1ccccc1O"></chem-molecule>
     <script type="module">
       import { configureRDKit } from "../dist/standalone.js"
       configureRDKit({ wasmUrl: "${PACKAGE}/test/RDKit_minimal.wasm" })
     </script>`,
  )
  await expect(page.locator("chem-molecule svg")).toBeVisible()
  expect(fetched).toEqual([`${PACKAGE}/test/RDKit_minimal.wasm`])
  expect(warnings).toEqual([])
})

test("configureRDKit({ module }) lends the page's own RDKit: its wasm is fetched once, and a late call says it is late", async ({ page }) => {
  const { fetched, warnings } = await modulePage(
    page,
    `<script src="RDKit_minimal.js"></script>
     <chem-molecule smiles="CCO"></chem-molecule>
     <script type="module">
       import { configureRDKit } from "../dist/standalone.js"
       configureRDKit({ module: initRDKitModule({ locateFile: () => "${PACKAGE}/test/RDKit_minimal.wasm" }) })
     </script>`,
  )
  await expect(page.locator("chem-molecule svg")).toBeVisible()
  expect(fetched).toEqual([`${PACKAGE}/test/RDKit_minimal.wasm`])
  await page.evaluate(() => import("../dist/standalone.js" as string).then((module) => module.configureRDKit({ wasmUrl: "x.wasm" })))
  await expect.poll(() => warnings.length).toBe(1)
  expect(warnings[0]).toContain("configureRDKit came after RDKit had started loading")
})

/** A molfile from atom lines (element, x, y, z) and bonds (from, to), one-based. */
const molfile = (atoms: Array<[string, number, number, number]>, bonds: Array<[number, number]>) =>
  [
    "",
    "  test",
    "",
    `${String(atoms.length).padStart(3)}${String(bonds.length).padStart(3)}  0  0  0  0  0  0  0  0999 V2000`,
    ...atoms.map(([el, x, y, z]) => `${x.toFixed(4).padStart(10)}${y.toFixed(4).padStart(10)}${z.toFixed(4).padStart(10)} ${el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`),
    ...bonds.map(([a, b]) => `${String(a).padStart(3)}${String(b).padStart(3)}  1  0`),
    "M  END",
    "",
  ].join("\n")

type EditApi = { edit(options: object): Promise<Record<string, unknown> | null> }
const startEdit = (page: Page, options: object) => page.evaluate((given) => (window as unknown as { ChemStructura: EditApi }).ChemStructura.edit(given), options)
const failedEdit = (page: Page, options: object) => page.evaluate((given) => (window as unknown as { ChemStructura: EditApi }).ChemStructura.edit(given).then(() => "opened", (error: Error) => error.message), options)

test("edit(): the saved structure's problems come back, and confirmProblems asks before saving", async ({ page }) => {
  await openExample(page, "script.html")
  const sheet = page.locator(".chem-sheet")
  // O–H–C: the H has two bonds.
  const saving = startEdit(page, { molfile: molfile([["O", 0, 0, 0], ["H", 1.5, 0, 0], ["C", 3, 0, 0]], [[1, 2], [2, 3]]), confirmProblems: true })
  await expect(sheet).toBeVisible()
  const asked: string[] = []
  page.once("dialog", (dialog) => (asked.push(dialog.message()), dialog.dismiss()))
  await sheet.getByRole("button", { name: "保存" }).click()
  await expect.poll(() => asked.join("")).toContain("第 2 个原子（H）超出化合价")
  expect(asked[0]).toContain("仍然保存吗？")
  await expect(sheet).toBeVisible()
  page.once("dialog", (dialog) => dialog.accept())
  await sheet.getByRole("button", { name: "保存" }).click()
  const saved = (await saving)!
  expect(saved.problems).toEqual([{ code: "valence", severity: "warning", atoms: [2], text: "第 2 个原子（H）超出化合价", message: expect.stringContaining("valence") }])
  expect(saved).toMatchObject({ notes: [], changed: false })
  expect(saved).not.toHaveProperty("smiles")
})

test("edit(): a 3D molfile is flattened and says so, or refused with on3D: \"reject\"", async ({ page }) => {
  await openExample(page, "script.html")
  const threeD = molfile([["C", 0, 0, 0], ["O", 1.2, 0, 0.9]], [[1, 2]])
  expect(await failedEdit(page, { molfile: threeD, on3D: "reject" })).toContain("三维")
  await expect(page.locator(".chem-sheet")).toHaveCount(0)
  const saving = startEdit(page, { molfile: threeD })
  await page.locator(".chem-sheet").getByRole("button", { name: "保存" }).click()
  expect(((await saving)!.notes as string[]).join("")).toContain("三维坐标已投影到平面")
})

test("edit(): SMILES in and out; SMILES it cannot read is refused; a formula with variables has no SMILES", async ({ page }) => {
  await localRDKit(page)
  await openExample(page, "script.html")
  const sheet = page.locator(".chem-sheet")
  const saving = startEdit(page, { smiles: "Oc1ccccc1" })
  await expect(sheet).toBeVisible()
  await sheet.getByRole("button", { name: "保存" }).click()
  expect(await saving).toMatchObject({ smiles: "Oc1ccccc1", changed: false, problems: [] })
  expect(await failedEdit(page, { smiles: "C1CC(((" })).toContain("SMILES 读不了")
  const formula = await readFile(fileURLToPath(new URL("fixtures/benzene-R1-R2.structura", import.meta.url)), "utf8")
  const generic = startEdit(page, { document: formula, withSmiles: true })
  await sheet.getByRole("button", { name: "保存" }).click()
  expect((await generic)!.smiles).toBeNull()
})

test("a page's own .dark leaves the editor in one piece: light, menus and all, as it has no dark theme yet", async ({ page }) => {
  await openExample(page, "script.html")
  await page.evaluate(() => document.documentElement.classList.add("dark"))
  await page.getByRole("button", { name: "文件", exact: true }).click()
  const menu = await page.getByRole("menu").evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(menu).toMatch(/^(rgb\(255, 255, 255\)|oklch\(1 0 0\))$/)
})

test("theme: edit({ theme: \"dark\" }) opens dark; <chem-molecule theme> draws for a dark page, and \"auto\" follows it", async ({ page }) => {
  await localRDKit(page)
  await openExample(page, "script.html")
  const saving = startEdit(page, { smiles: "c1ccccc1O", theme: "dark" })
  const sheet = page.locator(".chem-sheet")
  await expect(sheet).toHaveClass(/chem-dark/)
  await expect(sheet.locator(".chem-app")).toHaveClass(/chem-dark/)
  await sheet.getByRole("button", { name: "取消" }).click()
  expect(await saving).toBeNull()

  const picture = (theme: string) =>
    page.evaluate(async (theme) => {
      const element = document.createElement("chem-molecule")
      element.setAttribute("theme", theme)
      element.setAttribute("smiles", "c1ccccc1O")
      document.body.append(element)
      await new Promise((done) => element.addEventListener("load", done, { once: true }))
      const svg = () => element.querySelector("svg")!.outerHTML
      return { svg: svg(), element: theme }
    }, theme)
  const light = await picture("light")
  expect(light.svg).toContain("<rect")
  expect(light.svg).toContain("#222222")
  const dark = await picture("dark")
  expect(dark.svg).not.toContain("<rect")
  expect(dark.svg).not.toContain("#222222")
  // "auto" follows the page as it turns.
  const auto = page.locator('chem-molecule[theme="auto"]')
  await picture("auto")
  await expect.poll(() => auto.evaluate((element) => element.querySelector("svg")!.outerHTML.includes("#222222"))).toBe(true)
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"))
  await expect.poll(() => auto.evaluate((element) => element.querySelector("svg")!.outerHTML.includes("#222222"))).toBe(false)
})
