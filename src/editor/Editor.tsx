import { forwardRef, useMemo, useRef, useState } from "react"
import { atomIdsOfSelection, componentOf, displayMolecule, selectionFromAtoms } from "@structura/core/molecule"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import { AnalysisDialog } from "@/editor/analysis/AnalysisDialog"
import { reportFor, type Report } from "@/editor/analysis/report"
import { writeClipboard } from "@/editor/browser"
import { CanvasMenu } from "@/editor/canvas/CanvasMenu"
import { identifierOf, IDENTIFIER_NAMES, type IdentifierKind } from "@/editor/identifiers"
import { Flash } from "@/editor/shell/Flash"
import { useFlash } from "@/editor/shell/useFlash"
import { Canvas } from "@/editor/canvas/Canvas"
import type { CanvasHandle } from "@/editor/canvas/types"
import { useZoom } from "@/editor/canvas/useViewport"
import { contextTarget, type ContextTarget, createViewport, toolLabel } from "@structura/engine"
import { selectionClipboard } from "@/editor/clipboard"
import { useCommands } from "@/editor/hooks/useCommands"
import { useDocumentFile } from "@/editor/hooks/useDocumentFile"
import { RAISED_NUMBERS, useRememberedSetting } from "@/editor/hooks/useRememberedSetting"
import { drawOptions } from "@/editor/drawOptions"
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
import { MarkushWorkspace } from "@/editor/markush/workspace/MarkushWorkspace"
import type { Workspace } from "@/editor/markush/workspace/types"
import { WorkspaceTabs } from "@/editor/markush/workspace/WorkspaceTabs"
import { SmilesDialog } from "@/editor/shell/dialogs/SmilesDialog"
import { MenuBar } from "@/editor/shell/MenuBar"
import { StatusBar } from "@/editor/shell/StatusBar"
import { Toolbar } from "@/editor/shell/Toolbar"
import { useEditor } from "@/editor/useEditor"
import type { TemplateStore } from "@/editor/templates/store"
import { useTemplates } from "@/editor/templates/useTemplates"

export type { EditorHandle, RunResult } from "@/editor/hooks/useEditorHandle"
export type { EnumerateOptions, Enumeration } from "@structura/markush"
export type { Op } from "@structura/core/ops"
export type { FillVariables } from "@/editor/markush/useFill"
export type { RecognizeStructure } from "@/editor/vision/useRecognition"
export type { TemplateStore } from "@/editor/templates/store"

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
  /** The atoms the menu's copying and analysis act on: the selection, the molecule of the atom or bond clicked, or everything. */
  const menuAtoms = (): number[] => {
    const mol = editor.mol
    if (menuTarget?.kind === "selection") return atomIdsOfSelection(mol, editor.selection)
    if (menuTarget?.kind === "atom") return componentOf(mol, menuTarget.id)
    if (menuTarget?.kind === "bond") {
      const bond = mol.bonds.find((item) => item.id === menuTarget.id)
      return bond ? componentOf(mol, bond.a) : []
    }
    return []
  }
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
