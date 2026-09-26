import { neighbors } from "../../molecule.ts"
import type { Atom, Molecule } from "../../types.ts"
import { coloredStroke } from "../primitives.ts"
import type { Figure } from "../primitives.ts"
import type { BondContext, DoubleFlank } from "./context.ts"

const DOUBLE_GAP = 4.6
const BOND_WIDTH = 1.55

export function chainDoubleFlank(mol: Molecule, a: Atom, b: Atom): DoubleFlank {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const nx = -uy
  const ny = ux
  const endTrim = (origin: Atom, otherId: number) => {
    const others = neighbors(mol, origin.id).filter((atom) => atom.id !== otherId)
    if (others.length === 0) return { vote: 0, trim: 0 }
    let vote = 0
    let trim = 0
    for (const atom of others) {
      const vx = atom.x - origin.x
      const vy = atom.y - origin.y
      const neighborLength = Math.hypot(vx, vy) || 1
      vote -= Math.sign(vx * nx + vy * ny) || -1
      const sine = Math.abs(ux * vy - uy * vx) / neighborLength
      trim = Math.max(trim, sine < 0.2 ? DOUBLE_GAP * 2.4 : DOUBLE_GAP / sine + 1.5)
    }
    return { vote, trim: Math.min(trim, length * 0.42) }
  }
  const fromA = endTrim(a, b.id)
  const fromB = endTrim(b, a.id)
  const vote = fromA.vote + fromB.vote
  return { side: vote >= 0 ? 1 : -1, trimA: fromA.trim, trimB: fromB.trim }
}

function offsetLines(context: BondContext, offsets: number[], trims: Array<[number, number]>, width: number): Figure[] {
  const figures: Figure[] = []
  offsets.forEach((offset, index) => {
    let [trimA, trimB] = trims[index] ?? [0, 0]
    if (trimA + trimB > context.length * 0.72) {
      const scale = (context.length * 0.72) / (trimA + trimB)
      trimA *= scale
      trimB *= scale
    }
    figures.push(
      ...coloredStroke(
        context.x1,
        context.y1,
        context.x2,
        context.y2,
        offset,
        context.normal,
        trimA,
        trimB,
        context.colorA,
        context.colorB,
        width,
      ),
    )
  })
  return figures
}

export function singleBond(context: BondContext): Figure[] {
  return offsetLines(context, [0], [[0, 0]], BOND_WIDTH)
}

function emphasizeFlank(lines: Figure[], emphasis: BondContext["emphasis"]): Figure[] {
  const flank = lines.at(-1)
  if (flank?.kind !== "line") return lines
  if (emphasis === "bold") flank.width = 3.4
  if (emphasis === "dashed") flank.dash = "4 3"
  return lines
}

export function doubleBond(context: BondContext): Figure[] {
  if (context.toward) {
    const sign =
      context.normal.x * (context.toward.x - context.atomMid.x) +
        context.normal.y * (context.toward.y - context.atomMid.y) >=
      0
        ? 1
        : -1
    return emphasizeFlank(offsetLines(context, [0, 5 * sign], [[0, 0], [5, 5]], BOND_WIDTH), context.emphasis)
  }
  if (context.flank?.side === 0) {
    const half = DOUBLE_GAP / 2
    return emphasizeFlank(offsetLines(context, [-half, half], [[0, 0], [0, 0]], BOND_WIDTH), context.emphasis)
  }
  const side = context.flank?.side ?? 1
  const trimA = context.flank?.trimA ?? 8
  const trimB = context.flank?.trimB ?? 8
  return emphasizeFlank(
    offsetLines(context, [0, DOUBLE_GAP * side], [[0, 0], [trimA, trimB]], BOND_WIDTH),
    context.emphasis,
  )
}

export function tripleBond(context: BondContext): Figure[] {
  return offsetLines(context, [-4.2, 0, 4.2], [[5, 5], [0, 0], [5, 5]], BOND_WIDTH)
}
