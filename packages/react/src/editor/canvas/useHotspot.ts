import { useLayoutEffect, useState, useSyncExternalStore } from "react"
import { createHotspot } from "@structura/engine"

/**
 * The engine's hotspot (where hover keys land) for one canvas, re-rendering it when the
 * hover or the pin changes. `scope` (the tool and ring kind) changing clears the hover.
 */
export function useHotspot(scope: string) {
  const [hotspot] = useState(createHotspot)
  useSyncExternalStore(hotspot.subscribe, hotspot.view)
  useLayoutEffect(() => {
    hotspot.clearHover()
  }, [hotspot, scope])
  // The marked target is where a key acts: one rule, read at render.
  return { ...hotspot, target: hotspot.active }
}
