import type { MainModule } from "@rdkit/rdkit"

/** The RDKit release the package is built and tested with; its wasm must match the JS. */
const RDKIT_VERSION = "2026.3.6"

/**
 * Where RDKit's WebAssembly (about 7 MB, 2.4 MB gzipped) is fetched from. By default the
 * public CDN copy of the matching release; a host serving its own copy (offline use, a
 * strict content policy) sets it with `rdkitWasmUrl` on the editor or configureRDKit.
 */
let wasmUrl = `https://cdn.jsdelivr.net/npm/@rdkit/rdkit@${RDKIT_VERSION}/dist/RDKit_minimal.wasm`

let loading: Promise<MainModule> | null = null

/** Sets where RDKit's wasm is fetched from; takes effect if RDKit has not been loaded yet. */
export function configureRDKit({ wasmUrl: url }: { wasmUrl: string }) {
  if (!loading) wasmUrl = url
}

/**
 * Loads RDKit the first time something needs it, so drawing never waits for it. Later calls
 * share the same module; a failed load is tried again next time.
 */
export function loadRDKit(): Promise<MainModule> {
  loading ??= (async () => {
    const { default: init } = await import("@rdkit/rdkit")
    const rdkit = await init({ locateFile: () => wasmUrl })
    rdkit.prefer_coordgen(true)
    return rdkit
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}
