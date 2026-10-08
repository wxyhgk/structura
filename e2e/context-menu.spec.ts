import { expect, test, type Page } from "@playwright/test"
import { canvasCentre, doc, openEditor } from "./support.ts"

/** A benzene placed at the middle of the canvas, and where its first atom is on the screen. */
async function benzene(page: Page) {
  await page.getByRole("button", { name: "环 (R)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  await expect(page.getByTestId("formula")).toHaveText("C₆H₆")
  const atoms = (await doc(page)).molecule.atoms
  const mid = { x: atoms.reduce((sum, atom) => sum + atom.x, 0) / atoms.length, y: atoms.reduce((sum, atom) => sum + atom.y, 0) / atoms.length }
  const first = atoms[0]
  return { centre, atom: { x: centre.x + first.x - mid.x, y: centre.y + first.y - mid.y } }
}

test.beforeEach(async ({ page }) => openEditor(page))

test("right-clicking empty canvas offers paste and select all", async ({ page }) => {
  const { centre } = await benzene(page)
  await page.mouse.click(centre.x + 300, centre.y + 200, { button: "right" })
  const menu = page.getByTestId("canvas-menu")
  await expect(menu).toContainText("粘贴")
  await expect(menu).toContainText("全选")
})

test("an atom's menu changes its element, and copies the molecule as SMILES", async ({ page }) => {
  const { atom } = await benzene(page)
  await page.mouse.click(atom.x, atom.y, { button: "right" })
  await page.getByRole("menuitem", { name: "元素" }).hover()
  await page.getByRole("menuitem", { name: "N", exact: true }).click()
  await expect(page.getByTestId("formula")).toHaveText("C₅H₅N")
  await page.mouse.click(atom.x, atom.y, { button: "right" })
  await page.getByRole("menuitem", { name: "复制为" }).hover()
  await page.getByRole("menuitem", { name: "SMILES", exact: true }).click()
  await expect(page.getByTestId("flash")).toHaveText("已复制 SMILES：c1ccncc1")
})

test("on a selection the menu edits it, and the analysis gives formula, exact mass and ions", async ({ page }) => {
  const { atom } = await benzene(page)
  await page.keyboard.press("ControlOrMeta+a")
  await page.mouse.click(atom.x, atom.y, { button: "right" })
  const menu = page.getByTestId("canvas-menu")
  await expect(menu).toContainText("剪切")
  await expect(menu).toContainText("旋转和翻转")
  await page.getByRole("menuitem", { name: "分析…" }).click()
  const analysis = page.getByTestId("analysis")
  await expect(analysis).toContainText("C₆H₆")
  await expect(analysis).toContainText("78.0470")
  await expect(analysis).toContainText("79.0542")
  await expect(analysis).toContainText("Anal. calcd for C6H6: C, 92.26; H, 7.74.")
})
