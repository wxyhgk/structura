import { useState } from "react"
import { isDocument, readDocument } from "@structura/core/document"
import { usableRecords } from "@structura/core/import"
import type { Molecule } from "@structura/core/types"
import { looksLikeSmiles, smilesLines, smilesRecords } from "@structura/rdkit"
import { failure, MOD, readClipboard } from "@/editor/browser"
import type { Viewport } from "@structura/engine"
import { importNotes, type ImportNotes } from "@/editor/imports/notes"
import { readMolText } from "@/editor/imports/read"
import { loadRDKit } from "@/editor/rdkit"
import type { EditorState } from "@/editor/useEditor"

const RDKIT_FAILED = "RDKit 加载失败，请检查网络后重试。"

/**
 * Opening files, pasting molfile or SMILES text, and importing SMILES: all go through
 * usableRecords, land as one undoable step, and report problems through `notes`.
 */
export function useImports(editor: Pick<EditorState, "openMolecules" | "appendMolecules" | "loadDrawing">, viewport: Viewport) {
  const [notes, setNotes] = useState<ImportNotes | null>(null)

  /**
   * Adds molecules to the right of the drawing, as one undoable step. The canvas is
   * endless and the view never moves on its own: on an empty page they land in the middle
   * of what the user is looking at.
   */
  function addBeside(molecules: Molecule[]) {
    if (molecules.length === 0) return
    editor.appendMolecules(molecules, viewport.centre())
  }

  /**
   * Converts SMILES with RDKit, loading it on first use, and adds what worked. Returns
   * what to tell the user and how many lines were left out.
   */
  async function importSmiles(text: string): Promise<{ lines: string[]; skipped: number }> {
    if (smilesLines(text).length === 0) return { lines: ["没有找到 SMILES。"], skipped: 0 }
    const rdkit = await loadRDKit()
    const records = smilesRecords(rdkit, text)
    const imported = usableRecords(records)
    addBeside(imported.molecules)
    return { lines: importNotes(records, imported.problems), skipped: imported.skipped }
  }

  /**
   * Replaces the drawing with a saved Structura document, as it was saved, or with the
   * molecules in molfile or SD text, in the middle of the view; says what happened.
   * Throws when molfile text cannot be read at all.
   */
  function openText(text: string): ImportNotes {
    if (isDocument(text)) {
      const read = readDocument(text)
      if ("error" in read) return { opened: false, lines: [`文件无法打开：${read.error}`] }
      editor.loadDrawing(read.drawing)
      return { opened: true, lines: [] }
    }
    const { molecules, lines } = readMolText(text)
    if (molecules.length === 0) return { opened: false, lines: lines.length > 0 ? lines : ["文件里没有可以读取的分子。"] }
    editor.openMolecules(molecules, viewport.centre())
    return { opened: true, lines }
  }

  /** Replaces the drawing with a file's molecules. */
  async function openFile(file: File) {
    try {
      const result = openText(await file.text())
      if (result.lines.length > 0) setNotes(result)
    } catch (error) {
      setNotes({ opened: false, lines: [`读取文件失败：${failure(error)}`] })
    }
  }

  /**
   * Molfile or SMILES text lands beside the drawing; returns false, doing nothing, for
   * other text.
   */
  function pasteText(text: string): boolean {
    if (/^\s*M {2}END/m.test(text)) {
      try {
        const { molecules, lines } = readMolText(text)
        addBeside(molecules)
        if (lines.length > 0) setNotes({ opened: molecules.length > 0, lines })
      } catch (error) {
        setNotes({ opened: false, lines: [`粘贴的内容无法读取：${failure(error)}`] })
      }
      return true
    }
    if (looksLikeSmiles(text)) {
      void importSmiles(text)
        .then(({ lines, skipped }) => lines.length > 0 && setNotes({ opened: skipped < smilesLines(text).length, lines }))
        .catch(() => setNotes({ opened: false, lines: [RDKIT_FAILED] }))
      return true
    }
    return false
  }

  /** ⌘V: the editor takes the paste only for text it can read. */
  function paste(event: ClipboardEvent) {
    if (pasteText(event.clipboardData?.getData("text/plain") ?? "")) event.preventDefault()
  }

  /** 编辑 → 粘贴: the same, reading the clipboard itself, which the browser may refuse. */
  async function pasteClipboard() {
    let text: string
    try {
      text = await readClipboard()
    } catch {
      setNotes({ opened: false, title: "粘贴", lines: [`浏览器没有允许读取剪贴板。请直接在画布上按 ${MOD}V，或在网站设置里允许访问剪贴板。`] })
      return
    }
    if (!pasteText(text)) setNotes({ opened: false, title: "粘贴", lines: ["剪贴板里没有可以粘贴的结构（MOL 或 SMILES 文本）。"] })
  }

  return {
    notes,
    showNotes: setNotes,
    clearNotes: () => setNotes(null),
    openText,
    openFile,
    paste,
    pasteClipboard,
    importSmiles,
    rdkitFailed: RDKIT_FAILED,
  }
}

export type Imports = ReturnType<typeof useImports>
