import assert from "node:assert/strict"
import test from "node:test"
import { BOND_LENGTH } from "../src/constants.ts"
import { emptyDrawing } from "../src/drawing.ts"
import { angleTo, norm, pointInPolygon, signedDelta } from "../src/geometry.ts"
import { smallestRings } from "../src/molecule/cycles.ts"
import { applyOps, type Op } from "../src/ops.ts"
import { freeSites, scaffolds } from "../src/scaffolds.ts"
import type { Drawing, Molecule, Point } from "../src/types.ts"

function drawn(ops: Op[]): Drawing {
  const result = applyOps(emptyDrawing(), ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index}: ${result.error}`)
  return result.drawing
}

/** Why the atom is badly placed: inside a ring, on top of another atom, or not pointing away from its ring neighbours. */
function misplaced(mol: Molecule, id: number, host: number): string | null {
  const at = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  const atom = at.get(id)!
  for (const ring of smallestRings(mol)) {
    if (pointInPolygon(atom, ring.map((member) => at.get(member)!))) return `inside ring ${ring.join(",")}`
  }
  const close = mol.atoms.find((other) => other.id !== id && Math.hypot(other.x - atom.x, other.y - atom.y) < 0.6 * BOND_LENGTH)
  if (close) return `on top of atom #${close.id}`
  // Along the middle of the sector it went into, and that sector is not inside a ring.
  const center = at.get(host)!
  const direction = (point: Point) => norm(angleTo(center, point))
  const out = direction(atom)
  const around = mol.bonds
    .filter((bond) => (bond.a === host || bond.b === host) && bond.a !== id && bond.b !== id)
    .map((bond) => direction(at.get(bond.a === host ? bond.b : bond.a)!))
    .sort((x, y) => x - y)
  if (around.length < 2) return null
  const after = around.findIndex((angle) => angle > out)
  const end = after === -1 ? around[0] + 2 * Math.PI : around[after]
  const start = after <= 0 ? around.at(-1)! - (after === 0 ? 2 * Math.PI : 0) : around[after - 1]
  const off = Math.abs(signedDelta((start + end) / 2, out))
  if (off > (15 * Math.PI) / 180) return `off the exterior bisector by ${((off * 180) / Math.PI).toFixed(0)}°`
  return null
}

/** Adds a carbon to each atom of the drawing in turn; what is wrong with each one placed. */
function sproutEach(label: string, drawing: Drawing): string[] {
  const failures: string[] = []
  for (const atom of drawing.molecule.atoms) {
    const result = applyOps(drawing, [{ op: "add_atom", el: "C", to: atom.id }])
    assert.ok(result.ok, result.ok ? "" : result.error)
    const mol = result.drawing.molecule
    const why = misplaced(mol, mol.atoms.at(-1)!.id, atom.id)
    if (why) failures.push(`${label} #${atom.id}: ${why}`)
  }
  return failures
}

// Fusion atoms count too: between two six-membered rings their three sectors are equal,
// and the new bond used to take whichever came first, often one inside a ring.
test("a bond added to any atom of a scaffold, fusion atoms included, points outward", () => {
  const failures = scaffolds().flatMap((scaffold) => sproutEach(scaffold.name, drawn([{ op: "add_scaffold", name: scaffold.name }])))
  assert.deepEqual(failures, [])
})

test("a bond added to a hand-fused ring system points outward", () => {
  const systems: Record<string, Op[]> = {
    decalin: [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "cyclohexane" }, { op: "add_ring", bond: { between: [1, 2] }, kind: "cyclohexane" }],
    indane: [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_ring", bond: { between: [1, 2] }, kind: "cyclopentane" }],
    naphthalene: [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_ring", bond: { between: [3, 4] }, kind: "benzene" }],
  }
  const failures = Object.entries(systems).flatMap(([name, ops]) => sproutEach(name, drawn(ops)))
  assert.deepEqual(failures, [])
})

/** New atoms (beyond the first `before`) that land inside an old ring or on top of another atom. */
function clashes(mol: Molecule, before: number): string[] {
  const at = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  const old = new Set(mol.atoms.slice(0, before).map((atom) => atom.id))
  const rings = smallestRings(mol).filter((ring) => ring.every((id) => old.has(id)))
  const out: string[] = []
  for (const atom of mol.atoms.slice(before)) {
    if (rings.some((ring) => pointInPolygon(atom, ring.map((id) => at.get(id)!)))) out.push(`#${atom.id} inside a ring`)
    const close = mol.atoms.find((other) => other.id !== atom.id && Math.hypot(other.x - atom.x, other.y - atom.y) < 0.6 * BOND_LENGTH)
    if (close) out.push(`#${atom.id} on #${close.id}`)
  }
  return out
}

const GROWTHS: Record<string, (to: string) => Op[]> = {
  chain: (to) => [
    { op: "add_atom", el: "C", to, as: "a" },
    { op: "add_atom", el: "C", to: "a", as: "b" },
    { op: "add_atom", el: "C", to: "b" },
  ],
  ring: (to) => [{ op: "add_ring", atom: to, kind: "benzene" }],
  ethyl: (to) => [{ op: "add_group", to, name: "Et" }],
  boc: (to) => [{ op: "add_group", to, name: "Boc" }],
  nitro: (to) => [{ op: "add_recipe", to, name: "nitro" }],
  methoxy: (to) => [{ op: "add_recipe", to, name: "methoxy" }],
  tbu: (to) => [{ op: "add_recipe", to, name: "tert-butyl" }],
  scaffold: (to) => [{ op: "add_scaffold", name: "benzene", site: "C1", to }],
}

test("whatever grows from a free ring position stays out of the rings", () => {
  const failures: string[] = []
  for (const scaffold of scaffolds()) {
    for (const site of freeSites(scaffold)) {
      for (const [what, grow] of Object.entries(GROWTHS)) {
        const result = applyOps(emptyDrawing(), [{ op: "add_scaffold", name: scaffold.name, as: "s" }, ...grow(`s.${site}`)])
        if (!result.ok) continue
        const why = clashes(result.drawing.molecule, scaffold.molecule.atoms.length)
        if (why.length) failures.push(`${scaffold.name} ${site} ${what}: ${why.join("; ")}`)
      }
    }
  }
  assert.deepEqual(failures, [])
})
