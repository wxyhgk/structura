import { atomHotkey } from "./hotkeys/atoms.ts"
import { bondHotkey } from "./hotkeys/bonds.ts"
export type { HotTarget } from "./hotkeys/shared.ts"
export { setAtomLabel } from "./hotkeys/label.ts"
import type { HotResult, HotTarget } from "./hotkeys/shared.ts"
import type { Molecule } from "./types.ts"

export function applyHotkey(mol: Molecule, target: HotTarget, key: string): HotResult | null {
  if (target.type === "bond") return bondHotkey(mol, target.id, key)
  return atomHotkey(mol, target.id, key)
}
