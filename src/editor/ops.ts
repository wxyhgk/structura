import { emptyDrawing } from "@/chem/drawing"
import { bondById } from "@/chem/molecule"
import { applyOps, type Op, type OpsResult } from "@/chem/ops"
import type { BondStyle, Molecule } from "@/chem/types"

/**
 * The one way the editor changes the drawing: run the ops, commit what they produce, and
 * hand back the full result (names, problems, added atoms, next hotspot). Null if rejected.
 */
export function runOps(
  mol: Molecule,
  ops: Op[],
  commit: (mol: Molecule, keepSelection?: boolean) => void,
  options: {
    keepSelection?: boolean
    /** A rejection is expected (a key that does nothing here), so do not log it. */
    quiet?: boolean
  } = {},
): Extract<OpsResult, { ok: true }> | null {
  const result = applyOps({ ...emptyDrawing(), molecule: mol }, ops)
  if (!result.ok) {
    if (!options.quiet) console.warn(`edit rejected at op ${result.index}: ${result.error}`)
    return null
  }
  commit(result.drawing.molecule, options.keepSelection)
  return result
}

/** Clicking a bond with the bond tool: a plain single tool cycles the order, others restyle it. */
export function paintOps(mol: Molecule, bondId: number, style: BondStyle): Op[] {
  const bond = bondById(mol, bondId)
  if (!bond) return []
  if (style.order === 1 && style.stereo === "none" && !style.look && bond.stereo === "none" && !bond.look) {
    return [{ op: "set_bond", bond: bondId, order: bond.order === 1 ? 2 : bond.order === 2 ? 3 : 1 }]
  }
  return [{ op: "set_bond", bond: bondId, order: style.order, stereo: style.stereo, look: style.look ?? null }]
}
