import { useEffect, useState } from "react"
import type { Drawing } from "@structura/core/types"

/** A drawing with nothing on it: no atoms, no arrows. */
const blank = (drawing: Drawing) => drawing.molecule.atoms.length === 0 && drawing.arrows.length === 0

/** A file's name without its extension, for the title and the names of what is saved or exported. */
export function baseName(fileName: string): string {
  return fileName.replace(/\.(structura|mol|sdf|sd|mdl|json)$/i, "").trim() || "未命名"
}

/**
 * Which file the drawing is, and whether it has changed since it was opened or saved.
 * The drawing at that moment is kept: any other drawing is a change (undoing back to it
 * counts as unchanged only while it is the very same drawing). A blank page is never
 * "changed". `onDirtyChange` hears every flip, so the host can warn before leaving.
 */
export function useDocumentFile(current: Drawing, latest: () => Drawing, onDirtyChange?: (dirty: boolean) => void) {
  const [name, setName] = useState<string | null>(null)
  const [saved, setSaved] = useState<Drawing>(current)
  const dirty = current !== saved && !(blank(current) && blank(saved))
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  return {
    /** What the title shows: the file's name, or 未命名 for a drawing never opened or saved. */
    title: name ?? "未命名",
    /** The name files are written under, without extension. */
    base: name ?? "未命名",
    dirty,
    /** The drawing as it now is was just opened from, or saved to, a file of this name (null: a new page). */
    markSaved(fileName: string | null) {
      setName(fileName == null ? null : baseName(fileName))
      setSaved(latest())
    },
  }
}

export type DocumentFile = ReturnType<typeof useDocumentFile>
