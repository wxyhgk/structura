import type { Point } from "@structura/core/types"
import { build, once } from "./build.ts"

// Pictures for the brackets page.

/** A zigzag of `count` atoms from the origin, as the chain tool draws it. */
const zigzag = (count: number): Point[] => Array.from({ length: count }, (_, index) => ({ x: index * 35, y: index % 2 ? -20 : 0 }))

/** A phenanthrene in a group bracket, a substituent hanging off it. */
export const groupBracket = once(() =>
  build([
    { op: "add_scaffold", name: "phenanthrene" },
    { op: "add_bracket", atoms: Array.from({ length: 14 }, (_, index) => index + 1) },
    { op: "add_atom", el: "C", to: 3, as: "r" },
    { op: "label", atom: "r", text: "R1" },
  ]),
)

/** MeO–[CH2]n–CH2CH2–OH: one carbon as a repeat unit, the bonds running through its brackets. */
export const repeatBracket = once(() =>
  build([
    { op: "draw_chain", points: zigzag(6) },
    { op: "label", atom: 1, text: "MeO" },
    { op: "label", atom: 6, text: "OH" },
    { op: "add_bracket", atoms: [3], kind: "repeat" },
  ]),
)

/** A two-carbon repeat unit counted m. */
export const longerRepeat = once(() =>
  build([
    { op: "draw_chain", points: zigzag(6) },
    { op: "add_bracket", atoms: [3, 4], kind: "repeat", repeat: { min: 1, max: 4, name: "m" } },
  ]),
)

/** A bracket round a labelled group: OMe on a ring, its label inside. */
export const labelledBracket = once(() =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "o" },
    { op: "label", atom: "o", text: "OMe" },
    { op: "add_bracket", atoms: [7, 8] },
  ]),
)
