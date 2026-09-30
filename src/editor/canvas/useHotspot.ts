import { useCallback, useEffect, useRef, useState } from "react"
import { atomById } from "@/chem/molecule"
import type { HotTarget, Molecule } from "@/chem/types"
import { sameHover } from "@/editor/canvas/targeting"
import type { HoverTarget } from "@/editor/canvas/types"

/** How far the pointer may drift before a pinned hotspot lets go, in screen pixels. */
const PIN_SLACK = 6

type Pin = { id: number; x: number; y: number; covered: HoverTarget }

/**
 * Where hover keys land: the atom or bond under the pointer, or a pinned hotspot. After a
 * key grows the drawing, the new tip is pinned (the green circle) so the next key goes
 * there while the pointer rests; it lets go once the pointer moves onto something else.
 * `scope` changes (tool or ring kind) clear the hover.
 */
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

export function useHotspot(scope: string) {
  const [hover, setHover] = useState<HoverTarget>(null)
  const [pinnedId, setPinnedId] = useState<number | null>(null)
  const hoverRef = useRef<HoverTarget>(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const pinRef = useRef<Pin | null>(null)

  const [scopeSeen, setScopeSeen] = useState(scope)
  if (scopeSeen !== scope) {
    setScopeSeen(scope)
    setHover(null)
  }

  useEffect(() => {
    hoverRef.current = hover
  })

  function pin(id: number) {
    pinRef.current = { id, x: pointerRef.current.x, y: pointerRef.current.y, covered: hoverRef.current }
    setPinnedId(id)
  }

  // Stable, so effects can depend on it.
  const unpin = useCallback(() => {
    pinRef.current = null
    setPinnedId(null)
  }, [])

  return {
    hover,
    assignHover(next: HoverTarget) {
      hoverRef.current = next
      setHover((current) => (sameHover(current, next) ? current : next))
    },
    clearHover() {
      hoverRef.current = null
      setHover(null)
    },
    /** What the pointer itself is over now, whatever is pinned. */
    under: (): HoverTarget => hoverRef.current,
    /** Where a key acts right now (see resolveTarget). */
    active: (mol: Molecule): HotTarget | null => resolveTarget(mol, hoverRef.current, pinRef.current),
    /** The same, from rendered state: the one atom or bond the canvas marks. */
    target: (mol: Molecule): HotTarget | null => resolveTarget(mol, hover, pinnedId != null ? pinRef.current : null),
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
      pointerRef.current = { x: clientX, y: clientY }
      const pinned = pinRef.current
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

export type Hotspot = ReturnType<typeof useHotspot>
