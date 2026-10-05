import { expect, test } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { canvasCentre, doc, drawnText, openEditor, openFile } from "./support.ts"

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

test.beforeEach(async ({ page }) => openEditor(page))

test("drawing: a click draws a bond, a drag from its end draws the next", async ({ page }) => {
  await page.getByRole("button", { name: "键 (B)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  await expect(page.getByTestId("formula")).toHaveText("C₂H₆")
  const end = (await doc(page)).molecule.atoms[1]
  const start = (await doc(page)).molecule.atoms[0]
  // Screen and drawing differ only by a shift at 100%: the end lies where the first atom's offset says.
  const at = { x: centre.x + (end.x - start.x), y: centre.y + (end.y - start.y) }
  await page.mouse.move(at.x, at.y)
  await page.mouse.down()
  await page.mouse.move(at.x + 30, at.y + 40, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByTestId("formula")).toHaveText("C₃H₈")
})

test("Markush: dragging out of a ring's middle makes R1 attached anywhere on the ring, in one undoable step", async ({ page }) => {
  await page.getByRole("button", { name: "环 (R)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  await expect(page.getByTestId("formula")).toHaveText("C₆H₆")
  await page.getByRole("button", { name: "键 (B)" }).click()
  await page.mouse.move(centre.x, centre.y)
  await page.mouse.down()
  await page.mouse.move(centre.x + 60, centre.y - 40, { steps: 4 })
  await expect(page.getByTestId("attachment-preview")).toBeVisible()
  await page.mouse.move(centre.x + 120, centre.y - 70, { steps: 4 })
  await page.mouse.up()
  await expect.poll(async () => (await doc(page)).attachments?.[0]?.to.length).toBe(6)
  const drawing = await doc(page)
  expect(drawing.molecule.atoms.find((atom) => atom.id === drawing.attachments![0].atom)?.alias).toBe("R1")
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await doc(page)).attachments).toBeUndefined()
})

test("Markush: (R1)m with m = 0–2 enumerates 1 + 12 + 60 = 73 compounds", async ({ page }) => {
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  await page.getByLabel("R1 重复出现").check()
  await page.getByLabel("最多次数").fill("2")
  await expect.poll(async () => (await doc(page)).attachments?.[0]?.repeat).toEqual({ min: 0, max: 2, name: "m" })
  await expect(page.getByTestId("repeat-marks")).toBeVisible()
  await page.getByRole("button", { name: "批量生成化合物…" }).click()
  await expect(page.getByRole("dialog")).toContainText("共 73 种组合")
})

test("import: a MOL file's R# atom arrives as the variable R1, with no notice", async ({ page }) => {
  await openFile(page, fixture("phenyl-R1.mol"))
  await expect(page.getByTestId("variables-panel")).toContainText("R1")
  await expect(page.getByTestId("import-notes")).toHaveCount(0)
  const atoms = (await doc(page)).molecule.atoms
  expect(atoms.filter((atom) => atom.alias === "R1")).toHaveLength(1)
})

test("undo and redo: every step back, then forward again, to exactly the same drawing", async ({ page }) => {
  const before = await drawnText(page)
  await page.getByRole("button", { name: "环 (R)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  await page.getByRole("button", { name: "键 (B)" }).click()
  await page.mouse.click(centre.x + 250, centre.y)
  await openFile(page, fixture("phenyl-R1.mol"))
  await expect(page.getByTestId("variables-panel")).toBeVisible()
  const after = await drawnText(page)
  for (let step = 0; step < 3; step++) await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => drawnText(page)).toBe(before)
  for (let step = 0; step < 3; step++) await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(() => drawnText(page)).toBe(after)
})
