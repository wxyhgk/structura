import type { Arrow, Molecule, Point } from "@/chem/types"

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

/**
 * The one owner of zoom and pan. The canvas renders it and the toolbar, status bar, menu
 * commands and imports all read or move it here, so nothing mirrors the zoom. It lives
 * outside React state so panning re-renders the canvas alone, not the whole editor.
 */
export function createViewport() {
  let view = HOME
  let element: { getBoundingClientRect(): Rect } | null = null
  const listeners = new Set<() => void>()

  function set(next: View) {
    view = next
    for (const listener of listeners) listener()
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
    },
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
    /** Zooms around the middle of the canvas. */
    zoomBy(factor: number) {
      const rect = element?.getBoundingClientRect()
      if (rect) set(zoomedAt(view, { x: rect.width / 2, y: rect.height / 2 }, factor))
    },
    reset() {
      set(HOME)
    },
    /** Zooms and pans so all the points fit; nothing happens with no points. */
    fit(points: Point[]) {
      const rect = element?.getBoundingClientRect()
      const next = rect ? fittedView(points, rect.width, rect.height) : null
      if (next) set(next)
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
