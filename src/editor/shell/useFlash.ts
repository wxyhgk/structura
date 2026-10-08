import { useCallback, useEffect, useRef, useState } from "react"

/** A short message at the bottom of the editor ("已复制 SMILES"), gone after a moment. */
export function useFlash() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const flash = useCallback((text: string) => {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(null), 2200)
  }, [])
  return { message, flash }
}
