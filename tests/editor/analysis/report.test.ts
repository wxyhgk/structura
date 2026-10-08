import assert from "node:assert/strict"
import test from "node:test"
import { build } from "@structura/testkit"
import { reportFor } from "../../../src/editor/analysis/report.ts"

test("the analysis gives what an experimental section needs: ions with formulas, and the elemental analysis line", () => {
  const benzene = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule
  const report = reportFor(benzene, [])
  assert.equal(report.formula, "C6H6")
  assert.equal(report.weight.toFixed(2), "78.11")
  assert.equal(report.exact?.toFixed(4), "78.0470")
  assert.deepEqual(report.ions.map((ion) => `${ion.name} ${ion.formula} ${ion.mz.toFixed(4)}`), ["[M+H]⁺ C6H7 79.0542", "[M+Na]⁺ C6H6Na 101.0362", "[M−H]⁻ C6H5 77.0397"])
  assert.equal(report.hrmsLine, "HRMS (ESI) m/z: [M+H]+ calcd for C6H7 79.0542")
  assert.equal(report.analysisLine, "Anal. calcd for C6H6: C, 92.26; H, 7.74.")
})

test("a drawn cation is its own ion: no proton added", () => {
  const methylammonium = build([{ op: "add_atom", el: "N", as: "n" }, { op: "set_charge", atom: "n", charge: 1 }, { op: "add_atom", el: "C", to: "n" }]).molecule
  const report = reportFor(methylammonium, [])
  assert.equal(report.charge, 1)
  assert.deepEqual(report.ions.map((ion) => `${ion.name} ${ion.formula} ${ion.mz.toFixed(4)}`), ["[M]⁺ CH6N 32.0495"])
})
