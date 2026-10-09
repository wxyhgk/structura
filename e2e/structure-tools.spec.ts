import { expect, test, type Page } from "@playwright/test"
import { doc, menu, openEditor, type Doc } from "./support.ts"

// The 方括号 and 可变连接 tools in the left palette, as a person finds them: a box dragged
// round atoms brackets them, and a drag from an atom across rings makes a variable attachment.

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

/** A drag through the points, in drawing coordinates, in small steps as a hand makes it. */
async function dragThrough(page: Page, points: Array<{ x: number; y: number }>) {
  const [first, ...rest] = await Promise.all(points.map((point) => onPage(page, point)))
  await page.mouse.move(first.x, first.y)
  await page.mouse.down()
  for (const point of rest) await page.mouse.move(point.x, point.y, { steps: 8 })
}

/** The middles of naphthalene's two rings: the six atoms on each side along its long axis. */
function ringCentres(drawing: Doc, ids: number[]) {
  const atoms = drawing.molecule.atoms.filter((atom) => ids.includes(atom.id))
  const span = (key: "x" | "y") => Math.max(...atoms.map((atom) => atom[key])) - Math.min(...atoms.map((atom) => atom[key]))
  const axis = span("x") >= span("y") ? "x" : "y"
  const sorted = [...atoms].sort((a, b) => a[axis] - b[axis])
  const mean = (list: typeof atoms) => ({ x: list.reduce((sum, atom) => sum + atom.x, 0) / 6, y: list.reduce((sum, atom) => sum + atom.y, 0) / 6 })
  return [mean(sorted.slice(0, 6)), mean(sorted.slice(4))]
}

test.beforeEach(async ({ page }) => openEditor(page))

test("方括号 tool: a box round atoms brackets them; its menu picks a repeat unit; with atoms selected the button brackets them at once", async ({ page }) => {
  await draw(page, [{ op: "draw_chain", points: [{ x: 400, y: 300 }, { x: 435, y: 280 }, { x: 470, y: 300 }, { x: 505, y: 280 }, { x: 540, y: 300 }] }])
  await page.getByTestId("tool-bracket").click()
  await expect(page.getByTestId("tool-bracket")).toHaveAttribute("data-active", "true")
  await expect(page.getByTestId("tool-label")).toHaveText("方括号（基团 [ ]）")

  await dragThrough(page, [{ x: 425, y: 250 }, { x: 485, y: 330 }])
  await expect(page.getByTestId("bracket-preview")).toBeVisible()
  await page.mouse.up()
  await expect(page.getByTestId("bracket")).toHaveCount(1)
  expect((await doc(page)).brackets).toEqual([{ id: 1, atoms: [2, 3], kind: "group" }])

  // The menu's 重复单元 [ ]n: the next box makes a repeat unit with its n.
  await page.getByTestId("tool-bracket-caret").click()
  await page.getByTestId("tool-bracket-option-repeat").click()
  await dragThrough(page, [{ x: 495, y: 250 }, { x: 555, y: 330 }])
  await page.mouse.up()
  await expect(page.getByTestId("bracket")).toHaveCount(2)
  expect((await doc(page)).brackets?.[1]).toEqual({ id: 2, atoms: [4, 5], kind: "repeat", repeat: { min: 1, max: 4, name: "n" } })
  await expect(page.getByTestId("bracket-count")).toHaveText("n")

  // Selected first, then the button: bracketed straight away, one undoable step.
  await page.keyboard.press("ControlOrMeta+z")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.getByTestId("bracket")).toHaveCount(0)
  await menu(page, "编辑", "全选")
  await page.getByTestId("tool-bracket").click()
  expect((await doc(page)).brackets).toEqual([{ id: 3, atoms: [1, 2, 3, 4, 5], kind: "repeat", repeat: { min: 1, max: 4, name: "n" } }])
  await page.keyboard.press("ControlOrMeta+z")
  expect((await doc(page)).brackets).toBeUndefined()
})

test("可变连接 tool: a drag from an atom across both rings hangs it on all their positions; from empty canvas it makes an R group; its menu changes the drawing", async ({ page }) => {
  await draw(page, [
    { op: "add_scaffold", name: "naphthalene", at: { x: 400, y: 300 } },
    { op: "place_atom", el: "C", at: { x: 400, y: 450 } },
  ])
  const start = await doc(page)
  const lone = start.molecule.atoms.at(-1)!
  const [left, right] = ringCentres(start, start.molecule.atoms.slice(0, 10).map((atom) => atom.id))

  await page.getByTestId("tool-attach").click()
  await expect(page.getByTestId("tool-attach")).toHaveAttribute("data-active", "true")
  await dragThrough(page, [lone, left, right])
  await expect(page.getByTestId("sweep-preview")).toBeVisible()
  await expect(page.getByTestId("swept-ring")).toHaveCount(2)
  await expect(page.getByTestId("ring-hint")).toContainText("8 处")
  await page.mouse.up()
  const made = await doc(page)
  expect(made.attachments).toHaveLength(1)
  expect(made.attachments![0].atom).toBe(lone.id)
  expect(made.attachments![0].to).toHaveLength(8)
  expect(made.molecule.bonds).toHaveLength(11)
  await expect(page.getByTestId("sweep-preview")).toHaveCount(0)

  // Its menu: 直线 redraws the selected atom's attachment, as one step.
  await page.getByTestId("tool-lasso").click()
  await page.mouse.click((await onPage(page, lone)).x, (await onPage(page, lone)).y)
  await page.getByTestId("tool-attach-caret").click()
  await page.getByTestId("tool-attach-option-line").click()
  expect((await doc(page)).attachments![0].shape).toBe("line")
  await page.keyboard.press("ControlOrMeta+z")
  expect((await doc(page)).attachments![0].shape).toBeUndefined()
  await page.keyboard.press("ControlOrMeta+z")
  expect((await doc(page)).attachments).toBeUndefined()

  // From empty canvas: an R group where the drag began, hung on the ring passed over.
  await page.keyboard.press("Escape")
  await page.getByTestId("tool-attach").click()
  await dragThrough(page, [{ x: left.x - 160, y: left.y }, left])
  await page.mouse.up()
  const fresh = await doc(page)
  const r = fresh.molecule.atoms.at(-1)!
  expect(r.alias).toBe("R1")
  expect(fresh.attachments).toEqual([{ atom: r.id, to: expect.any(Array), shape: "line" }])
  expect(fresh.attachments![0].to).toHaveLength(4)
})
