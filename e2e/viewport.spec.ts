import { expect, test, type CDPSession, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { canvasCentre, doc, openEditor } from "./support.ts"

// The view on screens other than a desktop's: two fingers pan and pinch it on a touch screen,
// an editor mounted while hidden fits its drawing once it is shown, and a canvas resized
// keeps the same part of the drawing in its middle.

/** The canvas's zoom and pan, as its drawing is transformed. */
async function view(page: Page) {
  const transform = (await page.getByTestId("canvas").locator("> g").getAttribute("transform"))!
  const [x, y, zoom] = transform.match(/-?[\d.]+(e-?\d+)?/g)!.map(Number)
  return { zoom, pan: { x, y } }
}

type Finger = { x: number; y: number; id: number }

/** Fingers on the screen through Chrome's own touch input: the page sees real touch pointers. */
const touch = (cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", fingers: Finger[]) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: fingers })

/** Two fingers from `from` to `to`, in steps, the first down a moment before the second. */
async function twoFingers(cdp: CDPSession, from: [Finger, Finger], to: [Finger, Finger], steps = 8) {
  await touch(cdp, "touchStart", [from[0]])
  await touch(cdp, "touchStart", from)
  for (let i = 1; i <= steps; i++) {
    const at = (a: Finger, b: Finger) => ({ id: a.id, x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps })
    await touch(cdp, "touchMove", [at(from[0], to[0]), at(from[1], to[1])])
  }
  await touch(cdp, "touchEnd", [to[0]])
  await touch(cdp, "touchEnd", [])
}

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true })

  test("two fingers pinch the view about the point between them and pan it, drawing nothing; one finger still draws", async ({ page }) => {
    await openEditor(page)
    const cdp = await page.context().newCDPSession(page)
    const centre = await canvasCentre(page)
    const before = await view(page)
    expect(before.zoom).toBe(1)

    // Spread from 100 to 200 px apart, the middle moved 30 right and 20 down.
    const left = { id: 0, x: centre.x - 50, y: centre.y }
    const right = { id: 1, x: centre.x + 50, y: centre.y }
    await twoFingers(cdp, [left, right], [{ ...left, x: centre.x - 70, y: centre.y + 20 }, { ...right, x: centre.x + 130, y: centre.y + 20 }])
    await expect(page.getByText(/原子 · 200%$/)).toBeVisible()
    const pinched = await view(page)
    expect(pinched.zoom).toBeCloseTo(2)
    // The drawing point under the fingers' first middle is under their last.
    const box = (await page.getByTestId("canvas").boundingBox())!
    const worldBefore = (centre.x - box.x - before.pan.x) / before.zoom
    expect((centre.x + 30 - box.x - pinched.pan.x) / pinched.zoom).toBeCloseTo(worldBefore)
    expect((await doc(page)).molecule.atoms).toHaveLength(0)

    // Together, the same distance apart: a pan alone.
    await twoFingers(cdp, [left, right], [{ ...left, x: left.x - 40, y: left.y + 60 }, { ...right, x: right.x - 40, y: right.y + 60 }])
    const panned = await view(page)
    expect(panned.pan.x).toBeCloseTo(pinched.pan.x - 40)
    expect(panned.pan.y).toBeCloseTo(pinched.pan.y + 60)
    expect(panned.zoom).toBeCloseTo(2)
    expect((await doc(page)).molecule.atoms).toHaveLength(0)
    await expect(page.getByTestId("formula")).toHaveText("—")

    // One finger, as ever: a tap draws a bond.
    await touch(cdp, "touchStart", [{ id: 2, x: centre.x, y: centre.y }])
    await touch(cdp, "touchEnd", [])
    await expect(page.getByTestId("formula")).toHaveText("C₂H₆")
  })

  test("a second finger down while a bond is being dragged drops it: nothing drawn, nothing to undo", async ({ page }) => {
    await openEditor(page)
    const cdp = await page.context().newCDPSession(page)
    const centre = await canvasCentre(page)
    await touch(cdp, "touchStart", [{ id: 0, x: centre.x, y: centre.y }])
    for (let i = 1; i <= 5; i++) await touch(cdp, "touchMove", [{ id: 0, x: centre.x + i * 12, y: centre.y + i * 8 }])
    await touch(cdp, "touchStart", [{ id: 0, x: centre.x + 60, y: centre.y + 40 }, { id: 1, x: centre.x + 200, y: centre.y }])
    await touch(cdp, "touchMove", [{ id: 0, x: centre.x + 80, y: centre.y + 40 }, { id: 1, x: centre.x + 220, y: centre.y }])
    await touch(cdp, "touchEnd", [{ id: 1, x: centre.x + 220, y: centre.y }])
    await touch(cdp, "touchMove", [{ id: 1, x: centre.x + 260, y: centre.y + 50 }])
    await touch(cdp, "touchEnd", [])
    expect((await doc(page)).molecule.atoms).toHaveLength(0)
    await page.getByRole("button", { name: "编辑", exact: true }).click()
    await expect(page.getByRole("menuitem", { name: /撤销/ })).toBeDisabled()
  })
})

const PACKAGE = "http://127.0.0.1:25401"

test("an editor mounted in a hidden box fits its drawing when it is shown, not at the smallest zoom", async ({ page }) => {
  await page.goto(`${PACKAGE}/examples/module.html`)
  await expect(page.locator("#editor .chem-app")).toBeVisible()
  const molfile = await readFile(new URL("fixtures/phenyl-R1.mol", import.meta.url), "utf8")
  await page.evaluate(async (text) => {
    const box = document.createElement("div")
    box.id = "tab"
    box.style.cssText = "display: none; position: fixed; inset: 0; z-index: 10; background: white"
    document.body.append(box)
    const standalone = "/dist/standalone.js"
    const { mount } = await import(standalone)
    mount(box, { initialMolfile: text })
  }, molfile)
  await page.evaluate(() => (document.getElementById("tab")!.style.display = "block"))
  await expect(page.locator("#tab").getByText(/^7 原子 · /)).toHaveText("7 原子 · 150%")
})

test("a resized canvas keeps the drawing point at its middle there", async ({ page }) => {
  await openEditor(page)
  const centre = await canvasCentre(page)
  await page.mouse.click(centre.x, centre.y)
  await expect(page.getByTestId("formula")).toHaveText("C₂H₆")
  const middle = async () => {
    const box = (await page.getByTestId("canvas").boundingBox())!
    const { zoom, pan } = await view(page)
    return { x: (box.width / 2 - pan.x) / zoom, y: (box.height / 2 - pan.y) / zoom, width: box.width }
  }
  const before = await middle()
  await page.setViewportSize({ width: 1000, height: 640 })
  await expect.poll(async () => (await middle()).width).toBeLessThan(before.width)
  // The view follows when the canvas hears of its new size, a frame or so after the layout.
  await expect.poll(async () => (await middle()).x).toBeCloseTo(before.x)
  expect((await middle()).y).toBeCloseTo(before.y)
})
