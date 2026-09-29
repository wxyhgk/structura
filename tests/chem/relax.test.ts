import assert from "node:assert/strict"
import test from "node:test"
import { dist } from "../../src/chem/geometry.ts"
import { atomById, emptyMolecule, neighbors } from "../../src/chem/molecule.ts"
import { relax } from "../../src/chem/molecule/relax.ts"
import { applyOps, type Op } from "../../src/chem/ops.ts"
import type { Molecule } from "../../src/chem/types.ts"

function build(ops: Op[], start = emptyMolecule()): Molecule {
  const result = applyOps(start, ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index}: ${result.error}`)
  return result.mol
}

/** A zigzag chain of `length` carbons, ids 1…length. */
function chain(length: number): Molecule {
  const ops: Op[] = [{ op: "place_atom", el: "C", at: { x: 0, y: 0 } }]
  for (let id = 1; id < length; id++) ops.push({ op: "add_atom", el: "C", to: id })
  return build(ops)
}

/** Moves atoms by a fixed, uneven pattern so tests do not depend on randomness. */
function scramble(mol: Molecule, amount: number, only?: number[]): Molecule {
  return {
    ...mol,
    atoms: mol.atoms.map((atom, index) =>
      only && !only.includes(atom.id)
        ? atom
        : { ...atom, x: atom.x + amount * Math.sin(index * 2.1 + 0.3), y: atom.y + amount * Math.cos(index * 1.7 + 1.1) },
    ),
  }
}

const ids = (mol: Molecule) => mol.atoms.map((atom) => atom.id)

/** Cleaning the whole drawing keeps its scale: the target is its median bond. */
function medianBond(mol: Molecule): number {
  const sorted = bondLengths(mol).sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function assertBondsNear(mol: Molecule, target: number) {
  for (const length of bondLengths(mol)) assert.ok(Math.abs(length - target) / target < 0.05, `bond ${length} vs ${target}`)
}

function bondLengths(mol: Molecule): number[] {
  return mol.bonds.map((bond) => dist(atomById(mol, bond.a)!, atomById(mol, bond.b)!))
}

/** The angle at `centre` between two of its neighbours, in degrees. */
function angle(mol: Molecule, a: number, centre: number, b: number): number {
  const c = atomById(mol, centre)!
  const p = atomById(mol, a)!
  const q = atomById(mol, b)!
  const turn = Math.atan2(q.y - c.y, q.x - c.x) - Math.atan2(p.y - c.y, p.x - c.x)
  return (Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) * 180) / Math.PI
}

function closestPair(mol: Molecule): number {
  let best = Infinity
  for (const [index, a] of mol.atoms.entries()) for (const b of mol.atoms.slice(index + 1)) best = Math.max(0, Math.min(best, dist(a, b)))
  return best
}

test("a scrambled chain comes back to even bonds and 120° angles", () => {
  const mol = scramble(chain(8), 12)
  const cleaned = relax(mol, { atoms: ids(mol) })
  assertBondsNear(cleaned, medianBond(mol))
  for (let id = 2; id < 8; id++) assert.ok(Math.abs(angle(cleaned, id - 1, id, id + 1) - 120) < 5, `angle at ${id}`)
})

test("a scrambled ring becomes a regular polygon, substituents outside it", () => {
  const ring = build([{ op: "add_ring", at: { x: 0, y: 0 }, size: 5 }])
  const withMethyl = build([{ op: "add_atom", el: "C", to: 1 }], ring)
  const messy = scramble(withMethyl, 10)
  const cleaned = relax(messy, { atoms: ids(messy) })
  for (let id = 1; id <= 5; id++) {
    const before = id === 1 ? 5 : id - 1
    const after = id === 5 ? 1 : id + 1
    assert.ok(Math.abs(angle(cleaned, before, id, after) - 108) < 4, `ring angle at ${id}`)
  }
  assert.ok(Math.abs(angle(cleaned, 6, 1, 2) - 126) < 5)
  assert.ok(Math.abs(angle(cleaned, 6, 1, 5) - 126) < 5)
  assertBondsNear(cleaned, medianBond(messy))
})

test("atoms drawn on top of each other are pushed apart", () => {
  // Folding the end of the chain back puts atoms 6…9 onto 2…5.
  const mol = chain(9)
  const folded = {
    ...mol,
    atoms: mol.atoms.map((atom) => {
      if (atom.id < 6) return atom
      const twin = atomById(mol, atom.id - 4)!
      return { ...atom, x: twin.x, y: twin.y }
    }),
  }
  assert.equal(closestPair(folded), 0)
  const cleaned = relax(folded, { atoms: ids(mol) })
  assert.ok(closestPair(cleaned) > 0.8 * 40, `closest ${closestPair(cleaned)}`)
  assertBondsNear(cleaned, 40)
})

test("only the free atoms move; fixed and locked ones stay exactly", () => {
  const mol = scramble(chain(8), 10)
  const cleaned = relax(mol, { atoms: [4, 5, 6], locked: [6] })
  for (const atom of cleaned.atoms) {
    if (atom.id === 4 || atom.id === 5) continue
    assert.deepEqual(atom, atomById(mol, atom.id))
  }
  assert.notDeepEqual(atomById(cleaned, 4), atomById(mol, 4))
})

test("a clean drawing is left as it is", () => {
  const mol = build([
    { op: "add_ring", at: { x: 0, y: 0 }, size: 6, aromatic: true },
    { op: "add_atom", el: "C", to: 1, as: "a" },
    { op: "add_atom", el: "O", to: "a" },
    { op: "add_atom", el: "N", to: 3 },
  ])
  const cleaned = relax(mol, { atoms: ids(mol) })
  for (const atom of cleaned.atoms) assert.ok(dist(atom, atomById(mol, atom.id)!) < 0.5, `atom ${atom.id} moved`)
})

test("fused rings keep both rings regular", () => {
  const naphthalene = build([
    { op: "add_ring", at: { x: 0, y: 0 }, size: 6 },
    { op: "add_ring", bond: { between: [1, 2] }, size: 6 },
  ])
  const messy = scramble(naphthalene, 8)
  const cleaned = relax(messy, { atoms: ids(messy) })
  assertBondsNear(cleaned, medianBond(messy))
  for (const atom of cleaned.atoms) {
    const around = neighbors(cleaned, atom.id)
    if (around.length === 2) assert.ok(Math.abs(angle(cleaned, around[0].id, atom.id, around[1].id) - 120) < 5)
  }
})

test("a wedge keeps meaning the same stereoisomer", () => {
  // A centre whose two plain neighbours start almost on top of each other.
  let mol = build([
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "O", to: 1 },
    { op: "set_bond", bond: { between: [1, 4] }, stereo: "up" },
  ])
  mol = { ...mol, atoms: mol.atoms.map((atom) => (atom.id === 3 ? { ...atom, x: 40, y: 3 } : atom.id === 2 ? { ...atom, x: 40, y: -3 } : atom)) }
  // With three neighbours, which way round they go is what the wedge's meaning rests on.
  const orientation = (m: Molecule) => {
    const [c, a, b, o] = [1, 2, 3, 4].map((id) => atomById(m, id)!)
    const turn = (p: typeof a) => Math.atan2(p.y - c.y, p.x - c.x)
    const sorted = [a, b, o].sort((p, q) => turn(p) - turn(q)).map((p) => p.id)
    const start = sorted.indexOf(2)
    return [...sorted.slice(start), ...sorted.slice(0, start)].join()
  }
  const cleaned = relax(mol, { atoms: ids(mol) })
  assert.equal(orientation(cleaned), orientation(mol))
  assert.ok(Math.abs(angle(cleaned, 2, 1, 3) - 120) < 10)
})

test("a group moves as one rigid piece", () => {
  const mol = build([
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_group", to: 2, name: "Ph" },
  ])
  assert.equal(mol.groups.length, 1)
  const members = mol.groups[0].atoms
  const messy = scramble(mol, 15, [1])
  const cleaned = relax(messy, { atoms: ids(mol) })
  for (const a of members) {
    for (const b of members) {
      const before = dist(atomById(messy, a)!, atomById(messy, b)!)
      assert.ok(Math.abs(dist(atomById(cleaned, a)!, atomById(cleaned, b)!) - before) < 1e-6)
    }
  }
})

test("the same input always gives the same drawing", () => {
  const mol = scramble(build([{ op: "add_ring", at: { x: 0, y: 0 }, size: 7 }, { op: "add_atom", el: "C", to: 3 }]), 14)
  assert.deepEqual(relax(mol, { atoms: ids(mol) }), relax(mol, { atoms: ids(mol) }))
})
