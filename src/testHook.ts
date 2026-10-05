import type { EditorHandle } from "@/editor/Editor"

declare global {
  interface Window {
    /** The editor's handle, for the browser tests only (vite --mode e2e); absent otherwise. */
    __structura?: EditorHandle
  }
}

/**
 * Hands the editor to the end-to-end tests, so they set up a drawing and check the result
 * as a document instead of guessing from pixels. Only in the e2e build; never in a real one.
 */
export function exposeForTests(handle: EditorHandle | null) {
  if (import.meta.env.MODE === "e2e" && handle) window.__structura = handle
}
