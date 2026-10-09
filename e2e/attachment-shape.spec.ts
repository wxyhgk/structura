import { expect, test } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { doc, openEditor, openFile } from "./support.ts"

// A variable attachment over a whole fused system is drawn as patents draw it: an ellipse
// round the rings, or the bond sweeping round them; the 画法 can be chosen.

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

test("widened to the whole fused system the attachment becomes a curve, and its 画法 is chosen in one undoable step", async ({ page }) => {
  await openEditor(page)
  await openFile(page, fixture("carbazole-R1-one-ring.structura"))
  await page.getByRole("tab", { name: "通式" }).click()
  const drawn = page.getByTestId("attachments").locator("[data-shape]")
  await expect(drawn).toHaveAttribute("data-shape", "line")

  // R1 stands alone, so over the three rings it is an ellipse with a line to it.
  const tabs = page.getByRole("tablist", { name: "通式约束" })
  await tabs.getByRole("tab", { name: "概览" }).click()
  await page.getByRole("button", { name: /扩大到整个稠环体系（9 个位置）/ }).click()
  await expect.poll(async () => (await doc(page)).attachments?.[0]?.to.length).toBe(9)
  await expect(drawn).toHaveAttribute("data-shape", "loop")
  await expect(drawn.locator("path")).toHaveAttribute("d", / Z$/)

  // Chosen in the 位置 tab: an arc, saved with the document.
  await tabs.getByRole("tab", { name: "位置" }).click()
  const picker = page.getByTestId("attachment-row").getByRole("radiogroup", { name: "画法" })
  await expect(picker.getByRole("radio", { name: "自动" })).toHaveAttribute("aria-checked", "true")
  await picker.getByRole("radio", { name: "弧线" }).click()
  await expect.poll(async () => (await doc(page)).attachments?.[0]?.shape).toBe("arc")
  await expect(drawn).toHaveAttribute("data-shape", "arc")
  await expect(drawn.locator("path")).not.toHaveAttribute("d", /Z/)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await doc(page)).attachments?.[0]?.shape).toBeUndefined()
  await expect(drawn).toHaveAttribute("data-shape", "loop")

  // And from the canvas: right-click R1, 可变连接画法 → 直线.
  const label = page.getByTestId("canvas").locator("text", { hasText: /^R$/ }).first()
  const box = (await label.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" })
  await page.getByRole("menuitem", { name: "可变连接画法" }).hover()
  await page.getByRole("menuitemradio", { name: "直线" }).click()
  await expect.poll(async () => (await doc(page)).attachments?.[0]?.shape).toBe("line")
  await expect(drawn).toHaveAttribute("data-shape", "line")
})
