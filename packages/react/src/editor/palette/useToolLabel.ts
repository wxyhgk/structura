import { useSyncExternalStore } from "react"
import { toolLabel, type Editor } from "@structura/engine"

/** The status bar's name for the tool of whichever editor the palette drives. */
export function useToolLabel(editor: Pick<Editor, "subscribe" | "get">): string {
  const { tool, bondStyle, ringKind, atomEl, scaffold } = useSyncExternalStore(editor.subscribe, editor.get)
  return toolLabel(tool, bondStyle, ringKind, atomEl, scaffold)
}
