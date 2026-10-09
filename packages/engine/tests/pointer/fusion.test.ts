import assert from "node:assert/strict"
import test from "node:test"
import { atomById, emptyMolecule, fuseRingAt, neighbors, placeRing, setElement } from "@structura/core/molecule"
import { fuseReach, fusionTarget } from "@structura/engine"

test("the ring tool fuses onto the bond under the pointer, never a cleaner one nearby", () => {
  const ring = placeRing(emptyMolecule(), { x: 0, y: 0 }, "cyclohexane")
  const decalin = fuseRingAt(ring, ring.bonds[0].id, "cyclohexane", 1).mol
  const degreeOf = (id: number) => neighbors(decalin, id).length
  const junction = decalin.atoms.find((atom) => degreeOf(atom.id) === 3)!
  const amine = setElement(decalin, [junction.id], "N")
  // A bond at the nitrogen junction: a ring there overfills the N, yet it is the one pointed at.
  const edge = amine.bonds.find((bond) => (bond.a === junction.id || bond.b === junction.id) && degreeOf(bond.a === junction.id ? bond.b : bond.a) === 2)!
  const a = atomById(amine, edge.a)!
  const b = atomById(amine, edge.b)!
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const picked = fusionTarget(amine, middle, "cyclopropane", fuseReach(3))
  assert.equal(picked?.id, edge.id)
})
