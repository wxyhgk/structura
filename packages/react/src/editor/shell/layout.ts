import { createContext, useContext, useLayoutEffect, useState, type RefObject } from "react"

/**
 * How much room the editor has, by its own box (not the window: it is often one panel of a
 * page). full: everything as on a desktop. compact: one row of menus with the workspace switch,
 * the toolbar's less used buttons in its ⋯, the generic formula's panes one at a time. mini:
 * the menus in one ☰ beside the toolbar, no status bar, and, when the host offers it, a button
 * to edit in a larger window.
 */
export type Layout = "full" | "compact" | "mini"

/** Below these the editor's box is compact; below MINI, mini. Either side counts. */
export const COMPACT = { width: 720, height: 520 }
export const MINI = { width: 480, height: 360 }

/** The layout for a box of this size. A box with no size yet (hidden, not laid out) is full. */
export function layoutFor(width: number, height: number): Layout {
  if (width <= 0 || height <= 0) return "full"
  if (width < MINI.width || height < MINI.height) return "mini"
  if (width < COMPACT.width || height < COMPACT.height) return "compact"
  return "full"
}

/** The layout the host asked for, or, for "auto", the one the root's box has now, followed as it resizes. */
export function useLayout(root: RefObject<HTMLElement | null>, asked: Layout | "auto"): Layout {
  const [measured, setMeasured] = useState<Layout>("full")
  useLayoutEffect(() => {
    const element = root.current
    if (asked !== "auto" || !element) return
    const measure = () => setMeasured(layoutFor(element.clientWidth, element.clientHeight))
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [root, asked])
  return asked === "auto" ? measured : asked
}

export const LayoutContext = createContext<Layout>("full")

export function useLayoutContext(): Layout {
  return useContext(LayoutContext)
}
