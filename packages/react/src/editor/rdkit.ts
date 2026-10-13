import type { MainModule } from "@rdkit/rdkit"

/** The RDKit release the package is built and tested with; its wasm must match the JS. */
const RDKIT_VERSION = "2026.3.6"

/**
 * Where RDKit's WebAssembly (about 7 MB, 2.4 MB gzipped) is fetched from. By default the
 * public CDN copy of the matching release; a host serving its own copy (offline use, a
 * strict content policy) sets it with configureRDKit.
 */
let wasmUrl = `https://cdn.jsdelivr.net/npm/@rdkit/rdkit@${RDKIT_VERSION}/dist/RDKit_minimal.wasm`

/** An RDKit the host loaded itself and lends us, instead of a second one. */
let lent: MainModule | Promise<MainModule> | null = null

let loading: Promise<MainModule> | null = null

/** How a host tells the editor where its RDKit comes from. */
export type RDKitOptions = {
  /** Where to fetch RDKit_minimal.wasm from, matching this package's @rdkit/rdkit release. */
  wasmUrl?: string
  /**
   * An RDKit module the page already has (`await initRDKitModule()` from @rdkit/rdkit), or a
   * promise of one: used instead of loading a second copy. Structura switches it to Coordgen
   * layouts (`prefer_coordgen(true)`), which then holds for the page's own uses too.
   */
  module?: MainModule | Promise<MainModule>
}

/**
 * Where RDKit comes from. Only before RDKit is first needed (a SMILES, an identifier, a
 * <chem-molecule smiles> on the page): after that it is too late, and says so in the console.
 * Each entry of the package (chem-structura, chem-structura/standalone) keeps its own setting:
 * call the configureRDKit of the one in use.
 */
export function configureRDKit({ wasmUrl: url, module }: RDKitOptions) {
  if (loading) {
    console.warn("chem-structura: configureRDKit came after RDKit had started loading, and changes nothing. Call it before any SMILES is read, e.g. right after loading chem-structura.")
    return
  }
  if (url) wasmUrl = url
  if (module) lent = module
}

/**
 * Loads RDKit the first time something needs it, so drawing never waits for it. Later calls
 * share the same module; a failed load is tried again next time.
 */
export function loadRDKit(): Promise<MainModule> {
  loading ??= (async () => {
    const rdkit = lent ? await lent : await import("@rdkit/rdkit").then(({ default: init }) => init({ locateFile: () => wasmUrl }))
    rdkit.prefer_coordgen(true)
    return rdkit
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}
