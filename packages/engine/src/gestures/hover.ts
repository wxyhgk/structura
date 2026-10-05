import { RING_SIZE } from "@structura/core/constants"
import { atomById, bondLengthAt, fuseReach, fusionSide, fusionTarget, growRingPreview, ringOnBond, ringPoints } from "@structura/core/molecule"
import type { Point } from "@structura/core/types"
import { frameAt, handleCursor, hitOf, hoverOf, selectionFrame } from "../pointer/targeting.ts"
import type { PointerHost } from "./types.ts"

/** With the ring tool and no drag: where the ring would go, shown before the click. */
function ringPreview(host: PointerHost, world: Point) {
  const { mol, ringKind } = host.props
  const zoom = host.zoom()
  const doubles = ringKind === "benzene"
  const aimed = hitOf(mol, world, zoom)
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

/** The pointer moving with nothing pressed: what it is over, the frame handle's cursor, and the ring preview. */
export function hover(host: PointerHost, world: Point) {
  const { mol, tool, selection } = host.props
  const zoom = host.zoom()
  host.assignHover(hoverOf(mol, world, zoom))
  const frame = tool === "lasso" || tool === "marquee" ? selectionFrame(mol, selection) : null
  const which = frame ? frameAt(frame, world, zoom) : null
  host.setCursor(which ? handleCursor(which) : null)
  if (tool === "ring") ringPreview(host, world)
}
