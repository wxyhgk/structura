import { useEffect, useMemo, useState } from "react"
import type { Molecule } from "@structura/core/types"
import { inSlices } from "../asyncSlices.ts"
import { containsQuery, readQuery } from "../structureMatch.ts"
import type { RdkitState } from "./useRdkit.ts"

/** How long the structure box stays unchanged before it is searched with, so typing does not search on every key. */
const TYPING_MS = 350

/** A value that follows `value` once it has stayed the same for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

export type StructureMatch = {
  /**
   * off: nothing asked. waiting: typing, or RDKit loading. searching/done: matches come in as they are found.
   * invalid: not a SMILES or SMARTS (the compounds are not filtered by it). unavailable: no RDKit.
   */
  state: "off" | "waiting" | "searching" | "done" | "invalid" | "unavailable"
  /** Whether `mol` contains the structure; undefined not yet known, null RDKit cannot read it. */
  matches: (mol: Molecule) => boolean | null | undefined
  /** How many times more was found: a new object each time, so what is made from it is made again. */
  version: number
}

/** What the search for one query has found. */
type Search = { query: string; found: WeakMap<Molecule, boolean | null> }

const nothing = () => undefined
const fresh = (query: string): Search => ({ query, found: new WeakMap() })

/**
 * Finds which of `mols` contain `query` (a SMILES or SMARTS, read by RDKit's get_qmol), in
 * slices, so a long list does not stall the page. What was found for one query is kept for it.
 */
export function useStructureMatch(query: string, mols: readonly Molecule[], rdkit: RdkitState): StructureMatch {
  const wanted = query.trim()
  const settled = useSettled(wanted, TYPING_MS)
  /** Counts the times more was found. */
  const [progressed, progress] = useState(0)
  /** The query RDKit found to be neither SMILES nor SMARTS. */
  const [invalid, setInvalid] = useState<string | null>(null)
  const [kept, setKept] = useState(() => fresh(settled))
  // A new query starts a new search (adjusted while rendering, not in an effect).
  if (kept.query !== settled) setKept(fresh(settled))
  const search = kept.query === settled ? kept : fresh(settled)
  const module = rdkit.rdkit
  useEffect(() => {
    if (!settled || !module) return
    let cancelled = false
    const qmol = readQuery(module, settled)
    if (!qmol) {
      // Said once the effect is over, rather than in it.
      void Promise.resolve().then(() => !cancelled && setInvalid(settled))
      return () => {
        cancelled = true
      }
    }
    let last = performance.now()
    void inSlices(
      mols.filter((mol) => !search.found.has(mol)),
      (mol) => void search.found.set(mol, containsQuery(module, qmol, mol)),
      {
        cancelled: () => cancelled,
        onSlice: () => {
          if (performance.now() - last > 150) {
            last = performance.now()
            progress((count) => count + 1)
          }
        },
      },
    ).then((done) => done && progress((count) => count + 1))
    return () => {
      cancelled = true
      qmol.delete()
    }
  }, [settled, module, mols, search])

  const state: StructureMatch["state"] = !wanted
    ? "off"
    : rdkit.state === "unavailable"
      ? "unavailable"
      : wanted !== settled || !module
        ? "waiting"
        : invalid === settled
          ? "invalid"
          : mols.every((mol) => search.found.has(mol))
            ? "done"
            : "searching"
  return useMemo(() => ({ state, matches: state === "searching" || state === "done" ? (mol: Molecule) => search.found.get(mol) : nothing, version: progressed }), [state, search, progressed])
}
