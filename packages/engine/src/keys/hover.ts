import { bondById, componentOf, selectionFromAtoms } from "@structura/core/molecule"
import type { HotTarget, Molecule, Point, Selection } from "@structura/core/types"
import { hotkeyOps } from "../hotkeys/lookup.ts"
import type { Run } from "../ops/builders.ts"
import { pointerSide } from "../pointer/fusion.ts"
import { arrowDirection, chainEndToward, neighborToward } from "../pointer/arrowStep.ts"
import { keyOf, type KeyEventLike } from "./keymap.ts"

/** How near a bond's line, in screen pixels, the pointer counts as on it: a ring key there takes the side with room. */
export const RING_SIDE_DEAD = 2

/** What a key over the hotspot needs from the canvas it was pressed on. */
export type HoverKeyHost = {
  mol: Molecule
  /** Where the key acts: the atom or bond under the pointer, or the pinned hotspot. */
  hot: HotTarget
  selection: Selection
  /** The pointer, in drawing coordinates, when known; and the zoom, to measure it in screen pixels. */
  pointer: Point | null
  zoom: number
  run: Run
  setSelection: (selection: Selection) => void
  /** Moves the hotspot to where a key leaves it (see createHotspot), or lets it go. */
  remember: (next: HotTarget, mol: Molecule) => void
  unpin: () => void
  /** Opens the label field on an atom; whether it opened. */
  openLabel: (atom: number) => boolean
}

/**
 * A key pressed over the hotspot (step 1 and 2 of routeKey): g selects it, Tab its whole
 * molecule, Enter opens the atom's label, arrows walk the hotspot along bonds (⇧ to the chain's
 * end), and chemistry keys edit it (hotkeyOps). Whether the key was used; one that means
 * nothing here is left for the tool keys.
 */
export function hoverKey(event: KeyEventLike, host: HoverKeyHost): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  const { mol, hot } = host
  const direction = arrowDirection(event.key)
  if (direction) {
    // Arrows walk the hotspot along bonds. With a selection they keep their own meaning (⇧ moves it).
    const selected = host.selection.atoms.length > 0 || host.selection.bonds.length > 0
    if (hot.type !== "atom" || selected) return false
    const next = event.shiftKey ? chainEndToward(mol, hot.id, direction) : neighborToward(mol, hot.id, direction)
    if (next != null) host.remember({ type: "atom", id: next }, mol)
    return true
  }
  const key = keyOf(event)
  if (key === "g") {
    host.setSelection(hot.type === "atom" ? { atoms: [hot.id], bonds: [] } : { atoms: [], bonds: [hot.id] })
    return true
  }
  if (event.key === "Tab" && hot.type === "atom") {
    host.setSelection(selectionFromAtoms(mol, componentOf(mol, hot.id)))
    host.unpin()
    return true
  }
  if (event.key === "Enter" && hot.type === "atom") return host.openLabel(hot.id)
  // A ring key over a bond puts the ring on the side the pointer is on (a bond is only ever
  // hot under the pointer); right on the line, it takes the side with room.
  const bond = hot.type === "bond" ? bondById(mol, hot.id) : undefined
  const side = bond && host.pointer ? pointerSide(mol, bond, host.pointer, RING_SIDE_DEAD / host.zoom) : undefined
  // A key that means nothing here falls through to the tool keys. One that means something
  // but cannot apply (no room for the ring) is still used up, so it never switches tools.
  const ops = hotkeyOps(mol, hot, key, undefined, side)
  if (!ops) return false
  // A key on the atom under the pointer leaves the selection alone; it may be elsewhere.
  const result = host.run(ops, { quiet: true, keepSelection: true })
  if (result?.next) host.remember(result.next, result.drawing.molecule)
  return true
}
