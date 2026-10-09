import { forwardRef, useMemo, useRef, useState } from "react"
import { componentOf, displayMolecule, selectionFromAtoms } from "@structura/core/molecule"
import { TooltipProvider } from "../components/ui/tooltip.tsx"
import { ContextMenu, ContextMenuTrigger } from "../components/ui/context-menu.tsx"
import { AnalysisDialog } from "./analysis/AnalysisDialog.tsx"
import { reportFor, type Report } from "./analysis/report.ts"
import { writeClipboard } from "./browser.ts"
import { CanvasMenu } from "./canvas/CanvasMenu.tsx"
import { identifierOf, IDENTIFIER_NAMES, type IdentifierKind } from "./identifiers.ts"
import { Flash } from "./shell/Flash.tsx"
import { useFlash } from "./shell/useFlash.ts"
import { Canvas } from "./canvas/Canvas.tsx"
import type { CanvasHandle } from "./canvas/types.ts"
import { useZoom } from "./canvas/useViewport.ts"
import { contextAtoms, contextTarget, type ContextTarget, createViewport, placeDrawing, toolLabel } from "@structura/engine"
import { selectionClipboard } from "./clipboard.ts"
import { useCommands } from "./hooks/useCommands.ts"
import { useDocumentFile } from "./hooks/useDocumentFile.ts"
import { RAISED_NUMBERS, useRememberedSetting } from "./hooks/useRememberedSetting.ts"
import { drawOptions } from "./drawOptions.ts"
import { useEditorHandle, type EditorHandle } from "./hooks/useEditorHandle.ts"
import { useImports } from "./hooks/useImports.ts"
import { initialContent } from "./imports/read.ts"
import { OverlayScope } from "./input/overlays.ts"
import { useEditorInput } from "./input/useEditorInput.ts"
import { ToolPalette } from "./palette/ToolPalette.tsx"
import { HelpDialog } from "./shell/dialogs/HelpDialog.tsx"
import { EditorGuide } from "./shell/EditorGuide.tsx"
import type { GuideTopic } from "../guide/index.ts"
import { ImportNotesDialog } from "./shell/dialogs/ImportNotesDialog.tsx"
import { EnumerateDialog } from "./markush/EnumerateDialog.tsx"
import { FillDialog } from "./markush/FillDialog.tsx"
import type { FillVariables } from "./markush/useFill.ts"
import { StructureDialog } from "./vision/StructureDialog.tsx"
import type { RecognizeStructure } from "./vision/useRecognition.ts"
import { VariablesPanel } from "./markush/VariablesPanel.tsx"
import { MarkushWorkspace } from "./markush/workspace/MarkushWorkspace.tsx"
import type { Workspace } from "./markush/workspace/types.ts"
import { WorkspaceTabs } from "./markush/workspace/WorkspaceTabs.tsx"
import { SmilesDialog } from "./shell/dialogs/SmilesDialog.tsx"
import { MenuBar } from "./shell/MenuBar.tsx"
import { StatusBar } from "./shell/StatusBar.tsx"
import { Toolbar } from "./shell/Toolbar.tsx"
import { useEditor } from "./useEditor.ts"
import type { TemplateStore } from "./templates/store.ts"
import { useTemplates } from "./templates/useTemplates.ts"

export type { EditorHandle, RunResult } from "./hooks/useEditorHandle.ts"
export type { EnumerateOptions, Enumeration } from "@structura/markush"
export type { Op } from "@structura/core/ops"
export type { FillVariables } from "./markush/useFill.ts"
export type { RecognizeStructure } from "./vision/useRecognition.ts"
export type { TemplateStore } from "./templates/store.ts"

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
   * Whether the drawing has changes not yet saved to a file, each time that flips: the host
   * can warn before the page is closed, or keep a copy (the standalone app does both).
   */
  onDirtyChange?: (dirty: boolean) => void
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
  /**
   * Where the user's own group templates are kept (the standalone app: the Structura backend).
   * Without it only the built-in templates are offered, and saving one says why it cannot.
   */
  templateStore?: TemplateStore
}

/**
 * Lays out the editor and wires state, commands and input together. It fills its
 * container, so the host decides its size.
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ initialMolfile, initialDocument, onChange, onDocumentChange, onDirtyChange, fillVariables, recognizeStructure, templateStore }, ref) {
  const [initial] = useState(() => initialContent(initialDocument, initialMolfile))
  const editor = useEditor(initial)
  const templates = useTemplates(templateStore)
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
  /** Drawing, or the generic formula's workspace; both show the same document. */
  const [workspace, setWorkspace] = useState<Workspace>("draw")

  const imports = useImports(editor, viewport)
  const clipboard = selectionClipboard(editor, (line) => imports.showNotes({ opened: false, title: "复制为图片", lines: [line] }))
  /** How labels are written, the same on the canvas as in what is exported. */
  const labelStyle = useMemo(() => drawOptions(editor.raisedNumbers), [editor.raisedNumbers])
  const setRaisedNumbers = useRememberedSetting(RAISED_NUMBERS, editor.raisedNumbers, editor.setRaisedNumbers)
  /** What the last right-click was about, for the menu it opens. */
  const [menuTarget, setMenuTarget] = useState<ContextTarget | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const { message, flash } = useFlash()
  /** The atoms the menu's copying and analysis act on. */
  const menuAtoms = () => contextAtoms(editor.mol, editor.selection, menuTarget)
  async function copyAs(kind: IdentifierKind) {
    try {
      const text = await identifierOf(editor.mol, menuAtoms(), kind)
      writeClipboard(text)
      flash(`已复制 ${IDENTIFIER_NAMES[kind]}：${text.length > 48 ? `${text.slice(0, 48)}…` : text}`)
    } catch (error) {
      flash(`没能生成 ${IDENTIFIER_NAMES[kind]}：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const file = useDocumentFile(editor.drawing, editor.latest, onDirtyChange)
  /** Opens a file and, if it opened, remembers it as this document's file. */
  const openFile = async (picked: File) => {
    if (await imports.openFile(picked)) file.markSaved(picked.name)
  }
  const commands = useCommands({
    file,
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

  /** The canvas with its right-click menu: the drawing workspace's centre, and the formula's canvas in the other. */
  const canvasArea = (
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="flex min-h-0 min-w-0 flex-1" onContextMenu={(event) => setMenuTarget(contextTarget(shownMol, editor.selection, canvasRef.current?.targetAt(event.clientX, event.clientY) ?? null))}>
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
                  drawOptions={labelStyle}
                  attachments={editor.attachments}
                  run={editor.run}
                  latest={editor.latest}
                  setSelection={editor.setSelection}
                  undo={editor.undo}
                  viewport={viewport}
                />
                </div>
              </ContextMenuTrigger>
              <CanvasMenu
                target={menuTarget}
                commands={commands}
                run={(ops) => void editor.run(ops)}
                onEditLabel={(atom) => canvasRef.current?.editLabel(atom)}
                onSelectMolecule={(atom) => editor.setSelection(selectionFromAtoms(editor.mol, componentOf(editor.mol, atom)))}
                onCopyAs={(kind) => void copyAs(kind)}
                onAnalyze={() => setReport(reportFor(editor.mol, menuAtoms()))}
              />
            </ContextMenu>
  )

  return (
    <TooltipProvider delayDuration={350}>
      <OverlayScope value={input.overlayScope}>
        <div
          className="chem-app relative flex h-full w-full min-h-0 flex-col overflow-hidden"
          {...input.rootProps}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const dropped = event.dataTransfer.files[0]
            if (dropped) void openFile(dropped)
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".structura,.mol,.sdf,.sd,.mdl"
            className="hidden"
            data-testid="open-file"
            onChange={(event) => {
              const picked = event.target.files?.[0]
              event.target.value = ""
              if (picked) void openFile(picked)
            }}
          />
          <MenuBar commands={commands} colorHetero={editor.colorHetero} onColorHetero={editor.setColorHetero} raisedNumbers={editor.raisedNumbers} onRaisedNumbers={setRaisedNumbers} hasFill={fillVariables != null} title={file.title} dirty={file.dirty} tabs={<WorkspaceTabs value={workspace} onChange={setWorkspace} />} />
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
            {workspace === "draw" && canvasArea}
            {workspace === "markush" && (
              <MarkushWorkspace
                canvas={canvasArea}
                drawing={editor.drawing}
                run={editor.run}
                selected={editor.selection.atoms}
                colorHetero={editor.colorHetero}
                base={file.base}
                onPlace={(mol) => {
                  editor.appendMolecules([mol], viewport.centre())
                  setWorkspace("draw")
                }}
                onHelp={setGuide}
                onFill={fillVariables ? () => setFillOpen(true) : undefined}
                templates={templates}
              />
            )}
            {workspace === "draw" && <VariablesPanel
              mol={editor.mol}
              selected={editor.selection.atoms}
              variables={editor.variables}
              attachments={editor.attachments}
              provisos={editor.drawing.provisos}
              ringClosures={editor.drawing.ringClosures}
              run={editor.run}
              canEnumerate={commands.enumerate.enabled}
              onEnumerate={commands.enumerate.run}
              onFill={fillVariables ? () => setFillOpen(true) : undefined}
              onHelp={setGuide}
            />}
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
          <AnalysisDialog report={report} onOpenChange={(open) => !open && setReport(null)} onCopy={(text, what) => {
            writeClipboard(text)
            flash(`已复制${what}`)
          }} />
          <Flash message={message} />
          <EnumerateDialog
            open={enumerateOpen}
            onOpenChange={setEnumerateOpen}
            drawing={editor.latest()}
            colorHetero={editor.colorHetero}
            base={file.base}
            onPlace={(mol) => editor.appendMolecules([mol], viewport.centre())}
          />
          {recognizeStructure && (
            <StructureDialog
              open={recognizeOpen}
              onOpenChange={setRecognizeOpen}
              recognize={recognizeStructure}
              onApply={(drawing) => {
                const place = placeDrawing(editor.latest(), drawing)
                if ("load" in place) editor.loadDrawing(place.load)
                else editor.appendMolecules([place.append], viewport.centre())
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
