import { expect, test, type Page } from "@playwright/test"
import { canvasCentre, openEditor } from "./support.ts"

// The editor's dark theme in the app: chosen in 查看, remembered, and following the system
// (or the page) for 跟随系统. Light stays exactly as it was; files written stay light.

/** Lightness of a computed rgb() colour, 0 to 1. */
const lightness = (rgb: string) => {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map((value) => Number(value) / 255)
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}

const look = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector(".chem-app")!
    const bar = root.querySelector("header")!
    const canvas = root.querySelector("[data-testid=canvas]")!.parentElement!
    const bond = root.querySelector("[data-testid=canvas] line")
    return {
      dark: root.classList.contains("chem-dark"),
      bar: getComputedStyle(bar).backgroundColor,
      canvas: getComputedStyle(canvas).backgroundColor,
      bond: bond?.getAttribute("stroke") ?? null,
    }
  })

const pickTheme = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "查看", exact: true }).click()
  await page.getByRole("menuitemradio", { name }).click()
}

test("light is as it was, until 查看 → 深色: chrome, menus and canvas go dark, remembered; files stay light", async ({ page }) => {
  await openEditor(page)
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  const light = await look(page)
  expect(light).toMatchObject({ dark: false, bar: "rgb(242, 242, 242)", canvas: "rgb(255, 255, 255)", bond: "#222222" })

  await pickTheme(page, "深色")
  const dark = await look(page)
  expect(dark.dark).toBe(true)
  expect(lightness(dark.bar)).toBeLessThan(0.25)
  expect(lightness(dark.canvas)).toBeLessThan(0.2)
  expect(lightness(`rgb(${[1, 3, 5].map((at) => parseInt(dark.bond!.slice(at, at + 2), 16)).join(",")})`)).toBeGreaterThan(0.8)
  // Menus portal out of the editor, and come dark too.
  await page.getByRole("button", { name: "文件", exact: true }).click()
  const menu = page.getByRole("menu")
  await expect(menu).toHaveClass(/chem-dark/)
  expect(lightness(await menu.evaluate((element) => getComputedStyle(element).backgroundColor))).toBeLessThan(0.25)
  await page.keyboard.press("Escape")
  // What the editor writes is for documents: light.
  const svg = await page.evaluate(() => (window as unknown as { __structura: { getSvg(): string } }).__structura.getSvg())
  expect(svg).toContain('fill="#ffffff"')
  expect(svg).toContain("#222222")

  await page.reload()
  await expect(page.locator(".chem-app")).toHaveClass(/chem-dark/)
})

test("跟随系统: dark with the system, unless the page says otherwise, followed as either changes", async ({ page }) => {
  await openEditor(page)
  await pickTheme(page, "跟随系统")
  const root = page.locator(".chem-app")
  await expect(root).not.toHaveClass(/chem-dark/)
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(root).toHaveClass(/chem-dark/)
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"))
  await expect(root).not.toHaveClass(/chem-dark/)
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"))
  await expect(root).toHaveClass(/chem-dark/)
  await page.emulateMedia({ colorScheme: "light" })
  await page.evaluate(() => document.documentElement.classList.add("dark"))
  await expect(root).toHaveClass(/chem-dark/)
})
