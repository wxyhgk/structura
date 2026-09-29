// Keys pressed over an atom or bond. The tables say what each key means; actions.ts turns
// that into ops, so a key press is an edit like any other.
import type { Op } from "@/chem/ops"
import type { HotTarget, Molecule, Selection } from "@/chem/types"
import { atomActionOps, bondActionOps } from "./actions.ts"
import { ATOM_KEYS } from "./atom-keys.ts"
import { BOND_KEYS } from "./bond-keys.ts"

export type { AtomAction, BondAction } from "./actions.ts"
export { ATOM_KEYS, BOND_KEYS }

/** Whether the key does something on an atom or a bond. */
export function hasHotkey(type: HotTarget["type"], key: string): boolean {
  return Object.hasOwn(type === "atom" ? ATOM_KEYS : BOND_KEYS, key)
}

/**
 * The ops pressing `key` over the target sends, or null when the key means nothing there.
 * The result's `next` is where the following key lands; `as` names that atom when the key
 * grows a new one.
 */
export function hotkeyOps(mol: Molecule, target: HotTarget, key: string, as?: string): Op[] | null {
  if (!hasHotkey(target.type, key)) return null
  return target.type === "atom" ? atomActionOps(mol, target.id, ATOM_KEYS[key], as) : bondActionOps(target.id, BOND_KEYS[key], as)
}

const tipName = (index: number) => `tip${index}`

/**
 * A key pressed with a selection acts on every selected atom, or on every selected bond
 * when no atoms are selected, as one batch. Null if the key means nothing there. The atoms
 * are asked about as they are before the batch.
 */
export function selectionHotkeyOps(mol: Molecule, selection: Selection, key: string): Op[] | null {
  const onAtoms = selection.atoms.length > 0
  const ids = onAtoms ? selection.atoms : selection.bonds
  if (ids.length === 0 || !hasHotkey(onAtoms ? "atom" : "bond", key)) return null
  return ids.flatMap((id, index) =>
    (onAtoms ? hotkeyOps(mol, { type: "atom", id }, key, tipName(index)) : hotkeyOps(mol, { type: "bond", id }, key)) ?? [],
  )
}

/**
 * Where each selected atom's key left its tip, from the batch's `names`: the new atom it
 * grew, or the atom itself when the key changed it in place.
 */
export function selectionTips(atoms: number[], names: Record<string, number>): number[] {
  return atoms.map((id, index) => names[tipName(index)] ?? id)
}
