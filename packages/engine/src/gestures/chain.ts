import { ringPositionsAt } from "@structura/markush"
import { atomById, bondLengthAt, chainPoints } from "@structura/core/molecule"
import { chainCount } from "../pointer/chain.ts"
import { angleTo, snapAngle } from "@structura/core/geometry"
import type { Point } from "@structura/core/types"
import type { hitOf } from "../pointer/targeting.ts"
import { ringHint } from "./hints.ts"
import type { Gesture, GestureKind, PointerHost } from "./types.ts"

type ChainGesture = Extract<Gesture, { kind: "chain" }>

/**
 * The zigzag the chain tool draws toward the pointer. Its direction snaps to 30° steps
 * (not with Alt), except when the pointer is inside a ring: then it aims straight there and
 * ends exactly at the pointer, so the chain attaches at any of that ring's free positions,
 * which are returned too.
 */
function chainTo(gesture: ChainGesture, world: Point, free: boolean) {
  const mol = gesture.mol
  const positions = ringPositionsAt(mol, world, gesture.fromId ?? undefined)
  const distance = Math.hypot(world.x - gesture.origin.x, world.y - gesture.origin.y)
  const axis = free || positions ? angleTo(gesture.origin, world) : snapAngle(angleTo(gesture.origin, world))
  const length = bondLengthAt(mol, gesture.fromId ?? undefined)
  const points = chainPoints(gesture.origin, axis, chainCount(distance, length), length)
  if (positions) points[points.length - 1] = world
  return { points, positions }
}

/** The chain tool: a drag draws a zigzag chain, as long as the drag. */
export const chain: GestureKind<ChainGesture> = {
  move(host, gesture, world, event) {
    const { points, positions } = chainTo(gesture, world, event.altKey)
    host.setPreview({ kind: "chain", points })
    host.setRingHint(positions ? ringHint(positions.map((id) => atomById(gesture.mol, id)!)) : null)
  },
  up(host, gesture, world, event) {
    const { points } = chainTo(gesture, world, event.altKey)
    host.setPreview(null)
    host.props.run([{ op: "draw_chain", from: gesture.fromId ?? undefined, points, ringPointer: true }])
  },
}

/** Pressing with the chain tool: the chain starts at the atom pressed, or where the press was. */
export function startChain(host: PointerHost, hit: ReturnType<typeof hitOf>, world: Point): Gesture {
  const { mol } = host.props
  const fromId = hit?.type === "atom" ? hit.id : null
  const origin = fromId != null ? (atomById(mol, fromId) ?? world) : world
  host.setPreview({ kind: "chain", points: chainPoints(origin, 0, 1, bondLengthAt(mol, fromId ?? undefined)) })
  return { kind: "chain", mol, fromId, origin }
}
