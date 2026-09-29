import assert from "node:assert/strict"
import test from "node:test"
import { BOND_LENGTH } from "../../src/chem/constants.ts"
import { plainFormula, molecularWeight, valenceErrorCount } from "../../src/chem/formula.ts"
import { angleTo, dist } from "../../src/chem/geometry.ts"
import { toMolfile } from "../../src/chem/molfile.ts"
import {
  addAtom,
  addBond,
  atomById,
  attachRingAt,
  bondBetween,
  bumpCharge,
  setElement,
  neighbors,
  bondOrderSum,
  growRing,
  centroidOf,
  createBondAt,
  emptyMolecule,
  flipAtoms,
  fuseRingAt,
  placeRing,
  ringOnBond,
  rotateAtoms,
  sprout,
  tumbleAtoms,
} from "../../src/chem/molecule.ts"

function bondAngle(mol: ReturnType<typeof createBondAt>, atomId: number): number[] {
  const atom = atomById(mol, atomId)
  assert.ok(atom)
  const angles: number[] = []
  for (const bond of mol.bonds) {
    const otherId = bond.a === atomId ? bond.b : bond.b === atomId ? bond.a : 0
    if (!otherId) continue
    const other = atomById(mol, otherId)
    assert.ok(other)
    angles.push(angleTo(atom, other))
  }
  return angles
}

function smallestAngle(angles: number[]): number {
  const sorted = [...angles].sort((a, b) => a - b)
  let best = Math.PI * 2
  for (let index = 0; index < sorted.length; index++) {
    const start = sorted[index]
    const end = sorted[(index + 1) % sorted.length] + (index === sorted.length - 1 ? Math.PI * 2 : 0)
    best = Math.min(best, end - start)
  }
  return best
}

test("a click on empty space draws ethane", () => {
  const mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, { order: 1, stereo: "none" })
  assert.equal(mol.atoms.length, 2)
  assert.equal(mol.bonds.length, 1)
  assert.equal(plainFormula(mol), "C2H6")
  assert.ok(Math.abs(molecularWeight(mol) - 30.07) < 0.02)
  assert.match(toMolfile(mol), /V2000/)
})

test("repeated clicks keep a 120 degree staircase", () => {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, { order: 1, stereo: "none" })
  let tip = mol.atoms[1].id
  for (let step = 0; step < 4; step++) {
    mol = sprout(mol, tip, { order: 1, stereo: "none" })
    const terminal = mol.atoms.find((atom) => bondOrderSum(mol, atom.id) === 1 && atom.id !== mol.atoms[0].id)
    assert.ok(terminal)
    tip = terminal.id
  }
  for (const atom of mol.atoms) {
    const angles = bondAngle(mol, atom.id)
    if (angles.length < 2) continue
    const interior = smallestAngle(angles)
    assert.ok(Math.abs(interior - (2 * Math.PI) / 3) < 0.02, `angle ${interior}`)
  }
  assert.equal(plainFormula(mol), "C6H14")
})

test("benzene and cyclohexane formulas", () => {
  const benzene = placeRing(emptyMolecule(), { x: 0, y: 0 }, "benzene")
  assert.equal(benzene.atoms.length, 6)
  assert.equal(benzene.bonds.length, 6)
  assert.equal(plainFormula(benzene), "C6H6")
  assert.ok(Math.abs(molecularWeight(benzene) - 78.11) < 0.03)

  const hexane = placeRing(emptyMolecule(), { x: 0, y: 0 }, "cyclohexane")
  assert.equal(plainFormula(hexane), "C6H12")
})

test("fusing benzene onto a bond uses that bond as a shared edge", () => {
  const base = createBondAt(emptyMolecule(), { x: 10, y: 20 }, { order: 1, stereo: "none" })
  const bond = base.bonds[0]
  const fused = fuseRingAt(base, bond.id, "benzene", 1).mol
  assert.equal(fused.atoms.length, 6)
  assert.equal(fused.bonds.length, 6)
  assert.equal(plainFormula(fused), "C6H6")
  const a = atomById(fused, bond.a)
  const b = atomById(fused, bond.b)
  assert.ok(a && b)
  assert.ok(Math.abs(dist(a, b) - BOND_LENGTH) < 0.01)
  assert.equal(fused.bonds.filter((item) => item.order === 2).length, 3)
  assert.equal(valenceErrorCount(fused), 0)
})

test("fusing benzene onto a ring bond does not overfill the bridgeheads", () => {
  const benzene = placeRing(emptyMolecule(), { x: 0, y: 0 }, "benzene")
  for (const bond of benzene.bonds) {
    const fused = fuseRingAt(benzene, bond.id, "benzene", 1).mol
    assert.equal(plainFormula(fused), "C10H8")
    assert.equal(valenceErrorCount(fused), 0)
    for (const atom of fused.atoms) {
      const doubles = fused.bonds.filter(
        (item) => (item.a === atom.id || item.b === atom.id) && item.order === 2,
      )
      assert.equal(doubles.length, 1)
    }
  }
  const single = benzene.bonds.find((bond) => bond.order === 1)
  assert.ok(single)
  const naphthalene = fuseRingAt(benzene, single.id, "benzene", 1).mol
  assert.equal(valenceErrorCount(naphthalene), 0)
  const open = naphthalene.bonds.filter((bond) => {
    const ends = [bond.a, bond.b]
    return ends.every((id) => naphthalene.bonds.filter((item) => item.a === id || item.b === id).length <= 2)
  })
  assert.ok(open.length >= 2)
  for (const bond of open) {
    const fused = fuseRingAt(naphthalene, bond.id, "benzene", 1).mol
    assert.equal(valenceErrorCount(fused), 0)
    assert.equal(plainFormula(fused), "C14H10")
    for (const atom of fused.atoms) {
      const doubles = fused.bonds.filter(
        (item) => (item.a === atom.id || item.b === atom.id) && item.order === 2,
      )
      assert.equal(doubles.length, 1)
    }
  }
  const degreeOf = (id: number) => naphthalene.bonds.filter((bond) => bond.a === id || bond.b === id).length
  const bay = naphthalene.bonds.find((bond) => {
    const degrees = [degreeOf(bond.a), degreeOf(bond.b)].sort()
    return degrees[0] === 2 && degrees[1] === 3
  })
  assert.ok(bay)
  const phenalene = fuseRingAt(naphthalene, bay.id, "benzene", 1).mol
  assert.equal(phenalene.atoms.length, 13)
  assert.equal(plainFormula(phenalene), "C13H10")
  assert.equal(valenceErrorCount(phenalene), 0)
  const bare = phenalene.atoms.filter((atom) => {
    const doubles = phenalene.bonds.filter(
      (item) => (item.a === atom.id || item.b === atom.id) && item.order === 2,
    )
    return doubles.length === 0
  })
  assert.equal(bare.length, 1)
  const shared = naphthalene.bonds.find((bond) => degreeOf(bond.a) === 3 && degreeOf(bond.b) === 3)
  assert.ok(shared)
  const refused = fuseRingAt(naphthalene, shared.id, "benzene", 1).mol
  assert.equal(refused.atoms.length, naphthalene.atoms.length)
})

test("a fused ring stays off the existing ring on either side of the bond", () => {
  const benzene = placeRing(emptyMolecule(), { x: 0, y: 0 }, "benzene")
  const occupied = new Set(benzene.atoms.map((atom) => atom.id))
  for (const bond of benzene.bonds) {
    for (const side of [1, -1] as const) {
      const fused = fuseRingAt(benzene, bond.id, "benzene", side).mol
      for (const atom of fused.atoms) {
        if (occupied.has(atom.id)) continue
        let nearest = Infinity
        for (const other of benzene.atoms) nearest = Math.min(nearest, dist(atom, other))
        assert.ok(nearest > 30, `bond ${bond.id} side ${side} landed ${nearest.toFixed(1)} away`)
      }
    }
  }
  const single = benzene.bonds.find((bond) => bond.order === 1)
  assert.ok(single)
  const naphthalene = fuseRingAt(benzene, single.id, "benzene", 1).mol
  const placed = new Set(naphthalene.atoms.map((atom) => atom.id))
  const degree = (id: number) =>
    naphthalene.bonds.filter((bond) => bond.a === id || bond.b === id).length
  for (const bond of naphthalene.bonds) {
    if (degree(bond.a) > 2 || degree(bond.b) > 2) continue
    for (const side of [1, -1] as const) {
      const fused = fuseRingAt(naphthalene, bond.id, "benzene", side).mol
      for (const atom of fused.atoms) {
        if (placed.has(atom.id)) continue
        let nearest = Infinity
        for (const other of naphthalene.atoms) nearest = Math.min(nearest, dist(atom, other))
        assert.ok(nearest > 30, `naphthalene bond ${bond.id} side ${side} landed ${nearest.toFixed(1)} away`)
      }
    }
  }
})

test("rotating a bond a quarter turn stands it upright", () => {
  const mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, { order: 1, stereo: "none" })
  const ids = mol.atoms.map((atom) => atom.id)
  const center = centroidOf(mol, ids)
  assert.ok(center)
  const turned = rotateAtoms(mol, ids, center, Math.PI / 2)
  const xs = turned.atoms.map((atom) => atom.x)
  const ys = turned.atoms.map((atom) => atom.y)
  assert.ok(Math.abs(xs[0] - xs[1]) < 0.01)
  assert.ok(Math.abs(Math.abs(ys[0] - ys[1]) - BOND_LENGTH) < 0.01)
})

test("flipping horizontally mirrors across the center and swaps wedges", () => {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, { order: 1, stereo: "up" })
  const ids = mol.atoms.map((atom) => atom.id)
  const flipped = flipAtoms(mol, ids, "horizontal")
  const left = atomById(flipped, mol.atoms[0].id)
  const right = atomById(flipped, mol.atoms[1].id)
  assert.ok(left && right)
  assert.ok(Math.abs(left.x - BOND_LENGTH) < 0.01)
  assert.ok(Math.abs(right.x) < 0.01)
  assert.equal(flipped.bonds[0].stereo, "down")
})

test("a ring on an atom hangs off by one single bond", () => {
  const base = createBondAt(emptyMolecule(), { x: 0, y: 0 }, { order: 1, stereo: "none" })
  const target = base.atoms[1].id
  const attached = attachRingAt(base, target, "benzene").mol
  assert.equal(attached.atoms.length, 8)
  assert.equal(attached.bonds.length, 8)
  assert.equal(plainFormula(attached), "C8H10")
  const original = new Set(base.atoms.map((atom) => atom.id))
  const linker = attached.bonds.find(
    (bond) =>
      (bond.a === target && !original.has(bond.b)) || (bond.b === target && !original.has(bond.a)),
  )
  assert.equal(linker?.order, 1)
  const ipsoId = linker?.a === target ? linker.b : linker?.a
  const ipso = atomById(attached, ipsoId ?? -1)
  const origin = atomById(attached, target)
  assert.ok(ipso && origin)
  assert.ok(Math.abs(dist(origin, ipso) - BOND_LENGTH) < 0.05)
})

test("growRing puts a singly bonded atom into the ring", () => {
  const base = createBondAt(emptyMolecule(), { x: 0, y: 0 }, { order: 1, stereo: "none" })
  const target = base.atoms[1].id
  const phenyl = growRing(base, target, "benzene")
  assert.equal(phenyl.mol.atoms.length, 7)
  assert.equal(plainFormula(phenyl.mol), "C7H8")
  assert.equal(bondOrderSum(phenyl.mol, target), 4)
  const hexane = growRing(base, target, "cyclohexane")
  assert.equal(hexane.mol.atoms.length, 7)
  assert.equal(plainFormula(hexane.mol), "C7H14")
  assert.equal(bondOrderSum(hexane.mol, target), 3)
})

test("a fused ring keeps equal side lengths", () => {
  const a = { x: 0, y: 0 }
  const b = { x: BOND_LENGTH, y: 0 }
  const points = ringOnBond(a, b, 6, 1)
  assert.equal(points.length, 6)
  assert.deepEqual(points[0], a)
  assert.deepEqual(points[1], b)
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length]
    assert.ok(Math.abs(dist(points[index], next) - BOND_LENGTH) < 0.05)
  }
})

test("two quarter tumbles carry depth and mirror the structure", () => {
  const mol = createBondAt(emptyMolecule(), { x: -20, y: 0 }, { order: 1, stereo: "none" })
  const ids = mol.atoms.map((atom) => atom.id)
  const quarter = tumbleAtoms(mol, ids, { x: 0, y: 0 }, "y", Math.PI / 2)
  for (const atom of quarter.mol.atoms) assert.ok(Math.abs(atom.x) < 1e-9)
  assert.equal("z" in quarter.mol.atoms[0], false)

  const half = tumbleAtoms(quarter.mol, ids, { x: 0, y: 0 }, "y", Math.PI / 2, quarter.depth)
  const before = mol.atoms.map((atom) => atom.x)
  const after = half.mol.atoms.map((atom) => atom.x)
  after.forEach((x, index) => assert.ok(Math.abs(x + before[index]) < 1e-9))

  const lost = tumbleAtoms(quarter.mol, ids, { x: 0, y: 0 }, "y", Math.PI / 2)
  for (const atom of lost.mol.atoms) assert.ok(Math.abs(atom.x) < 1e-9)
})

test("lookups by id and between atoms follow every edit", () => {
  const ethane = createBondAt(emptyMolecule(), { x: 0, y: 0 }, { order: 1, stereo: "none" })
  const [a, b] = ethane.atoms.map((atom) => atom.id)
  assert.equal(bondBetween(ethane, a, b)?.id, ethane.bonds[0].id)
  assert.equal(bondBetween(ethane, b, a)?.id, ethane.bonds[0].id, "either way round")
  const third = addAtom(ethane, "O", 80, 0)
  assert.equal(bondBetween(third.mol, b, third.id), undefined)
  assert.deepEqual(neighbors(third.mol, b).map((atom) => atom.id), [a])
  const joined = addBond(third.mol, b, third.id, { order: 2, stereo: "none" })!
  assert.equal(bondBetween(joined.mol, third.id, b)?.order, 2)
  assert.deepEqual(neighbors(joined.mol, b).map((atom) => atom.id), [a, third.id])
  assert.deepEqual(neighbors(third.mol, b).map((atom) => atom.id), [a], "the earlier molecule is untouched")
  assert.equal(atomById(joined.mol, third.id)?.el, "O")

  // A clone filled in after a lookup was taken is looked up afresh.
  const filling = { ...joined.mol, atoms: [...joined.mol.atoms] }
  assert.equal(atomById(filling, 99), undefined)
  filling.atoms.push({ id: 99, el: "N", x: 0, y: 40, charge: 0 })
  assert.equal(atomById(filling, 99)?.el, "N")
})

test("a fused ring never overfills a heteroatom at the ring junction", () => {
  const ring = placeRing(emptyMolecule(), { x: 0, y: 0 }, "cyclohexane")
  const decalin = fuseRingAt(ring, ring.bonds[0].id, "cyclohexane", 1).mol
  const degreeOf = (mol: typeof decalin, id: number) => neighbors(mol, id).length
  const junction = decalin.atoms.find((atom) => degreeOf(decalin, atom.id) === 3)!
  const edge = decalin.bonds.find(
    (bond) => (bond.a === junction.id || bond.b === junction.id) && degreeOf(decalin, bond.a === junction.id ? bond.b : bond.a) === 2,
  )!
  assert.ok(edge)
  assert.notEqual(fuseRingAt(decalin, edge.id, "cyclopropane", 1).mol, decalin, "a carbon takes a fourth bond")
  const amine = setElement(decalin, [junction.id], "N")
  assert.equal(fuseRingAt(amine, edge.id, "cyclopropane", 1).mol, amine, "a neutral nitrogen does not")
  const ammonium = bumpCharge(amine, [junction.id], 1)
  assert.notEqual(fuseRingAt(ammonium, edge.id, "cyclopropane", 1).mol, ammonium, "an ammonium nitrogen does")
})
