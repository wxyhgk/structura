import assert from "node:assert/strict"
import test from "node:test"
import initRDKitModule from "@rdkit/rdkit"
import {
  BOND_LENGTH,
  addRing,
  attachRing,
  expandGroup,
  findRings,
  fuseRing,
  growBond,
  kekulize,
  moleculeFromMolfile,
  moleculeFromSmiles,
  moleculeSvg,
  relax,
  ringMembership,
  sideBySide,
  toMolfile,
  untangleGroups,
  type Molecule,
} from "../src/chem.ts"

const rdkit = await initRDKitModule()
rdkit.prefer_coordgen(true)

const EMPTY: Molecule = { atoms: [], bonds: [], groups: [], nextAtomId: 1, nextBondId: 1, nextGroupId: 1 }
const ORIGIN = { x: 0, y: 0 }

function length(mol: Molecule, a: number, b: number): number {
  const p = mol.atoms.find((atom) => atom.id === a)!
  const q = mol.atoms.find((atom) => atom.id === b)!
  return Math.hypot(p.x - q.x, p.y - q.y)
}

const bonded = (mol: Molecule, a: number, b: number) => mol.bonds.some((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a))

test("addRing draws a ring of the kind asked, every bond one bond long", () => {
  const mol = addRing(EMPTY, ORIGIN, "cyclohexane")
  assert.equal(mol.atoms.length, 6)
  assert.equal(mol.bonds.length, 6)
  for (const bond of mol.bonds) assert.ok(Math.abs(length(mol, bond.a, bond.b) - BOND_LENGTH) < 1e-6)
})

test("findRings and ringMembership find naphthalene's two rings and the two atoms they share", () => {
  const benzene = addRing(EMPTY, ORIGIN, "benzene")
  const naphthalene = fuseRing(benzene, benzene.bonds[0].id, "benzene")
  assert.equal(naphthalene.atoms.length, 10)
  const rings = findRings(naphthalene)
  assert.deepEqual(rings.map((ring) => ring.length), [6, 6])
  const shared = [...ringMembership(naphthalene)].filter(([, count]) => count === 2).map(([id]) => id)
  assert.deepEqual(shared.sort(), [benzene.bonds[0].a, benzene.bonds[0].b].sort())
  // Changing the map handed out leaves the next answer as it was.
  ringMembership(naphthalene).clear()
  assert.equal(ringMembership(naphthalene).size, 10)
})

test("fuseRing goes on the side asked of a lone bond, outside a ring, and refuses a bond that is not there", () => {
  const ethane = moleculeFromSmiles(rdkit, "CC")
  const bond = ethane.bonds[0].id
  const newAtoms = (mol: Molecule) => mol.atoms.filter((atom) => atom.id >= ethane.nextAtomId).map(({ x, y }) => [x, y])
  const one = newAtoms(fuseRing(ethane, bond, "cyclohexane", 1))
  const other = newAtoms(fuseRing(ethane, bond, "cyclohexane", -1))
  // The same ring mirrored in the bond (which lies level).
  assert.deepEqual(one.map(([x, y]) => [Math.round(x), Math.round(-y)]), other.map(([x, y]) => [Math.round(x), Math.round(y)]))
  // On a ring's bond the new ring goes outside it, whichever side is asked.
  const ring = addRing(EMPTY, ORIGIN, "cyclohexane")
  const fused = (side: 1 | -1) => fuseRing(ring, ring.bonds[0].id, "cyclohexane", side)
  assert.deepEqual(fused(1), fused(-1))
  assert.equal(findRings(fused(1)).length, 2)
  assert.throws(() => fuseRing(ring, 999, "benzene"), /no bond with id 999/)
})

test("attachRing hangs a ring off an atom by one bond and names its atoms", () => {
  const ring = addRing(EMPTY, ORIGIN, "cyclohexane")
  const at = ring.atoms[0].id
  const { molecule, ring: ids } = attachRing(ring, at, "benzene")
  assert.equal(ids.length, 6)
  assert.ok(bonded(molecule, at, ids[0]))
  assert.equal(findRings(molecule).length, 2)
  assert.throws(() => attachRing(ring, 999, "benzene"), /no atom with id 999/)
})

test("growBond adds an atom one bond away, with the element and order asked", () => {
  const ring = addRing(EMPTY, ORIGIN, "cyclohexane")
  const at = ring.atoms[0].id
  const { molecule, atom } = growBond(ring, at, { element: "O", order: 2 })
  assert.equal(molecule.atoms.find((item) => item.id === atom)?.el, "O")
  assert.equal(molecule.bonds.find((bond) => bonded({ ...molecule, bonds: [bond] }, at, atom))?.order, 2)
  assert.ok(Math.abs(length(molecule, at, atom) - BOND_LENGTH) < 1e-6)
  // Pointing out of the ring: further from its centre than the ring atom.
  const from = ring.atoms[0]
  const to = molecule.atoms.find((item) => item.id === atom)!
  assert.ok(Math.hypot(to.x, to.y) > Math.hypot(from.x, from.y))
})

test("expandGroup draws an abbreviation out atom by atom, and refuses one it does not know", () => {
  const ring = addRing(EMPTY, ORIGIN, "cyclohexane")
  const { molecule: grown, atom } = growBond(ring, ring.atoms[0].id)
  const boc = expandGroup(grown, atom, "Boc")
  // Boc is C(=O)OC(CH3)3, seven atoms: the end atom becomes its carbonyl carbon.
  assert.equal(boc.atoms.length, grown.atoms.length + 6)
  assert.equal(boc.atoms.find((item) => item.id === atom)?.el, "C")
  assert.ok(boc.groups.length > 0 && boc.groups.every((group) => !group.collapsed))
  assert.throws(() => expandGroup(grown, atom, "Xyz"), /unknown abbreviation "Xyz"/)
})

test("relax brings a pulled atom back towards an even bond length, and moves only the atoms listed", () => {
  const ring = addRing(EMPTY, ORIGIN, "cyclohexane")
  const [first, ...rest] = ring.atoms
  const pulled = { ...ring, atoms: [{ ...first, x: first.x * 1.6, y: first.y * 1.6 }, ...rest] }
  const before = length(pulled, first.id, ring.bonds.find((bond) => bond.a === first.id || bond.b === first.id)!.b)
  const tidied = relax(pulled, { atoms: [first.id] })
  const bond = ring.bonds.find((item) => item.a === first.id || item.b === first.id)!
  const after = length(tidied, bond.a, bond.b)
  assert.ok(Math.abs(after - BOND_LENGTH) < Math.abs(before - BOND_LENGTH))
  assert.deepEqual(tidied.atoms.slice(1), pulled.atoms.slice(1))
})

test("untangleGroups leaves a drawing with nothing overlapping as it was", () => {
  const ring = addRing(EMPTY, ORIGIN, "cyclohexane")
  const { molecule, atom } = growBond(ring, ring.atoms[0].id)
  const ph = expandGroup(molecule, atom, "Ph")
  assert.deepEqual(untangleGroups(ph, ph.groups.map((group) => group.id)), ph)
})

test("sideBySide puts molecules in a row with fresh ids", () => {
  const ring = addRing(EMPTY, ORIGIN, "benzene")
  const row = sideBySide([ring, ring])
  assert.equal(row.atoms.length, 12)
  assert.equal(new Set(row.atoms.map((atom) => atom.id)).size, 12)
  const xs = (ids: Molecule["atoms"]) => ids.map((atom) => atom.x)
  assert.ok(Math.max(...xs(row.atoms.slice(0, 6))) < Math.min(...xs(row.atoms.slice(6))))
})

test("kekulize gives an all-single aromatic ring alternating double bonds", () => {
  const ring = addRing(EMPTY, ORIGIN, "benzene")
  const flat = { ...ring, bonds: ring.bonds.map((bond) => ({ ...bond, order: 1 as const, aromatic: true })) }
  const { molecule, unresolved } = kekulize(flat)
  assert.equal(unresolved, 0)
  assert.equal(molecule.bonds.filter((bond) => bond.order === 2).length, 3)
})

test("a molecule read from SMILES has its rings, one bond long, and a bad SMILES says why", () => {
  const mol = moleculeFromSmiles(rdkit, "c1ccccc1CC(=O)O")
  assert.equal(mol.atoms.length, 10)
  assert.deepEqual(findRings(mol).map((ring) => ring.length), [6])
  const lengths = mol.bonds.map((bond) => length(mol, bond.a, bond.b)).sort((a, b) => a - b)
  assert.ok(Math.abs(lengths[Math.floor(lengths.length / 2)] - BOND_LENGTH) < 1)
  assert.throws(() => moleculeFromSmiles(rdkit, "C1CC"))
})

test("toMolfile and moleculeFromMolfile go round", () => {
  const ring = addRing(EMPTY, ORIGIN, "benzene")
  const { molecule, problems } = moleculeFromMolfile(toMolfile(ring))
  assert.deepEqual(problems, [])
  assert.equal(molecule.atoms.length, 6)
  assert.deepEqual(findRings(molecule).map((item) => item.length), [6])
  assert.ok(moleculeFromMolfile("not a molfile").problems.length > 0)
})

test("moleculeSvg draws the molecule, on no ground when asked", () => {
  const { molecule } = growBond(addRing(EMPTY, ORIGIN, "benzene"), 1, { element: "O" })
  const svg = moleculeSvg(molecule)
  assert.match(svg, /<svg /)
  assert.match(svg, />O</)
  assert.match(svg, /fill="#ffffff"/)
  assert.doesNotMatch(moleculeSvg(molecule, { background: false }), /fill="#ffffff"/)
  assert.equal(moleculeSvg(EMPTY), "")
})

test("no function changes the molecule it is given", () => {
  const ring = addRing(EMPTY, ORIGIN, "benzene")
  const copy = structuredClone(ring)
  fuseRing(ring, ring.bonds[0].id, "benzene")
  attachRing(ring, ring.atoms[0].id, "cyclopentane")
  const grown = growBond(ring, ring.atoms[0].id)
  expandGroup(grown.molecule, grown.atom, "Boc")
  relax(ring, { atoms: ring.atoms.map((atom) => atom.id) })
  kekulize(ring)
  sideBySide([ring, ring])
  assert.deepEqual(ring, copy)
})
