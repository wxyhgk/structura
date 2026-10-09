import assert from "node:assert/strict"
import test from "node:test"
import { plainFormula } from "@structura/core/formula"
import type { Op } from "@structura/core/ops"
import type { Drawing, Molecule } from "@structura/core/types"
import { enumerate, librarySize, pickFields, repeatSkips } from "@structura/markush"
import { build, label, run } from "@structura/testkit"

// Brackets in a generic formula: a group bracket an attachment goes into (no meaning beyond
// the attachment), and a repeat unit [ … ]n written out for each n.

/** Naphthalene (atoms 1–10) and a methyl (11) attached at any of `to`, in a group bracket round the naphthalene when `bracketed`. */
function methylOnNaphthalene(bracketed: boolean): Drawing {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  return build([
    { op: "add_scaffold", name: "naphthalene", at: { x: 0, y: 0 } },
    { op: "place_atom", el: "C", at: { x: 200, y: 0 } },
    ...(bracketed ? [{ op: "add_bracket", atoms: all } as Op] : []),
    { op: "set_attachment", atom: 11, to: all },
  ])
}

test("an attachment into a group bracket enumerates as any attachment to those atoms", () => {
  const into = methylOnNaphthalene(true)
  const plain = methylOnNaphthalene(false)
  assert.equal(into.attachments?.[0].shape, undefined, "drawn into the bracket by itself, nothing stored")
  const a = enumerate(into)
  const b = enumerate(plain)
  assert.equal(a.molecules.length, 8, "every CH of naphthalene; the two fusion carbons have no hydrogen")
  assert.equal(a.occupied, 2)
  assert.deepEqual(a.molecules.map((mol) => plainFormula(mol)), b.molecules.map((mol) => plainFormula(mol)))
  assert.deepEqual(a.picks, b.picks)
  assert.equal(librarySize(into).combinations, 8)
  assert.equal(librarySize(into).combinations, librarySize(plain).combinations)
  // Asked to be drawn into the bracket, the same.
  const asked = run(into, [{ op: "set_attachment_shape", atom: 11, shape: "bracket" }])
  assert.equal(enumerate(asked).molecules.length, 8)
})

/** CH3–[CH2]n–CH3: atoms 1–3 in a zigzag, the middle one in a repeat bracket counted `min`–`max` times. */
function propane(min: number, max: number, extra: Op[] = []): Drawing {
  return build([
    { op: "draw_chain", points: [{ x: 0, y: 0 }, { x: 35, y: -20 }, { x: 70, y: 0 }] },
    { op: "add_bracket", atoms: [2], kind: "repeat", repeat: { min, max, name: "n" } },
    ...extra,
  ])
}

/** The longest and shortest bond, and the closest two atoms not bonded to each other. */
function geometry(mol: Molecule) {
  const at = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  const lengths = mol.bonds.map((bond) => Math.hypot(at.get(bond.a)!.x - at.get(bond.b)!.x, at.get(bond.a)!.y - at.get(bond.b)!.y))
  const bonded = new Set(mol.bonds.flatMap((bond) => [`${bond.a} ${bond.b}`, `${bond.b} ${bond.a}`]))
  let closest = Infinity
  for (const a of mol.atoms) for (const b of mol.atoms) if (a.id < b.id && !bonded.has(`${a.id} ${b.id}`)) closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y))
  return { shortest: Math.min(...lengths), longest: Math.max(...lengths), closest }
}

test("–[CH2]n– with n = 1–3 writes the unit out head to tail: propane, butane, pentane, as a zigzag", () => {
  const drawing = propane(1, 3)
  const result = enumerate(drawing)
  assert.deepEqual(result.molecules.map((mol) => plainFormula(mol)), ["C3H8", "C4H10", "C5H12"])
  assert.deepEqual(result.picks.map((picks) => pickFields(picks)), [{ n: "1" }, { n: "2" }, { n: "3" }])
  assert.equal(librarySize(drawing).combinations, 3)
  for (const mol of result.molecules) {
    assert.equal(mol.bonds.length, mol.atoms.length - 1, "a chain, joined throughout")
    const { shortest, longest, closest } = geometry(mol)
    assert.ok(longest - shortest < 0.5, "every bond as long as drawn")
    assert.ok(closest > 50, "no atom on top of another: it keeps zigzagging")
  }
  // Pentane's ends: the last CH3 carried along past the third unit.
  const pentane = result.molecules[2]
  const xs = pentane.atoms.map((atom) => atom.x)
  assert.ok(Math.max(...xs) - Math.min(...xs) > 130)
})

test("a count from 0 leaves the unit out, its neighbours bonded directly", () => {
  const result = enumerate(propane(0, 1))
  assert.deepEqual(result.molecules.map((mol) => plainFormula(mol)), ["C2H6", "C3H8"])
  assert.deepEqual(result.picks.map((picks) => pickFields(picks)), [{ n: "0" }, { n: "1" }])
})

test("a variable inside a repeat unit chooses on its own in each copy; librarySize multiplies by every count", () => {
  // CH3–[CH(R1)]n–CH3, R1 = H or Cl, n = 1–2: 2 + 2 × 2 combinations.
  const drawing = propane(1, 2, [
    { op: "add_atom", el: "C", to: 2 },
    { op: "label", atom: 4, text: "R1" },
    { op: "remove_bracket", id: 1 },
    { op: "add_bracket", atoms: [2, 4], kind: "repeat", repeat: { min: 1, max: 2, name: "n" } },
    { op: "set_variable", name: "R1", alternatives: [label("H"), label("Cl")] },
  ])
  assert.equal(librarySize(drawing).combinations, 6)
  const result = enumerate(drawing)
  assert.equal(result.molecules.length, 6)
  assert.deepEqual(result.molecules.map((mol) => plainFormula(mol)).sort(), ["C3H7Cl", "C3H8", "C4H10", "C4H8Cl2", "C4H9Cl", "C4H9Cl"].sort())
  const twice = result.picks.find((picks) => picks.filter((pick) => pick.name === "R1").length === 2)!
  assert.deepEqual(twice[0], { name: "n", count: 2 }, "the count comes first")
})

test("a repeat bracket with other than two bonds through it is reported and counted once, as drawn", () => {
  // Isobutane's middle carbon in a repeat bracket: three bonds cross it.
  const drawing = build([
    { op: "draw_chain", points: [{ x: 0, y: 0 }, { x: 35, y: -20 }, { x: 70, y: 0 }] },
    { op: "add_atom", el: "C", to: 2 },
    { op: "add_bracket", atoms: [2], kind: "repeat" },
  ])
  assert.deepEqual(repeatSkips(drawing), [{ name: "n", bracket: 1, crossing: 3 }])
  const result = enumerate(drawing)
  assert.deepEqual(result.skippedRepeats, [{ name: "n", bracket: 1, crossing: 3 }])
  assert.deepEqual(result.molecules.map((mol) => plainFormula(mol)), ["C4H10"])
  assert.deepEqual(librarySize(drawing).skippedRepeats, result.skippedRepeats)
})

test("a repeat unit beside a variable elsewhere: each count with each choice, the count in the fields", () => {
  // R1–[CH2]n–CH3, R1 = Cl or Br, n = 1–2.
  const drawing = propane(1, 2, [
    { op: "label", atom: 1, text: "R1" },
    { op: "set_variable", name: "R1", alternatives: [label("Cl"), label("Br")] },
  ])
  const result = enumerate(drawing)
  assert.equal(librarySize(drawing).combinations, 4)
  assert.deepEqual(result.molecules.map((mol) => plainFormula(mol)), ["C2H5Cl", "C2H5Br", "C3H7Cl", "C3H7Br"])
  assert.deepEqual(pickFields(result.picks[3]), { n: "2", R1: "Br" })
})
