// chem-structura/standalone: the editor for a page without React, React bundled in. A page
// includes "chem-structura/style.css" once, sizes an element and calls mount(element); the
// handle it gets back is the React component's ref handle, plus unmount(). Everything in
// chem-structura/core comes along, so a page can also show structures without opening the
// editor (drawingSvg…) from the one file. Built twice: as an ES module (dist/standalone.js)
// and for a plain <script> (dist/chem-structura.iife.js, which sets window.ChemStructura).
import { createRef } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { Editor, type EditorHandle, type EditorProps } from "./editor/Editor.tsx"

export type { EditorHandle, EditorProps, EnumerateOptions, Enumeration, FillVariables, Op, RecognizeStructure, RunResult } from "./editor/Editor.tsx"
export type { TemplateStore } from "./editor/templates/store.ts"
export { httpTemplateStore } from "./editor/templates/httpStore.ts"
export { memoryTemplateStore } from "./editor/templates/memoryStore.ts"
export { configureRDKit } from "./editor/rdkit.ts"
export { applyOps, displayFormula, drawingCdxml, drawingFromMolfile, drawingMolfile, drawingSvg, elementalAnalysis, emptyDrawing, enumerate, enumerationSdf } from "./core.ts"
export { exactMass, isDocument, librarySize, molecularWeight, netCharge, plainFormula, readDocument, readMolfile, readSdf, toDocument, toMolfile, toSdf, validateDrawing } from "./core.ts"
export type { Arrow, Atom, Bond, Bracket, Drawing, ExportOptions, LibrarySize, Molecule, MolRecord, OpsResult, Problem } from "./core.ts"

/** The options of mount(): the component's props. */
export type MountOptions = EditorProps

/** A mounted editor: the component's ref handle, and unmount() to take it off the page. */
export type MountedEditor = EditorHandle & {
  /** Removes the editor from its element; the handle cannot be used after. */
  unmount(): void
}

/**
 * Puts an editor in `target` (an element, or a selector for one), which it fills: give the
 * element a size. Returns once the editor is on the page, its handle ready to use.
 */
export function mount(target: Element | string, options: MountOptions = {}): MountedEditor {
  const element = typeof target === "string" ? document.querySelector(target) : target
  if (!element) throw new Error(`chem-structura: no element matches ${JSON.stringify(target)}`)
  const ref = createRef<EditorHandle>()
  const root = createRoot(element)
  flushSync(() => root.render(<Editor ref={ref} {...options} />))
  const handle = ref.current
  if (!handle) throw new Error("chem-structura: the editor did not start")
  let mounted = true
  /** Each call goes to the handle the editor has now, so it always sees the latest drawing. */
  const live = <K extends keyof EditorHandle>(name: K) =>
    ((...args: unknown[]) => {
      if (!mounted || !ref.current) throw new Error("chem-structura: the editor was unmounted")
      return (ref.current[name] as (...args: unknown[]) => unknown)(...args)
    }) as EditorHandle[K]
  return {
    getMolfile: live("getMolfile"),
    setMolfile: live("setMolfile"),
    getDocument: live("getDocument"),
    setDocument: live("setDocument"),
    getCdxml: live("getCdxml"),
    run: live("run"),
    enumerate: live("enumerate"),
    fit: live("fit"),
    unmount() {
      if (!mounted) return
      mounted = false
      root.unmount()
    },
  }
}
