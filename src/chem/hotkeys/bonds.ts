import { fuseChairAt, fuseRingAt, setBondLook } from "../molecule.ts"
import type { BondStyle, Molecule, RingKind } from "../types.ts"
import type { HotResult } from "./shared.ts"

const FUSED: Record<string, RingKind> = {
  a: "benzene",
  z: "cyclopentene",
  v: "cyclopropane",
  "4": "cyclobutane",
  "5": "cyclopentane",
  "6": "cyclohexane",
  "7": "cycloheptane",
  "8": "cyclooctane",
}

export function bondHotkey(mol: Molecule, id: number, key: string): HotResult | null {
  if (key === "9" || key === "0") {
    const chair = fuseChairAt(mol, id, key === "9" ? 1 : -1)
    return { mol: chair.mol, next: { type: "atom", id: chair.far } }
  }
  const kind = FUSED[key]
  if (kind) {
    const fused = fuseRingAt(mol, id, kind, 1)
    return { mol: fused.mol, next: { type: "atom", id: fused.far } }
  }
  const style = bondStyleFor(key)
  if (!style) return null
  return { mol: setBondLook(mol, id, style), next: { type: "bond", id } }
}

function bondStyleFor(key: string): BondStyle | null {
  switch (key) {
    case "2":
      return { order: 2, stereo: "none" }
    case "3":
      return { order: 3, stereo: "none" }
    case "w":
      return { order: 1, stereo: "up" }
    case "h":
    case "W":
      return { order: 1, stereo: "down" }
    case "H":
      return { order: 1, stereo: "none", look: "shadow" }
    case "b":
      return { order: 1, stereo: "none", look: "bold" }
    case "B":
      return { order: 2, stereo: "none", emphasis: "bold" }
    case "d":
      return { order: 1, stereo: "none", look: "dashed" }
    case "D":
      return { order: 2, stereo: "none", emphasis: "dashed" }
    case "y":
      return { order: 1, stereo: "either" }
    default:
      return null
  }
}
