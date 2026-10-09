import { useState } from "react"
import { atomById, bondsLeaving } from "@structura/core/molecule"
import type { Molecule } from "@structura/core/types"
import type { Run } from "@structura/engine"
import type { useHotspot } from "./useHotspot.ts"

/** The label field: on one atom, or on a selected fragment to replace (`replace` lists its atoms). */
export type LabelEdit = { id: number; initial: string; replace?: number[] }

/**
 * The canvas's label field: opening it on an atom (double click, Enter, the menu) or on a
 * fragment to replace, and what is typed into it, as one edit.
 */
export function useLabelEditor({ current, hotspot, run }: { current: () => Molecule; hotspot: ReturnType<typeof useHotspot>; run: Run }) {
  const [edit, setEdit] = useState<LabelEdit | null>(null)

  /** Opens the field on an atom; false if the atom is gone. */
  function openLabel(id: number): boolean {
    const atom = atomById(current(), id)
    if (!atom) return false
    // The field covers the atom, so the canvas sees the pointer leave; pinning keeps the
    // atom as the hotspot, so Enter after Escape reopens it and keys go on from there.
    hotspot.pin(atom.id)
    setEdit({ id: atom.id, initial: atom.alias ?? (atom.el === "C" ? "" : atom.el) })
    return true
  }

  /** Opens the field on the fragment made of these atoms; what is typed replaces it. */
  function replaceFragment(ids: number[]) {
    const mol = current()
    // The field sits on the atom that joins the fragment to the rest, where the new piece goes.
    const [join] = bondsLeaving(mol, ids)
    const at = join ? (ids.includes(join.a) ? join.a : join.b) : ids[0]
    if (at != null && atomById(mol, at)) setEdit({ id: at, initial: "", replace: ids })
  }

  /** The field closed: with the text typed, or null when it was cancelled. */
  function done(text: string | null) {
    const was = edit
    setEdit(null)
    if (text == null || !was) return
    if (was.replace) run([{ op: "replace", atoms: was.replace, with: { label: text } }])
    else run([{ op: "label", atom: was.id, text }], { keepSelection: true })
  }

  return { edit, openLabel, replaceFragment, done }
}
