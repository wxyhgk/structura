import { atomHotkey } from "./hotkeys/atoms.ts"
import { bondHotkey } from "./hotkeys/bonds.ts"
export type { HotTarget } from "./molecule/grow.ts"
import type { HotResult, HotTarget } from "./molecule/grow.ts"
import type { Molecule } from "./types.ts"

export function applyHotkey(mol: Molecule, target: HotTarget, key: string): HotResult | null {
  if (target.type === "bond") return bondHotkey(mol, target.id, key)
  return atomHotkey(mol, target.id, key)
}
