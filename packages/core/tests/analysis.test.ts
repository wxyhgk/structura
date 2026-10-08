import assert from "node:assert/strict"
import test from "node:test"
import { elementalAnalysis, exactMass, netCharge } from "@structura/core/analysis"
import { build } from "@structura/testkit"

const close = (actual: number | null, expected: number, digits = 5) => assert.ok(actual != null && Math.abs(actual - expected) < 10 ** -digits, `${actual} ≠ ${expected}`)

test("exact masses as HRMS reports them: ethanol, benzene, chlorobenzene, and a drawn 13C", () => {
  const ethanol = build([{ op: "add_atom", el: "C", as: "a" }, { op: "add_atom", el: "C", to: "a", as: "b" }, { op: "add_atom", el: "O", to: "b" }]).molecule
  close(exactMass(ethanol), 46.041865)
  const benzene = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule
  close(exactMass(benzene), 78.04695)
  const chloro = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_atom", el: "Cl", to: 1 }]).molecule
  close(exactMass(chloro), 112.007978)
  const labelled = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "set_isotope", atom: 1, isotope: 13 }]).molecule
  close(exactMass(labelled)! - exactMass(benzene)!, 1.003355)
  // Only the selected atoms count: one CH of benzene.
  close(exactMass(benzene, [1]), 13.007825)
})

test("elemental analysis: benzene is 92.26% C and 7.74% H", () => {
  const benzene = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule
  const shares = elementalAnalysis(benzene).map(({ symbol, percent }) => `${symbol} ${percent.toFixed(2)}`)
  assert.deepEqual(shares, ["C 92.26", "H 7.74"])
  assert.deepEqual(elementalAnalysis(build([]).molecule), [])
})

test("the net charge adds up what is drawn", () => {
  const ammonium = build([{ op: "add_atom", el: "N", as: "n" }, { op: "set_charge", atom: "n", charge: 1 }]).molecule
  assert.equal(netCharge(ammonium), 1)
})
