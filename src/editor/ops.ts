import { bondById } from "@structura/core/molecule"
import type { Op, OpsResult } from "@structura/core/ops"
import type { BondStyle, Molecule } from "@structura/core/types"

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
