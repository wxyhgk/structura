import type { Molecule, Selection } from "@structura/core/types"
import type { HoverTarget } from "./types.ts"

/** What a right-click acts on: the selection, one atom or bond, or the empty canvas. */
export type ContextTarget = { kind: "selection" } | { kind: "atom"; id: number } | { kind: "bond"; id: number } | { kind: "canvas" }

/**
 * What a right-click on `hit` is about, the way ChemDraw decides: on something already
 * selected, the whole selection; on an atom or bond outside it, that one alone (the
 * selection is left as it is); on empty canvas, the canvas.
 */
export function contextTarget(mol: Molecule, selection: Selection, hit: HoverTarget): ContextTarget {
  if (!hit) return { kind: "canvas" }
  const selected =
    hit.type === "atom"
      ? selection.atoms.includes(hit.id)
      : selection.bonds.includes(hit.id) || (() => {
          const bond = mol.bonds.find((item) => item.id === hit.id)
          return bond != null && selection.atoms.includes(bond.a) && selection.atoms.includes(bond.b)
        })()
  const several = selection.atoms.length + selection.bonds.length > 1
  if (selected && several) return { kind: "selection" }
  return hit.type === "atom" ? { kind: "atom", id: hit.id } : { kind: "bond", id: hit.id }
}
