import { useEffect, useRef, useState } from "react"
import { Canvas } from "@/editor/Canvas"
import type { CanvasHandle } from "@/editor/canvas/types"
import { useClipboard } from "@/editor/hooks/useClipboard"
import { useCommands } from "@/editor/hooks/useCommands"
import { useImports } from "@/editor/hooks/useImports"
import { useShortcuts } from "@/editor/hooks/useShortcuts"
import { keepFocusOffToolbar } from "@/editor/keys"
import { ToolPalette } from "@/editor/palette/ToolPalette"
import { HelpDialog } from "@/editor/shell/dialogs/HelpDialog"
import { ImportNotesDialog } from "@/editor/shell/dialogs/ImportNotesDialog"
import { SmilesDialog } from "@/editor/shell/dialogs/SmilesDialog"
import { MenuBar } from "@/editor/shell/MenuBar"
import { StatusBar } from "@/editor/shell/StatusBar"
import { Toolbar } from "@/editor/shell/Toolbar"
import { toolLabel } from "@/editor/tools/catalog"
import { useEditor } from "@/editor/useEditor"

/** Lays out the editor and wires state, commands and input together. */
export function Editor() {
  const editor = useEditor()
  const canvasRef = useRef<CanvasHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [zoom, setZoom] = useState(1)
  const [smilesOpen, setSmilesOpen] = useState(false)

  const imports = useImports(editor, canvasRef)
  const clipboard = useClipboard(editor)
  const commands = useCommands({
    editor,
    canvas: canvasRef,
    clipboard,
    openFileDialog: () => fileRef.current?.click(),
    openSmilesDialog: () => setSmilesOpen(true),
  })
  useShortcuts(editor, canvasRef, commands)

  useEffect(() => {
    document.title = "Structura"
    document.addEventListener("mousedown", keepFocusOffToolbar, true)
    return () => document.removeEventListener("mousedown", keepFocusOffToolbar, true)
  }, [])

  return (
    <div
      className="chem-app flex h-full flex-col"
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
          commit={editor.commit}
          setSelection={editor.setSelection}
          onZoom={setZoom}
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
  )
}
