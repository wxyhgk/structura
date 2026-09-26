import type { MainModule } from "@rdkit/rdkit"

let loading: Promise<MainModule> | null = null

/**
 * Loads RDKit (about 2.4 MB of WebAssembly, gzipped) the first time something needs it,
 * so drawing never waits for it. Later calls share the same module.
 */
export function loadRDKit(): Promise<MainModule> {
  loading ??= (async () => {
    const [{ default: init }, { default: wasmUrl }] = await Promise.all([
      import("@rdkit/rdkit"),
      import("@rdkit/rdkit/RDKit_minimal.wasm?url"),
    ])
    const rdkit = await init({ locateFile: () => wasmUrl })
    rdkit.prefer_coordgen(true)
    return rdkit
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}
