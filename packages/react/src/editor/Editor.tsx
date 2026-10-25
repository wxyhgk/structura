import { forwardRef } from "react"
import { toDocument } from "@structura/core/document"
import { EditorFrame } from "./EditorFrame.tsx"
import { DRAWING_PAGES } from "../guide/index.ts"
import type { EditorHandle } from "./hooks/useEditorHandle.ts"
import type { Selection } from "@structura/core/types"
import type { RecognizeStructure } from "./vision/useRecognition.ts"
import type { TemplateStore } from "./templates/store.ts"
import type { Theme } from "../components/theme.ts"
import type { Layout } from "./shell/layout.ts"
import type { OnFile } from "./save.ts"

export type { EditorHandle, RunResult } from "./hooks/useEditorHandle.ts"
export type { Selection } from "@structura/core/types"
export type { EnumerateOptions, Enumeration } from "@structura/markush"
export type { Op } from "@structura/core/ops"
export type { RecognizeStructure } from "./vision/useRecognition.ts"
export type { TemplateStore } from "./templates/store.ts"
export type { Theme } from "../components/theme.ts"
export type { Layout } from "./shell/layout.ts"
export type { EditorFile, OnFile } from "./save.ts"

/** Parts of the editor a host can leave out, each shown unless set to false. */
export type EditorUi = {
  /** 文件 编辑 结构 … (in a mini editor, the ☰ that holds them). */
  menuBar?: boolean
  /** Undo, zoom, rotate… */
  toolbar?: boolean
  /** The tools and elements down the left. */
  palette?: boolean
  /** The tool, formula, weight and zoom along the bottom (a mini editor has none anyway). */
  statusBar?: boolean
}

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
   * What is selected (atom and bond ids as getDocument numbers them), each time the user
   * changes it: a click, a box or lasso (once, when released), select all, Escape, or an edit
   * that clears it. Not called for the host's own setSelection, nor when nothing changed.
   */
  onSelectionChange?: (selection: Selection) => void
  /**
   * Whether the drawing has changes not yet saved to a file, each time that flips: the host
   * can warn before the page is closed, or keep a copy (the standalone app does both).
   */
  onDirtyChange?: (dirty: boolean) => void
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
  /**
   * Called for an Escape the editor has no other use for: no gesture to stop, nothing selected
   * (Escape does each of those first, one press at a time; menus, dialogs and fields keep their
   * own). A host showing the editor in a dialog of its own closes it here. Without it, that
   * Escape takes the lasso, as in ChemDraw.
   */
  onDismiss?: () => void
  /**
   * "light" (the default), "dark", or "auto": dark when the page says so (data-theme="dark", or
   * class "dark", on <html>) or, when it says nothing, when the system is dark; followed live.
   * Files the editor writes (SVG, CDXML, Word…) stay light either way.
   */
  theme?: Theme
  /** Offers 浅色 / 深色 / 跟随系统 in 查看; the host keeps the choice and passes it back as `theme`. Without it, no choice is shown. */
  onThemeChange?: (theme: Theme) => void
  /**
   * "auto" (the default) lays the editor out by the size of its own box, as it changes: full,
   * then compact below 720×520 (fewer buttons), then
   * mini below 480×360 (the menus in one ☰, no status bar). Or one of those, always.
   */
  layout?: Layout | "auto"
  /** Parts of the editor to leave out: see EditorUi. */
  ui?: EditorUi
  /**
   * Offers 放大编辑 in a mini editor: the host opens the structure somewhere larger (mount()
   * does, in edit()'s sheet) and resolves to the document as it was saved there, which this
   * editor takes as one undoable edit; null or nothing leaves it as it was.
   */
  onExpand?: (document: string) => Promise<string | null | undefined> | void
  /**
   * Takes the files the editor makes (保存, 导出, tables of compounds) instead of the browser
   * downloading them: for an app with its own storage or save dialog, or a page in an iframe.
   * Returning false lets the browser download that one after all.
   */
  onFile?: OnFile
  /**
   * Offers 结构 → 通式与批量生成…: the host opens the generic formula (this document) where
   * its variables are defined and compounds generated (the standalone app: its 通式 page).
   * Without it the item is not shown; `enumerate()` on the handle generates without a page.
   */
  onEnumerate?: (document: string) => void
}

/**
 * The structure editor: it fills its container, so the host decides its size. The generic
 * formula's variables and what they generate are the host's page (onEnumerate), not the editor's.
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ onEnumerate, ...props }, ref) {
  return <EditorFrame ref={ref} {...props} guidePages={DRAWING_PAGES} onEnumerate={onEnumerate ? ({ editor }) => onEnumerate(toDocument(editor.latest())) : undefined} />
})
