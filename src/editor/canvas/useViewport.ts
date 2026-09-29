import { useEffect, useRef, useSyncExternalStore } from "react"
import { ZOOM_STEP } from "@/editor/canvas/view"
import type { Viewport } from "@/editor/canvas/viewport"

/**
 * Binds the viewport to the canvas's svg: its box is the canvas on screen, the wheel pans
 * (and zooms with ⌘ or Ctrl, or a trackpad pinch), and the canvas re-renders on every move.
 */
export function useViewport(viewport: Viewport) {
  const svgRef = useRef<SVGSVGElement>(null)
  const view = useSyncExternalStore(viewport.subscribe, viewport.get)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    viewport.attach(svg)
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        viewport.zoomAt(event.clientX, event.clientY, event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP)
        return
      }
      const { zoom, pan } = viewport.get()
      viewport.set({ zoom, pan: { x: pan.x - event.deltaX, y: pan.y - event.deltaY } })
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      svg.removeEventListener("wheel", onWheel)
      viewport.attach(null)
    }
  }, [viewport])

  return { svgRef, ...view }
}

/** The zoom alone, for labels that should not re-render while the drawing pans. */
export function useZoom(viewport: Viewport): number {
  return useSyncExternalStore(viewport.subscribe, () => viewport.get().zoom)
}
