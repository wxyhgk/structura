import { ringAt } from "@structura/markush"
import { SNAP_ATOM, addAtom, atomById, nearestAtom } from "@structura/core/molecule"
import type { Point } from "@structura/core/types"
import { attachmentOps } from "../markush/attachmentOps.ts"
import { bracketDropAt } from "../pointer/brackets.ts"
import { hitOf } from "../pointer/targeting.ts"
import { ringHint } from "./hints.ts"
import type { Gesture, GestureKind, PointerHost } from "./types.ts"

type Attach = Extract<Gesture, { kind: "attach" }>

/** The positions the sweep has gathered: a bracket's atoms once it went into one, else those of every ring passed over. */
function candidates(gesture: Attach): number[] {
  if (gesture.bracket) return gesture.bracket.atoms
  return [...new Set(gesture.rings.flatMap((ring) => ring.positions))]
}

/**
 * The pointer at `world`: a ring whose middle it is in joins the candidates (a ring outside
 * the bracket gone into takes the sweep back to rings); off atoms and ring middles, inside a
 * group bracket the atom is outside of, the bracket becomes the target.
 */
function gather(host: PointerHost, gesture: Attach, world: Point) {
  const mol = gesture.mol
  const found = ringAt(mol, world, gesture.from ?? undefined)
  if (found) {
    const key = found.ring.join()
    if (!gesture.rings.some((ring) => ring.ring.join() === key)) gesture.rings = [...gesture.rings, found]
    if (gesture.bracket && !found.ring.every((id) => gesture.bracket!.atoms.includes(id))) gesture.bracket = null
    return
  }
  if (gesture.from == null || hitOf(mol, world, host.zoom())?.type === "atom") return
  const drop = bracketDropAt(mol, host.props.brackets, host.props.attachments, world, gesture.from)
  if (drop) gesture.bracket = drop.bracket
}

/** The preview: a line to the pointer, the rings passed over and the positions gathered. */
function show(host: PointerHost, gesture: Attach, world: Point) {
  const mol = gesture.mol
  const at = (ids: readonly number[]) => ids.flatMap((id) => atomById(mol, id) ?? [])
  const positions = candidates(gesture)
  const a = gesture.from != null ? (atomById(mol, gesture.from) ?? gesture.origin) : gesture.origin
  host.setPreview({ kind: "sweep", a, b: world, rings: gesture.bracket ? [] : gesture.rings.map((ring) => at(ring.ring)), hint: positions.length > 0 ? ringHint(mol, positions) : null })
}

/**
 * The attachment tool: dragged from an atom (or a new R group where the press was), every
 * ring whose middle the pointer passes over becomes a place it may hang from; going into a
 * group bracket, any atom of the bracket. Letting go makes the variable attachment, drawn as
 * the tool's shape, in one step; over no ring it makes nothing. Pressed in a ring's middle,
 * the drag goes the other way: the attachment hangs from where it ends.
 */
export const attach: GestureKind<Attach> = {
  move(host, gesture, world) {
    gather(host, gesture, world)
    show(host, gesture, world)
  },
  up(host, gesture, world) {
    host.setPreview(null)
    gather(host, gesture, world)
    const to = candidates(gesture)
    if (to.length < 2) return
    // Into a bracket it is drawn as one; the tool's shape is for rings.
    const shape = gesture.bracket ? undefined : (host.props.attachShape ?? undefined)
    const mol = gesture.mol
    if (gesture.from != null) {
      host.props.run(attachmentOps(mol, gesture.from, to, { shape, made: gesture.fresh ? gesture.origin : undefined }))
      return
    }
    // Out of the rings: onto an atom outside them, that atom; into the open, a new R group there.
    const zoom = host.zoom()
    const landed = nearestAtom(mol, world, SNAP_ATOM / zoom)
    if (landed) {
      if (!to.includes(landed.id)) host.props.run(attachmentOps(mol, landed.id, to, { shape }))
      return
    }
    if (hitOf(mol, world, zoom) || ringAt(mol, world)) return
    host.props.run(attachmentOps(mol, mol.nextAtomId, to, { shape, made: world }))
  },
}

/**
 * Pressing with the attachment tool: on an atom, the sweep starts from it; in a ring's
 * middle, from that ring; on empty canvas, from a new atom there (in the gesture's molecule
 * only, until it is let go). Nothing on a bond.
 */
export function startAttach(host: PointerHost, hit: ReturnType<typeof hitOf>, world: Point): Gesture | null {
  const { mol } = host.props
  if (hit?.type === "bond") return null
  if (hit?.type === "atom") return { kind: "attach", mol, from: hit.id, fresh: false, origin: atomById(mol, hit.id) ?? world, rings: [], bracket: null }
  const inRing = ringAt(mol, world)
  if (inRing) return { kind: "attach", mol, from: null, fresh: false, origin: world, rings: [inRing], bracket: null }
  // The new atom takes the next id, as place_atom will give it when the drag is let go.
  const made = addAtom(mol, "C", world.x, world.y)
  return { kind: "attach", mol: made.mol, from: made.id, fresh: true, origin: world, rings: [], bracket: null }
}
