import { useEffect, useRef } from "react"

/**
 * Listens on window for the component's lifetime. The handler is new every render and the
 * listener always calls the latest one, so it is added once instead of on every render.
 */
export function useWindowListener<K extends keyof WindowEventMap>(type: K, handler: (event: WindowEventMap[K]) => void): void {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    const listener = (event: WindowEventMap[K]) => latest.current(event)
    window.addEventListener(type, listener)
    return () => window.removeEventListener(type, listener)
  }, [type])
}
