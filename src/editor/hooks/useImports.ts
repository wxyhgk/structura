import { useEffect, useRef, useState, type RefObject } from "react"
import { usableRecords } from "@/chem/import"
import { emptyMolecule } from "@/chem/molecule"
import { readMolfile, readSdf, type MolRecord } from "@/chem/sdf"
import type { Molecule } from "@/chem/types"
import { failure } from "@/editor/browser"
import type { CanvasHandle } from "@/editor/canvas/types"
import { editorKeysBlocked } from "@/editor/keys"
import { importNotes, type ImportNotes } from "@/editor/imports/notes"
import { loadRDKit } from "@/editor/rdkit"
import type { EditorState } from "@/editor/useEditor"
import { looksLikeSmiles, smilesLines, smilesToMolfile } from "@/rdkit/smiles"

const RDKIT_FAILED = "RDKit 加载失败，请检查网络后重试。"

/**
 * Opening files, pasting molfile or SMILES text, and importing SMILES: all go through
 * usableRecords, land as one undoable step, and report problems through `notes`.
 */
export function useImports(editor: EditorState, canvas: RefObject<CanvasHandle | null>) {
  const [notes, setNotes] = useState<ImportNotes | null>(null)
  /** Set when an import lands, so the view fits the drawing once it has rendered. */
  const fitAfterImport = useRef(false)

  useEffect(() => {
    if (!fitAfterImport.current) return
    fitAfterImport.current = false
    canvas.current?.fitContent(editor.mol)
  }, [canvas, editor.mol])

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

  /** Replaces the drawing with a file's molecules. */
  async function openFile(file: File) {
    try {
      const records = readSdf(await file.text())
      const imported = usableRecords(records)
      const found = importNotes(records, imported.problems)
      if (imported.molecules.length === 0) {
        setNotes({ opened: false, lines: found.length > 0 ? found : ["文件里没有可以读取的分子。"] })
        return
      }
      fitAfterImport.current = true
      editor.openMolecules(imported.molecules)
      if (found.length > 0) setNotes({ opened: true, lines: found })
    } catch (error) {
      setNotes({ opened: false, lines: [`读取文件失败：${failure(error)}`] })
    }
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (editorKeysBlocked(event)) return
      const text = event.clipboardData?.getData("text/plain") ?? ""
      if (/^\s*M {2}END/m.test(text)) {
        event.preventDefault()
        try {
          const records = readSdf(text)
          const imported = usableRecords(records)
          addBeside(imported.molecules)
          const found = importNotes(records, imported.problems)
          if (found.length > 0) setNotes({ opened: imported.molecules.length > 0, lines: found })
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
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  })

  return {
    notes,
    showNotes: setNotes,
    clearNotes: () => setNotes(null),
    openFile,
    importSmiles,
    rdkitFailed: RDKIT_FAILED,
  }
}

export type Imports = ReturnType<typeof useImports>
