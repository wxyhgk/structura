import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { enumerateSteps, type EnumerateOptions, type Enumeration } from "@/chem/markush/enumerate"
import type { Drawing } from "@/chem/types"

/** Work done per slice before the page gets to paint and handle input again. */
const SLICE_MS = 12

export type EnumerationRun = {
  /** What was made so far; null until the first slice has run. */
  result: Enumeration | null
  /** "running" until every combination up to the limit is tried, or the user stops it. */
  status: "running" | "done" | "stopped"
  stop: () => void
}

/** A copy of the growing result that later steps will not change underneath React. */
function snapshot(result: Enumeration): Enumeration {
  return {
    ...result,
    molecules: result.molecules.slice(),
    classesLeftOut: { ...result.classesLeftOut },
    represented: { ...result.represented },
    misfits: { ...result.misfits },
    onlyClasses: result.onlyClasses.slice(),
    failures: result.failures.slice(),
  }
}

/**
 * Expands `drawing` (null: nothing to do) in short timer slices, so the page stays
 * responsive and shows progress. New inputs start a new run; results of an earlier run are
 * never shown for later inputs, since each run's state is tagged with the inputs it is for.
 */
export function useEnumeration(drawing: Drawing | null, { limit, representatives }: Required<EnumerateOptions>): EnumerationRun {
  const inputs = useMemo(() => (drawing ? { drawing, limit, representatives } : null), [drawing, limit, representatives])
  const [state, setState] = useState<{ inputs: typeof inputs; result: Enumeration | null; status: EnumerationRun["status"] }>({
    inputs: null,
    result: null,
    status: "done",
  })
  /** Stops the current run, keeping what it made; a no-op once it is over. */
  const stopRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!inputs) return
    const steps = enumerateSteps(inputs.drawing, { limit: inputs.limit, representatives: inputs.representatives })
    let timer: ReturnType<typeof setTimeout> | undefined
    const slice = () => {
      const end = performance.now() + SLICE_MS
      let step = steps.next()
      while (!step.done && performance.now() < end) step = steps.next()
      setState({ inputs, result: snapshot(step.value), status: step.done ? "done" : "running" })
      if (!step.done) timer = setTimeout(slice, 0)
    }
    stopRef.current = () => {
      clearTimeout(timer)
      setState((current) => {
        if (current.inputs !== inputs) return { inputs, result: null, status: "stopped" }
        return current.status === "running" ? { ...current, status: "stopped" } : current
      })
    }
    timer = setTimeout(slice, 0)
    return () => {
      clearTimeout(timer)
      stopRef.current = () => {}
    }
  }, [inputs])

  const stop = useCallback(() => stopRef.current(), [])
  if (!inputs || state.inputs !== inputs) return { result: null, status: inputs ? "running" : "done", stop }
  return { result: state.result, status: state.status, stop }
}
