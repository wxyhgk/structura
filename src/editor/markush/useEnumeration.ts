import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { enumerateSteps, type EnumerateOptions, type Enumeration } from "@structura/markush"
import type { Drawing } from "@structura/core/types"
import { loadRDKit } from "@/editor/rdkit"
import { canonicalIdentity, canonicalSmiles } from "./identity.ts"

/** Work done per slice before the page gets to paint and handle input again. */
const SLICE_MS = 12

export type EnumerationRun = {
  /** What was made so far; null until the first slice has run. */
  result: Enumeration | null
  /** "running" until every combination up to the limit is tried, or the user stops it. */
  status: "running" | "done" | "stopped"
  /** Whether repeats were dropped: asked and done, not asked, or asked but RDKit would not load. */
  dedupe: "on" | "off" | "unavailable"
  stop: () => void
}

/** A copy of the growing result that later steps will not change underneath React. */
function snapshot(result: Enumeration): Enumeration {
  return {
    ...result,
    molecules: result.molecules.slice(),
    picks: result.picks.slice(),
    formulaOf: result.formulaOf.slice(),
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
export function useEnumeration(
  drawing: Drawing | null,
  { limit, representatives, dedupe }: Required<Omit<EnumerateOptions, "identity" | "identifySmiles">> & { dedupe: boolean },
): EnumerationRun {
  const inputs = useMemo(() => (drawing ? { drawing, limit, representatives, dedupe } : null), [drawing, limit, representatives, dedupe])
  const [state, setState] = useState<{ inputs: typeof inputs; result: Enumeration | null; status: EnumerationRun["status"]; dedupe: EnumerationRun["dedupe"] }>({
    inputs: null,
    result: null,
    status: "done",
    dedupe: "off",
  })
  /** Stops the current run, keeping what it made; a no-op once it is over. */
  const stopRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!inputs) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    let steps: ReturnType<typeof enumerateSteps> | null = null
    let dedupe: EnumerationRun["dedupe"] = "off"
    const slice = () => {
      if (!steps) return
      const end = performance.now() + SLICE_MS
      let step = steps.next()
      while (!step.done && performance.now() < end) step = steps.next()
      setState({ inputs, result: snapshot(step.value), status: step.done ? "done" : "running", dedupe })
      if (!step.done) timer = setTimeout(slice, 0)
    }
    const start = (identities?: Pick<EnumerateOptions, "identity" | "identifySmiles">) => {
      if (cancelled) return
      steps = enumerateSteps(inputs.drawing, { limit: inputs.limit, representatives: inputs.representatives, ...identities })
      timer = setTimeout(slice, 0)
    }
    // Dropping repeats needs RDKit's canonical SMILES; without RDKit it all goes ahead, repeats kept.
    if (inputs.dedupe)
      loadRDKit().then(
        (rdkit) => {
          dedupe = "on"
          start({ identity: canonicalIdentity(rdkit), identifySmiles: canonicalSmiles(rdkit) })
        },
        () => {
          dedupe = "unavailable"
          start()
        },
      )
    else start()
    stopRef.current = () => {
      cancelled = true
      clearTimeout(timer)
      setState((current) => {
        if (current.inputs !== inputs) return { inputs, result: null, status: "stopped", dedupe }
        return current.status === "running" ? { ...current, status: "stopped" } : current
      })
    }
    return () => {
      cancelled = true
      clearTimeout(timer)
      stopRef.current = () => {}
    }
  }, [inputs])

  const stop = useCallback(() => stopRef.current(), [])
  if (!inputs || state.inputs !== inputs) return { result: null, status: inputs ? "running" : "done", dedupe: "off", stop }
  return { result: state.result, status: state.status, dedupe: state.dedupe, stop }
}
