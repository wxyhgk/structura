import { expect, test } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { doc, openFile, openMarkush } from "./support.ts"

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

test("on the 通式 page the results follow every change to the variables, and undo takes it back", async ({ page }) => {
  await openMarkush(page)
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  const workspace = page.getByTestId("markush-workspace")
  await expect(workspace).toBeVisible()

  const results = workspace.getByTestId("results-summary")
  await expect(results).toContainText("得到 2 个不同的化合物")
  await expect(workspace.getByTestId("enumerated-compound")).toHaveCount(2)

  // Typing a candidate into the board regenerates the results on its own.
  await workspace.getByPlaceholder(/回车添加/).first().fill("Br")
  await workspace.getByPlaceholder(/回车添加/).first().press("Enter")
  await expect(results).toContainText("得到 3 个不同的化合物")
  await expect(workspace.getByTestId("enumerated-compound")).toHaveCount(3)
  const list = (await doc(page)).variables?.R1 as { alternatives: Array<{ text?: string }> }
  expect(list.alternatives.map((item) => item.text)).toContain("Br")

  // The board's edits are the document's: one history with the canvas.
  await page.getByRole("button", { name: "撤销" }).click()
  await expect(results).toContainText("得到 2 个不同的化合物")
})

test("a generated compound opens by itself on the drawing page, in a new tab", async ({ page }) => {
  await openMarkush(page)
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  const compounds = page.getByTestId("enumerated-compound")
  await expect(compounds).toHaveCount(2)
  await compounds.first().hover()
  const opened = page.waitForEvent("popup")
  await compounds.first().getByRole("button", { name: "在绘图页打开" }).click()
  const drawing = await opened
  await expect.poll(() => drawing.evaluate(() => "__structura" in window)).toBe(true)
  expect(new URL(drawing.url()).pathname).toBe("/")
  // The compound alone: no variable left in it, nothing else from the formula's page.
  const atoms = (await doc(drawing)).molecule.atoms
  expect(atoms.length).toBeGreaterThan(6)
  expect(atoms.filter((atom) => atom.alias === "R1")).toHaveLength(0)
  expect((await doc(drawing)).variables).toBeUndefined()
})
