import { bumpCharge, fuseChairAt, fuseRingAt, setBondLook, sproutAt } from "../molecule.ts"
import { atomNext, degree, extend, SINGLE, type HotResult } from "../molecule/grow.ts"
import { addPhenyl, addRing, become, isotopeOf, nick, RECIPES, type RecipeName } from "../molecule/recipes.ts"
import type { BondStyle, Molecule, RingKind } from "../types.ts"

/** What a key does to an atom, as data, so the key tables stay free of code. */
export type AtomAction =
  | { do: "extend"; style: BondStyle }
  | { do: "sprout-up" }
  | { do: "phenyl" }
  | { do: "ring"; kind: RingKind }
  /** `inChain` is used instead when the atom already has two or more neighbours. */
  | { do: "recipe"; name: RecipeName; inChain?: RecipeName }
  | { do: "become"; el: string }
  | { do: "isotope"; el: string; isotope: number }
  | { do: "label"; text: string }
  | { do: "charge"; delta: 1 | -1 }

/** What a key does to a bond. */
export type BondAction =
  | { do: "style"; style: BondStyle }
  | { do: "fuse"; kind: RingKind }
  | { do: "fuse-chair"; turn: 1 | -1 }

export function runAtomAction(mol: Molecule, id: number, action: AtomAction): HotResult {
  switch (action.do) {
    case "extend":
      return extend(mol, id, action.style)
    case "sprout-up": {
      const grown = sproutAt(mol, id, Math.PI / 2, SINGLE, "C")
      return atomNext(grown.mol, grown.id)
    }
    case "phenyl":
      return addPhenyl(mol, id)
    case "ring":
      return addRing(mol, id, action.kind)
    case "recipe":
      return RECIPES[action.inChain && degree(mol, id) >= 2 ? action.inChain : action.name](mol, id)
    case "become":
      return become(mol, id, action.el)
    case "isotope":
      return isotopeOf(mol, id, action.el, action.isotope)
    case "label":
      return nick(mol, id, action.text)
    case "charge":
      return atomNext(bumpCharge(mol, [id], action.delta), id)
  }
}

export function runBondAction(mol: Molecule, id: number, action: BondAction): HotResult {
  switch (action.do) {
    case "style":
      return { mol: setBondLook(mol, id, action.style), next: { type: "bond", id } }
    case "fuse": {
      const fused = fuseRingAt(mol, id, action.kind, 1)
      return { mol: fused.mol, next: { type: "atom", id: fused.far } }
    }
    case "fuse-chair": {
      const chair = fuseChairAt(mol, id, action.turn)
      return { mol: chair.mol, next: { type: "atom", id: chair.far } }
    }
  }
}
