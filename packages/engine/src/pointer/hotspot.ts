import { atomById } from "@structura/core/molecule"
import type { HotTarget, Molecule } from "@structura/core/types"
import { sameHover } from "./targeting.ts"
import type { HoverTarget } from "./types.ts"

/** How far the pointer may drift before a pinned hotspot lets go, in screen pixels. */
const PIN_SLACK = 6

/** A pinned hotspot: the atom, where the pointer was when it was pinned, and what the pointer covered then. */
type Pin = { id: number; x: number; y: number; covered: HoverTarget }

/**
 * Where the next key acts, the one place the canvas marks: the atom or bond under the
 * pointer, as in ChemDraw, else the hotspot the last key left. Right after a key, while the
 * pointer still rests on the atom it was pressed on, the hotspot wins, so keys chain.
 */
export function resolveTarget(mol: Molecule, hover: HoverTarget, pin: Pin | null): HotTarget | null {
  const pointed =
    hover && (hover.type === "atom" ? atomById(mol, hover.id) : mol.bonds.some((bond) => bond.id === hover.id)) ? hover : null
  const pinned: HotTarget | null = pin && atomById(mol, pin.id) ? { type: "atom", id: pin.id } : null
  if (!pinned) return pointed
  if (!pointed || sameHover(pointed, pinned) || (pin!.covered != null && sameHover(pointed, pin!.covered))) return pinned
  return pointed
}

/**
 * Where hover keys land, kept outside any framework: the atom or bond under the pointer, or
 * a pinned hotspot. After a key grows the drawing, the new tip is pinned so the next key
 * goes there while the pointer rests; it lets go once the pointer moves onto something
 * else. A view re-renders from `subscribe` when the hover or the pin changes.
 */
export function createHotspot() {
  let hover: HoverTarget = null
  let pinned: Pin | null = null
  let pointer = { x: 0, y: 0 }
  let view: { hover: HoverTarget; pinnedId: number | null } = { hover, pinnedId: null }
  const listeners = new Set<() => void>()

  function changed() {
    view = { hover, pinnedId: pinned?.id ?? null }
    for (const listener of listeners) listener()
  }

  function pin(id: number) {
    pinned = { id, x: pointer.x, y: pointer.y, covered: hover }
    changed()
  }

  function unpin() {
    if (!pinned) return
    pinned = null
    changed()
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** What a view draws from: a new object whenever the hover or the pin changes. */
    view: () => view,
    assignHover(next: HoverTarget) {
      if (sameHover(hover, next)) return
      hover = next
      changed()
    },
    clearHover() {
      if (hover == null) return
      hover = null
      changed()
    },
    /** What the pointer itself is over now, whatever is pinned. */
    under: (): HoverTarget => hover,
    /** Where a key acts right now (see resolveTarget); also the one atom or bond the canvas marks. */
    active: (mol: Molecule): HotTarget | null => resolveTarget(mol, hover, pinned),
    /** Pins where a key's result says the next key should go; a bond or nothing unpins. */
    remember(next: HotTarget, mol: Molecule) {
      if (next.type === "atom" && atomById(mol, next.id)) pin(next.id)
      else unpin()
    },
    pin,
    unpin,
    /**
     * Follows the pointer; `under` finds what it is over. The pin lets go as soon as the
     * pointer is over something other than the pinned atom, as in ChemDraw. The atom the key
     * was pressed on is the one exception, so keys can be pressed again without moving, but
     * only until the pointer leaves it: coming back to it later takes the keys as usual.
     */
    track(clientX: number, clientY: number, under: () => HoverTarget) {
      pointer = { x: clientX, y: clientY }
      if (!pinned) return
      // A little jitter where the key was pressed is not a move; once the pointer has left, it is.
      if (pinned.covered != null && Math.hypot(clientX - pinned.x, clientY - pinned.y) <= PIN_SLACK) return
      const target = under()
      const onCovered = target != null && pinned.covered != null && sameHover(target, pinned.covered)
      if (!onCovered) pinned.covered = null
      const onPinned = target?.type === "atom" && target.id === pinned.id
      if (target && !onPinned && !onCovered) unpin()
    },
  }
}

export type Hotspot = ReturnType<typeof createHotspot>
