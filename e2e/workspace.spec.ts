import { expect, test } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { doc, openEditor, openFile } from "./support.ts"

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

test("the 通式 workspace shows the same document, and its results follow every change to the variables", async ({ page }) => {
  await openEditor(page)
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  await page.getByRole("tab", { name: "通式" }).click()
  const workspace = page.getByTestId("markush-workspace")
  await expect(workspace).toBeVisible()
  // The old sidebar is the drawing workspace's; here the variables have a board of their own.
  await expect(page.getByTestId("variables-panel")).toHaveCount(0)

  const results = workspace.getByTestId("results-summary")
  await expect(results).toContainText("得到 2 个不同的化合物")
  await expect(workspace.getByTestId("enumerated-compound")).toHaveCount(2)

  // Typing a candidate into the board regenerates the results on its own.
  await workspace.getByPlaceholder(/回车添加/).first().fill("Br")
  await workspace.getByPlaceholder(/回车添加/).first().press("Enter")
  await expect(results).toContainText("得到 3 个不同的化合物")
  await expect(workspace.getByTestId("enumerated-compound")).toHaveCount(3)

  // One document, one history: undo works from either workspace, and the drawing tab sees the change.
  await page.getByRole("tab", { name: "绘图" }).click()
  const list = (await doc(page)).variables?.R1 as { alternatives: Array<{ text?: string }> }
  expect(list.alternatives.map((item) => item.text)).toContain("Br")
  await page.keyboard.press("ControlOrMeta+z")
  await page.getByRole("tab", { name: "通式" }).click()
  await expect(page.getByTestId("results-summary")).toContainText("得到 2 个不同的化合物")
})

test("a generated compound placed from the results goes onto the drawing, back in the drawing workspace", async ({ page }) => {
  await openEditor(page)
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  await page.getByRole("tab", { name: "通式" }).click()
  const compounds = page.getByTestId("enumerated-compound")
  await expect(compounds).toHaveCount(2)
  const before = (await doc(page)).molecule.atoms.length
  await compounds.first().hover()
  await compounds.first().getByRole("button", { name: "放到画布" }).click()
  await expect(page.getByRole("tab", { name: "绘图" })).toHaveAttribute("aria-selected", "true")
  await expect.poll(async () => (await doc(page)).molecule.atoms.length).toBeGreaterThan(before)
})
