import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "../src/drawing.ts"
import { plainFormula } from "../src/formula.ts"
import { angleTo } from "../src/geometry.ts"
import { atomById } from "../src/molecule.ts"
import { applyOps, type Op, type Replacement } from "../src/ops.ts"
import type { Molecule } from "../src/types.ts"
import { closestPair } from "@structura/testkit"

function build(ops: Op[], start: Molecule | null = null) {
  const result = applyOps(start ? { ...emptyDrawing(), molecule: start } : emptyDrawing(), ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index}: ${result.error}`)
  return result
}

/** Toluene: benzene (atoms 1 to 6) with a methyl on atom 1. */
function toluene() {
  const result = build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "me" },
  ])
  return { mol: result.drawing.molecule, me: result.names.me, ipso: 1 }
}

test("a methyl is swapped for a label, a ring or a recipe, and nothing else moves", () => {
  const cases: Array<[Replacement, string]> = [
    [{ label: "OMe" }, "C7H8O"],
    [{ label: "Ph" }, "C12H10"],
    [{ label: "Boc" }, "C11H14O2"],
    [{ ring: "cyclohexane" }, "C12H16"],
    [{ recipe: "nitro" }, "C6H5NO2"],
  ]
  for (const [piece, formula] of cases) {
    const { mol, me, ipso } = toluene()
    const out = build([{ op: "replace", atoms: [me], with: piece, as: "new" }], mol)
    const next = out.drawing.molecule
    assert.equal(plainFormula(next), formula, JSON.stringify(piece))
    for (const atom of mol.atoms.filter((item) => item.id !== me)) assert.deepEqual(atomById(next, atom.id), atom, "the ring stays put")
    assert.ok(closestPair(next) > 0.6 * 40, `${JSON.stringify(piece)}: closest pair ${closestPair(next).toFixed(1)}`)
    assert.ok(next.bonds.some((bond) => [bond.a, bond.b].includes(ipso) && [bond.a, bond.b].includes(out.names.new)), "named piece hangs off the ring")
  }
})

test("the new piece points the way the old one did", () => {
  const { mol, me, ipso } = toluene()
  const before = angleTo(atomById(mol, ipso)!, atomById(mol, me)!)
  const out = build([{ op: "replace", atoms: [me], with: { label: "Cl" }, as: "cl" }], mol)
  const next = out.drawing.molecule
  const after = angleTo(atomById(next, ipso)!, atomById(next, out.names.cl)!)
  assert.ok(Math.abs(after - before) < 0.05)
  assert.equal(plainFormula(next), "C6H5Cl")
})

test("a whole substituent of several atoms is replaced as one", () => {
  const start = build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "a" },
    { op: "add_atom", el: "C", to: "a", as: "b" },
  ])
  const { a, b } = start.names
  const out = build([{ op: "replace", atoms: [a, b], with: { label: "OMe" } }], start.drawing.molecule)
  assert.equal(plainFormula(out.drawing.molecule), "C7H8O")
})

test("a free-standing molecule is replaced where it stood", () => {
  const start = build([{ op: "place_atom", el: "C", at: { x: 200, y: 100 } }, { op: "add_atom", el: "C", to: 1 }])
  const centre = { x: (start.drawing.molecule.atoms[0].x + start.drawing.molecule.atoms[1].x) / 2, y: (start.drawing.molecule.atoms[0].y + start.drawing.molecule.atoms[1].y) / 2 }
  const out = build([{ op: "replace", atoms: [1, 2], with: { ring: "benzene" } }], start.drawing.molecule)
  const next = out.drawing.molecule
  assert.equal(plainFormula(next), "C6H6")
  const x = next.atoms.reduce((sum, atom) => sum + atom.x, 0) / next.atoms.length
  const y = next.atoms.reduce((sum, atom) => sum + atom.y, 0) / next.atoms.length
  assert.ok(Math.hypot(x - centre.x, y - centre.y) < 1)
})

test("a fragment joined by two bonds, or nothing, is refused", () => {
  const { mol } = toluene()
  const ring = mol.atoms.filter((atom) => atom.el === "C").slice(0, 2).map((atom) => atom.id)
  const both = applyOps({ ...emptyDrawing(), molecule: mol }, [{ op: "replace", atoms: ring, with: { label: "O" } }])
  assert.ok(!both.ok && /joined to the rest by \d bonds/.test(both.error))
  const none = applyOps({ ...emptyDrawing(), molecule: mol }, [{ op: "replace", atoms: [], with: { label: "O" } }])
  assert.ok(!none.ok)
  const blank = applyOps({ ...emptyDrawing(), molecule: mol }, [{ op: "replace", atoms: [ring[0]], with: { label: " " } }])
  assert.ok(!blank.ok)
})
