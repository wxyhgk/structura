import { readFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"
import { doc, menu, openEditor } from "./support.ts"

type Handle = { run(ops: unknown[]): { ok: boolean } }

/** Draws with ops, as an agent would. The view starts with the drawing's origin at the canvas's top left, so this is placed well inside. */
async function draw(page: Page, ops: unknown[]) {
  await page.evaluate((list) => (window as unknown as { __structura: Handle }).__structura.run(list), ops)
}

test.beforeEach(async ({ page }) => openEditor(page))

/** Right-clicks "[" near its top, clear of any bond through its middle. */
async function rightClickBracket(page: Page) {
  const box = (await page.getByTestId("bracket").locator("polyline").first().boundingBox())!
  await page.mouse.click(box.x + 1, box.y + Math.min(6, box.height / 4), { button: "right" })
}

/** What a download holds, as text. */
async function downloaded(page: Page, top: string, item: string): Promise<{ name: string; text: string }> {
  const download = page.waitForEvent("download")
  await menu(page, top, item)
  const file = await download
  return { name: file.suggestedFilename(), text: readFileSync((await file.path())!, "utf8") }
}

test("selected atoms get square brackets, made a repeat unit with its count, kept in the files, and undone", async ({ page }) => {
  await draw(page, [{ op: "draw_chain", points: [{ x: 400, y: 300 }, { x: 435, y: 280 }, { x: 470, y: 300 }, { x: 505, y: 280 }, { x: 540, y: 300 }] }])
  await expect(page.getByTestId("formula")).toHaveText("C₅H₁₂")
  await menu(page, "编辑", "全选")
  await menu(page, "结构", "加方括号")
  await expect(page.getByTestId("bracket")).toHaveCount(1)
  await expect(page.getByTestId("bracket")).toHaveAttribute("data-kind", "group")
  expect((await doc(page)).brackets).toEqual([{ id: 1, atoms: [1, 2, 3, 4, 5], kind: "group" }])

  // Its own menu: a repeat unit, then its count.
  await rightClickBracket(page)
  await page.getByRole("menuitemradio", { name: /重复单元/ }).click()
  await expect(page.getByTestId("bracket")).toHaveAttribute("data-kind", "repeat")
  await expect(page.getByTestId("bracket-count")).toHaveText("n")
  await rightClickBracket(page)
  await page.getByRole("menuitem", { name: "重复次数…" }).click()
  const dialog = page.getByTestId("bracket-count-dialog")
  await dialog.getByLabel("次数的名字").fill("m")
  await dialog.getByLabel("最多次数").fill("3")
  await dialog.getByTestId("bracket-count-save").click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId("bracket-count")).toHaveText("m")
  expect((await doc(page)).brackets).toEqual([{ id: 1, atoms: [1, 2, 3, 4, 5], kind: "repeat", repeat: { min: 1, max: 3, name: "m" } }])

  // Saved, exported as MOL and as SVG, the bracket goes along.
  const saved = await downloaded(page, "文件", "保存")
  expect(JSON.parse(saved.text).drawing.brackets).toEqual([{ id: 1, atoms: [1, 2, 3, 4, 5], kind: "repeat", repeat: { min: 1, max: 3, name: "m" } }])
  const mol = await downloaded(page, "文件", "导出 MOL")
  expect(mol.text).toContain("M  STY  2   1 SRU   2 DAT")
  expect(mol.text).toContain("M  SED   2 1-3")
  expect(mol.text).toContain("M  SMT   1 m")
  const svg = await downloaded(page, "文件", "导出 SVG")
  expect(svg.text).toMatch(/font-style="italic"[^>]*>m</)

  // Each step undoes on its own; the last takes the bracket away.
  for (let step = 0; step < 3; step++) await page.keyboard.press("ControlOrMeta+z")
  await expect(page.getByTestId("bracket")).toHaveCount(0)
  expect((await doc(page)).brackets).toBeUndefined()
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(page.getByTestId("bracket")).toHaveCount(1)
})

test("a bracket's menu deletes it, and deleting its atoms takes it with them", async ({ page }) => {
  await draw(page, [
    { op: "add_ring", at: { x: 400, y: 300 }, kind: "benzene" },
    { op: "add_bracket", atoms: [1, 2, 3, 4, 5, 6] },
    { op: "add_bracket", atoms: [1, 2] },
  ])
  await expect(page.getByTestId("bracket")).toHaveCount(2)
  await rightClickBracket(page)
  await page.getByRole("menuitem", { name: "删除括号" }).click()
  await expect(page.getByTestId("bracket")).toHaveCount(1)
  await menu(page, "编辑", "全选")
  await page.keyboard.press("Delete")
  await expect(page.getByTestId("bracket")).toHaveCount(0)
})
