import { forwardRef, useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { readDocument, toDocument } from "@structura/core/document"
import { displayMolecule } from "@structura/core/molecule"
import { TooltipProvider } from "../components/ui/tooltip.tsx"
import { ContextMenu, ContextMenuTrigger } from "../components/ui/context-menu.tsx"
import { AnalysisDialog } from "./analysis/AnalysisDialog.tsx"
import { writeClipboard } from "./browser.ts"
import { BracketCountDialog } from "./canvas/BracketCountDialog.tsx"
import { CanvasMenu } from "./canvas/CanvasMenu.tsx"
import { canvasSlice } from "./canvas/slice.ts"
import { useCanvasMenu } from "./canvas/useCanvasMenu.ts"
import { Flash } from "./shell/Flash.tsx"
import { useFlash } from "./shell/useFlash.ts"
import { Canvas } from "./canvas/Canvas.tsx"
import type { CanvasHandle } from "./canvas/types.ts"
import { useZoom } from "./canvas/useViewport.ts"
import { createViewport, placeDrawing } from "@structura/engine"
import { selectionClipboard } from "./clipboard.ts"
import { useCommands } from "./hooks/useCommands.ts"
import { useDocumentFile } from "./hooks/useDocumentFile.ts"
import { useEditorDialogs } from "./hooks/useEditorDialogs.ts"
import { RAISED_NUMBERS, useRememberedSetting } from "./hooks/useRememberedSetting.ts"
import { drawOptions } from "./drawOptions.ts"
import { useEditorHandle, type EditorHandle } from "./hooks/useEditorHandle.ts"
import { useImports } from "./hooks/useImports.ts"
import { initialContent } from "./imports/read.ts"
import { OverlayScope } from "./input/overlays.ts"
import { useEditorInput } from "./input/useEditorInput.ts"
import { BoundPalette } from "./palette/BoundPalette.tsx"
import { PadSlotContext, type Pad, type PadSlot } from "./palette/padSlot.ts"
import { useToolLabel } from "./palette/useToolLabel.ts"
import { HelpDialog } from "./shell/dialogs/HelpDialog.tsx"
import { EditorGuide } from "./shell/EditorGuide.tsx"
import { ImportNotesDialog } from "./shell/dialogs/ImportNotesDialog.tsx"
import { StructureDialog } from "./vision/StructureDialog.tsx"
import { DarkContext, darkClass, useDark } from "../components/theme.ts"
import { SmilesDialog } from "./shell/dialogs/SmilesDialog.tsx"
import { LayoutContext, useLayout } from "./shell/layout.ts"
import { MenuBar, MenuSheet } from "./shell/MenuBar.tsx"
import { StatusBar } from "./shell/StatusBar.tsx"
import { Toolbar } from "./shell/Toolbar.tsx"
import { useEditor } from "./useEditor.ts"
import { useTemplates, type Templates } from "./templates/useTemplates.ts"
import { SaveContext, saveTo } from "./save.ts"

import type { EditorProps } from "./Editor.tsx"
import type { DocumentFile } from "./hooks/useDocumentFile.ts"
import type { EditorDialogs } from "./hooks/useEditorDialogs.ts"
import type { EditorState } from "./useEditor.ts"
import type { Viewport } from "@structura/engine"
import type { GuidePages } from "../guide/index.ts"

/** What the frame hands the area beside the palette: the editor's state and the frame's parts. */
export type FrameParts = {
  editor: EditorState
  file: DocumentFile
  dialogs: EditorDialogs
  templates: Templates
  viewport: Viewport
}

/**
 * The editor's frame: everything Editor is, and the 通式 page's editor too (markush/MarkushEditor),
 * which puts its panes around the canvas (`centre`) and offers 从专利文字填写 (`hasFill`, the
 * dialog its own). Editor itself does not import the 通式 page, so the package leaves it out.
 */
export type FrameProps = Omit<EditorProps, "onEnumerate"> & {
  /** What fills the area beside the palette, given the canvas: the canvas alone by default. */
  centre?: (canvas: ReactNode, parts: FrameParts) => ReactNode
  /** Offers 结构 → 通式与批量生成… */
  onEnumerate?: (parts: FrameParts) => void
  /** Offers AI → 从专利文字填写变量…, its dialog being the centre's. */
  hasFill?: boolean
  /** The name beside the mark in the menu bar. */
  brand?: string
  /** The pages its guide (帮助 → 使用说明) has. */
  guidePages: GuidePages
}

/**
 * Lays out the editor and wires state, commands and input together. It fills its
 * container, so the host decides its size.
 */
export const EditorFrame = forwardRef<EditorHandle, FrameProps>(function EditorFrame({ initialMolfile, initialDocument, onChange, onDocumentChange, onSelectionChange, onDirtyChange, recognizeStructure, templateStore, onDismiss, theme = "light", onThemeChange, layout: askedLayout = "auto", ui = {}, onExpand, onFile, centre, onEnumerate, hasFill = false, brand, guidePages }, ref) {
  const dark = useDark(theme)
  const [initial] = useState(() => initialContent(initialDocument, initialMolfile))
  const editor = useEditor(initial)
  const save = useMemo(() => saveTo(onFile), [onFile])
  const templates = useTemplates(templateStore, save)
  const canvasRef = useRef<CanvasHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [viewport] = useState(createViewport)
  const zoom = useZoom(viewport)
  const dialogs = useEditorDialogs()
  /** The molecule as the canvas shows it: collapsed abbreviations as labels. */
  const shownMol = useMemo(() => displayMolecule(editor.mol), [editor.mol])

  const imports = useImports(editor, viewport)
  const clipboard = selectionClipboard(editor, (line) => imports.showNotes({ opened: false, title: "复制为图片", lines: [line] }))
  /** How labels are written, the same on the canvas as in what is exported. */
  const labelStyle = useMemo(() => drawOptions(editor.raisedNumbers), [editor.raisedNumbers])
  /** A sketch pad that is open: the palette is its until it closes. */
  const [pad, setPad] = useState<Pad | null>(null)
  const claimPalette = useCallback((claimed: Pad) => {
    setPad(claimed)
    return () => setPad((current) => (current === claimed ? null : current))
  }, [])
  const paletteTool = useToolLabel(pad?.editor ?? editor)
  const padSlot = useMemo<PadSlot>(() => ({ claim: claimPalette, colorHetero: editor.colorHetero, drawOptions: labelStyle }), [claimPalette, editor.colorHetero, labelStyle])
  const setRaisedNumbers = useRememberedSetting(RAISED_NUMBERS, editor.raisedNumbers, editor.setRaisedNumbers)
  const { message, flash } = useFlash()
  /** The bracket whose 重复次数 dialog is open. */
  const [countFor, setCountFor] = useState<number | null>(null)
  const menu = useCanvasMenu({ editor, shownMol, canvas: canvasRef, flash, showReport: dialogs.showReport })
  const file = useDocumentFile(editor.drawing, editor.latest, onDirtyChange)
  /** Opens a file and, if it opened, remembers it as this document's file. */
  const openFile = async (picked: File) => {
    if (await imports.openFile(picked)) file.markSaved(picked.name)
  }
  const commands = useCommands({
    onDismiss,
    file,
    editor,
    canvas: canvasRef,
    viewport,
    clipboard: { ...clipboard, paste: () => void imports.pasteClipboard() },
    openFileDialog: () => fileRef.current?.click(),
    dialogs,
    openMarkush: onEnumerate ? () => onEnumerate(parts()) : undefined,
    models: { recognize: recognizeStructure != null, fill: hasFill },
    save,
  })
  const input = useEditorInput({ editor, canvas: canvasRef, commands, onPaste: imports.paste, onCopy: clipboard.onEvent })
  useEditorHandle(ref, { editor, viewport, openText: imports.openText, onChange, onDocumentChange, onSelectionChange })
  const layout = useLayout(input.rootProps.ref, askedLayout)
  const parts = (): FrameParts => ({ editor, file, dialogs, templates, viewport })
  /** 放大编辑: the structure out to the host's larger editor, and what was saved there back as one edit. */
  const expand = onExpand
    ? () =>
        void Promise.resolve(onExpand(toDocument(editor.latest()))).then((saved) => {
          if (typeof saved !== "string") return
          const read = readDocument(saved)
          if ("drawing" in read) editor.loadDrawing(read.drawing)
          else flash("放大编辑保存的结构读不出来，未改动")
        })
    : undefined
  const menuProps = {
    commands,
    colorHetero: editor.colorHetero,
    onColorHetero: editor.setColorHetero,
    raisedNumbers: editor.raisedNumbers,
    onRaisedNumbers: setRaisedNumbers,
    hasFill,
    theme,
    onTheme: onThemeChange,
  }

  /** The canvas with its right-click menu: the centre, or what the 通式 page puts its panes around. */
  const canvasArea = (
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="flex min-h-0 min-w-0 flex-1" onContextMenu={menu.onContextMenu}>
                <Canvas ref={canvasRef} {...canvasSlice(editor, { mol: shownMol, drawOptions: labelStyle, attachments: editor.attachments, brackets: editor.brackets, viewport })} />
                </div>
              </ContextMenuTrigger>
              <CanvasMenu
                target={menu.target}
                attachments={editor.attachments}
                commands={commands}
                run={(ops) => void editor.run(ops)}
                onEditLabel={(atom) => canvasRef.current?.editLabel(atom)}
                onSelectMolecule={menu.selectMolecule}
                onCopyAs={menu.copyAs}
                onAnalyze={menu.analyze}
                brackets={editor.brackets}
                onBracketCount={setCountFor}
                onSelectAtoms={menu.selectAtoms}
              />
            </ContextMenu>
  )

  return (
    <DarkContext value={dark}>
    <LayoutContext value={layout}>
    <SaveContext value={save}>
    <TooltipProvider delayDuration={350}>
      <OverlayScope value={input.overlayScope}>
        <PadSlotContext value={padSlot}>
          <div
            className={`chem-app relative flex h-full w-full min-h-0 flex-col overflow-hidden ${darkClass(dark)}`}
            data-layout={layout}
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
              accept=".structura,.cdxml,.mol,.sdf,.sd,.mdl"
              className="hidden"
              data-testid="open-file"
              onChange={(event) => {
                const picked = event.target.files?.[0]
                event.target.value = ""
                if (picked) void openFile(picked)
              }}
            />
            {ui.menuBar !== false && layout !== "mini" && (
              <MenuBar {...menuProps} title={file.title} dirty={file.dirty} compact={layout === "compact"} brand={brand} />
            )}
            {ui.toolbar !== false && (
              <Toolbar
                commands={commands}
                zoom={zoom}
                layout={layout}
                menus={ui.menuBar !== false && layout === "mini" ? <MenuSheet {...menuProps} /> : undefined}
                onExpand={expand}
              />
            )}

            <div className="flex min-h-0 flex-1">
              {ui.palette !== false && <BoundPalette editor={pad?.editor ?? editor} onPick={pad?.onPick} structureTools={!pad} />}
              {centre ? centre(canvasArea, parts()) : canvasArea}
            </div>

            {ui.statusBar !== false && layout !== "mini" && (
              <StatusBar
                toolLabel={paletteTool}
                formula={editor.formula}
                weight={editor.weight}
                valenceErrors={editor.valenceErrors}
                atomCount={editor.mol.atoms.length}
                zoom={zoom}
              />
            )}

            <ImportNotesDialog notes={imports.notes} onClose={imports.clearNotes} />
            <AnalysisDialog report={dialogs.report} onOpenChange={(open) => !open && dialogs.showReport(null)} onCopy={(text, what) => {
              writeClipboard(text)
              flash(`已复制${what}`)
            }} />
            <Flash message={message} />
            {recognizeStructure && (
              <StructureDialog
                open={dialogs.recognize}
                onOpenChange={dialogs.setOpen("recognize")}
                recognize={recognizeStructure}
                onApply={(drawing) => {
                  const place = placeDrawing(editor.latest(), drawing)
                  if ("load" in place) editor.loadDrawing(place.load)
                  else editor.appendMolecules([place.append], viewport.centre())
                }}
              />
            )}
            <SmilesDialog
              open={dialogs.smiles}
              onOpenChange={dialogs.setOpen("smiles")}
              onImport={imports.importSmiles}
              onNotes={(lines) => imports.showNotes({ opened: true, lines })}
              loadFailed={imports.rdkitFailed}
            />
            <BracketCountDialog
              bracket={editor.brackets?.find((bracket) => bracket.id === countFor) ?? null}
              onSave={(id, repeat) => editor.run([{ op: "set_bracket", id, kind: "repeat", repeat }], { keepSelection: true }) != null}
              onClose={() => setCountFor(null)}
            />
            <HelpDialog open={dialogs.help} onOpenChange={dialogs.setOpen("help")} commands={commands} />
            <EditorGuide topic={dialogs.guide} onTopic={dialogs.showGuide} openShortcuts={dialogs.guideToShortcuts} pages={guidePages} />
          </div>
        </PadSlotContext>
      </OverlayScope>
    </TooltipProvider>
    </SaveContext>
    </LayoutContext>
    </DarkContext>
  )
})
