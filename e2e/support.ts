import { expect, type Page } from "@playwright/test"

// What every flow needs: an empty editor, the drawing as a document, and the menus.

type Atom = { id: number; el: string; x: number; y: number; alias?: string }
export type Doc = {
  molecule: { atoms: Atom[]; bonds: Array<{ a: number; b: number }> }
  attachments?: Array<{ atom: number; to: number[]; repeat?: { min: number; max: number; name: string } }>
  variables?: Record<string, unknown>
}
type Handle = { getDocument(): string; setDocument(text: string): string[] }

/** Opens the editor and waits until it hands itself to the tests. */
export async function openEditor(page: Page) {
  await page.goto("/")
  await expect.poll(() => page.evaluate(() => "__structura" in window)).toBe(true)
}

/** The drawing as the editor would save it. */
export async function doc(page: Page): Promise<Doc> {
  const text = await page.evaluate(() => (window as unknown as { __structura: Handle }).__structura.getDocument())
  return JSON.parse(text).drawing
}

/**
 * What is drawn, as text, for comparing before and after: the saved document without its id
 * counters, which only ever go up (an id is never handed out twice, even after undo).
 */
export async function drawnText(page: Page): Promise<string> {
  const text = await page.evaluate(() => (window as unknown as { __structura: Handle }).__structura.getDocument())
  return JSON.stringify(JSON.parse(text, (key, value) => (/^next[A-Z]\w*Id$/.test(key) ? undefined : value)))
}

/** Picks an item from a top menu. */
export async function menu(page: Page, top: string, item: string | RegExp) {
  await page.getByRole("button", { name: top, exact: true }).click()
  await page.getByRole("menuitem", { name: item }).click()
}

/** Opens a file through 文件 → 打开…, as a person would. */
export async function openFile(page: Page, path: string) {
  const chooser = page.waitForEvent("filechooser")
  await menu(page, "文件", /打开/)
  await (await chooser).setFiles(path)
}

/** The middle of the drawing area, in page coordinates. */
export async function canvasCentre(page: Page) {
  const box = (await page.getByTestId("canvas").boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
