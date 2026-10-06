import { expect, test, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { menu, openEditor, openFile } from "./support.ts"

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

/** Where R1's "1" sits against its "R" on the canvas: negative is raised (R¹), positive lowered (R₁). */
async function numberOffset(page: Page): Promise<number> {
  const label = page.getByTestId("canvas").locator("text", { hasText: /^R$/ }).first()
  const number = page.getByTestId("canvas").locator("text", { hasText: /^1$/ }).first()
  const [r, one] = await Promise.all([label.getAttribute("y"), number.getAttribute("y")])
  return Number(one) - Number(r)
}

test("variables' numbers can be raised (R¹) or lowered (R₁), on the canvas, in exports, and remembered", async ({ page }) => {
  await openEditor(page)
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  await expect.poll(() => numberOffset(page)).toBeGreaterThan(0)
  await menu(page, "查看", "变量编号写成上标（R¹）")
  await expect.poll(() => numberOffset(page)).toBeLessThan(0)

  const download = page.waitForEvent("download")
  await menu(page, "文件", "导出 SVG")
  const svg = await readFile((await (await download).path())!, "utf8")
  const y = (text: string) => Number(new RegExp(`y="([^"]+)"[^>]*>${text}<`).exec(svg)?.[1])
  expect(y("1")).toBeLessThan(y("R"))

  await page.reload()
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  await expect.poll(() => numberOffset(page)).toBeLessThan(0)
})
