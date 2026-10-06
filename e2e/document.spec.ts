import { expect, test } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { canvasCentre, drawnText, menu, openEditor, openFile } from "./support.ts"

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

test.beforeEach(async ({ page }) => openEditor(page))

test("the title follows the file: its name when opened, a dot for unsaved changes, gone again once saved", async ({ page }) => {
  const title = page.getByTestId("document-title")
  await expect(title).toHaveText("未命名")
  await openFile(page, fixture("phenyl-R1.mol"))
  await expect(title).toHaveText("phenyl-R1")
  await page.getByRole("button", { name: "键 (B)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x + 250, centre.y + 150)
  await expect(title).toHaveText("phenyl-R1•")
  const download = page.waitForEvent("download")
  await menu(page, "文件", "保存")
  expect((await download).suggestedFilename()).toBe("phenyl-R1.structura")
  await expect(title).toHaveText("phenyl-R1")
})

test("unsaved work survives a reload: the copy kept in the browser is offered back", async ({ page }) => {
  await page.getByRole("button", { name: "环 (R)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  await expect(page.getByTestId("formula")).toHaveText("C₆H₆")
  const before = await drawnText(page)
  // The copy is written a moment after the last edit.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("structura:unsaved") != null)).toBe(true)
  await page.reload()
  await expect(page.getByTestId("restore-bar")).toBeVisible()
  await expect(page.getByTestId("formula")).not.toHaveText("C₆H₆")
  await page.getByRole("button", { name: "恢复" }).click()
  await expect(page.getByTestId("restore-bar")).toHaveCount(0)
  await expect.poll(() => drawnText(page)).toBe(before)
})

test("discarding the copy forgets it for good", async ({ page }) => {
  await page.getByRole("button", { name: "环 (R)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  await expect.poll(() => page.evaluate(() => localStorage.getItem("structura:unsaved") != null)).toBe(true)
  await page.reload()
  await page.getByRole("button", { name: "丢弃" }).click()
  await page.reload()
  await expect(page.getByTestId("restore-bar")).toHaveCount(0)
})

test("leaving with unsaved changes asks first", async ({ page }) => {
  await page.getByRole("button", { name: "环 (R)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  const asked = page.waitForEvent("dialog")
  await page.close({ runBeforeUnload: true })
  const dialog = await asked
  expect(dialog.type()).toBe("beforeunload")
  await dialog.dismiss()
})
