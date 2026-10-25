import { useEffect, useImperativeHandle, useRef, type Ref } from "react"
import { readDocument, toDocument } from "@structura/core/document"
import { enumerate, enumerationSdf, type EnumerateOptions, type Enumeration } from "@structura/markush"
import { emptySelection, selectionFromAtoms } from "@structura/core/molecule"
import type { Selection } from "@structura/core/types"
import { toMolfile } from "@structura/core/molfile"
import type { Op, OpsResult } from "@structura/core/ops"
import { failure } from "../browser.ts"
import { drawingCdxml } from "../cdxml.ts"
import { svgToPng } from "../clipboardImage.ts"
import { drawOptions } from "../drawOptions.ts"
import { identifierOf, type IdentifierKind } from "../identifiers.ts"
import { readSmiles } from "../imports/smiles.ts"
import { pictureSvg } from "../pictureSvg.ts"
import { drawingPoints, type Viewport } from "@structura/engine"
import type { Imports } from "./useImports.ts"
import type { EditorState } from "../useEditor.ts"

/** What `run` hands back: the op layer's result, or which op was rejected and why. */
export type RunResult = Extract<OpsResult, { ok: true }> | { ok: false; index: number; error: string }

/** What a host page can do with an embedded editor, through its ref. */
export type EditorHandle = {
  /** The drawing as molfile text: the molecule and its brackets (as Sgroups); a generic formula's variables are not in it. */
  getMolfile(): string
  /**
   * Replaces the drawing with molfile or SD text as one undoable step and fits it in view;
   * blank text clears it. Returns the problems worth telling the user, if any. The host
   * set this text, so onChange and onDocumentChange are not called for it.
   */
  setMolfile(text: string): string[]
  /** The whole drawing as a Structura document (JSON): molecule, arrows, variables, attachments. */
  getDocument(): string
  /**
   * Replaces the drawing with a Structura document, as it was saved, as one undoable step.
   * Returns why it could not be read, or nothing. Not echoed to onChange / onDocumentChange.
   */
  setDocument(text: string): string[]
  /**
   * The drawing as a ChemDraw file (CDXML), as 导出 CDXML saves it: variables, variable
   * attachments and brackets as ChemDraw's own objects, the definitions as text under it.
   * Without the Structura document 导出 CDXML also keeps in it (adding that is asynchronous).
   */
  getCdxml(): string
  /**
   * The drawing as an SVG picture, as 导出 SVG saves it (with the 显示 menu's settings);
   * empty text when there is nothing drawn.
   */
  getSvg(): string
  /**
   * The same picture as PNG, `scale` times its size (3 by default, sharp in a slide); null
   * when there is nothing drawn. Browser only.
   */
  getPng(options?: { scale?: number }): Promise<Blob | null>
  /**
   * The drawing's SMILES, from RDKit (fetched on first use); variables such as R1 come out
   * as "*". Empty text when there is nothing drawn.
   */
  getSmiles(): Promise<string>
  /** The drawing's InChI, from RDKit; refused (the promise fails) when it has variables, which InChI cannot say. */
  getInchi(): Promise<string>
  /** The drawing's InChIKey, from RDKit; refused, as getInchi, for variables. */
  getInchiKey(): Promise<string>
  /**
   * Replaces the drawing with the molecules of SMILES text (one per line) as one undoable step;
   * blank text clears it. Resolves to the problems worth telling the user, if any. Not echoed
   * to onChange / onDocumentChange, as setMolfile.
   */
  setSmiles(text: string): Promise<string[]>
  /**
   * Applies edits through the same op layer agents use (add_atom, replace, set_variable…),
   * all or nothing, as one undoable step. Reported to onChange / onDocumentChange like any edit.
   */
  run(ops: Op[]): RunResult
  /** Expands the generic formula into concrete compounds, with the SD file of those made (each record carrying its formula number, when there are several, and its variables' values, as the 展开 dialog downloads them). */
  enumerate(options?: EnumerateOptions): Enumeration & { sdf: string }
  /** Zooms and pans so the whole drawing is in view. */
  fit(): void
  /** What is selected: atom and bond ids as getDocument numbers them (a copy). */
  getSelection(): Selection
  /**
   * Selects these atoms and bonds (ids as getDocument numbers them), replacing the selection;
   * ids the drawing does not have are ignored. Without `bonds`, the bonds whose two ends are
   * both among the atoms are selected with them; empty lists clear it. Not an edit: it is not
   * undone, the view stays where it is, and onSelectionChange is not called for it.
   */
  setSelection(selection: { atoms: number[]; bonds?: number[] }): void
}

/** Whether two selections hold the same atoms and bonds, in whatever order. */
function sameSelection(a: Selection, b: Selection): boolean {
  const same = (x: number[], y: number[]) => {
    if (x.length !== y.length) return false
    const set = new Set(x)
    return y.every((id) => set.has(id))
  }
  return a === b || (same(a.atoms, b.atoms) && same(a.bonds, b.bonds))
}

const copySelection = (selection: Selection): Selection => ({ atoms: [...selection.atoms], bonds: [...selection.bonds] })

/**
 * The editor as a component other code talks to: the ref handle; `onChange` with the new
 * molfile after every edit that changes the molecule, and `onDocumentChange` with the whole
 * document after every edit that changes anything in it (not on hover, selection or a
 * gesture still in progress); `onSelectionChange` when the user selects something else; and
 * fitting a starting document into view.
 */
export function useEditorHandle(
  ref: Ref<EditorHandle>,
  {
    editor,
    viewport,
    openText,
    onChange,
    onDocumentChange,
    onSelectionChange,
  }: {
    editor: Pick<EditorState, "mol" | "drawing" | "latest" | "run" | "loadDrawing" | "newDocument" | "raisedNumbers" | "colorHetero" | "openMolecules" | "selection" | "setSelection" | "get">
    viewport: Viewport
    openText: Imports["openText"]
    onChange?: (molfile: string) => void
    onDocumentChange?: (document: string) => void
    onSelectionChange?: (selection: Selection) => void
  },
) {
  const reported = useRef({ mol: editor.mol, drawing: editor.drawing })
  /** Set when the host's own setMolfile / setDocument is about to change the drawing. */
  const quiet = useRef(false)
  const started = useRef(false)
  /** The selection last told to the host, or set by it: a change back to it is not reported. */
  const reportedSelection = useRef(editor.selection)

  /** Fits the latest drawing, so a fit right after the host's run or setMolfile sees the change. */
  const fit = () => {
    const now = editor.latest()
    viewport.fit(drawingPoints(now.molecule, now.arrows))
  }

  useEffect(() => {
    const last = reported.current
    if (last.drawing === editor.drawing) return
    reported.current = { mol: editor.mol, drawing: editor.drawing }
    if (quiet.current) {
      quiet.current = false
      return
    }
    if (last.mol !== editor.mol || last.drawing.brackets !== editor.drawing.brackets) onChange?.(toMolfile(editor.mol, "Structura", editor.drawing.brackets))
    onDocumentChange?.(toDocument(editor.drawing))
  }, [editor.drawing, editor.mol, onChange, onDocumentChange])

  // Box and lasso set the selection once, when the button is released, so a drag reports once.
  useEffect(() => {
    if (sameSelection(reportedSelection.current, editor.selection)) return
    reportedSelection.current = editor.selection
    onSelectionChange?.(copySelection(editor.selection))
  }, [editor.selection, onSelectionChange])

  // A document the editor starts with is fitted once the canvas has its size.
  useEffect(() => {
    if (started.current) return
    started.current = true
    if (editor.mol.atoms.length > 0) fit()
  })

  /** Clears the drawing for the host (blank text given to setMolfile or setSmiles). */
  const clear = () => {
    const now = editor.latest()
    if (now.molecule.atoms.length > 0 || now.arrows.length > 0) quiet.current = true
    editor.newDocument()
  }

  /** What 导出 SVG saves; empty text for an empty page. */
  const svg = () => pictureSvg(editor.latest(), emptySelection(), editor.colorHetero, drawOptions(editor.raisedNumbers))

  /** An identifier of the whole drawing from RDKit; empty text for an empty page. */
  const identifier = async (kind: IdentifierKind) => {
    const molecule = editor.latest().molecule
    return molecule.atoms.length === 0 ? "" : identifierOf(molecule, [], kind)
  }

  useImperativeHandle(ref, () => ({
    getMolfile: () => toMolfile(editor.latest().molecule, "Structura", editor.latest().brackets),
    setMolfile(text: string) {
      if (!text.trim()) {
        clear()
        return []
      }
      try {
        const result = openText(text)
        if (result.opened) quiet.current = true
        return result.lines
      } catch (error) {
        return [failure(error)]
      }
    },
    getDocument: () => toDocument(editor.latest()),
    setDocument(text: string) {
      const read = readDocument(text)
      if ("error" in read) return [read.error]
      quiet.current = true
      editor.loadDrawing(read.drawing)
      return []
    },
    getCdxml: () => drawingCdxml(editor.latest(), editor.raisedNumbers),
    getSvg: svg,
    async getPng({ scale }: { scale?: number } = {}) {
      const picture = svg()
      return picture ? svgToPng(picture, scale) : null
    },
    getSmiles: () => identifier("smiles"),
    getInchi: () => identifier("inchi"),
    getInchiKey: () => identifier("inchikey"),
    async setSmiles(text: string) {
      if (!text.trim()) {
        clear()
        return []
      }
      try {
        const { molecules, lines } = await readSmiles(text)
        // Marked before the change, which React may render before this function goes on.
        if (molecules.length > 0) {
          quiet.current = true
          editor.openMolecules(molecules, viewport.centre())
        }
        return lines
      } catch (error) {
        return [failure(error)]
      }
    },
    run(ops: Op[]) {
      let rejected: { index: number; error: string } | null = null
      const result = editor.run(ops, { keepSelection: true, onReject: (why) => (rejected = why) })
      if (result) return result
      return { ok: false, ...(rejected ?? { index: -1, error: "the edit was rejected" }) }
    },
    enumerate(options?: EnumerateOptions) {
      const result = enumerate(editor.latest(), options)
      return { ...result, sdf: enumerationSdf(result) }
    },
    fit,
    getSelection: () => copySelection(editor.get().selection),
    setSelection({ atoms, bonds }: { atoms: number[]; bonds?: number[] }) {
      const mol = editor.latest().molecule
      const atomIds = new Set(mol.atoms.map((atom) => atom.id))
      const bondIds = new Set(mol.bonds.map((bond) => bond.id))
      const kept = [...new Set(atoms)].filter((id) => atomIds.has(id))
      const next = bonds ? { atoms: kept, bonds: [...new Set(bonds)].filter((id) => bondIds.has(id)) } : selectionFromAtoms(mol, kept)
      // Marked as told before the change, so the effect above does not echo it.
      reportedSelection.current = next
      editor.setSelection(next)
    },
  }))
}
