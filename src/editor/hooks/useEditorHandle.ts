import { useEffect, useImperativeHandle, useRef, type Ref } from "react"
import { toMolfile } from "@/chem/molfile"
import { failure } from "@/editor/browser"
import { drawingPoints, type Viewport } from "@/editor/canvas/viewport"
import type { Imports } from "@/editor/hooks/useImports"
import type { EditorState } from "@/editor/useEditor"

/** What a host page can do with an embedded editor, through its ref. */
export type EditorHandle = {
  /** The drawing as molfile text. */
  getMolfile(): string
  /**
   * Replaces the drawing with molfile or SD text as one undoable step and fits it in view;
   * blank text clears it. Returns the problems worth telling the user, if any. The host
   * set this text, so onChange is not called for it.
   */
  setMolfile(text: string): string[]
  /** Zooms and pans so the whole drawing is in view. */
  fit(): void
}

/**
 * The editor as a component other code talks to: the ref handle, `onChange` with the new
 * molfile after every edit that changes the molecule (not on hover, selection or a gesture
 * still in progress), and fitting a starting document into view.
 */
export function useEditorHandle(
  ref: Ref<EditorHandle>,
  {
    editor,
    viewport,
    openText,
    onChange,
  }: {
    editor: Pick<EditorState, "mol" | "arrows" | "newDocument">
    viewport: Viewport
    openText: Imports["openText"]
    onChange?: (molfile: string) => void
  },
) {
  const reported = useRef(editor.mol)
  /** Set when the host's own setMolfile is about to change the molecule. */
  const quiet = useRef(false)
  const started = useRef(false)

  const fit = () => viewport.fit(drawingPoints(editor.mol, editor.arrows))

  useEffect(() => {
    if (reported.current === editor.mol) return
    reported.current = editor.mol
    if (quiet.current) quiet.current = false
    else onChange?.(toMolfile(editor.mol))
  }, [editor.mol, onChange])

  // A document the editor starts with is fitted once the canvas has its size.
  useEffect(() => {
    if (started.current) return
    started.current = true
    if (editor.mol.atoms.length > 0) fit()
  })

  useImperativeHandle(ref, () => ({
    getMolfile: () => toMolfile(editor.mol),
    setMolfile(text: string) {
      if (!text.trim()) {
        if (editor.mol.atoms.length > 0 || editor.arrows.length > 0) quiet.current = true
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
    fit,
  }))
}
