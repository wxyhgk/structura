import { useRef, type PointerEvent } from "react"
import type { Drawing, Molecule, Selection } from "@structura/core/types"
import { doubleClickAction, hitOf, sameHover, type HoverTarget } from "@structura/engine"
import type { EditorSlice } from "./types.ts"

/** Two presses this close in time (ms) and space (px) make a double click. */
const DOUBLE_CLICK_MS = 500
const DOUBLE_CLICK_SLOP = 6

/**
 * Double clicks on the canvas, timed here since pointer events carry no click count:
 * `press` notes each left press, and `doubleClick` says whether this press is the second
 * of a double click on the same atom or bond, and acts on it if so.
 */
export function useDoubleClick({
  props,
  current,
  openLabel,
}: {
  props: Pick<EditorSlice, "tool" | "latest" | "undo" | "selection" | "setSelection" | "viewport">
  current: () => Molecule
  openLabel: (atom: number) => void
}) {
  const { viewport } = props
  /** What the last press hit and the drawing before it, to spot a double click. */
  const firstClick = useRef<{ hit: HoverTarget; before: Drawing; selection: Selection; tool: string; time: number; x: number; y: number } | null>(null)

  /**
   * The second press of a double click on the same atom or bond: soon after the first and
   * close to it. The first press was an ordinary click, which may have drawn a bond, changed
   * a bond order or selected something; that is undone before the double click acts.
   * Returns whether it acted.
   */
  function doubleClick(event: PointerEvent<SVGSVGElement>): boolean {
    const first = firstClick.current
    firstClick.current = null
    if (event.button !== 0 || !first) return false
    if (event.timeStamp - first.time > DOUBLE_CLICK_MS || Math.hypot(event.clientX - first.x, event.clientY - first.y) > DOUBLE_CLICK_SLOP) return false
    // Two presses with different tools are two separate clicks, however quick.
    if (first.tool !== props.tool) return false
    const hit = hitOf(current(), viewport.toWorld(event.clientX, event.clientY), viewport.get().zoom)
    if (!hit || !sameHover(first.hit, hit)) return false
    const action = doubleClickAction(current(), hit)
    // Selecting the molecule is for the selection tools, as in ChemDraw: with the bond tool,
    // two quick clicks on a bond are two clicks, stepping its order twice.
    if (action?.kind === "select" && props.tool !== "lasso" && props.tool !== "marquee") return false
    if (props.latest() !== first.before) props.undo()
    // The first press may have selected what it hit; a double click leaves the selection as it found it.
    if (action?.kind === "label") {
      props.setSelection(first.selection)
      openLabel(action.atom)
    }
    else if (action?.kind === "select") props.setSelection(action.selection)
    return action != null
  }

  /** Notes a press that was not a double click's second, so the next one can be. */
  function press(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    const world = viewport.toWorld(event.clientX, event.clientY)
    firstClick.current = {
      hit: hitOf(current(), world, viewport.get().zoom),
      before: props.latest(),
      selection: props.selection,
      tool: props.tool,
      time: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
    }
  }

  return { doubleClick, press }
}
