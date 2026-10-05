import { bondById, componentOf } from "@structura/core/molecule"
import type { Op, OpsResult } from "@structura/core/ops"
import type { BondStyle, HotTarget, Molecule, Point, Selection } from "@structura/core/types"
import type { ScaffoldPick } from "@/editor/tools/types"

export type RunOptions = {
  keepSelection?: boolean
  /** A rejection is expected (a key that cannot apply here), so do not log it. */
  quiet?: boolean
  /** Told which op was rejected and why, for callers that report it (the embedding API). */
  onReject?: (rejection: { index: number; error: string }) => void
}

/**
 * The one way the editor changes the drawing (editor.run): apply the ops to the latest
 * drawing, commit the result as one undo step and hand it back (names, problems, added
 * and moved atoms, next hotspot). Null if rejected.
 */
export type Run = (ops: Op[], options?: RunOptions) => Extract<OpsResult, { ok: true }> | null

/** Clicking a bond with the bond tool: a plain single tool cycles the order, others restyle it. */
export function paintOps(mol: Molecule, bondId: number, style: BondStyle): Op[] {
  const bond = bondById(mol, bondId)
  if (!bond) return []
  if (style.order === 1 && style.stereo === "none" && !style.look && bond.stereo === "none" && !bond.look) {
    return [{ op: "set_bond", bond: bondId, order: bond.order === 1 ? 2 : bond.order === 2 ? 3 : 1 }]
  }
  return [{ op: "set_bond", bond: bondId, order: style.order, stereo: style.stereo, look: style.look ?? null }]
}

/**
 * Joining two pieces at what is selected, as ChemDraw does: two bonds of two pieces fuse,
 * two atoms of two pieces become one. Null for any other selection, or one inside one piece.
 */
export function joinOps(mol: Molecule, selection: Selection): Op[] | null {
  const apart = (a: number, b: number) => !componentOf(mol, a).includes(b)
  if (selection.bonds.length === 2) {
    const [first, second] = selection.bonds.map((id) => bondById(mol, id))
    return first && second && apart(first.a, second.a) ? [{ op: "join", bonds: [first.id, second.id] }] : null
  }
  if (selection.bonds.length === 0 && selection.atoms.length === 2 && apart(selection.atoms[0], selection.atoms[1])) {
    return [{ op: "join", atoms: [selection.atoms[0], selection.atoms[1]] }]
  }
  return null
}

/**
 * What placing the chosen scaffold does where the user acts: on an atom it joins by its
 * site, on a bond it fuses by its edge, on empty canvas it stands at that spot. The
 * template tool and the quick template field both build their ops here.
 */
export function scaffoldOps(pick: ScaffoldPick, target: HotTarget | null, at: Point): Op[] {
  if (target?.type === "atom") return [{ op: "add_scaffold", name: pick.name, site: pick.site, to: target.id }]
  if (target?.type === "bond") return [{ op: "add_scaffold", name: pick.name, edge: pick.edge, onto: target.id }]
  return [{ op: "add_scaffold", name: pick.name, at }]
}
