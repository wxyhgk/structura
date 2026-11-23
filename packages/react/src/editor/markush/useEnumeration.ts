import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { enumerateSteps, type EnumerateOptions, type Enumeration } from "@structura/markush"
import type { Drawing } from "@structura/core/types"
import { loadRDKit } from "../rdkit.ts"
import { canonicalIdentity, canonicalSmiles } from "./identity.ts"
import { runSlice } from "./slice.ts"

/** Work done per slice before the page gets to paint and handle input again. */
const SLICE_MS = 12
/**
 * How often a running enumeration shows its progress. Every update re-renders the results;
 * showing each 12 ms slice kept the page busy rendering, so the pointer's hover lagged.
 */
const SHOW_MS = 200

/** Whether the user is waiting on the page (Chromium can tell); a slice then gives way at once. */
const inputPending = (): boolean => (navigator as Navigator & { scheduling?: { isInputPending?: () => boolean } }).scheduling?.isInputPending?.() ?? false

export type EnumerationRun = {
  /** What was made so far; null until the first slice has run. */
  result: Enumeration | null
  /** "running" until every combination up to the limit is tried, or the user stops it. */
  status: "running" | "done" | "stopped"
  /** Whether repeats were dropped: asked and done, not asked, or asked but RDKit would not load. */
  dedupe: "on" | "off" | "unavailable"
  /** Why the run ended early, in words, when a step threw; the run is then "stopped" with what was made before. */
  error: string | null
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
  { limit, representatives, dedupe, order }: Required<Omit<EnumerateOptions, "identity" | "identifySmiles" | "onCompound">> & { dedupe: boolean },
): EnumerationRun {
  const inputs = useMemo(() => (drawing ? { drawing, limit, representatives, dedupe, order } : null), [drawing, limit, representatives, dedupe, order])
  const [state, setState] = useState<{ inputs: typeof inputs; result: Enumeration | null; status: EnumerationRun["status"]; dedupe: EnumerationRun["dedupe"]; error: string | null }>({
    inputs: null,
    result: null,
    status: "done",
    dedupe: "off",
    error: null,
  })
  /** Stops the current run, keeping what it made; a no-op once it is over. */
  const stopRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!inputs) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    let steps: ReturnType<typeof enumerateSteps> | null = null
    let dedupe: EnumerationRun["dedupe"] = "off"
    let shown = 0
    /** Ends the run where it is, saying why. */
    const fail = (error: string, last?: Enumeration) => {
      steps = null
      if (!cancelled) setState((current) => ({ inputs, result: last ? snapshot(last) : current.inputs === inputs ? current.result : null, status: "stopped", dedupe, error }))
    }
    const slice = () => {
      if (!steps) return
      const end = performance.now() + SLICE_MS
      const made = runSlice(steps, () => performance.now() < end && !inputPending())
      if (made.error != null) return fail(made.error, made.last?.value)
      const { step } = made
      const now = performance.now()
      // The first result at once, then progress every SHOW_MS, and the end as soon as it comes.
      if (step.done || shown === 0 || now - shown >= SHOW_MS) {
        shown = now
        setState({ inputs, result: snapshot(step.value), status: step.done ? "done" : "running", dedupe, error: null })
      }
      if (!step.done) timer = setTimeout(slice, 0)
    }
    const start = (identities?: Pick<EnumerateOptions, "identity" | "identifySmiles">) => {
      if (cancelled) return
      try {
        steps = enumerateSteps(inputs.drawing, { limit: inputs.limit, representatives: inputs.representatives, order: inputs.order, ...identities })
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error))
      }
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
        if (current.inputs !== inputs) return { inputs, result: null, status: "stopped", dedupe, error: null }
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
  if (!inputs || state.inputs !== inputs) return { result: null, status: inputs ? "running" : "done", dedupe: "off", error: null, stop }
  return { result: state.result, status: state.status, dedupe: state.dedupe, error: state.error, stop }
}
