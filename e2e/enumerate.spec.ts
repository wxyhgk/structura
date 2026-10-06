import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { doc, openEditor, openFile } from "./support.ts"

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

test("generated compounds show what each variable became, filter, export as CSV, and go onto the canvas", async ({ page }) => {
  await openEditor(page)
  await openFile(page, fixture("benzene-R1-anywhere.structura"))
  await page.getByLabel("R1 重复出现").check()
  await page.getByLabel("最多次数").fill("2")
  await page.getByRole("button", { name: "批量生成化合物…" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("得到 12 个不同的化合物")
  const compounds = dialog.getByTestId("enumerated-compound")
  await expect(compounds).toHaveCount(12)
  await expect(compounds.nth(1)).toContainText("R1 = ")

  // Cl alone, Cl2 (o, m, p) and ClF (o, m, p): 7 of the 12 hold chlorine.
  await dialog.getByLabel("筛选生成的化合物").fill("Cl")
  await expect(dialog.getByTestId("filter-count")).toHaveText("7 / 12")
  await expect(compounds).toHaveCount(7)

  const download = page.waitForEvent("download")
  await dialog.getByRole("button", { name: "CSV" }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe("benzene-R1-anywhere 展开.csv")
  const lines = (await readFile((await file.path())!, "utf8")).replace(/^﻿/, "").trim().split("\n")
  expect(lines[0]).toBe("No,SMILES,Formula,MW,R1 position,R1")
  expect(lines).toHaveLength(1 + 7)
  expect(lines.slice(1).every((line) => line.includes("Cl"))).toBe(true)

  const before = (await doc(page)).molecule.atoms.length
  await compounds.first().hover()
  await compounds.first().getByRole("button", { name: "放到画布" }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(async () => (await doc(page)).molecule.atoms.length).toBeGreaterThan(before)
})

test("an attachment drawn into one ring of carbazole widens to the whole fused system; symmetric repeats are merged", async ({ page }) => {
  await openEditor(page)
  await openFile(page, fixture("carbazole-R1-one-ring.structura"))
  await expect(page.getByTestId("library-size")).toContainText("可展开为 4 种组合")
  await page.getByRole("button", { name: /扩大到整个稠环体系（9 个位置）/ }).click()
  await expect.poll(async () => (await doc(page)).attachments?.[0]?.to.length).toBe(9)
  await expect(page.getByTestId("library-size")).toContainText("可展开为 9 种组合")
  await page.getByRole("button", { name: "批量生成化合物…" }).click()
  // Carbazole is symmetric: 1/8, 2/7, 3/6, 4/5 are the same, so nine positions are five compounds.
  await expect(page.getByRole("dialog")).toContainText("得到 5 个不同的化合物（合并了 4 个重复的）")
})

test("two formulas on one page are generated each on its own, labelled 式 1 and 式 2", async ({ page }) => {
  await openEditor(page)
  await openFile(page, fixture("two-formulas.structura"))
  await expect(page.getByTestId("library-size")).toContainText("可展开为 4 种组合")
  await page.getByRole("button", { name: "批量生成化合物…" }).click()
  const compounds = page.getByRole("dialog").getByTestId("enumerated-compound")
  await expect(compounds).toHaveCount(4)
  await expect(compounds.filter({ hasText: "式 1" })).toHaveCount(2)
  await expect(compounds.filter({ hasText: "式 2" })).toHaveCount(2)
})

test("a proviso written in the panel takes its combination out of what is generated", async ({ page }) => {
  await openEditor(page)
  await openFile(page, fixture("benzene-R1-R2.structura"))
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
  await page.getByRole("button", { name: "批量生成化合物…" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("按附加条件排除了 1 个")
  // Of four combinations, one is out; the two R1/R2 = H/Cl swaps are the same chlorobenzene.
  await expect(dialog).toContainText("得到 2 个不同的化合物")
})
