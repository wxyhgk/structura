import { expect, test, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { doc, menu, openEditor, openFile } from "./support.ts"

// Generating compounds in the 通式 workspace: the results follow the formula as it changes.

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

/** Opens a formula and switches to the 通式 workspace. */
async function openFormula(page: Page, name: string) {
  await openEditor(page)
  await openFile(page, fixture(name))
  await page.getByRole("tab", { name: "通式" }).click()
  await expect(page.getByTestId("markush-workspace")).toBeVisible()
}

/** Picks a tab of the constraints pane under the canvas. */
const constraintTab = (page: Page, name: string) => page.getByRole("tablist", { name: "通式约束" }).getByRole("tab", { name })

test("generated compounds show what each variable became, filter, and export as CSV", async ({ page }) => {
  await openFormula(page, "benzene-R1-anywhere.structura")
  await constraintTab(page, "位置").click()
  await page.getByLabel("R1 重复出现").check()
  await page.getByLabel("最多次数").fill("2")
  await expect(page.getByTestId("results-summary")).toContainText("得到 12 个不同的化合物")
  const compounds = page.getByTestId("enumerated-compound")
  await expect(compounds).toHaveCount(12)
  await expect(compounds.nth(1)).toContainText("R1 = ")

  // Cl alone, Cl2 (o, m, p) and ClF (o, m, p): 7 of the 12 hold chlorine.
  await page.getByLabel("筛选生成的化合物").fill("Cl")
  await expect(page.getByTestId("filter-count")).toHaveText("7 / 12")
  await expect(compounds).toHaveCount(7)

  const download = page.waitForEvent("download")
  await page.getByTestId("resultsPane").getByRole("button", { name: "CSV" }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe("benzene-R1-anywhere 展开.csv")
  const lines = (await readFile((await file.path())!, "utf8")).replace(/^﻿/, "").trim().split("\n")
  expect(lines[0]).toBe("No,SMILES,Formula,MW,R1 position,R1")
  expect(lines).toHaveLength(1 + 7)
  expect(lines.slice(1).every((line) => line.includes("Cl"))).toBe(true)
})

test("the structure menu's command opens the 通式 workspace", async ({ page }) => {
  await openEditor(page)
  await menu(page, "结构", "通式与批量生成…")
  await expect(page.getByTestId("markush-workspace")).toBeVisible()
  await expect(page.getByTestId("variables-empty")).toBeVisible()
})

test("an attachment drawn into one ring of carbazole widens to the whole fused system; symmetric repeats are merged", async ({ page }) => {
  await openFormula(page, "carbazole-R1-one-ring.structura")
  await constraintTab(page, "概览").click()
  await expect(page.getByTestId("library-size")).toContainText("可展开为 4 种组合")
  await page.getByRole("button", { name: /扩大到整个稠环体系（9 个位置）/ }).click()
  await expect.poll(async () => (await doc(page)).attachments?.[0]?.to.length).toBe(9)
  await expect(page.getByTestId("library-size")).toContainText("可展开为 9 种组合")
  // Carbazole is symmetric: 1/8, 2/7, 3/6, 4/5 are the same, so nine positions are five compounds.
  await expect(page.getByTestId("results-summary")).toContainText("得到 5 个不同的化合物（合并了 4 个重复的）")
})

test("two formulas on one page are generated each on its own, labelled 式 1 and 式 2", async ({ page }) => {
  await openFormula(page, "two-formulas.structura")
  await constraintTab(page, "概览").click()
  await expect(page.getByTestId("library-size")).toContainText("可展开为 4 种组合")
  const compounds = page.getByTestId("enumerated-compound")
  await expect(compounds).toHaveCount(4)
  await expect(compounds.filter({ hasText: "式 1" })).toHaveCount(2)
  await expect(compounds.filter({ hasText: "式 2" })).toHaveCount(2)
})

test("a proviso takes its combination out of what is generated", async ({ page }) => {
  await openFormula(page, "benzene-R1-R2.structura")
  await constraintTab(page, "附加条件").click()
  const provisos = page.getByTestId("provisos")
  await provisos.getByRole("button", { name: "+ 排除一种组合" }).click()
  await provisos.getByLabel("条件里的变量").first().selectOption("R1")
  await provisos.getByRole("checkbox", { name: "H" }).first().check()
  await provisos.getByRole("button", { name: "+ 再加一个变量" }).click()
  await provisos.getByLabel("条件里的变量").nth(1).selectOption("R2")
  await provisos.getByRole("checkbox", { name: "H" }).nth(1).check()
  await provisos.getByRole("button", { name: "添加" }).click()
  await expect(provisos.getByTestId("proviso")).toHaveText(["排除：R1 = H 且 R2 = H×"])
  await expect.poll(async () => (await doc(page) as { provisos?: unknown[] }).provisos?.length).toBe(1)
  // Of four combinations, one is out; the two R1/R2 = H/Cl swaps are the same chlorobenzene.
  await expect(page.getByTestId("results-summary")).toContainText("得到 2 个不同的化合物")
  await page.getByTestId("notes-toggle").click()
  await expect(page.getByTestId("enumeration-notes")).toContainText("按附加条件排除了 1 个")
})

test("two variables may close a ring together: the closed rings join the generated compounds", async ({ page }) => {
  await openFormula(page, "benzene-R1-R2.structura")
  await constraintTab(page, "概览").click()
  await expect(page.getByTestId("library-size")).toContainText("可展开为 4 种组合")
  await constraintTab(page, "成环").click()
  const closures = page.getByTestId("closures")
  await closures.getByRole("button", { name: "+ 两个变量可以一起成环" }).click()
  await closures.getByLabel("成环的第一个变量").selectOption("R1")
  await closures.getByLabel("成环的第二个变量").selectOption("R2")
  await closures.getByLabel("能成的环").fill("(CH2)3-4")
  await closures.getByRole("button", { name: "添加" }).click()
  await expect(closures.getByTestId("closure")).toContainText("R1 与 R2 可一起成环：(CH2)3、(CH2)4")
  // Benzene, chlorobenzene (twice), o-dichlorobenzene, indane and tetralin.
  await expect(page.getByTestId("results-summary")).toContainText("得到 5 个不同的化合物")
  await expect(page.getByTestId("enumerated-compound").filter({ hasText: "R1+R2 = (CH2)3" })).toHaveCount(1)
  await constraintTab(page, "概览").click()
  await expect(page.getByTestId("library-size")).toContainText("可展开为 6 种组合")
})

test("a class carrying named substituents is added in the form, shown, and counted", async ({ page }) => {
  await openFormula(page, "benzene-R1-R2.structura")
  await constraintTab(page, "概览").click()
  await expect(page.getByTestId("library-size")).toContainText("可展开为 4 种组合")
  const card = page.getByTestId("variable-R1")
  await card.getByRole("button", { name: "+ 类别…" }).click()
  await card.getByLabel("基团类别").selectOption("aryl")
  await card.getByLabel("最小").fill("6")
  await card.getByLabel("最大").fill("6")
  await card.getByLabel("取代基选自").fill("F")
  await card.getByLabel("取代基最少个数").fill("0")
  await card.getByLabel("取代基最多个数").fill("1")
  await card.getByRole("button", { name: "添加", exact: true }).click()
  await expect(card).toContainText("芳基（被 0–1 个 F 取代）")
  // R1: H, Cl, phenyl and 4-fluorophenyl; R2: H, Cl.
  await expect(page.getByTestId("library-size")).toContainText("可展开为 8 种组合")
})

/** The middle of the open sketch pad, in page coordinates. */
async function padCentre(page: Page) {
  const pad = (await page.getByTestId("inline-sketch").getByTestId("sketch-pad").boundingBox())!
  return { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 }
}

test("a candidate drawn in the sketch pad joins the variable's list, and the compounds made from it", async ({ page }) => {
  await openFormula(page, "benzene-R1-anywhere.structura")
  const card = page.getByTestId("variable-R1")
  const compounds = page.getByTestId("enumerated-compound")
  await expect(compounds).toHaveCount(2)
  await expect(card.getByTestId("alternative")).toHaveCount(2)

  await card.getByRole("button", { name: "✎ 画一个" }).click()
  const sketch = page.getByTestId("inline-sketch")
  await expect(sketch).toContainText("给 R1 画一个候选项")
  const centre = await padCentre(page)
  // A bond, then its first atom made O: methoxy, joined by the O (the first atom drawn).
  await page.mouse.click(centre.x, centre.y)
  await sketch.getByRole("button", { name: "O", exact: true }).click()
  await page.mouse.click(centre.x, centre.y)
  // The main drawing is untouched while drawing in the pad.
  expect((await doc(page)).molecule.atoms.length).toBe(7)
  await sketch.getByRole("button", { name: "添加到 R1" }).click()
  await expect(sketch).toHaveCount(0)
  await expect(card.getByTestId("alternative")).toHaveCount(3)
  // Anisole: one more compound.
  await expect(compounds).toHaveCount(3)

  // The drawn candidate opens again for changing.
  await card.getByRole("button", { name: "修改画的结构" }).click()
  await expect(page.getByTestId("inline-sketch")).toContainText("修改 R1 的候选项")
  await page.getByTestId("inline-sketch").getByRole("button", { name: "保存" }).click()
  await expect(card.getByTestId("alternative")).toHaveCount(3)
})

test("in the sketch pad's site mode a click on an atom sets the site, shown on the atom, instead of drawing", async ({ page }) => {
  await openFormula(page, "benzene-R1-anywhere.structura")
  await page.getByTestId("variable-R1").getByRole("button", { name: "✎ 画一个" }).click()
  const sketch = page.getByTestId("inline-sketch")
  await expect(sketch).toContainText("给 R1 画一个候选项")
  const centre = await padCentre(page)
  await page.mouse.click(centre.x, centre.y)
  // Before any site is set, the first atom drawn is the default, and says so.
  await expect(sketch.getByTestId("site-badge")).toHaveText("默认")
  await expect(sketch.getByTestId("sites-line")).toContainText("默认用第一个画的原子")
  await sketch.getByRole("button", { name: "◎ 设位点" }).click()
  await page.mouse.click(centre.x, centre.y)
  await expect(sketch.getByTestId("site-badge")).toHaveText("1")
  await sketch.getByRole("button", { name: "添加到 R1" }).click()
  await expect(sketch).toHaveCount(0)
  // Ethyl with one "*": two carbons, not a third drawn by the click.
  type Piece = { kind: string; molecule?: { atoms: Array<{ el: string; alias?: string }> } }
  const list = (await doc(page)).variables?.R1 as { alternatives: Piece[] }
  const piece = list.alternatives.at(-1)
  expect(piece?.kind).toBe("fragment")
  expect(piece?.molecule?.atoms.map((atom) => atom.alias ?? atom.el).sort()).toEqual(["*", "C", "C"])

  // Opened again, the piece shows its site on the atom, with no "*" drawn.
  await page.getByTestId("variable-R1").getByRole("button", { name: "修改画的结构" }).click()
  await expect(page.getByTestId("inline-sketch").getByTestId("site-badge")).toHaveText("1")
  await expect(page.getByTestId("inline-sketch").getByTestId("sites-line")).toContainText("第 1 个原子")
})

test("a candidate drawn with two sites makes one compound for each: methoxy joined by O, and by C", async ({ page }) => {
  await openFormula(page, "benzene-R1-anywhere.structura")
  const card = page.getByTestId("variable-R1")
  const compounds = page.getByTestId("enumerated-compound")
  await expect(compounds).toHaveCount(2)
  await card.getByRole("button", { name: "✎ 画一个" }).click()
  const sketch = page.getByTestId("inline-sketch")
  const first = await padCentre(page)
  // A click on empty canvas draws a bond to the right, one bond length (40 at 100%) long.
  const second = { x: first.x + 40, y: first.y }
  await page.mouse.click(first.x, first.y)
  await sketch.getByRole("button", { name: "O", exact: true }).click()
  await page.mouse.click(first.x, first.y)
  await sketch.getByRole("button", { name: "◎ 设位点" }).click()
  await page.mouse.click(first.x, first.y)
  await page.mouse.click(second.x, second.y)
  await expect(sketch.getByTestId("site-badge")).toHaveText(["1", "2"])
  await expect(sketch.getByTestId("sites-line")).toContainText("共 2 种")
  await sketch.getByRole("button", { name: "添加到 R1" }).click()
  await expect(card.getByTestId("alternative").last()).toContainText("2 个位点")
  // Anisole and benzyl alcohol.
  await expect(compounds).toHaveCount(4)
  // Opened again, both sites are back on their atoms.
  await card.getByRole("button", { name: "修改画的结构" }).click()
  await expect(page.getByTestId("inline-sketch").getByTestId("site-badge")).toHaveText(["1", "2"])
})
