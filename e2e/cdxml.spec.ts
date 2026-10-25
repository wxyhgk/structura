import { expect, type Page, test } from "@playwright/test"
import { readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { doc, drawnText, menu, openEditor, openFile } from "./support.ts"

// 文件 → 导出 CDXML: a generic formula for ChemDraw, its marks as ChemDraw's own objects and
// its definitions as text under it; 打开 brings the file back whole while it is unchanged.

type Handle = { run(ops: unknown[]): { ok: boolean }; getCdxml(): string }

test.beforeEach(async ({ page }) => openEditor(page))

test("a generic formula exports as CDXML: R1 anywhere on the ring, a repeat unit, and the definitions", async ({ page }) => {
  const ok = await page.evaluate(
    (ops) => (window as unknown as { __structura: Handle }).__structura.run(ops).ok,
    [
      { op: "add_ring", at: { x: 420, y: 300 }, kind: "benzene" },
      { op: "add_atom", el: "C", as: "r" },
      { op: "label", atom: "r", text: "R1" },
      { op: "move", atoms: ["r"], dx: 530, dy: 230 },
      { op: "set_attachment", atom: "r", to: [1, 2, 3, 4, 5, 6], repeat: { min: 0, max: 3, name: "m" } },
      { op: "add_atom", el: "O", to: 4, as: "o" },
      { op: "add_atom", el: "C", to: "o", as: "c" },
      { op: "add_atom", el: "C", to: "c" },
      { op: "add_bracket", atoms: ["c"], kind: "repeat" },
      { op: "set_variable", name: "R1", alternatives: [{ kind: "label", text: "H" }, { kind: "label", text: "Cl" }, { kind: "class", class: "alkyl", min: 1, max: 6 }] },
    ],
  )
  expect(ok).toBe(true)

  const download = page.waitForEvent("download")
  await menu(page, "文件", "导出 CDXML")
  const file = await download
  expect(file.suggestedFilename()).toMatch(/\.cdxml$/)
  const text = readFileSync((await file.path())!, "utf8")
  expect(text).toMatch(/^<\?xml/)
  expect(text).toContain('NodeType="GenericNickname" GenericNickname="R1"')
  expect(text).toMatch(/NodeType="VariableAttachment" Attachments="(\d+ ){5}\d+"/)
  expect(text).toContain('BracketUsage="SRU"')
  expect(text).toContain("R1 = H、Cl、取代或未取代的(C1–C6)烷基")
  expect(text).toContain("m = 0–3")
  expect(text).toContain("n = 1–4")
  // The host gets the same file through the handle, but for the Structura document kept in a comment.
  expect(text).toMatch(/<!--structura:v1:[\da-f]+:[A-Za-z\d+/=]+-->\n<\/CDXML>\n$/)
  expect(await page.evaluate(() => (window as unknown as { __structura: Handle }).__structura.getCdxml())).toBe(text.replace(/<!--structura:[^>]*-->\n/, ""))
})

/** Draws R1 on a ring with its alternatives and a proviso, exports CDXML and returns the file's path. */
async function exportFormula(page: Page): Promise<string> {
  const ok = await page.evaluate(
    (ops) => (window as unknown as { __structura: Handle }).__structura.run(ops).ok,
    [
      { op: "add_ring", at: { x: 420, y: 300 }, kind: "benzene" },
      { op: "add_atom", el: "C", to: 1, as: "r" },
      { op: "label", atom: "r", text: "R1" },
      { op: "set_variable", name: "R1", alternatives: [{ kind: "label", text: "H" }, { kind: "label", text: "Cl" }] },
      { op: "add_proviso", proviso: { kind: "compound", smiles: "Clc1ccccc1" } },
    ],
  )
  expect(ok).toBe(true)
  const download = page.waitForEvent("download")
  await menu(page, "文件", "导出 CDXML")
  return (await (await download).path())!
}

test("an exported CDXML opens again whole: the variable's alternatives and the proviso come back", async ({ page }) => {
  const path = await exportFormula(page)
  const before = await drawnText(page)
  await menu(page, "文件", "新建")
  await expect.poll(() => doc(page).then((drawing) => drawing.molecule.atoms.length)).toBe(0)
  // The download is saved without its name; opened under one, as a person would.
  const named = join(dirname(path), "formula-R1.cdxml")
  writeFileSync(named, readFileSync(path))
  await openFile(page, named)
  await expect.poll(() => drawnText(page)).toBe(before)
  expect(Object.keys((await doc(page)).variables ?? {})).toEqual(["R1"])
  await expect(page.getByTestId("document-title")).toHaveText(basename(named, ".cdxml"))
})

test("a CDXML changed after export is refused, with the reason, rather than read as it was", async ({ page }) => {
  const path = await exportFormula(page)
  // Moved in "ChemDraw": the first atom a few points to the right.
  const changed = readFileSync(path, "utf8").replace(/<n id="(\d+)" p="([\d.]+) /, (_, id: string, x: string) => `<n id="${id}" p="${Number(x) + 5} `)
  const moved = join(dirname(path), "moved.cdxml")
  writeFileSync(moved, changed)
  await menu(page, "文件", "新建")
  await openFile(page, moved)
  await expect(page.getByText(/导出后改过.*目前只能打开 Structura 导出且未改动的 CDXML/)).toBeVisible()
  expect((await doc(page)).molecule.atoms.length).toBe(0)
})
