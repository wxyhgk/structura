import type { BondAction } from "./actions.ts"

/** The keys pressed over a bond. Upper case is Shift. */
export const BOND_KEYS: Record<string, BondAction> = {
  "1": { do: "style", style: { order: 1, stereo: "none" } },
  "2": { do: "style", style: { order: 2, stereo: "none" } },
  "3": { do: "style", style: { order: 3, stereo: "none" } },
  w: { do: "style", style: { order: 1, stereo: "up" } },
  W: { do: "style", style: { order: 1, stereo: "down" } },
  h: { do: "style", style: { order: 1, stereo: "down" } },
  y: { do: "style", style: { order: 1, stereo: "either" } },
  b: { do: "style", style: { order: 1, stereo: "none", look: "bold" } },
  d: { do: "style", style: { order: 1, stereo: "none", look: "dashed" } },
  H: { do: "style", style: { order: 1, stereo: "none", look: "shadow" } },
  B: { do: "style", style: { order: 2, stereo: "none", emphasis: "bold" } },
  D: { do: "style", style: { order: 2, stereo: "none", emphasis: "dashed" } },
  a: { do: "fuse", kind: "benzene" },
  z: { do: "fuse", kind: "cyclopentene" },
  v: { do: "fuse", kind: "cyclopropane" },
  "4": { do: "fuse", kind: "cyclobutane" },
  "5": { do: "fuse", kind: "cyclopentane" },
  "6": { do: "fuse", kind: "cyclohexane" },
  "7": { do: "fuse", kind: "cycloheptane" },
  "8": { do: "fuse", kind: "cyclooctane" },
  "9": { do: "fuse-chair", turn: 1 },
  "0": { do: "fuse-chair", turn: -1 },
}
