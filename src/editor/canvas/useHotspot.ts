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
    /** The pinned atom's id, while that atom still exists. */
    pinnedIn: (mol: Molecule) => (pinnedId != null && atomById(mol, pinnedId) ? pinnedId : null),
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
    /** The target a hover key acts on now: the pin first, else what the pointer is over. */
    active(mol: Molecule): HotTarget | null {
      const pinned = pinRef.current
      if (pinned && atomById(mol, pinned.id)) return { type: "atom", id: pinned.id }
      const current = hoverRef.current
      if (!current) return null
      if (current.type === "atom" && atomById(mol, current.id)) return current
      if (current.type === "bond" && mol.bonds.some((bond) => bond.id === current.id)) return current
      return null
    },
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
