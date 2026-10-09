import { useState, type MouseEvent, type RefObject } from "react"
import { componentOf, selectionFromAtoms } from "@structura/core/molecule"
import type { Molecule } from "@structura/core/types"
import { contextAtoms, contextTarget, type ContextTarget } from "@structura/engine"
import { reportFor, type Report } from "../analysis/report.ts"
import { writeClipboard } from "../browser.ts"
import { identifierOf, IDENTIFIER_NAMES, type IdentifierKind } from "../identifiers.ts"
import type { EditorState } from "../useEditor.ts"
import type { CanvasHandle } from "./types.ts"

/**
 * The canvas's right-click menu: what the last right-click was about, and what the menu's
 * own items do with it (copy as SMILES / InChI, analyse, select the molecule).
 */
export function useCanvasMenu({
  editor,
  shownMol,
  canvas,
  flash,
  showReport,
}: {
  editor: Pick<EditorState, "mol" | "selection" | "setSelection" | "brackets">
  /** The molecule as the canvas shows it, which is what a right-click lands on. */
  shownMol: Molecule
  canvas: RefObject<CanvasHandle | null>
  flash: (message: string) => void
  showReport: (report: Report) => void
}) {
  const [target, setTarget] = useState<ContextTarget | null>(null)
  /** The atoms the menu's copying and analysis act on. */
  const atoms = () => contextAtoms(editor.mol, editor.selection, target, editor.brackets)

  async function copyAs(kind: IdentifierKind) {
    try {
      const text = await identifierOf(editor.mol, atoms(), kind)
      writeClipboard(text)
      flash(`已复制 ${IDENTIFIER_NAMES[kind]}：${text.length > 48 ? `${text.slice(0, 48)}…` : text}`)
    } catch (error) {
      flash(`没能生成 ${IDENTIFIER_NAMES[kind]}：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    target,
    onContextMenu: (event: MouseEvent) => {
      const at = canvas.current
      setTarget(contextTarget(shownMol, editor.selection, at?.targetAt(event.clientX, event.clientY) ?? null, at?.bracketAt(event.clientX, event.clientY) ?? null))
    },
    copyAs: (kind: IdentifierKind) => void copyAs(kind),
    analyze: () => showReport(reportFor(editor.mol, atoms())),
    selectMolecule: (atom: number) => editor.setSelection(selectionFromAtoms(editor.mol, componentOf(editor.mol, atom))),
    selectAtoms: (atoms: number[]) => editor.setSelection(selectionFromAtoms(editor.mol, atoms)),
  }
}
