import { neighbors, atomById } from "@structura/core/molecule"
import type { Op, RecipeName } from "@structura/core/ops"
import { templateFor } from "@structura/core/templates"
import type { BondStyle, Molecule, RingKind } from "@structura/core/types"

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

/**
 * The ops a key sends for an atom. `as` names the atom the next key should land on when
 * the key grows something; keys that change the atom in place leave it unnamed, since the
 * next key lands on the same atom. `mol` only answers questions the table asks (how many
 * neighbours, what charge), so ops for several atoms can be built up front.
 */
export function atomActionOps(mol: Molecule, id: number, action: AtomAction, as?: string): Op[] {
  switch (action.do) {
    case "extend": {
      const { order, stereo } = action.style
      return [{ op: "add_atom", el: "C", to: id, order, ...(stereo !== "none" ? { stereo } : {}), as }]
    }
    case "sprout-up":
      return [{ op: "add_atom", el: "C", to: id, angle: Math.PI / 2, as }]
    case "phenyl":
      return [{ op: "add_ring", atom: id, kind: "benzene", as }]
    case "ring":
      return [{ op: "add_ring", atom: id, kind: action.kind, as }]
    case "recipe": {
      const name = action.inChain && neighbors(mol, id).length >= 2 ? action.inChain : action.name
      return [{ op: "add_recipe", to: id, name, as }]
    }
    case "become":
      return [{ op: "set_element", atom: id, el: action.el }]
    case "isotope":
      return [
        { op: "set_element", atom: id, el: action.el },
        { op: "set_isotope", atom: id, isotope: action.isotope },
      ]
    case "label":
      // A known abbreviation is built out (hanging off a chain atom); anything else is only written on.
      return templateFor(action.text) ? [{ op: "add_group", to: id, name: action.text, as }] : [{ op: "label", atom: id, text: action.text }]
    case "charge": {
      const charge = Math.max(-3, Math.min(3, (atomById(mol, id)?.charge ?? 0) + action.delta))
      return [{ op: "set_charge", atom: id, charge }]
    }
  }
}

/** The ops a key sends for a bond; a fused ring's far atom is named `as`. */
export function bondActionOps(id: number, action: BondAction, as?: string): Op[] {
  switch (action.do) {
    case "style": {
      const { order, stereo, look, emphasis } = action.style
      return [{ op: "set_bond", bond: id, order, stereo, look: look ?? null, emphasis: emphasis ?? null }]
    }
    case "fuse":
      return [{ op: "add_ring", bond: id, kind: action.kind, side: 1, as }]
    case "fuse-chair":
      return [{ op: "add_ring", bond: id, chair: action.turn, as }]
  }
}
