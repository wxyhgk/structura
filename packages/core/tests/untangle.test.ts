import assert from "node:assert/strict"
import test from "node:test"
import { build, closestPair, run } from "@structura/testkit"
import { dist } from "../src/geometry.ts"
import { atomById, untangleGroups } from "../src/molecule.ts"
import type { Molecule } from "../src/types.ts"

const ring = { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" } as const

/** Benzene with Bn and Ph on neighbouring atoms, drawn out, Ph swung onto the benzyl ring. */
function crowded(): Molecule {
  const drawing = build([ring, { op: "add_group", to: 1, name: "Bn" }, { op: "add_group", to: 2, name: "Ph" }, { op: "set_collapsed", collapsed: false }])
  const mol = drawing.molecule
  const bn = mol.groups.find((group) => group.label === "Bn")!
  const ph = mol.groups.find((group) => group.label === "Ph")!
  // Lay the phenyl on the benzyl's ring, as templates placed side by side can land.
  const target = atomById(mol, bn.atoms.at(-1)!)!
  const from = atomById(mol, ph.atoms.at(-1)!)!
  return run(drawing, [{ op: "move", atoms: ph.atoms, dx: target.x - from.x, dy: target.y - from.y }]).molecule
}

const lengths = (mol: Molecule, ids: Set<number>) =>
  mol.bonds.filter((bond) => ids.has(bond.a) && ids.has(bond.b)).map((bond) => dist(atomById(mol, bond.a)!, atomById(mol, bond.b)!))

test("groups drawn on top of each other are moved apart; nothing else moves and the groups keep their shape", () => {
  const mol = crowded()
  assert.ok(closestPair(mol) < 10, "the test starts with atoms on top of each other")
  const grouped = new Set(mol.groups.flatMap((group) => group.atoms))
  const tidy = untangleGroups(mol, mol.groups.map((group) => group.id))
  assert.ok(closestPair(tidy) >= 0.5 * 40, `closest pair ${closestPair(tidy)}`)
  for (const atom of mol.atoms.filter((item) => !grouped.has(item.id))) assert.deepEqual(atomById(tidy, atom.id), atom)
  for (const group of mol.groups) {
    const before = lengths(mol, new Set(group.atoms))
    lengths(tidy, new Set(group.atoms)).forEach((length, index) => assert.ok(Math.abs(length - before[index]) < 1e-6, group.label))
  }
})

test("a molecule with nothing overlapping, or no group to move, comes back as it was", () => {
  const mol = build([ring, { op: "add_group", to: 1, name: "Ph" }, { op: "set_collapsed", collapsed: false }]).molecule
  assert.equal(untangleGroups(mol, mol.groups.map((group) => group.id)), mol)
  const stuck = crowded()
  assert.equal(untangleGroups(stuck, []), stuck)
})
