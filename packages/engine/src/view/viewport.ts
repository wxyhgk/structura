import type { Arrow, Molecule, Point } from "@structura/core/types"
import { steppedZoom } from "./zoomLevels.ts"

/** How the drawing sits on screen: screen = pan + world × zoom. */
export type View = { zoom: number; pan: Point }

const HOME: View = { zoom: 1, pan: { x: 0, y: 0 } }
const FIT_MARGIN = 60

export function clampZoom(value: number): number {
  return Math.min(4, Math.max(0.25, value))
}

/** The view zoomed by `factor` around a point on the canvas, which stays where it is. */
export function zoomedAt(view: View, at: Point, factor: number): View {
  const worldX = (at.x - view.pan.x) / view.zoom
  const worldY = (at.y - view.pan.y) / view.zoom
  const zoom = clampZoom(view.zoom * factor)
  return { zoom, pan: { x: at.x - worldX * zoom, y: at.y - worldY * zoom } }
}

/** The view that shows all the points, centred, in a canvas of the given size; null if none. */
export function fittedView(points: Point[], width: number, height: number): View | null {
  if (points.length === 0) return null
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const spanX = Math.max(...xs) - Math.min(...xs) + FIT_MARGIN * 2
  const spanY = Math.max(...ys) - Math.min(...ys) + FIT_MARGIN * 2
  const zoom = Math.min(1.5, Math.max(0.1, Math.min(width / spanX, height / spanY)))
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2
  return { zoom, pan: { x: width / 2 - cx * zoom, y: height / 2 - cy * zoom } }
}

/** Every point a fit has to keep in view: atoms and both ends of each arrow. */
export function drawingPoints(mol: Molecule, arrows: Arrow[]): Point[] {
  return [...mol.atoms, ...arrows.flatMap((arrow) => [{ x: arrow.x1, y: arrow.y1 }, { x: arrow.x2, y: arrow.y2 }])]
}

type Rect = { left: number; top: number; width: number; height: number }
type Size = { width: number; height: number }

/** The element's size, or null while it has none (display: none, a 0×0 container). */
function sizeOf(rect: Rect | undefined): Size | null {
  return rect && rect.width > 0 && rect.height > 0 ? { width: rect.width, height: rect.height } : null
}

/**
 * The one owner of zoom and pan. The canvas renders it and the toolbar, status bar, menu
 * commands and imports all read or move it here, so nothing mirrors the zoom. It lives
 * outside React state so panning re-renders the canvas alone, not the whole editor.
 */
export function createViewport() {
  let view = HOME
  let element: { getBoundingClientRect(): Rect } | null = null
  /** The canvas's size when last seen with one: a resize keeps the middle of the view where it was. */
  let size: Size | null = null
  /** A fit asked for while the canvas had no size, made once it has one. */
  let pendingFit: Point[] | null = null
  const listeners = new Set<() => void>()

  function set(next: View) {
    view = next
    for (const listener of listeners) listener()
  }

  /** Zooms and pans so all the points fit in a canvas of this size. */
  function fitTo(points: Point[], next: Size) {
    size = next
    const fitted = fittedView(points, next.width, next.height)
    if (fitted) set(fitted)
  }

  /**
   * The canvas may have a new size: the first one it has makes a fit that waited for it; a
   * change after that moves the view by half of it, so what was in the middle stays there.
   */
  function resize() {
    const next = sizeOf(element?.getBoundingClientRect())
    if (!next) return
    if (pendingFit) {
      const points = pendingFit
      pendingFit = null
      fitTo(points, next)
      return
    }
    const last = size
    size = next
    if (!last || (last.width === next.width && last.height === next.height)) return
    set({ zoom: view.zoom, pan: { x: view.pan.x + (next.width - last.width) / 2, y: view.pan.y + (next.height - last.height) / 2 } })
  }

  /** Zooms around the middle of the canvas. */
  function zoomBy(factor: number) {
    const rect = element?.getBoundingClientRect()
    if (rect) set(zoomedAt(view, { x: rect.width / 2, y: rect.height / 2 }, factor))
  }

  return {
    get: (): View => view,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** The element whose box is the canvas on screen. */
    attach(next: { getBoundingClientRect(): Rect } | null) {
      element = next
      resize()
    },
    /** Call when the canvas's box may have changed size (a ResizeObserver on it). */
    resize,
    set,
    toWorld(clientX: number, clientY: number): Point {
      const rect = element?.getBoundingClientRect()
      return {
        x: (clientX - (rect?.left ?? 0) - view.pan.x) / view.zoom,
        y: (clientY - (rect?.top ?? 0) - view.pan.y) / view.zoom,
      }
    },
    zoomAt(clientX: number, clientY: number, factor: number) {
      const rect = element?.getBoundingClientRect()
      if (rect) set(zoomedAt(view, { x: clientX - rect.left, y: clientY - rect.top }, factor))
    },
    zoomBy,
    /** Zooms around the middle of the canvas to the next preset level up (1) or down (−1). */
    zoomStep(direction: 1 | -1) {
      zoomBy(steppedZoom(view.zoom, direction) / view.zoom)
    },
    reset() {
      set(HOME)
    },
    /**
     * Zooms and pans so all the points fit; nothing happens with no points. A canvas with no
     * size yet (in a hidden tab) would fit at the smallest zoom, so it waits for its first size.
     */
    fit(points: Point[]) {
      const next = sizeOf(element?.getBoundingClientRect())
      pendingFit = next ? null : points
      if (next) fitTo(points, next)
    },
    /** The world point at the middle of the canvas: where new content lands on an empty page. */
    centre(): Point {
      const rect = element?.getBoundingClientRect()
      const middle = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 }
      return { x: (middle.x - view.pan.x) / view.zoom, y: (middle.y - view.pan.y) / view.zoom }
    },
  }
}

export type Viewport = ReturnType<typeof createViewport>
