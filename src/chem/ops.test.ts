import assert from "node:assert/strict"
import test from "node:test"
import { plainFormula } from "./formula.ts"
import { applyHotkey } from "./hotkeys.ts"
import { atomById, bondById, createBondAt, emptyMolecule } from "./molecule.ts"
import { applyOps, type Op } from "./ops.ts"
import type { Molecule } from "./types.ts"
import { validate } from "./validate.ts"

const SINGLE = { order: 1 as const, stereo: "none" as const }

function ok(mol: Molecule, ops: Op[]) {
  const result = applyOps(mol, ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index}: ${result.error}`)
  return result
}

test("a molecule can be built from nothing with named atoms", () => {
  const acid = ok(emptyMolecule(), [
    { op: "add_atom", el: "C", as: "methyl" },
    { op: "add_atom", el: "C", to: "methyl", as: "carboxyl" },
    { op: "add_atom", el: "O", to: "carboxyl", order: 2 },
    { op: "add_atom", el: "O", to: "carboxyl", as: "hydroxyl" },
  ])
  assert.equal(plainFormula(acid.mol), "C2H4O2")
  assert.deepEqual(Object.keys(acid.names), ["methyl", "carboxyl", "hydroxyl"])
  assert.equal(atomById(acid.mol, acid.names.hydroxyl)?.el, "O")
  assert.deepEqual(validate(acid.mol), [])
})

test("a batch is all or nothing and says which op failed", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const result = applyOps(start, [
    { op: "set_element", atom: 1, el: "N" },
    { op: "set_element", atom: 99, el: "O" },
  ])
  assert.equal(result.ok, false)
  assert.equal(result.mol, start)
  if (!result.ok) {
    assert.equal(result.index, 1)
    assert.match(result.error, /#99/)
  }
})

test("mistakes are reported instead of guessed at", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const cases: Array<[Op[], RegExp]> = [
    [[{ op: "add_atom", el: "C", to: "nobody" }], /no atom is named "nobody"/],
    [[{ op: "add_atom", el: "Xx", to: 1 }], /not an element/],
    [[{ op: "add_atom", el: "C", to: 1, as: "a" }, { op: "add_atom", el: "C", to: 2, as: "a" }], /already used/],
    [[{ op: "add_bond", a: 1, b: 2 }], /already bonded/],
    [[{ op: "set_charge", atom: 1, charge: 5 }], /outside/],
    [[{ op: "set_bond", bond: { between: [1, 1] }, order: 2 }], /not bonded/],
    [[{ op: "set_bond", bond: 1, order: 2, stereo: "up" }], /single bond/],
    [[{ op: "add_ring", atom: 1, size: 9 }], /no ring of size 9/],
    [[{ op: "add_ring", atom: 1, size: 5, aromatic: true }], /six-membered/],
    [[{ op: "add_group", to: 1, name: "Zzz" }], /not a known abbreviation/],
    [[{ op: "hotkey", atom: 1, key: "§" }], /does nothing/],
  ]
  for (const [ops, message] of cases) {
    const result = applyOps(start, ops)
    assert.equal(result.ok, false, JSON.stringify(ops))
    if (!result.ok) assert.match(result.error, message)
    assert.equal(result.mol, start)
  }
})

test("rings, groups and labels go through the same code as the editor", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const built = ok(start, [
    { op: "add_ring", atom: 2, size: 6, aromatic: true, as: "para" },
    { op: "add_group", to: "para", name: "Boc" },
  ])
  assert.equal(plainFormula(built.mol), "C12H16O2", "toluene, since the end carbon joins the ring, with Boc para")

  const fused = ok(start, [{ op: "add_ring", bond: 1, size: 6, aromatic: true }])
  assert.equal(plainFormula(fused.mol), "C6H6")

  const labelled = ok(start, [{ op: "label", atom: 2, text: "OMe" }])
  assert.equal(plainFormula(labelled.mol), "C2H6O")
})

test("a hotkey op gives exactly what pressing the key gives", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  for (const key of ["1", "2", "6", "K", "N", "a"]) {
    const direct = applyHotkey(start, { type: "atom", id: 2 }, key)
    const viaOps = ok(start, [{ op: "hotkey", atom: 2, key }])
    assert.deepEqual(viaOps.mol, direct?.mol, key)
    assert.deepEqual(viaOps.next, direct?.next, key)
  }
})

test("a wedge named by its atoms starts at the first one", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const wedged = ok(start, [{ op: "set_bond", bond: { between: [2, 1] }, stereo: "up" }])
  assert.equal(bondById(wedged.mol, 1)?.a, 2)
  assert.equal(bondById(wedged.mol, 1)?.stereo, "up")
})

test("warnings come back but do not stop the edit", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const crowded = ok(start, [
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "C", to: 1 },
  ])
  assert.deepEqual(crowded.problems.map((problem) => problem.code), ["valence"])
})

/** Small deterministic generator so a failure always replays the same way. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

test("random batches either apply cleanly or change nothing", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const next = random(seed)
    const pick = <T,>(list: T[]): T => list[Math.floor(next() * list.length)]
    let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
    for (let step = 0; step < 40; step++) {
      // Some refs point at atoms that do not exist, on purpose.
      const ref = () => (next() < 0.9 && mol.atoms.length > 0 ? pick(mol.atoms).id : 9999)
      const bondRef = () => (next() < 0.9 && mol.bonds.length > 0 ? pick(mol.bonds).id : 9999)
      const ops: Op[] = Array.from({ length: 1 + Math.floor(next() * 3) }, (): Op => {
        switch (Math.floor(next() * 10)) {
          case 0:
            return { op: "add_atom", el: pick(["C", "N", "O", "S"]), to: ref(), order: pick([1, 2] as const) }
          case 1:
            return { op: "set_element", atom: ref(), el: pick(["C", "N", "O", "Cl"]) }
          case 2:
            return { op: "set_charge", atom: ref(), charge: pick([-1, 0, 1]) }
          case 3:
            return { op: "set_bond", bond: bondRef(), order: pick([1, 2, 3] as const) }
          case 4:
            return { op: "remove", atoms: [ref()] }
          case 5:
            return { op: "add_ring", atom: ref(), size: pick([3, 5, 6]), aromatic: next() < 0.3 }
          case 6:
            return { op: "add_ring", bond: bondRef(), size: pick([5, 6]) }
          case 7:
            return { op: "add_group", to: ref(), name: pick(["Me", "Ph", "Boc", "OMe", "NO2", "SO2"]) }
          case 8:
            return { op: "hotkey", atom: ref(), key: pick(["1", "2", "9", "K", "o", "N", "6"]) }
          default:
            return { op: "rotate", atoms: mol.atoms.map((atom) => atom.id), angle: next() }
        }
      })
      const result = applyOps(mol, ops)
      if (result.ok) {
        assert.deepEqual(validate(result.mol).filter((problem) => problem.severity === "error"), [], `seed ${seed} step ${step}`)
        mol = result.mol
      } else {
        assert.equal(result.mol, mol, `seed ${seed} step ${step}: a failed batch must not change anything`)
      }
      if (mol.atoms.length === 0) mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
    }
  }
})
