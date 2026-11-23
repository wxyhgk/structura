import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { Molecule } from "@structura/core/types"
import { computeProperties, peekProperties, type RdProps } from "../properties.ts"
import type { RdkitState } from "./useRdkit.ts"

// What has been computed is shared by everyone showing compounds (the table's rows, a
// filter, a sort): each asks for its molecules, and all are told when more are ready.

let version = 0
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
const announce = () => {
  version++
  for (const listener of listeners) listener()
}

/** How often at most the page hears of progress: each time redraws the rows that changed. */
const ANNOUNCE_MS = 150

/** What is known of the molecules asked for: a new object whenever more is computed, so what is made from it is made again. */
export type PropertiesWork = {
  /** The properties computed so far; undefined for a molecule not done yet, null for one RDKit cannot read. */
  get: (mol: Molecule) => RdProps | null | undefined
  /** How many of the molecules asked for are not done yet. */
  pending: number
  /** What had been announced when this was made. */
  version: number
}

/**
 * Has RDKit's properties of `mols` computed, in slices, as soon as RDKit is there; the
 * component redraws as they arrive. Pass a list that keeps its identity while the molecules do.
 */
export function useProperties(mols: readonly Molecule[], rdkit: RdkitState): PropertiesWork {
  const seen = useSyncExternalStore(subscribe, () => version)
  const module = rdkit.rdkit
  useEffect(() => {
    // Nothing to compute announces nothing: a list rebuilt after each announcement would else never settle.
    if (!module || mols.every((mol) => peekProperties(mol) !== undefined)) return
    let cancelled = false
    let last = performance.now()
    void computeProperties(module, mols, {
      cancelled: () => cancelled,
      onSlice: () => {
        if (performance.now() - last >= ANNOUNCE_MS) {
          last = performance.now()
          announce()
        }
      },
    }).then((done) => done && announce())
    return () => {
      cancelled = true
    }
  }, [module, mols])
  return useMemo(() => ({ get: peekProperties, pending: mols.filter((mol) => peekProperties(mol) === undefined).length, version: seen }), [mols, seen])
}
