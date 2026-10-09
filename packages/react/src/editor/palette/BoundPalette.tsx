import { useSyncExternalStore } from "react"
import type { Editor } from "@structura/engine"
import { ToolPalette } from "./ToolPalette.tsx"

type PaletteSource = Pick<Editor, "subscribe" | "get" | "setTool" | "setBondStyle" | "setRingKind" | "applyElement" | "pickScaffold" | "takeBracketTool" | "takeAttachTool">

/**
 * The tool palette driving one editor: the main canvas's, or an open sketch pad's (`onPick`
 * runs first on every pick; a pad has no bracket or attachment tools, `structureTools` false).
 */
export function BoundPalette({ editor, onPick, structureTools = true }: { editor: PaletteSource; onPick?: () => void; structureTools?: boolean }) {
  const snapshot = useSyncExternalStore(editor.subscribe, editor.get)
  const picked =
    <A extends unknown[]>(act: (...args: A) => void) =>
    (...args: A) => {
      onPick?.()
      act(...args)
    }
  return (
    <ToolPalette
      tool={snapshot.tool}
      bondStyle={snapshot.bondStyle}
      ringKind={snapshot.ringKind}
      atomEl={snapshot.atomEl}
      scaffold={snapshot.scaffold}
      bracketKind={snapshot.bracketKind}
      attachShape={snapshot.attachShape}
      structureTools={structureTools}
      onBracket={picked(editor.takeBracketTool)}
      onAttach={picked(editor.takeAttachTool)}
      onScaffold={picked(editor.pickScaffold)}
      onTool={picked(editor.setTool)}
      onBondStyle={picked(editor.setBondStyle)}
      onRingKind={picked(editor.setRingKind)}
      onElement={picked(editor.applyElement)}
    />
  )
}
