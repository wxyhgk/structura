import type { Drawing, Molecule } from "@structura/core/types"
import { selectionActions } from "./selection.ts"
import { createEditorStore } from "./store.ts"

/** The whole editor without a screen: its state and write path, and every action on the selection. */
export function createEditor(initial: Molecule[] | Drawing = []) {
  const store = createEditorStore(initial)
  return { ...store, ...selectionActions(store) }
}

export type Editor = ReturnType<typeof createEditor>
