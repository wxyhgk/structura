import { angleTo } from "../geometry.ts"
import { groupOrAlias } from "./abbreviate.ts"
import { atomById, bumpCharge, neighbors, setElement, setIsotope } from "./graph.ts"
import { branchAngles, sproutAngle } from "./angles.ts"
import { attachChairAt } from "./chair.ts"
import { sproutAt } from "./place.ts"
import { growRing } from "./rings.ts"
import type { Molecule, RingKind } from "../types.ts"
import { DOUBLE, HASH, SINGLE, WEDGE } from "../constants.ts"
import { atomNext, degree, inRing, type HotResult } from "./grow.ts"

function addCarbonyl(mol: Molecule, id: number): HotResult {
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

function addChair(mol: Molecule, id: number, turn: 1 | -1): HotResult {
  const ring = attachChairAt(mol, id, turn)
  return atomNext(ring.mol, ring.far)
}

function addFork(mol: Molecule, id: number): HotResult {
  const [left, right] = branchAngles(mol, id)
  const first = sproutAt(mol, id, left, SINGLE, "C")
  const second = sproutAt(first.mol, id, right, SINGLE, "C")
  return atomNext(second.mol, first.id)
}

function addStereoPair(mol: Molecule, id: number): HotResult {
  const [left, right] = branchAngles(mol, id)
  const up = sproutAt(mol, id, left, WEDGE, "C")
  const down = sproutAt(up.mol, id, right, HASH, "C")
  return atomNext(down.mol, up.id)
}

function addSulfonyl(mol: Molecule, id: number): HotResult {
  const sulfur = sproutAt(mol, id, sproutAngle(mol, id), SINGLE, "S")
  const up = sproutAt(sulfur.mol, sulfur.id, Math.PI / 2, DOUBLE, "O")
  const down = sproutAt(up.mol, sulfur.id, -Math.PI / 2, DOUBLE, "O")
  return atomNext(down.mol, sulfur.id)
}

function headAt(mol: Molecule, id: number, el: string, charge = 0): { mol: Molecule; id: number } {
  if (degree(mol, id) >= 2) return sproutAt(mol, id, sproutAngle(mol, id), SINGLE, el, charge)
  const next = setElement(mol, [id], el)
  return { mol: bumpCharge(next, [id], charge - (atomById(next, id)?.charge ?? 0)), id }
}

function addNitro(mol: Molecule, id: number): HotResult {
  const nitrogen = headAt(mol, id, "N", 1)
  const [left, right] = branchAngles(nitrogen.mol, nitrogen.id)
  const oxo = sproutAt(nitrogen.mol, nitrogen.id, left, DOUBLE, "O")
  const oxy = sproutAt(oxo.mol, nitrogen.id, right, SINGLE, "O", -1)
  return atomNext(oxy.mol, nitrogen.id)
}

function addAzide(mol: Molecule, id: number): HotResult {
  const angle = sproutAngle(mol, id)
  const first = sproutAt(mol, id, angle, SINGLE, "N")
  const second = sproutAt(first.mol, first.id, angle, DOUBLE, "N", 1)
  const third = sproutAt(second.mol, second.id, angle, DOUBLE, "N", -1)
  return atomNext(third.mol, first.id)
}

function sproutTrio(mol: Molecule, id: number, el: string): HotResult {
  const carbon = headAt(mol, id, "C")
  const atom = atomById(carbon.mol, carbon.id)
  const parent = atom ? neighbors(carbon.mol, carbon.id)[0] : undefined
  const base = atom && parent ? angleTo(atom, parent) : 0
  let next = carbon.mol
  for (const delta of [Math.PI, (2 * Math.PI) / 3, (-2 * Math.PI) / 3]) {
    next = sproutAt(next, carbon.id, base + delta, SINGLE, el).mol
  }
  return atomNext(next, carbon.id)
}

function addTrifluoromethyl(mol: Molecule, id: number): HotResult {
  return sproutTrio(mol, id, "F")
}

function addTertButyl(mol: Molecule, id: number): HotResult {
  return sproutTrio(mol, id, "C")
}

function addMethoxy(mol: Molecule, id: number): HotResult {
  const oxygen = headAt(mol, id, "O")
  const methyl = sproutAt(oxygen.mol, oxygen.id, sproutAngle(oxygen.mol, oxygen.id), SINGLE, "C")
  return atomNext(methyl.mol, methyl.id)
}

function addMagnesiumBromide(mol: Molecule, id: number): HotResult {
  const metal = headAt(mol, id, "Mg")
  const bromine = sproutAt(metal.mol, metal.id, sproutAngle(metal.mol, metal.id), SINGLE, "Br")
  return atomNext(bromine.mol, metal.id)
}

export function become(mol: Molecule, id: number, el: string): HotResult {
  return atomNext(setElement(mol, [id], el), id)
}

export function isotopeOf(mol: Molecule, id: number, el: string, isotope: number): HotResult {
  return atomNext(setIsotope(setElement(mol, [id], el), [id], isotope), id)
}

/** Puts the named abbreviation on the atom, or just its label when there is no template. */
export function nick(mol: Molecule, id: number, label: string): HotResult {
  const placed = groupOrAlias(mol, id, label)
  return atomNext(placed.mol, placed.id)
}

/**
 * Groups built from an atom that no other op expresses, by name, so an agent can ask for
 * "nitro" instead of knowing that Shift+N builds one. The hover keys map onto these.
 */
export const RECIPES = {
  carbonyl: addCarbonyl,
  fork: addFork,
  "stereo-pair": addStereoPair,
  sulfonyl: addSulfonyl,
  nitro: addNitro,
  azide: addAzide,
  trifluoromethyl: addTrifluoromethyl,
  "tert-butyl": addTertButyl,
  methoxy: addMethoxy,
  "magnesium-bromide": addMagnesiumBromide,
  chair: (mol: Molecule, id: number) => addChair(mol, id, 1),
  "chair-flipped": (mol: Molecule, id: number) => addChair(mol, id, -1),
} satisfies Record<string, (mol: Molecule, id: number) => HotResult>

export type RecipeName = keyof typeof RECIPES
