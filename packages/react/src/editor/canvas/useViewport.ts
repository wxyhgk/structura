import { useEffect, useRef, useSyncExternalStore } from "react"
import { type Viewport, ZOOM_STEP } from "@structura/engine"

/**
 * Binds the viewport to the canvas's svg: its box is the canvas on screen, the wheel pans
 * (and zooms with ⌘ or Ctrl, or a trackpad pinch), and the canvas re-renders on every move.
 * The viewport hears when the box changes size: a hidden editor's first fit waits for one,
 * and a resized canvas keeps its middle.
 */
export function useViewport(viewport: Viewport) {
  const svgRef = useRef<SVGSVGElement>(null)
  const view = useSyncExternalStore(viewport.subscribe, viewport.get, viewport.get)

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
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => viewport.resize())
    observer?.observe(svg)
    return () => {
      svg.removeEventListener("wheel", onWheel)
      observer?.disconnect()
      viewport.attach(null)
    }
  }, [viewport])

  return { svgRef, ...view }
}

/** The zoom alone, for labels that should not re-render while the drawing pans. */
export function useZoom(viewport: Viewport): number {
  const zoom = () => viewport.get().zoom
  return useSyncExternalStore(viewport.subscribe, zoom, zoom)
}
