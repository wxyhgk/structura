import { useEffect, useRef, useState } from "react"
import { usableRecords } from "@/chem/import"
import { emptyMolecule } from "@/chem/molecule"
import { readMolfile, type MolRecord } from "@/chem/sdf"
import type { Molecule } from "@/chem/types"
import { failure } from "@/editor/browser"
import { drawingPoints, type Viewport } from "@/editor/canvas/viewport"
import { importNotes, type ImportNotes } from "@/editor/imports/notes"
import { readMolText } from "@/editor/imports/read"
import { loadRDKit } from "@/editor/rdkit"
import type { EditorState } from "@/editor/useEditor"
import { looksLikeSmiles, smilesLines, smilesToMolfile } from "@/rdkit/smiles"

const RDKIT_FAILED = "RDKit 加载失败，请检查网络后重试。"

/**
 * Opening files, pasting molfile or SMILES text, and importing SMILES: all go through
 * usableRecords, land as one undoable step, and report problems through `notes`.
 */
export function useImports(editor: Pick<EditorState, "mol" | "arrows" | "openMolecules" | "appendMolecules">, viewport: Viewport) {
  const [notes, setNotes] = useState<ImportNotes | null>(null)
  /** Set when an import lands, so the view fits the drawing once it has rendered. */
  const fitAfterImport = useRef(false)

  useEffect(() => {
    if (!fitAfterImport.current) return
    fitAfterImport.current = false
    viewport.fit(drawingPoints(editor.mol, editor.arrows))
  }, [viewport, editor.mol, editor.arrows])

  /** Adds molecules to the right of the drawing, as one undoable step. */
  function addBeside(molecules: Molecule[]) {
    if (molecules.length === 0) return
    fitAfterImport.current = true
    editor.appendMolecules(molecules)
  }

  /**
   * Converts SMILES with RDKit, loading it on first use, and adds what worked. Returns
   * what to tell the user and how many lines were left out.
   */
  async function importSmiles(text: string): Promise<{ lines: string[]; skipped: number }> {
    const entries = smilesLines(text)
    if (entries.length === 0) return { lines: ["没有找到 SMILES。"], skipped: 0 }
    const rdkit = await loadRDKit()
    const records: MolRecord[] = entries.map(({ smiles, name }) => {
      const result = smilesToMolfile(rdkit, smiles)
      if ("error" in result) {
        return { mol: emptyMolecule(), title: smiles, properties: {}, problems: [{ code: "bad-molfile", severity: "error", message: result.error }] }
      }
      const read = readMolfile(result.molfile)
      return { mol: read.mol, title: name || smiles, properties: {}, problems: read.problems }
    })
    const imported = usableRecords(records)
    addBeside(imported.molecules)
    return { lines: importNotes(records, imported.problems), skipped: imported.skipped }
  }

  /**
   * Replaces the drawing with the molecules in molfile or SD text, fitting them in view,
   * and says what happened. Throws when the text cannot be read at all.
   */
  function openText(text: string): ImportNotes {
    const { molecules, lines } = readMolText(text)
    if (molecules.length === 0) return { opened: false, lines: lines.length > 0 ? lines : ["文件里没有可以读取的分子。"] }
    fitAfterImport.current = true
    editor.openMolecules(molecules)
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

  /** Pasted molfile or SMILES text lands beside the drawing; other text is left alone. */
  function paste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text/plain") ?? ""
    if (/^\s*M {2}END/m.test(text)) {
      event.preventDefault()
      try {
        const { molecules, lines } = readMolText(text)
        addBeside(molecules)
        if (lines.length > 0) setNotes({ opened: molecules.length > 0, lines })
      } catch (error) {
        setNotes({ opened: false, lines: [`粘贴的内容无法读取：${failure(error)}`] })
      }
    } else if (looksLikeSmiles(text)) {
      event.preventDefault()
      void importSmiles(text)
        .then(({ lines, skipped }) => lines.length > 0 && setNotes({ opened: skipped < smilesLines(text).length, lines }))
        .catch(() => setNotes({ opened: false, lines: [RDKIT_FAILED] }))
    }
  }

  return {
    notes,
    showNotes: setNotes,
    clearNotes: () => setNotes(null),
    openText,
    openFile,
    paste,
    importSmiles,
    rdkitFailed: RDKIT_FAILED,
  }
}

export type Imports = ReturnType<typeof useImports>
