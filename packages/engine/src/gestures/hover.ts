import { RING_SIZE } from "@structura/core/constants"
import { atomById, bondLengthAt, growRingPreview, ringOnBond, ringPoints } from "@structura/core/molecule"
import { fuseReach, fusionSide, fusionTarget } from "../pointer/fusion.ts"
import type { Point } from "@structura/core/types"
import type { HotTarget } from "@structura/core/types"
import { frameAt, selectionFrame } from "../pointer/targeting.ts"
import { aimOf } from "./aim.ts"
import { curveHover } from "./curve.ts"
import type { PointerHost, PointerInput } from "./types.ts"

/** With the ring tool and no drag: where the ring would go, shown before the click. `aimed` is what the pointer is on. */
function ringPreview(host: PointerHost, world: Point, aimed: HotTarget | null) {
  const { mol, ringKind } = host.props
  const zoom = host.zoom()
  const doubles = ringKind === "benzene"
  if (aimed?.type === "atom" && atomById(mol, aimed.id)) {
    const preview = growRingPreview(mol, aimed.id, ringKind)
    return host.setPreview({ kind: "ring", points: preview.points, doubles, anchor: preview.anchor })
  }
  const target = aimed?.type === "atom" ? null : fusionTarget(mol, world, ringKind, fuseReach(RING_SIZE[ringKind], bondLengthAt(mol)) / zoom)
  const [a, b] = target ? [atomById(mol, target.a), atomById(mol, target.b)] : []
  if (target && a && b) return host.setPreview({ kind: "ring", points: ringOnBond(a, b, RING_SIZE[ringKind], fusionSide(mol, target, world)), doubles })
  if (aimed) return host.setPreview(null)
  host.setPreview({ kind: "ring", points: ringPoints(world, RING_SIZE[ringKind], bondLengthAt(mol)), doubles })
}

/** The pointer moving with nothing pressed: what it is over, the frame handle or custom curve under it, and the ring preview. */
export function hover(host: PointerHost, world: Point, event?: PointerInput) {
  const { mol, tool, selection } = host.props
  const zoom = host.zoom()
  const selecting = tool === "lasso" || tool === "marquee"
  // What the press would take: a bond a curve is nearer than is not lit.
  const { hit, curve } = aimOf(host, world, event)
  host.assignHover(hit)
  const frame = selecting ? selectionFrame(mol, selection) : null
  const which = frame ? frameAt(frame, world, zoom) : null
  host.setFrameHandle(which)
  host.setCurveHover(selecting && !which ? curveHover(host, world, curve) : null)
  if (tool === "ring") ringPreview(host, world, hit)
}
