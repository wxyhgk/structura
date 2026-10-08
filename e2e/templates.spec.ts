import { expect, test, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { doc, openEditor, openFile } from "./support.ts"

// The template library in the 通式 workspace. The e2e build keeps the user's templates in
// memory (no backend), fresh for every page.

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))
type Listed = { alternatives: Array<{ kind: string; class?: string; name?: string; molecule?: { atoms: Array<{ el: string; alias?: string }> } }> }

async function openWorkspace(page: Page) {
  await openEditor(page)
  await openFile(page, fixture("benzene-R1-R2.structura"))
  await page.getByRole("tab", { name: "通式" }).click()
  await expect(page.getByTestId("markush-workspace")).toBeVisible()
}

/** Draws methoxy in the open sketch pad: a bond, its first atom made O. */
async function drawMethoxy(page: Page) {
  const sketch = page.getByTestId("inline-sketch")
  const pad = (await sketch.getByTestId("sketch-pad").boundingBox())!
  const centre = { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 }
  await page.mouse.click(centre.x, centre.y)
  await sketch.getByRole("button", { name: "O", exact: true }).click()
  await page.mouse.click(centre.x, centre.y)
}

test("a variable's card offers the built-in templates for its site, and the library finds the rest", async ({ page }) => {
  await openWorkspace(page)
  const r1 = page.getByTestId("variable-R1")
  const picker = r1.getByTestId("template-picker")
  await expect(picker.getByTestId("template-chip").first()).toBeVisible()
  // R1 is at the end of a branch: no linker templates on its card.
  await expect(picker).not.toContainText("亚芳基")

  await picker.getByTestId("template-chip").filter({ hasText: "C1–C30 烷基" }).click()
  await expect.poll(async () => ((await doc(page)).variables!.R1 as Listed).alternatives.some((item) => item.class === "alkyl")).toBe(true)
  await expect(picker.getByTestId("template-chip").filter({ hasText: "C1–C30 烷基" })).toBeDisabled()

  await picker.getByRole("button", { name: "模板库…" }).click()
  const library = page.getByTestId("template-library")
  await expect(library).toContainText("添加到 R1")
  await library.getByLabel("搜索模板").fill("HETEROARYL")
  await expect(library.getByTestId("template-name").first()).toHaveText("C2–C30 杂芳基")
  await expect(library).not.toContainText("C1–C30 烷基")
  await library.getByLabel("搜索模板").fill("aryl")
  // Every site: the linker's arylene shows up too, but cannot go on R1.
  await library.getByLabel("显示全部位置").check()
  const arylene = library.getByTestId("template-row").filter({ hasText: "C6–C30 亚芳基" })
  await expect(arylene.getByRole("button", { name: "添加" })).toBeDisabled()
  await library.getByTestId("template-row").filter({ hasText: "C6–C30 芳基" }).getByRole("button", { name: "添加" }).click()
  await expect(library.getByTestId("template-note")).toContainText("已把“C6–C30 芳基”添加到 R1")
  await page.keyboard.press("Escape")
  await expect(library).toHaveCount(0)
  expect(((await doc(page)).variables!.R1 as Listed).alternatives.map((item) => item.class ?? item.kind)).toEqual(["label", "label", "alkyl", "aryl"])
})

test("a piece drawn in the sketch pad is saved as a template, with its site, and added to another variable", async ({ page }) => {
  await openWorkspace(page)
  await page.getByTestId("variable-R1").getByRole("button", { name: "✎ 画一个" }).click()
  const sketch = page.getByTestId("inline-sketch")
  await drawMethoxy(page)
  await sketch.getByRole("button", { name: "存为模板…" }).click()
  const form = sketch.getByTestId("save-template-form")
  await form.getByLabel("模板名称").fill("甲氧基")
  await form.getByLabel("模板的其他名称").fill("methoxy, OMe")
  await form.getByRole("button", { name: "存为模板" }).click()
  await expect(sketch.getByTestId("template-kept")).toContainText("已存为模板“甲氧基”（我的模板）")
  // Saving a template leaves the variable as it was.
  await sketch.getByRole("button", { name: "取消" }).click()
  expect(((await doc(page)).variables!.R1 as Listed).alternatives).toHaveLength(2)

  const r2 = page.getByTestId("variable-R2")
  await r2.getByTestId("template-chip").filter({ hasText: "甲氧基" }).click()
  await expect(r2.getByTestId("alternative")).toHaveCount(3)
  const piece = ((await doc(page)).variables!.R2 as Listed).alternatives.at(-1)!
  expect(piece.kind).toBe("fragment")
  expect(piece.name).toBe("甲氧基")
  expect(piece.molecule!.atoms.map((atom) => atom.alias ?? atom.el).sort()).toEqual(["*", "C", "O"])
  await expect(page.getByTestId("results-summary")).toContainText("共 6 种组合")

  // In the library, found by another name; renamed onto another shelf; then deleted, after asking.
  await r2.getByRole("button", { name: "模板库…" }).click()
  const library = page.getByTestId("template-library")
  await library.getByLabel("搜索模板").fill("ome")
  const row = library.getByTestId("template-row").filter({ hasText: "甲氧基" })
  await expect(row.getByTestId("template-source")).toHaveText("我的")
  await expect(row.getByRole("button", { name: "已添加" })).toBeDisabled()
  await row.getByRole("button", { name: "改名/分组" }).click()
  const edit = library.getByTestId("save-template-form")
  await edit.getByLabel("模板分组").fill("烷氧基")
  await edit.getByRole("button", { name: "保存修改" }).click()
  await expect(library.getByTestId("template-group")).toContainText("烷氧基")
  await row.getByRole("button", { name: "删除" }).click()
  await expect(row).toContainText("不能撤销")
  await row.getByRole("button", { name: "删除" }).click()
  await expect(library.getByTestId("template-row")).toHaveCount(0)
})

test("a class on a card is saved as a template; the user's templates go out to a file and come back", async ({ page }) => {
  await openWorkspace(page)
  const r1 = page.getByTestId("variable-R1")
  await r1.getByTestId("template-chip").filter({ hasText: "C6–C30 芳基" }).click()
  await r1.getByTestId("alternative").filter({ hasText: "芳基" }).getByRole("button", { name: "存为模板" }).click()
  const form = r1.getByTestId("save-template-form")
  await form.getByLabel("模板名称").fill("芳基（我的）")
  await form.getByRole("button", { name: "存为模板" }).click()
  await expect(form).toHaveCount(0)
  await expect(r1.getByTestId("template-picker")).toContainText("芳基（我的）")

  await r1.getByRole("button", { name: "模板库…" }).click()
  const library = page.getByTestId("template-library")
  const saving = page.waitForEvent("download")
  await library.getByRole("button", { name: "导出" }).click()
  const file = await saving
  expect(file.suggestedFilename()).toBe("structura-templates.json")
  const text = await readFile((await file.path())!, "utf8")
  expect(JSON.parse(text).templates.map((template: { name: string }) => template.name)).toEqual(["芳基（我的）"])

  // The same file again adds nothing; a copied built-in is added.
  await library.getByTestId("template-import").setInputFiles({ name: "structura-templates.json", mimeType: "application/json", buffer: Buffer.from(text) })
  await expect(library.getByTestId("template-note")).toContainText("导入了 0 个模板，跳过 1 个")
  await library.getByTestId("template-row").filter({ hasText: "C1–C30 烷基" }).getByRole("button", { name: "复制为我的模板" }).click()
  await library.getByTestId("save-template-form").getByRole("button", { name: "存为模板" }).click()
  await expect(library.getByTestId("template-source").filter({ hasText: "我的" })).toHaveCount(2)
})
