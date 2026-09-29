import { forwardRef, useRef, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Canvas } from "@/editor/canvas/Canvas"
import type { CanvasHandle } from "@/editor/canvas/types"
import { useZoom } from "@/editor/canvas/useViewport"
import { createViewport } from "@/editor/canvas/viewport"
import { selectionClipboard } from "@/editor/clipboard"
import { useCommands } from "@/editor/hooks/useCommands"
import { useEditorHandle, type EditorHandle } from "@/editor/hooks/useEditorHandle"
import { useImports } from "@/editor/hooks/useImports"
import { initialMolecules } from "@/editor/imports/read"
import { OverlayScope } from "@/editor/input/overlays"
import { useEditorInput } from "@/editor/input/useEditorInput"
import { ToolPalette } from "@/editor/palette/ToolPalette"
import { HelpDialog } from "@/editor/shell/dialogs/HelpDialog"
import { ImportNotesDialog } from "@/editor/shell/dialogs/ImportNotesDialog"
import { SmilesDialog } from "@/editor/shell/dialogs/SmilesDialog"
import { MenuBar } from "@/editor/shell/MenuBar"
import { StatusBar } from "@/editor/shell/StatusBar"
import { Toolbar } from "@/editor/shell/Toolbar"
import { toolLabel } from "@/editor/tools/catalog"
import { useEditor } from "@/editor/useEditor"

export type { EditorHandle } from "@/editor/hooks/useEditorHandle"

export type EditorProps = {
  /** Molfile or SD text to start with; read once, when the editor mounts. */
  initialMolfile?: string
  /** The drawing as molfile text, after every edit that changes it. */
  onChange?: (molfile: string) => void
}

/**
 * Lays out the editor and wires state, commands and input together. It fills its
 * container, so the host decides its size.
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ initialMolfile, onChange }, ref) {
  const [initial] = useState(() => initialMolecules(initialMolfile))
  const editor = useEditor(initial)
  const canvasRef = useRef<CanvasHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [viewport] = useState(createViewport)
  const zoom = useZoom(viewport)
  const [smilesOpen, setSmilesOpen] = useState(false)

  const imports = useImports(editor, viewport)
  const clipboard = selectionClipboard(editor)
  const commands = useCommands({
    editor,
    canvas: canvasRef,
    viewport,
    clipboard,
    openFileDialog: () => fileRef.current?.click(),
    openSmilesDialog: () => setSmilesOpen(true),
  })
  const input = useEditorInput({ editor, canvas: canvasRef, commands, onPaste: imports.paste, onCopy: clipboard.onEvent })
  useEditorHandle(ref, { editor, viewport, openText: imports.openText, onChange })

  return (
    <TooltipProvider delayDuration={350}>
      <OverlayScope value={input.overlayScope}>
        <div
          className="chem-app flex h-full w-full min-h-0 flex-col overflow-hidden"
          {...input.rootProps}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files[0]
            if (file) void imports.openFile(file)
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".mol,.sdf,.sd,.mdl"
            className="hidden"
            data-testid="open-file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void imports.openFile(file)
            }}
          />
          <MenuBar commands={commands} colorHetero={editor.colorHetero} onColorHetero={editor.setColorHetero} />
          <Toolbar commands={commands} zoom={zoom} />

          <div className="flex min-h-0 flex-1">
            <ToolPalette
              tool={editor.tool}
              bondStyle={editor.bondStyle}
              ringKind={editor.ringKind}
              atomEl={editor.atomEl}
              onTool={editor.setTool}
              onBondStyle={editor.setBondStyle}
              onRingKind={editor.setRingKind}
              onElement={editor.applyElement}
            />
            <Canvas
              ref={canvasRef}
              mol={editor.mol}
              arrows={editor.arrows}
              tool={editor.tool}
              bondStyle={editor.bondStyle}
              ringKind={editor.ringKind}
              atomEl={editor.atomEl}
              selection={editor.selection}
              colorHetero={editor.colorHetero}
              run={editor.run}
              latest={editor.latest}
              setSelection={editor.setSelection}
              viewport={viewport}
            />
          </div>

          <StatusBar
            toolLabel={toolLabel(editor.tool, editor.bondStyle, editor.ringKind, editor.atomEl)}
            formula={editor.formula}
            weight={editor.weight}
            valenceErrors={editor.valenceErrors}
            atomCount={editor.mol.atoms.length}
            zoom={zoom}
          />

          <ImportNotesDialog notes={imports.notes} onClose={imports.clearNotes} />
          <SmilesDialog
            open={smilesOpen}
            onOpenChange={setSmilesOpen}
            onImport={imports.importSmiles}
            onNotes={(lines) => imports.showNotes({ opened: true, lines })}
            loadFailed={imports.rdkitFailed}
          />
          <HelpDialog open={editor.helpOpen} onOpenChange={editor.setHelpOpen} commands={commands} />
        </div>
      </OverlayScope>
    </TooltipProvider>
  )
})
