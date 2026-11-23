import { expect, test, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { openFile, openMarkush } from "./support.ts"

// The results as a table, filtered by variable values, element counts, a structure and
// property ranges, and downloaded with their properties. The formula: benzene with R1 (Cl or F)
// anywhere, up to twice, which makes 12 compounds: none, Cl, F, and three positions each of Cl2, F2, ClF.

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

async function openTwelve(page: Page) {
  await openMarkush(page)
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  await expect(page.getByTestId("markush-workspace")).toBeVisible()
  await page.getByRole("tablist", { name: "通式约束" }).getByRole("tab", { name: "位置" }).click()
  await page.getByLabel("R1 重复出现").check()
  await page.getByLabel("最多次数").fill("2")
  await expect(page.getByTestId("results-summary")).toContainText("得到 12 个不同的化合物")
}

const rows = (page: Page) => page.getByTestId("result-row")
/** The texts of one column over the rows shown. */
const column = (page: Page, id: string) => page.locator(`[data-testid="result-row"] [data-column="${id}"]`).allTextContents()

test("the results can be a table: a row each, a column for every variable and property, remembered", async ({ page }) => {
  await openTwelve(page)
  await expect(page.getByTestId("view-cards")).toHaveAttribute("aria-pressed", "true")
  await page.getByTestId("view-table").click()
  await expect(page.getByTestId("results-table")).toBeVisible()
  await expect(rows(page)).toHaveCount(12)
  await expect(page.getByTestId("enumerated-compound")).toHaveCount(0)
  const heads = await page.getByTestId("results-table").locator("thead th").allTextContents()
  expect(heads.join(" ")).toMatch(/编号.*结构.*R1.*R1 位置.*分子式.*分子量.*精确质量.*cLogP.*TPSA.*HBD.*HBA.*可旋转键.*重原子数/)

  // Weight and formula at once; RDKit's properties as soon as RDKit has them.
  await expect(page.locator('[data-column="prop:logp"]').first()).toHaveText(/^-?\d+\.\d\d$/)
  expect((await column(page, "prop:tpsa")).every((text) => text === "0.0")).toBe(true)
  expect((await column(page, "prop:heavy")).sort()).toContain("6")

  // The choice is remembered.
  expect(await page.evaluate(() => localStorage.getItem("structura.resultsView"))).toBe("table")
  await page.getByTestId("view-cards").click()
  await expect(page.getByTestId("enumerated-compound")).toHaveCount(12)
})

test("a click on a heading sorts by it, ascending then descending; variables go by the order of their candidates", async ({ page }) => {
  await openTwelve(page)
  await page.getByTestId("view-table").click()
  await expect(rows(page)).toHaveCount(12)
  await page.getByTestId("sort-prop:mw").click()
  await expect(page.getByRole("columnheader", { name: /分子量/ })).toHaveAttribute("aria-sort", "ascending")
  const up = (await column(page, "prop:mw")).map(Number)
  expect(up).toEqual([...up].sort((a, b) => a - b))
  expect(up[0]).toBeCloseTo(78.11, 1)
  await page.getByTestId("sort-prop:mw").click()
  const down = (await column(page, "prop:mw")).map(Number)
  expect(down).toEqual([...down].sort((a, b) => b - a))
  expect(down[0]).toBeGreaterThan(140)

  // R1's candidates are Cl, then F: Cl first when ascending, F first when descending, compounds without R1 last.
  await page.getByTestId("sort-v:R1").click()
  expect((await column(page, "v:R1"))[0]).toMatch(/^Cl/)
  expect((await column(page, "v:R1")).at(-1)).toBe("")
  await page.getByTestId("sort-v:R1").click()
  expect((await column(page, "v:R1"))[0]).toMatch(/^F/)
  expect((await column(page, "v:R1")).at(-1)).toBe("")
  // Sorting does not renumber: the numbers stay with their compounds.
  const ids = await page.locator('[data-testid="result-row"] [data-testid="compound-id"]').allTextContents()
  expect([...ids].sort()).toEqual(Array.from({ length: 12 }, (_, index) => `C-${index + 1}`).sort())
  await page.getByTestId("sort-chip").getByRole("button").click()
  await expect(page.getByTestId("sort-chip")).toHaveCount(0)
})

test("the filter box matches a variable's value exactly, counts elements, and reports what it cannot find", async ({ page }) => {
  await openTwelve(page)
  const box = page.getByLabel("筛选生成的化合物")
  const count = page.getByTestId("filter-count")
  const compounds = page.getByTestId("enumerated-compound")

  // R1 = Cl in 7 of the 12 (Cl, Cl2 ×3, ClF ×3); "C" as a value is not "Cl".
  await box.fill("R1=Cl")
  await expect(count).toHaveText("7 / 12")
  await box.fill("r1 = cl")
  await expect(count).toHaveText("7 / 12")
  await box.fill("R1=C")
  await expect(page.getByTestId("results-empty")).toContainText("没有符合筛选条件")
  await box.fill("R1=Cl R1=F")
  await expect(count).toHaveText("3 / 12")
  await box.fill("R1=Cl|F")
  await expect(count).toHaveText("11 / 12")
  await box.fill("R1!=Cl")
  await expect(count).toHaveText("5 / 12")

  // Element counts: F alone is "some fluorine", F2 exactly two.
  await box.fill("F")
  await expect(count).toHaveText("7 / 12")
  await box.fill("F2")
  await expect(count).toHaveText("3 / 12")
  await box.fill("F1")
  await expect(count).toHaveText("4 / 12")
  await box.fill("Cl0")
  await expect(count).toHaveText("5 / 12")
  await box.fill("N")
  await expect(page.getByTestId("results-empty")).toBeVisible()
  await box.fill("Cl F")
  await expect(count).toHaveText("3 / 12")
  await expect(compounds).toHaveCount(3)

  // A variable nobody has is said, not silently empty.
  await box.fill("R9=H")
  await expect(page.getByTestId("filter-notes")).toContainText("没有叫 R9 的变量")
  await page.getByTestId("filter-clear").click()
  await expect(box).toHaveValue("")
  await expect(compounds).toHaveCount(12)
})

test("a structure (SMILES or SMARTS) and property ranges filter the compounds; a wrong structure says so", async ({ page }) => {
  await openTwelve(page)
  const count = page.getByTestId("filter-count")
  await page.getByTestId("filter-more-toggle").click()
  const structure = page.getByLabel("按子结构筛选")

  await structure.fill("Clc")
  await expect(count).toHaveText("7 / 12")
  // Only the ortho dichloro compound has both chlorines on neighbouring carbons.
  await structure.fill("Clc1ccccc1Cl")
  await expect(count).toHaveText("1 / 12")
  await structure.fill("c1ccccc1")
  await expect(page.getByTestId("enumerated-compound")).toHaveCount(12)
  await structure.fill("c1ccc(")
  await expect(page.getByTestId("filter-notes")).toContainText("不是有效的 SMILES 或 SMARTS")
  await expect(page.getByTestId("enumerated-compound")).toHaveCount(12)
  await structure.fill("")

  // Weight is the formula's: benzene (78) and fluorobenzene (96) weigh under 100.
  await page.getByLabel("分子量 上限").fill("100")
  await expect(count).toHaveText("2 / 12")
  await page.getByLabel("分子量 上限").fill("")
  // RDKit's numbers: all twelve have TPSA 0, none a hydrogen-bond donor.
  await page.getByLabel("TPSA 上限").fill("0")
  await expect(count).toHaveText("12 / 12")
  await page.getByLabel("HBD 下限").fill("1")
  await expect(page.getByTestId("results-empty")).toContainText("没有符合筛选条件")
  await page.getByLabel("HBD 下限").fill("")
  await page.getByLabel("TPSA 上限").fill("")
  // Benzenes with one or two halogens break none of Lipinski's limits.
  await page.getByText("符合五规则").click()
  await expect(count).toHaveText("12 / 12")
})

test("the downloads say whether they hold what the filter keeps or everything, and carry the properties", async ({ page }) => {
  await openTwelve(page)
  const pane = page.getByTestId("resultsPane")
  await expect(pane).toContainText("下载全部 12 个")
  await page.getByLabel("筛选生成的化合物").fill("Cl")
  const scope = page.getByTestId("export-scope")
  await expect(scope.locator("option")).toHaveText(["筛选出的 7 个", "全部 12 个"])

  const sdf = page.waitForEvent("download")
  await pane.getByRole("button", { name: "SDF" }).click()
  const text = await readFile((await (await sdf).path())!, "utf8")
  expect(text.split("$$$$").length - 1).toBe(7)
  for (const item of ["> <MW>", "> <ExactMass>", "> <cLogP>", "> <TPSA>", "> <HBD>", "> <HBA>", "> <RotBonds>", "> <HeavyAtoms>", "> <Formula>"]) expect(text).toContain(item)

  await scope.selectOption("all")
  const csv = page.waitForEvent("download")
  await pane.getByRole("button", { name: "CSV" }).click()
  const lines = (await readFile((await (await csv).path())!, "utf8")).replace(/^﻿/, "").trim().split("\n")
  expect(lines).toHaveLength(1 + 12)
  expect(lines[0]).toContain("cLogP")
  // Nothing unreadable here, so nothing to apologise for.
  await expect(page.getByTestId("download-note")).toHaveCount(0)
})
