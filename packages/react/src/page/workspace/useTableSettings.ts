import { useState } from "react"
import { DEFAULT_NUMBERING, type Numbering } from "../numbering.ts"

const KEY = "structura.compoundTable"

/** How generated compounds are numbered, and how many a table puts to a row. */
export type TableSettings = { numbering: Numbering; columns: number }

const DEFAULTS: TableSettings = { numbering: DEFAULT_NUMBERING, columns: 3 }

function load(): TableSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<TableSettings>
    const pattern = typeof saved.numbering?.pattern === "string" ? saved.numbering.pattern : DEFAULTS.numbering.pattern
    const start = Number.isInteger(saved.numbering?.start) ? saved.numbering!.start : DEFAULTS.numbering.start
    const columns = Number.isInteger(saved.columns) && saved.columns! >= 1 && saved.columns! <= 8 ? saved.columns! : DEFAULTS.columns
    return { numbering: { pattern, start }, columns }
  } catch {
    return DEFAULTS
  }
}

/** The numbering and the table's columns, remembered in this browser (patents of one drafter number alike). */
export function useTableSettings() {
  const [settings, setSettings] = useState(load)
  const update = (next: Partial<TableSettings>) => {
    const merged = { ...settings, ...next }
    try {
      localStorage.setItem(KEY, JSON.stringify(merged))
    } catch {
      // Storage may be blocked; the settings last this visit.
    }
    setSettings(merged)
  }
  return { ...settings, setNumbering: (numbering: Numbering) => update({ numbering }), setColumns: (columns: number) => update({ columns }) }
}
