import { useCallback, useEffect, useState } from "react"
import type { Drawing } from "@structura/core/types"
import { useEnumeration, type EnumerationRun } from "../useEnumeration.ts"

/** How long the drawing must stay unchanged before it is generated again, so typing does not restart it on every key. */
export const SETTLE_MS = 400

export type LiveEnumeration = {
  run: EnumerationRun
  /** Whether edits regenerate on their own, once they settle. */
  auto: boolean
  setAuto: (auto: boolean) => void
  /** Whether what is shown was generated from an earlier drawing than the current one. */
  stale: boolean
  /** Generates the current drawing now, again even when it has not changed. */
  regenerate: () => void
}

/**
 * Keeps `drawing` (null: nothing to generate) expanded as it is edited: each change is
 * generated once the drawing has stayed the same for SETTLE_MS, or only on regenerate()
 * when automatic updating is off.
 */
export function useLiveEnumeration(drawing: Drawing | null, options: Parameters<typeof useEnumeration>[1]): LiveEnumeration {
  const [auto, setAuto] = useState(true)
  /** The drawing being generated, and the editor's drawing it was taken from (a copy, after regenerate, so it runs again). */
  const [target, setTarget] = useState<{ source: Drawing | null; drawing: Drawing | null }>(() => ({ source: drawing, drawing }))
  const stale = target.source !== drawing

  useEffect(() => {
    if (!auto || !stale) return
    const timer = setTimeout(() => setTarget({ source: drawing, drawing }), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [auto, stale, drawing])

  const regenerate = useCallback(() => setTarget({ source: drawing, drawing: drawing && { ...drawing } }), [drawing])
  const run = useEnumeration(target.drawing, options)
  return { run, auto, setAuto, stale, regenerate }
}
