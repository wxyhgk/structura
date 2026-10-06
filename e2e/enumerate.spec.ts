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
