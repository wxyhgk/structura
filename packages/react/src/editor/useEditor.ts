import { useMemo, useState, useSyncExternalStore } from "react"
import type { Drawing, Molecule } from "@structura/core/types"
import { canTransform, createEditor, statusOf } from "@structura/engine"

/**
 * The editor's state for React: the engine's editor (state, write path, actions), read
 * through useSyncExternalStore so a render always shows the latest snapshot. Which dialogs
 * are open is useEditorDialogs'.
 */
export function useEditor(initial: Molecule[] | Drawing = []) {
  const [editor] = useState(() => createEditor(initial))
  const snapshot = useSyncExternalStore(editor.subscribe, editor.get)
  const { history, selection } = snapshot
  const drawing = history.present
  const mol = drawing.molecule
  // The status bar only changes with the molecule or the selected atoms, not on zoom or hover.
  const status = useMemo(() => statusOf(mol, selection), [mol, selection])

  return {
    ...editor,
    mol,
    arrows: drawing.arrows,
    /** The whole drawing as rendered: molecule, arrows and the generic formula's variables and attachments. */
    drawing,
    variables: drawing.variables,
    attachments: drawing.attachments,
    /** Square brackets round parts of the structure. */
    brackets: drawing.brackets,
    tool: snapshot.tool,
    bondStyle: snapshot.bondStyle,
    ringKind: snapshot.ringKind,
    atomEl: snapshot.atomEl,
    scaffold: snapshot.scaffold,
    bracketKind: snapshot.bracketKind,
    attachShape: snapshot.attachShape,
    selection,
    colorHetero: snapshot.colorHetero,
    raisedNumbers: snapshot.raisedNumbers,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    canTransform: canTransform(mol, selection),
    ...status,
  }
}

/** Everything the editor state hook exposes; shell components and hooks take this. */
export type EditorState = ReturnType<typeof useEditor>
