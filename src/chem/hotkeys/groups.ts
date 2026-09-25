import { angleTo } from "../geometry.ts"
import {
  atomById,
  attachChairAt,
  growRing,
  neighbors,
  setAlias,
  setElement,
  setHydrogens,
  sproutAngle,
  sproutAt,
} from "../molecule.ts"
import type { Molecule, RingKind } from "../types.ts"
import { atomNext, branchAngles, degree, extend, HASH, inRing, SINGLE, DOUBLE, WEDGE, type HotResult } from "./shared.ts"

export function addCarbonyl(mol: Molecule, id: number): HotResult {
  if (degree(mol, id) >= 2 && inRing(mol, id)) {
    const acyl = sproutAt(mol, id, sproutAngle(mol, id), SINGLE, "C")
    return addCarbonyl(acyl.mol, acyl.id)
  }
  if (degree(mol, id) >= 2) {
    const oxo = sproutAt(mol, id, Math.PI / 2, DOUBLE, "O")
    return atomNext(oxo.mol, id)
  }
  const angle = sproutAngle(mol, id)
  const oxo = sproutAt(mol, id, Math.PI / 2, DOUBLE, "O")
  const methyl = sproutAt(oxo.mol, id, angle, SINGLE, "C")
  return atomNext(methyl.mol, methyl.id)
}

export function addPhenyl(mol: Molecule, id: number): HotResult {
  const ring = growRing(mol, id, "benzene")
  return atomNext(ring.mol, ring.far)
}

export function addRing(mol: Molecule, id: number, kind: RingKind): HotResult {
  const ring = growRing(mol, id, kind)
  return atomNext(ring.mol, ring.far)
}

export function addChair(mol: Molecule, id: number, turn: 1 | -1): HotResult {
  const ring = attachChairAt(mol, id, turn)
  return atomNext(ring.mol, ring.far)
}

export function addFork(mol: Molecule, id: number): HotResult {
  const [left, right] = branchAngles(mol, id)
  const first = sproutAt(mol, id, left, SINGLE, "C")
  const second = sproutAt(first.mol, id, right, SINGLE, "C")
  return atomNext(second.mol, first.id)
}

export function addStereoPair(mol: Molecule, id: number): HotResult {
  const [left, right] = branchAngles(mol, id)
  const up = sproutAt(mol, id, left, WEDGE, "C")
  const down = sproutAt(up.mol, id, right, HASH, "C")
  return atomNext(down.mol, up.id)
}

export function addSulfonyl(mol: Molecule, id: number): HotResult {
  const sulfur = sproutAt(mol, id, sproutAngle(mol, id), SINGLE, "S")
  let next = setHydrogens(sulfur.mol, sulfur.id, 0)
  const up = sproutAt(next, sulfur.id, Math.PI / 2, DOUBLE, "O")
  next = setHydrogens(up.mol, up.id, 0)
  const down = sproutAt(next, sulfur.id, -Math.PI / 2, DOUBLE, "O")
  next = setHydrogens(down.mol, down.id, 0)
  return atomNext(next, sulfur.id)
}

export function addNitro(mol: Molecule, id: number): HotResult {
  const nitrogen = sproutAt(mol, id, sproutAngle(mol, id), SINGLE, "N", 1)
  let next = setHydrogens(nitrogen.mol, nitrogen.id, 0)
  const oxo = sproutAt(next, nitrogen.id, Math.PI / 2, DOUBLE, "O")
  next = setHydrogens(oxo.mol, oxo.id, 0)
  const oxy = sproutAt(next, nitrogen.id, -Math.PI / 2, SINGLE, "O", -1)
  next = setHydrogens(oxy.mol, oxy.id, 0)
  return atomNext(next, nitrogen.id)
}

export function addAzide(mol: Molecule, id: number): HotResult {
  const angle = sproutAngle(mol, id)
  const first = sproutAt(mol, id, angle, SINGLE, "N")
  let next = setHydrogens(first.mol, first.id, 0)
  const second = sproutAt(next, first.id, angle, DOUBLE, "N", 1)
  next = setHydrogens(second.mol, second.id, 0)
  const third = sproutAt(next, second.id, angle, DOUBLE, "N", -1)
  next = setHydrogens(third.mol, third.id, 0)
  return atomNext(next, first.id)
}

function sproutTrio(mol: Molecule, id: number, el: string): HotResult {
  const carbon = sproutAt(mol, id, sproutAngle(mol, id), SINGLE, "C")
  const atom = atomById(carbon.mol, carbon.id)
  const parent = atom ? neighbors(carbon.mol, carbon.id)[0] : undefined
  const base = atom && parent ? angleTo(atom, parent) : 0
  let next = carbon.mol
  for (const delta of [Math.PI, (2 * Math.PI) / 3, (-2 * Math.PI) / 3]) {
    next = sproutAt(next, carbon.id, base + delta, SINGLE, el).mol
  }
  return atomNext(next, carbon.id)
}

export function addTrifluoromethyl(mol: Molecule, id: number): HotResult {
  return sproutTrio(mol, id, "F")
}

export function addTertButyl(mol: Molecule, id: number): HotResult {
  return sproutTrio(mol, id, "C")
}

export function addMethoxy(mol: Molecule, id: number): HotResult {
  const oxygen = sproutAt(mol, id, sproutAngle(mol, id), SINGLE, "O")
  const methyl = sproutAt(oxygen.mol, oxygen.id, sproutAngle(oxygen.mol, oxygen.id), SINGLE, "C")
  return atomNext(methyl.mol, methyl.id)
}

export function addMagnesiumBromide(mol: Molecule, id: number): HotResult {
  const metal = sproutAt(mol, id, sproutAngle(mol, id), SINGLE, "Mg")
  const bromine = sproutAt(metal.mol, metal.id, sproutAngle(metal.mol, metal.id), SINGLE, "Br")
  return atomNext(bromine.mol, metal.id)
}

export function become(mol: Molecule, id: number, el: string): HotResult {
  return atomNext(setElement(mol, [id], el), id)
}

export function nick(mol: Molecule, id: number, alias: string, el = "C"): HotResult {
  return atomNext(setAlias(setElement(mol, [id], el), id, alias), id)
}

export { extend }
