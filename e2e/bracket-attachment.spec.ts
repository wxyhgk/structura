import { expect, test, type Page } from "@playwright/test"
import { doc, menu, openEditor } from "./support.ts"

// Brackets and variable attachments as one Markush feature: a bond dragged into a group
// bracket means "joined at any position of the bracketed group", and a repeat unit [ … ]n
// is written out for each n when generating.

type Handle = { run(ops: unknown[]): { ok: boolean } }

/** Draws with ops, as an agent would. The view starts with the drawing's origin at the canvas's top left, at 100%. */
async function draw(page: Page, ops: unknown[]) {
  await page.evaluate((list) => (window as unknown as { __structura: Handle }).__structura.run(list), ops)
}

/** Where a point of the drawing is on the page. */
async function onPage(page: Page, point: { x: number; y: number }) {
  const box = (await page.getByTestId("canvas").boundingBox())!
  return { x: box.x + point.x, y: box.y + point.y }
}

/** Picks a tab of the constraints pane under the canvas. */
const constraintTab = (page: Page, name: string) => page.getByRole("tablist", { name: "通式约束" }).getByRole("tab", { name })

test.beforeEach(async ({ page }) => openEditor(page))

test("a bond dragged from an outside atom into a group bracket attaches anywhere in it, and generates every position", async ({ page }) => {
  await draw(page, [{ op: "add_scaffold", name: "naphthalene", at: { x: 400, y: 300 } }])
  await menu(page, "编辑", "全选")
  await menu(page, "结构", "加方括号")
  await expect(page.getByTestId("bracket")).toHaveAttribute("data-kind", "group")
  await draw(page, [{ op: "place_atom", el: "C", at: { x: 600, y: 300 } }])
  const drawing = await doc(page)
  const outside = drawing.molecule.atoms.find((atom) => atom.x === 600)!
  const right = Math.max(...drawing.molecule.atoms.filter((atom) => atom.id !== outside.id).map((atom) => atom.x))

  // Just inside "]" (its upright is the right edge of its box), level with the middle: on no atom and in no ring's middle.
  const close = (await page.getByTestId("bracket").locator("polyline").nth(1).boundingBox())!
  const from = await onPage(page, outside)
  const into = { x: close.x + close.width - 5, y: from.y }
  expect(into.x - (await onPage(page, { x: right, y: 0 })).x).toBeGreaterThan(5)
  await page.getByRole("button", { name: "键 (B)" }).click()
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(into.x + 20, into.y, { steps: 4 })
  await page.mouse.move(into.x, into.y, { steps: 2 })
  await expect(page.getByTestId("attachment-preview")).toBeVisible()
  await page.mouse.up()

  const ring = drawing.molecule.atoms.filter((atom) => atom.id !== outside.id).map((atom) => atom.id)
  await expect.poll(async () => (await doc(page)).attachments).toEqual([{ atom: outside.id, to: ring }])
  expect((await doc(page)).molecule.bonds).toHaveLength(11)
  await expect(page.getByTestId("attachments").locator("[data-shape]")).toHaveAttribute("data-shape", "bracket")

  // In the 通式 workspace: listed under the bracket, counted at every atom, the two fusion carbons skipped.
  await page.getByRole("tab", { name: "通式" }).click()
  await constraintTab(page, "位置").click()
  await expect(page.getByTestId("group-bracket-row")).toContainText("连在括号里任一位置")
  await expect(page.getByTestId("attachment-row").getByRole("radio", { name: "括号" })).toBeVisible()
  await constraintTab(page, "概览").click()
  await expect(page.getByTestId("library-size")).toContainText("可展开为 8 种组合")
  // 1- and 2-methylnaphthalene, each made four times over.
  await expect(page.getByTestId("results-summary")).toContainText("得到 2 个不同的化合物")

  // One step: undo takes the attachment away.
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await doc(page)).attachments).toBeUndefined()
})

test("a repeat unit's count is changed in the 位置 tab, and generating writes the unit out for each n", async ({ page }) => {
  await draw(page, [
    { op: "draw_chain", points: [{ x: 400, y: 300 }, { x: 435, y: 280 }, { x: 470, y: 300 }] },
    { op: "label", atom: 1, text: "Cl" },
    { op: "add_bracket", atoms: [2], kind: "repeat", repeat: { min: 1, max: 2, name: "n" } },
  ])
  await page.getByRole("tab", { name: "通式" }).click()
  await constraintTab(page, "概览").click()
  await expect(page.getByTestId("repeat-counts")).toContainText("n = 1–2")
  await expect(page.getByTestId("library-size")).toContainText("可展开为 2 种组合")

  await constraintTab(page, "位置").click()
  const row = page.getByTestId("repeat-bracket-row")
  await row.getByLabel("重复单元最多次数").fill("4")
  await expect.poll(async () => (await doc(page)).brackets?.[0].repeat).toEqual({ min: 1, max: 4, name: "n" })
  await expect(page.getByTestId("results-summary")).toContainText("得到 4 个")
  await expect(page.getByTestId("enumerated-compound").nth(3)).toContainText("n = 4")
  // Out of the field, so the key undoes the edit rather than the typing.
  await row.getByLabel("重复单元最多次数").evaluate((field) => (field as HTMLElement).blur())
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await doc(page)).brackets?.[0].repeat?.max).toBe(2)
})
