import { expect, test, type Page } from "@playwright/test"
import { doc, drawnText, openEditor, type Doc } from "./support.ts"

// A variable attachment drawn as the user's own curve: 自定义 turns the drawing into nodes,
// which the select tools drag, add to and take from; the 可变连接 tool set to 自定义 takes the
// path dragged as the curve.

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

/** Carbazole round (420, 320) and R1 (atom 14) above and to the left of it. */
const CARBAZOLE = [
  { op: "add_scaffold", name: "carbazole", at: { x: 420, y: 320 } },
  { op: "place_atom", el: "C", at: { x: 260, y: 170 } },
  { op: "label", atom: 14, text: "R1" },
]

/** The carbons of carbazole's benzene rings that carry hydrogens: where R1 may go. */
const positions = (drawing: Doc) =>
  drawing.molecule.atoms.filter((atom) => atom.el === "C" && atom.id < 14 && drawing.molecule.bonds.filter((bond) => bond.a === atom.id || bond.b === atom.id).length === 2).map((atom) => atom.id)

/** The middle of the first piece of the attachment's loop, read off the drawn path ("M start L end M p C c1 c2 q …"). */
async function onLoop(page: Page) {
  const d = (await page.getByTestId("attachments").locator("path").first().getAttribute("d"))!
  const [, rest] = d.split(/ M /)
  const [p, c] = rest.split(" C ")
  const [px, py] = p.split(" ").map(Number)
  const [ax, ay, bx, by, qx, qy] = c.split(" ").map(Number)
  return { start: { x: px, y: py }, middle: { x: (px + 3 * ax + 3 * bx + qx) / 8, y: (py + 3 * ay + 3 * by + qy) / 8 } }
}

test("自定义 turns the drawing into nodes; picked with the lasso, a node is dragged, one put in and one taken out, each undoable", async ({ page }) => {
  await openEditor(page)
  await draw(page, CARBAZOLE)
  await draw(page, [{ op: "set_attachment", atom: 14, to: positions(await doc(page)) }])
  const drawn = page.getByTestId("attachments").locator("[data-shape]")
  await expect(drawn).toHaveAttribute("data-shape", "loop")

  // Right-click R1, 可变连接画法 → 自定义: the ellipse becomes eight nodes, still a loop.
  const label = page.getByTestId("canvas").locator("text", { hasText: /^R$/ }).first()
  const box = (await label.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" })
  await page.getByRole("menuitem", { name: "可变连接画法" }).hover()
  await page.getByRole("menuitemradio", { name: "自定义" }).click()
  await expect.poll(async () => (await doc(page)).attachments?.[0]?.shape).toBe("custom")
  await expect(drawn).toHaveAttribute("data-shape", "custom")
  const converted = (await doc(page)).attachments![0].curve!
  expect(converted.closed).toBe(true)
  expect(converted.nodes).toHaveLength(8)

  // A click on the curve with the lasso shows its nodes.
  await page.getByTestId("tool-lasso").click()
  const loop = await onLoop(page)
  const on = await onPage(page, loop.start)
  await page.mouse.click(on.x, on.y)
  await expect(page.getByTestId("curve-node")).toHaveCount(8)

  // Dragging a node moves it, as one step; undo puts it back.
  const before = await drawnText(page)
  const handle = (await page.getByTestId("curve-node").nth(2).boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + 40, handle.y - 30, { steps: 6 })
  await page.mouse.up()
  await expect.poll(async () => (await doc(page)).attachments![0].curve!.nodes[2]).not.toEqual(converted.nodes[2])
  expect((await doc(page)).attachments![0].curve!.nodes[0]).toEqual(converted.nodes[0])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => drawnText(page)).toBe(before)

  // A click on the picked curve between two nodes puts one in; Delete takes it out again; Escape lets the curve go.
  const between = await onPage(page, (await onLoop(page)).middle)
  await page.mouse.click(between.x, between.y)
  await expect(page.getByTestId("curve-node")).toHaveCount(9)
  expect((await doc(page)).attachments![0].curve!.nodes).toHaveLength(9)
  await page.keyboard.press("Delete")
  await expect(page.getByTestId("curve-node")).toHaveCount(8)
  expect((await doc(page)).molecule.atoms).toHaveLength(14)
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("curve-handles")).toHaveCount(0)
})

test("the 可变连接 tool set to 自定义 takes the path dragged round the rings as the curve, closed when it comes back round", async ({ page }) => {
  await openEditor(page)
  await draw(page, CARBAZOLE)
  await page.getByTestId("tool-attach-caret").click()
  await page.getByTestId("tool-attach-option-custom").click()

  // From R1 to the top of the rings, then round them all and back to where the loop began.
  const centre = { x: 420, y: 320 }
  const round = Array.from({ length: 37 }, (_, i) => {
    const t = -Math.PI / 2 - (i / 36) * 2 * Math.PI
    return { x: centre.x + 155 * Math.cos(t), y: centre.y + 95 * Math.sin(t) }
  })
  const start = await onPage(page, { x: 260, y: 170 })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (const point of round) {
    const at = await onPage(page, point)
    await page.mouse.move(at.x, at.y, { steps: 3 })
  }
  await expect(page.getByTestId("sweep-trail")).toBeVisible()
  await page.mouse.up()
  const made = (await doc(page)).attachments![0]
  expect(made.shape).toBe("custom")
  expect(made.curve!.closed).toBe(true)
  expect(made.to.sort((a, b) => a - b)).toEqual(positions(await doc(page)).sort((a, b) => a - b))
  await expect(page.getByTestId("attachments").locator("[data-shape]")).toHaveAttribute("data-shape", "custom")
  await page.keyboard.press("ControlOrMeta+z")
  expect((await doc(page)).attachments).toBeUndefined()
})
