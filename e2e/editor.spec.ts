import { expect, test } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { canvasCentre, doc, drawnText, openEditor, openFile, toMarkush } from "./support.ts"

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
  await toMarkush(page)
  await page.getByRole("tablist", { name: "通式约束" }).getByRole("tab", { name: "位置" }).click()
  await page.getByLabel("R1 重复出现").check()
  await page.getByLabel("最多次数").fill("2")
  await expect.poll(async () => (await doc(page)).attachments?.[0]?.repeat).toEqual({ min: 0, max: 2, name: "m" })
  await expect(page.getByTestId("repeat-marks")).toBeVisible()
  // Counted before anything is generated, in the constraints' overview.
  await page.getByRole("tablist", { name: "通式约束" }).getByRole("tab", { name: "概览" }).click()
  await expect(page.getByTestId("library-size")).toContainText("可展开为 73 种组合")
  // Repeats are dropped by RDKit's canonical SMILES (loaded in the page): 12 different compounds.
  await expect(page.getByTestId("results-summary")).toContainText("共 73 种组合，得到 12 个不同的化合物（合并了 61 个重复的）")
})

test("import: a MOL file's R# atom arrives as the variable R1, with no notice", async ({ page }) => {
  await openFile(page, fixture("phenyl-R1.mol"))
  await expect(page.getByTestId("import-notes")).toHaveCount(0)
  await toMarkush(page)
  await expect(page.getByTestId("variable-R1")).toBeVisible()
  const atoms = (await doc(page)).molecule.atoms
  expect(atoms.filter((atom) => atom.alias === "R1")).toHaveLength(1)
})

test("import: a V3000 MOL file opens like a V2000 one, its R# as R1 and its wedge kept, with no notice", async ({ page }) => {
  await openFile(page, fixture("phenyl-R1-v3000.mol"))
  await expect.poll(async () => (await doc(page)).molecule.atoms.length).toBe(10)
  await expect(page.getByTestId("import-notes")).toHaveCount(0)
  const { atoms, bonds } = (await doc(page)).molecule
  expect(atoms.filter((atom) => atom.alias === "R1")).toHaveLength(1)
  const element = (id: number) => atoms.find((atom) => atom.id === id)?.el
  const wedges = (bonds as Array<{ a: number; b: number; stereo?: string }>).filter((bond) => bond.stereo === "up")
  expect(wedges.map((bond) => [element(bond.a), element(bond.b)])).toEqual([["C", "O"]])
  await toMarkush(page)
  await expect(page.getByTestId("variable-R1")).toBeVisible()
})

test("undo and redo: every step back, then forward again, to exactly the same drawing", async ({ page }) => {
  const before = await drawnText(page)
  await page.getByRole("button", { name: "环 (R)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  await page.getByRole("button", { name: "键 (B)" }).click()
  await page.mouse.click(centre.x + 250, centre.y)
  await openFile(page, fixture("phenyl-R1.mol"))
  await expect.poll(async () => (await doc(page)).molecule.atoms.some((atom) => atom.alias === "R1")).toBe(true)
  const after = await drawnText(page)
  for (let step = 0; step < 3; step++) await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => drawnText(page)).toBe(before)
  for (let step = 0; step < 3; step++) await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(() => drawnText(page)).toBe(after)
})

test("the editor's chrome keeps its own look: buttons flat, not the browser's", async ({ page }) => {
  await openEditor(page)
  const look = await page.getByRole("button", { name: "文件", exact: true }).evaluate((button) => {
    const style = getComputedStyle(button)
    return { border: style.borderTopWidth, background: style.backgroundColor }
  })
  expect(look).toEqual({ border: "0px", background: "rgba(0, 0, 0, 0)" })
})

test("arrow keys move the hotspot along bonds without the mouse; Shift runs to the chain's end", async ({ page }) => {
  await page.getByRole("button", { name: "键 (B)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  const [start, end] = (await doc(page)).molecule.atoms
  // Rest on the bond's end and grow a chain from it: 1, 1, 1 leaves the hotspot on the tip.
  await page.mouse.move(centre.x + (end.x - start.x), centre.y + (end.y - start.y))
  for (let step = 0; step < 3; step++) await page.keyboard.press("1")
  await expect(page.getByTestId("formula")).toHaveText("C₅H₁₂")
  expect((await doc(page)).molecule.atoms.at(-1)!.x).toBeGreaterThan(start.x)
  const elements = async () => (await doc(page)).molecule.atoms.map((atom) => atom.el).join("")
  // ← steps back one atom from the tip; O lands there, not on the tip or under the pointer.
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("o")
  await expect.poll(elements).toBe("CCCOC")
  // ⇧← runs from there along the chain to its far end, the first atom drawn.
  await page.keyboard.press("Shift+ArrowLeft")
  await page.keyboard.press("n")
  await expect.poll(elements).toBe("NCCOC")
  // No atom that way: the hotspot stays, and the next key still lands on it.
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("s")
  await expect.poll(elements).toBe("SCCOC")
})
