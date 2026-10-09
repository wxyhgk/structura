import type { BridgeName } from "../types.ts"

/**
 * Divalent pieces that join two atoms: "L is a single bond or a substituted or unsubstituted
 * (C6–C30)arylene". Each is a chain of benzene rings entered at the ipso atom and left at
 * `exit` (3 para, 2 meta), with any ring atoms swapped for another element.
 */
export type Bridge = { rings: Array<{ exit: number; swap?: Record<number, string> }>; size: number }

export const BRIDGES = {
  "p-phenylene": { rings: [{ exit: 3 }], size: 6 },
  "m-phenylene": { rings: [{ exit: 2 }], size: 6 },
  "4,4'-biphenylene": { rings: [{ exit: 3 }, { exit: 3 }], size: 12 },
  "2,5-pyridinediyl": { rings: [{ exit: 3, swap: { 5: "N" } }], size: 6 },
} satisfies Record<BridgeName, Bridge>
