import type { Drawing, Molecule } from "@structura/core/types"
import { selectionActions } from "./selection.ts"
import { createEditorStore } from "./store.ts"
import { toolActions } from "./toolActions.ts"

/** The whole editor without a screen: its state and write path, every action on the selection, and picking tools that act on it. */
export function createEditor(initial: Molecule[] | Drawing = []) {
  const store = createEditorStore(initial)
  return { ...store, ...selectionActions(store), ...toolActions(store) }
}

export type Editor = ReturnType<typeof createEditor>
