import type { BondStyle, RingKind } from "./types.ts"

export const BOND_LENGTH = 40

/** Every ring the editor draws, the one table all ring sizes come from. */
export const RING_SHAPES: Record<RingKind, { size: number; aromatic?: true; double?: true }> = {
  cyclopropane: { size: 3 },
  cyclobutane: { size: 4 },
  cyclopentane: { size: 5 },
  cyclopentene: { size: 5, double: true },
  cyclohexane: { size: 6 },
  benzene: { size: 6, aromatic: true },
  cycloheptane: { size: 7 },
  cyclooctane: { size: 8 },
}

export const RING_SIZE = Object.fromEntries(
  Object.entries(RING_SHAPES).map(([kind, shape]) => [kind, shape.size]),
) as Record<RingKind, number>

/** The saturated ring of a size, or benzene when aromatic; undefined when there is none. */
export function ringKindFor(size: number, aromatic = false): RingKind | undefined {
  const kinds = Object.keys(RING_SHAPES) as RingKind[]
  return kinds.find((kind) => {
    const shape = RING_SHAPES[kind]
    return shape.size === size && !shape.double && Boolean(shape.aromatic) === aromatic
  })
}

export const SINGLE: { order: 1; stereo: "none" } = { order: 1, stereo: "none" }
export const DOUBLE: BondStyle = { order: 2, stereo: "none" }
export const TRIPLE: BondStyle = { order: 3, stereo: "none" }
export const WEDGE: BondStyle = { order: 1, stereo: "up" }
export const HASH: BondStyle = { order: 1, stereo: "down" }
