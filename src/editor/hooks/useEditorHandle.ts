import { useEffect, useImperativeHandle, useRef, type Ref } from "react"
import { readDocument, toDocument } from "@structura/core/document"
import { enumerate, pickFields, type EnumerateOptions, type Enumeration } from "@structura/core/markush"
import { toMolfile, toSdf } from "@structura/core/molfile"
import type { Op, OpsResult } from "@structura/core/ops"
import { failure } from "@/editor/browser"
import { drawingPoints, type Viewport } from "@/editor/canvas/viewport"
import type { Imports } from "@/editor/hooks/useImports"
import type { EditorState } from "@/editor/useEditor"

/** What `run` hands back: the op layer's result, or which op was rejected and why. */
export type RunResult = Extract<OpsResult, { ok: true }> | { ok: false; index: number; error: string }

/** What a host page can do with an embedded editor, through its ref. */
export type EditorHandle = {
  /** The drawing as molfile text (the molecule only: a generic formula's variables are not in it). */
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
   * Applies edits through the same op layer agents use (add_atom, replace, set_variable…),
   * all or nothing, as one undoable step. Reported to onChange / onDocumentChange like any edit.
   */
  run(ops: Op[]): RunResult
  /** Expands the generic formula into concrete compounds, with the SD file of those made (each record carrying its variables' values). */
  enumerate(options?: EnumerateOptions): Enumeration & { sdf: string }
  /** Zooms and pans so the whole drawing is in view. */
  fit(): void
}

/**
 * The editor as a component other code talks to: the ref handle; `onChange` with the new
 * molfile after every edit that changes the molecule, and `onDocumentChange` with the whole
 * document after every edit that changes anything in it (not on hover, selection or a
 * gesture still in progress); and fitting a starting document into view.
 */
export function useEditorHandle(
  ref: Ref<EditorHandle>,
  {
    editor,
    viewport,
    openText,
    onChange,
    onDocumentChange,
  }: {
    editor: Pick<EditorState, "mol" | "arrows" | "drawing" | "latest" | "run" | "loadDrawing" | "newDocument">
    viewport: Viewport
    openText: Imports["openText"]
    onChange?: (molfile: string) => void
    onDocumentChange?: (document: string) => void
  },
) {
  const reported = useRef({ mol: editor.mol, drawing: editor.drawing })
  /** Set when the host's own setMolfile / setDocument is about to change the drawing. */
  const quiet = useRef(false)
  const started = useRef(false)

  const fit = () => viewport.fit(drawingPoints(editor.mol, editor.arrows))

  useEffect(() => {
    const last = reported.current
    if (last.drawing === editor.drawing) return
    reported.current = { mol: editor.mol, drawing: editor.drawing }
    if (quiet.current) {
      quiet.current = false
      return
    }
    if (last.mol !== editor.mol) onChange?.(toMolfile(editor.mol))
    onDocumentChange?.(toDocument(editor.drawing))
  }, [editor.drawing, editor.mol, onChange, onDocumentChange])

  // A document the editor starts with is fitted once the canvas has its size.
  useEffect(() => {
    if (started.current) return
    started.current = true
    if (editor.mol.atoms.length > 0) fit()
  })

  useImperativeHandle(ref, () => ({
    getMolfile: () => toMolfile(editor.latest().molecule),
    setMolfile(text: string) {
      if (!text.trim()) {
        const now = editor.latest()
        if (now.molecule.atoms.length > 0 || now.arrows.length > 0) quiet.current = true
        editor.newDocument()
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
    run(ops: Op[]) {
      let rejected: { index: number; error: string } | null = null
      const result = editor.run(ops, { keepSelection: true, onReject: (why) => (rejected = why) })
      if (result) return result
      return { ok: false, ...(rejected ?? { index: -1, error: "the edit was rejected" }) }
    },
    enumerate(options?: EnumerateOptions) {
      const result = enumerate(editor.latest(), options)
      return { ...result, sdf: toSdf(result.molecules, "Structura", result.picks.map(pickFields)) }
    },
    fit,
  }))
}
