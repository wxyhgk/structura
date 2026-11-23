import { expect, test, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { doc, openFile, openMarkush } from "./support.ts"

// Compound numbers belong to the compounds and are kept in the document; the generation
// options are the document's too.

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

type Run = { run(ops: unknown[]): { ok: boolean } }

/** Opens the benzene formula with R1 = Cl, F on the 通式 page. */
async function openFormula(page: Page) {
  await openMarkush(page)
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  await expect(page.getByTestId("results-summary")).toContainText("得到 2 个不同的化合物")
}

/** Lets the page go though its document has changes (the leave-the-page question is answered yes). */
const leaveFreely = (page: Page) => page.on("dialog", (dialog) => void (dialog.type() === "beforeunload" && dialog.accept()))

const ids = (page: Page) => page.getByTestId("enumerated-compound").getByTestId("compound-id")
const results = (page: Page) => page.getByTestId("resultsPane")

test("generating changes nothing in the file; numbers are written when fixed, and the file is then unsaved", async ({ page }) => {
  await openFormula(page)
  await expect(ids(page)).toHaveText(["C-1", "C-2"])
  // Only a preview so far: no numbering in the document, and nothing to save.
  await expect(page.getByTestId("numbers-fresh")).toBeVisible()
  expect((await doc(page)).numbering).toBeUndefined()
  await expect(page.getByTestId("document-title")).toHaveText("benzene-R1-anywhere")

  await results(page).getByRole("button", { name: "固定编号" }).click()
  await expect(page.getByTestId("numbers-fixed")).toContainText("2 个")
  const { numbering } = await doc(page)
  expect(numbering?.pattern).toBe("C-{n}")
  expect(Object.values(numbering?.assigned ?? {}).sort()).toEqual([1, 2])
  await expect(page.getByTestId("document-title")).toHaveText("benzene-R1-anywhere•")
  // One undoable step.
  await page.getByRole("button", { name: "撤销" }).click()
  expect((await doc(page)).numbering).toBeUndefined()
  await expect(page.getByTestId("numbers-fresh")).toBeVisible()
})

test("a compound keeps its number when the list changes around it, and a filter changes no number", async ({ page }) => {
  await openFormula(page)
  // Downloading fixes the numbers.
  const download = page.waitForEvent("download")
  await results(page).getByRole("button", { name: "CSV" }).click()
  await download
  await expect(page.getByTestId("numbers-fixed")).toContainText("2 个")

  // Br comes first in the list now; Cl and F keep C-1 and C-2, Br is the next number.
  await page.evaluate(() => (window as unknown as { __structura: Run }).__structura.run([{ op: "set_variable", name: "R1", alternatives: [{ kind: "label", text: "Br" }, { kind: "label", text: "Cl" }, { kind: "label", text: "F" }] }]))
  await expect(page.getByTestId("results-summary")).toContainText("得到 3 个不同的化合物")
  await expect(ids(page)).toHaveText(["C-3", "C-1", "C-2"])
  await expect(page.getByTestId("numbers-fresh")).toContainText("1 个新化合物")

  // A filter only chooses what is shown.
  await page.getByLabel("筛选生成的化合物").fill("F")
  await expect(ids(page)).toHaveText(["C-2"])
  await page.getByLabel("筛选生成的化合物").fill("")

  // Br is dropped: F keeps C-2, and the number C-1 stays taken.
  await page.evaluate(() => (window as unknown as { __structura: Run }).__structura.run([{ op: "set_variable", name: "R1", alternatives: [{ kind: "label", text: "F" }] }]))
  await expect(ids(page)).toHaveText(["C-2"])
})

test("starting over asks first, renumbers in list order, and can be undone", async ({ page }) => {
  await openFormula(page)
  await results(page).getByRole("button", { name: "固定编号" }).click()
  await page.evaluate(() => (window as unknown as { __structura: Run }).__structura.run([{ op: "set_variable", name: "R1", alternatives: [{ kind: "label", text: "Br" }, { kind: "label", text: "Cl" }, { kind: "label", text: "F" }] }]))
  await expect(ids(page)).toHaveText(["C-3", "C-1", "C-2"])

  // Said no to: nothing changes.
  page.once("dialog", (dialog) => void dialog.dismiss())
  await results(page).getByRole("button", { name: "重新编号…" }).click()
  await expect(ids(page)).toHaveText(["C-3", "C-1", "C-2"])

  page.once("dialog", (dialog) => void dialog.accept())
  await results(page).getByRole("button", { name: "重新编号…" }).click()
  await expect(ids(page)).toHaveText(["C-1", "C-2", "C-3"])
  expect(Object.values((await doc(page)).numbering?.assigned ?? {}).sort()).toEqual([1, 2, 3])

  await page.getByRole("button", { name: "撤销" }).click()
  await expect(ids(page)).toHaveText(["C-3", "C-1", "C-2"])
})

test("how numbers are written and the first number are the document's: they come back with the file", async ({ page }) => {
  await openFormula(page)
  await page.getByLabel("编号的写法").fill("化合物{n}")
  await page.getByLabel("起始编号").fill("20")
  await page.getByLabel("筛选生成的化合物").click()
  await expect(ids(page)).toHaveText(["化合物20", "化合物21"])
  const text = await page.evaluate(() => (window as unknown as { __structura: { getDocument(): string } }).__structura.getDocument())
  expect((await doc(page)).numbering).toMatchObject({ pattern: "化合物{n}", start: 20 })

  // Another browser's habit does not matter once the file says: a fresh page, its own storage.
  leaveFreely(page)
  await page.evaluate(() => localStorage.clear())
  await openMarkush(page)
  await page.evaluate((given) => (window as unknown as { __structura: { setDocument(text: string): string[] } }).__structura.setDocument(given), text)
  await expect(ids(page)).toHaveText(["化合物20", "化合物21"])
})

test("the generation options are saved in the document, and undone with it", async ({ page }) => {
  await openFormula(page)
  expect((await doc(page)).generation).toBeUndefined()
  await results(page).getByLabel("去重").uncheck()
  await results(page).getByLabel("最多生成").selectOption("100")
  // Every position of the ring, each with each candidate: nothing merged.
  await expect(page.getByTestId("results-summary")).toContainText("得到 12 个化合物")
  // All of them, once one is set: the file then generates the same however the defaults change.
  expect((await doc(page)).generation).toEqual({ representatives: true, dedupe: false, limit: 100, order: "spread" })
  // Without de-duplication compounds are told apart by their choices, and the page says so.
  await expect(results(page)).toContainText("编号按取值认化合物")

  const text = await page.evaluate(() => (window as unknown as { __structura: { getDocument(): string } }).__structura.getDocument())

  // Each change is a step of the drawing's history.
  await page.getByRole("button", { name: "撤销" }).click()
  await page.getByRole("button", { name: "撤销" }).click()
  await expect(results(page).getByLabel("去重")).toBeChecked()
  await expect(results(page).getByLabel("最多生成")).toHaveValue("500")

  // And the file keeps them.
  leaveFreely(page)
  await openMarkush(page)
  await page.evaluate((given) => (window as unknown as { __structura: { setDocument(text: string): string[] } }).__structura.setDocument(given), text)
  await expect(results(page).getByLabel("去重")).not.toBeChecked()
  await expect(results(page).getByLabel("最多生成")).toHaveValue("100")
})

test("automatic updating is the person's own setting, kept in the browser and not in the file", async ({ page }) => {
  await openFormula(page)
  await results(page).getByLabel("自动更新").uncheck()
  expect((await doc(page)).generation).toBeUndefined()
  await openMarkush(page)
  await expect(results(page).getByLabel("自动更新")).not.toBeChecked()
})

test("a file saved with numbers reads back with them", async ({ page }) => {
  await openMarkush(page)
  const text = JSON.parse(await readFile(fixture("benzene-R1-anywhere.structura"), "utf8"))
  text.drawing.numbering = { pattern: "1-{n}", start: 1, assigned: { "s:Fc1ccccc1": 7 } }
  await page.evaluate((given) => (window as unknown as { __structura: { setDocument(text: string): string[] } }).__structura.setDocument(given), JSON.stringify(text))
  await expect(page.getByTestId("results-summary")).toContainText("得到 2 个不同的化合物")
  // Cl is new: it follows the highest number given out.
  await expect(ids(page)).toHaveText(["1-8", "1-7"])
})
