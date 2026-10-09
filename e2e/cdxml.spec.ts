import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { menu, openEditor } from "./support.ts"

// 文件 → 导出 CDXML: a generic formula for ChemDraw, its marks as ChemDraw's own objects and
// its definitions as text under it.

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
  // The host gets the same file through the handle.
  expect(await page.evaluate(() => (window as unknown as { __structura: Handle }).__structura.getCdxml())).toBe(text)
})
