import { RING_SIZE } from "@structura/core/constants"
import { atomById, bondLengthAt } from "@structura/core/molecule"
import { fuseReach, fusionSide, fusionTarget } from "../pointer/fusion.ts"
import type { Point } from "@structura/core/types"
import { paintOps, scaffoldOps } from "../ops/builders.ts"
import type { hitOf } from "../pointer/targeting.ts"
import type { PointerHost } from "./types.ts"

/**
 * Tools that act on the press itself, with no drag: the eraser, the charges, an element, a
 * scaffold template, a ring, and the bond tool on a bond. Returns whether the press was
 * theirs; the other tools start a drag instead.
 */
export function clickTool(host: PointerHost, hit: ReturnType<typeof hitOf>, world: Point): boolean {
  const { mol, tool, bondStyle, ringKind, atomEl, scaffold, run } = host.props
  switch (tool) {
    case "eraser":
      if (hit?.type === "atom") run([{ op: "remove", atoms: [hit.id] }])
      else if (hit) run([{ op: "remove", bonds: [hit.id] }])
      return true
    case "charge-plus":
    case "charge-minus": {
      const atom = hit?.type === "atom" ? atomById(mol, hit.id) : undefined
      if (atom) run([{ op: "set_charge", atom: atom.id, charge: Math.max(-3, Math.min(3, atom.charge + (tool === "charge-plus" ? 1 : -1))) }], { keepSelection: true })
      return true
    }
    case "atom":
      if (hit?.type === "atom") run([{ op: "set_element", atom: hit.id, el: atomEl }], { keepSelection: true })
      else if (!hit) run([{ op: "place_atom", el: atomEl, at: world }])
      return true
    case "scaffold":
      run(scaffoldOps(scaffold, hit, world))
      return true
    case "ring": {
      if (hit?.type === "atom") run([{ op: "add_ring", atom: hit.id, kind: ringKind }])
      else {
        const target = fusionTarget(mol, world, ringKind, fuseReach(RING_SIZE[ringKind], bondLengthAt(mol)) / host.zoom())
        if (target) run([{ op: "add_ring", bond: target.id, side: fusionSide(mol, target, world), kind: ringKind }])
        else if (!hit) run([{ op: "add_ring", at: world, kind: ringKind }])
      }
      host.setPreview(null)
      return true
    }
    case "bond":
      if (hit?.type !== "bond") return false
      run(paintOps(mol, hit.id, bondStyle))
      return true
    default:
      return false
  }
}
