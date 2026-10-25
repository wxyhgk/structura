import { expect, type Page } from "@playwright/test"

// What every flow needs: an empty editor, the drawing as a document, and the menus.

type Atom = { id: number; el: string; x: number; y: number; alias?: string }
export type Doc = {
  molecule: { atoms: Atom[]; bonds: Array<{ a: number; b: number }> }
  attachments?: Array<{ atom: number; to: number[]; repeat?: { min: number; max: number; name: string }; shape?: "line" | "loop" | "arc" | "bracket" | "custom"; curve?: { nodes: Array<[number, number]>; closed: boolean } }>
  variables?: Record<string, unknown>
  brackets?: Array<{ id: number; atoms: number[]; kind: string; repeat?: { min: number; max: number; name: string } }>
}
type Handle = { getDocument(): string; setDocument(text: string): string[] }

/** Opens the editor and waits until it hands itself to the tests. */
export async function openEditor(page: Page) {
  await page.goto("/")
  await expect.poll(() => page.evaluate(() => "__structura" in window)).toBe(true)
}

/** Opens the 通式 page and waits until its editor hands itself to the tests. */
export async function openMarkush(page: Page) {
  await page.goto("/markush.html")
  await expect.poll(() => page.evaluate(() => "__structura" in window)).toBe(true)
}

/**
 * Takes the document drawn on this page to the 通式 page, in this tab: what 结构 → 通式与批量生成…
 * does in a new one (enumerate.spec.ts follows that), here so the test goes on with one page.
 * Leaving a drawing with changes asks first; the test says yes.
 */
export async function toMarkush(page: Page) {
  const text = await page.evaluate(() => (window as unknown as { __structura: Handle }).__structura.getDocument())
  const leave = (dialog: import("@playwright/test").Dialog) => void (dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss())
  page.once("dialog", leave)
  await openMarkush(page)
  page.off("dialog", leave)
  await page.evaluate((given) => (window as unknown as { __structura: Handle }).__structura.setDocument(given), text)
  await expect(page.getByTestId("markush-workspace")).toBeVisible()
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

/** Picks an item from a top menu, a plain one or a tick box (杂原子着色…). */
export async function menu(page: Page, top: string, item: string | RegExp) {
  await page.getByRole("button", { name: top, exact: true }).click()
  await page.getByRole("menuitem", { name: item }).or(page.getByRole("menuitemcheckbox", { name: item })).first().click()
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

/** The files of a stored (uncompressed) zip, as Structura writes them, by name: read through its central directory. */
export function unzipText(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const decoder = new TextDecoder()
  const files = new Map<string, string>()
  for (let i = 0; i < count; i++) {
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const local = view.getUint32(at + 42, true)
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    files.set(decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)), decoder.decode(bytes.subarray(start, start + size)))
    at += 46 + nameLength
  }
  return files
}
