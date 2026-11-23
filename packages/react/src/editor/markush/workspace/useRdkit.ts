import type { MainModule } from "@rdkit/rdkit"
import { useEffect, useState } from "react"
import { loadRDKit } from "../../rdkit.ts"

/** RDKit as the results pane finds it: still loading, there, or not to be had (the wasm could not be fetched). */
export type RdkitState = { state: "loading"; rdkit: null } | { state: "ready"; rdkit: MainModule } | { state: "unavailable"; rdkit: null }

const LOADING: RdkitState = { state: "loading", rdkit: null }

/** RDKit, loaded once something asks for it (`wanted`), so a pane that never needs it never fetches it. */
export function useRdkit(wanted: boolean): RdkitState {
  const [found, setFound] = useState<RdkitState>(LOADING)
  useEffect(() => {
    if (!wanted || found.state !== "loading") return
    let cancelled = false
    loadRDKit().then(
      (rdkit) => !cancelled && setFound({ state: "ready", rdkit }),
      () => !cancelled && setFound({ state: "unavailable", rdkit: null }),
    )
    return () => {
      cancelled = true
    }
  }, [wanted, found.state])
  return found
}
