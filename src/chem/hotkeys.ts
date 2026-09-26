// Keys pressed over an atom or bond. The tables say what each key means; actions.ts does it.
import { runAtomAction, runBondAction } from "./hotkeys/actions.ts"
import { ATOM_KEYS } from "./hotkeys/atom-keys.ts"
import { BOND_KEYS } from "./hotkeys/bond-keys.ts"
import type { HotResult } from "./molecule/grow.ts"
import type { HotTarget, Molecule } from "./types.ts"

export type { AtomAction, BondAction } from "./hotkeys/actions.ts"
export { ATOM_KEYS, BOND_KEYS }

/** Whether the key does something on an atom or a bond. */
export function hasHotkey(type: HotTarget["type"], key: string): boolean {
  return Object.hasOwn(type === "atom" ? ATOM_KEYS : BOND_KEYS, key)
}

export function applyHotkey(mol: Molecule, target: HotTarget, key: string): HotResult | null {
  if (target.type === "bond") {
    const action = Object.hasOwn(BOND_KEYS, key) ? BOND_KEYS[key] : undefined
    return action ? runBondAction(mol, target.id, action) : null
  }
  const action = Object.hasOwn(ATOM_KEYS, key) ? ATOM_KEYS[key] : undefined
  return action ? runAtomAction(mol, target.id, action) : null
}
