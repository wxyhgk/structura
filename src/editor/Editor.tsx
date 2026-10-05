import { forwardRef, useMemo, useRef, useState } from "react"
import { displayMolecule } from "@structura/core/molecule"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Canvas } from "@/editor/canvas/Canvas"
import type { CanvasHandle } from "@/editor/canvas/types"
import { useZoom } from "@/editor/canvas/useViewport"
import { createViewport, toolLabel } from "@structura/engine"
import { selectionClipboard } from "@/editor/clipboard"
import { useCommands } from "@/editor/hooks/useCommands"
import { useEditorHandle, type EditorHandle } from "@/editor/hooks/useEditorHandle"
import { useImports } from "@/editor/hooks/useImports"
import { initialContent } from "@/editor/imports/read"
import { OverlayScope } from "@/editor/input/overlays"
import { useEditorInput } from "@/editor/input/useEditorInput"
import { ToolPalette } from "@/editor/palette/ToolPalette"
import { HelpDialog } from "@/editor/shell/dialogs/HelpDialog"
import { EditorGuide } from "@/editor/shell/EditorGuide"
import type { GuideTopic } from "@/guide"
import { ImportNotesDialog } from "@/editor/shell/dialogs/ImportNotesDialog"
import { EnumerateDialog } from "@/editor/markush/EnumerateDialog"
import { FillDialog } from "@/editor/markush/FillDialog"
import type { FillVariables } from "@/editor/markush/useFill"
import { StructureDialog } from "@/editor/vision/StructureDialog"
import type { RecognizeStructure } from "@/editor/vision/useRecognition"
import { VariablesPanel } from "@/editor/markush/VariablesPanel"
import { SmilesDialog } from "@/editor/shell/dialogs/SmilesDialog"
import { MenuBar } from "@/editor/shell/MenuBar"
import { StatusBar } from "@/editor/shell/StatusBar"
import { Toolbar } from "@/editor/shell/Toolbar"
import { useEditor } from "@/editor/useEditor"

export type { EditorHandle, RunResult } from "@/editor/hooks/useEditorHandle"
export type { EnumerateOptions, Enumeration } from "@structura/markush"
export type { Op } from "@structura/core/ops"
export type { FillVariables } from "@/editor/markush/useFill"
export type { RecognizeStructure } from "@/editor/vision/useRecognition"

export type EditorProps = {
  /** Molfile or SD text to start with; read once, when the editor mounts. */
  initialMolfile?: string
  /** A Structura document (from getDocument or a saved .structura file) to start with; wins over initialMolfile. */
  initialDocument?: string
  /** The drawing as molfile text, after every edit that changes the molecule. */
  onChange?: (molfile: string) => void
  /** The whole drawing as a Structura document, after every edit, including a generic formula's variables. */
  onDocumentChange?: (document: string) => void
  /**
   * How to reach the model for "从专利文字填写": the editor builds the request and checks the
   * answer; the host sends it to a server holding the API key (@structura/ai/server).
   * Without it the button is not shown.
   */
  fillVariables?: FillVariables
  /**
   * How to reach the model for "从图片识别结构": the host streams the agent's steps back
   * (see @structura/ai/server's structureHandler). Without it the menu item is not shown.
   */
  recognizeStructure?: RecognizeStructure
}

/**
 * Lays out the editor and wires state, commands and input together. It fills its
 * container, so the host decides its size.
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ initialMolfile, initialDocument, onChange, onDocumentChange, fillVariables, recognizeStructure }, ref) {
  const [initial] = useState(() => initialContent(initialDocument, initialMolfile))
  const editor = useEditor(initial)
  const canvasRef = useRef<CanvasHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [viewport] = useState(createViewport)
  const zoom = useZoom(viewport)
  const [smilesOpen, setSmilesOpen] = useState(false)
  const [enumerateOpen, setEnumerateOpen] = useState(false)
  const [fillOpen, setFillOpen] = useState(false)
  /** The molecule as the canvas shows it: collapsed abbreviations as labels. */
  const shownMol = useMemo(() => displayMolecule(editor.mol), [editor.mol])
  const [recognizeOpen, setRecognizeOpen] = useState(false)
  const [guide, setGuide] = useState<GuideTopic | null>(null)

  const imports = useImports(editor, viewport)
  const clipboard = selectionClipboard(editor, (line) => imports.showNotes({ opened: false, title: "复制为图片", lines: [line] }))
  const commands = useCommands({
    editor,
    canvas: canvasRef,
    viewport,
    clipboard: { ...clipboard, paste: () => void imports.pasteClipboard() },
    openFileDialog: () => fileRef.current?.click(),
    openSmilesDialog: () => setSmilesOpen(true),
    openEnumerate: () => setEnumerateOpen(true),
    openGuide: () => setGuide("start"),
    openRecognize: recognizeStructure ? () => setRecognizeOpen(true) : undefined,
    openFill: fillVariables ? () => setFillOpen(true) : undefined,
  })
  const input = useEditorInput({ editor, canvas: canvasRef, commands, onPaste: imports.paste, onCopy: clipboard.onEvent })
  useEditorHandle(ref, { editor, viewport, openText: imports.openText, onChange, onDocumentChange })

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
            accept=".structura,.mol,.sdf,.sd,.mdl"
            className="hidden"
            data-testid="open-file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void imports.openFile(file)
            }}
          />
          <MenuBar commands={commands} colorHetero={editor.colorHetero} onColorHetero={editor.setColorHetero} hasFill={fillVariables != null} />
          <Toolbar commands={commands} zoom={zoom} />

          <div className="flex min-h-0 flex-1">
            <ToolPalette
              tool={editor.tool}
              bondStyle={editor.bondStyle}
              ringKind={editor.ringKind}
              atomEl={editor.atomEl}
              scaffold={editor.scaffold}
              onScaffold={editor.pickScaffold}
              onTool={editor.setTool}
              onBondStyle={editor.setBondStyle}
              onRingKind={editor.setRingKind}
              onElement={editor.applyElement}
            />
            <Canvas
              ref={canvasRef}
              mol={shownMol}
              arrows={editor.arrows}
              tool={editor.tool}
              bondStyle={editor.bondStyle}
              ringKind={editor.ringKind}
              scaffold={editor.scaffold}
              atomEl={editor.atomEl}
              selection={editor.selection}
              colorHetero={editor.colorHetero}
              attachments={editor.attachments}
              run={editor.run}
              latest={editor.latest}
              setSelection={editor.setSelection}
              undo={editor.undo}
              viewport={viewport}
            />
            <VariablesPanel
              mol={editor.mol}
              selected={editor.selection.atoms}
              variables={editor.variables}
              attachments={editor.attachments}
              run={editor.run}
              canEnumerate={commands.enumerate.enabled}
              onEnumerate={commands.enumerate.run}
              onFill={fillVariables ? () => setFillOpen(true) : undefined}
              onHelp={setGuide}
            />
          </div>

          <StatusBar
            toolLabel={toolLabel(editor.tool, editor.bondStyle, editor.ringKind, editor.atomEl, editor.scaffold)}
            formula={editor.formula}
            weight={editor.weight}
            valenceErrors={editor.valenceErrors}
            atomCount={editor.mol.atoms.length}
            zoom={zoom}
          />

          <ImportNotesDialog notes={imports.notes} onClose={imports.clearNotes} />
          <EnumerateDialog open={enumerateOpen} onOpenChange={setEnumerateOpen} drawing={editor.latest()} colorHetero={editor.colorHetero} />
          {recognizeStructure && (
            <StructureDialog
              open={recognizeOpen}
              onOpenChange={setRecognizeOpen}
              recognize={recognizeStructure}
              onApply={(drawing) => {
                // On an empty page the whole drawing goes in (variable attachments too); beside a drawing, its molecule.
                const now = editor.latest()
                if (now.molecule.atoms.length === 0 && now.arrows.length === 0) editor.loadDrawing(drawing)
                else editor.appendMolecules([drawing.molecule], viewport.centre())
              }}
            />
          )}
          {fillVariables && <FillDialog open={fillOpen} onOpenChange={setFillOpen} drawing={editor.latest()} run={editor.run} fill={fillVariables} />}
          <SmilesDialog
            open={smilesOpen}
            onOpenChange={setSmilesOpen}
            onImport={imports.importSmiles}
            onNotes={(lines) => imports.showNotes({ opened: true, lines })}
            loadFailed={imports.rdkitFailed}
          />
          <HelpDialog open={editor.helpOpen} onOpenChange={editor.setHelpOpen} commands={commands} />
          <EditorGuide
            topic={guide}
            onTopic={setGuide}
            openShortcuts={() => {
              setGuide(null)
              editor.setHelpOpen(true)
            }}
          />
        </div>
      </OverlayScope>
    </TooltipProvider>
  )
})
