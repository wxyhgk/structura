import { expect, test } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { canvasCentre, copies, drawnText, menu, openEditor, openFile, openMarkush } from "./support.ts"

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
  await expect.poll(() => copies(page, "structura:unsaved")).toBe(1)
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
  await expect.poll(() => copies(page, "structura:unsaved")).toBe(1)
  await page.reload()
  await page.getByRole("button", { name: "丢弃" }).click()
  await page.reload()
  await expect(page.getByTestId("restore-bar")).toHaveCount(0)
})

test("two tabs keep their own copies: neither writes over the other's", async ({ page }) => {
  await page.getByRole("button", { name: "环 (R)" }).click()
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  await expect.poll(() => copies(page, "structura:unsaved")).toBe(1)
  const other = await page.context().newPage()
  await openEditor(other)
  // The first tab's copy is offered here; this tab draws something else without touching it.
  await expect(other.getByTestId("restore-bar")).toBeVisible()
  await other.getByRole("button", { name: "键 (B)" }).click()
  const box = (await other.getByTestId("canvas").boundingBox())!
  await other.mouse.click(box.x + box.width / 2 + 100, box.y + box.height / 2 + 60)
  await expect.poll(() => copies(page, "structura:unsaved")).toBe(2)
  // A reload of the first tab is offered a copy of another page, not its own earlier one.
  await page.reload()
  await expect(page.getByTestId("restore-bar")).toBeVisible()
  // Discarding it takes only that copy.
  await page.getByRole("button", { name: "丢弃" }).click()
  await expect.poll(() => copies(page, "structura:unsaved")).toBe(1)
})

test("a document handed over from the drawing page still offers last time's unsaved copy", async ({ page }) => {
  const markush = await page.context().newPage()
  await openMarkush(markush)
  await markush.getByRole("button", { name: "环 (R)" }).click()
  const box = (await markush.getByTestId("canvas").boundingBox())!
  await markush.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect.poll(() => copies(markush, "structura:markush:unsaved")).toBe(1)
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  const opened = page.waitForEvent("popup")
  await menu(page, "结构", "通式与批量生成…")
  const handed = await opened
  await expect(handed.getByTestId("markush-workspace")).toBeVisible()
  await expect(handed.getByTestId("restore-bar")).toBeVisible()
  // The hand-over itself was taken, not left in storage.
  await expect.poll(() => handed.evaluate(() => Object.keys(localStorage).filter((name) => name.startsWith("structura:handoff:")).length)).toBe(0)
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
