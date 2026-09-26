import type { RingKind } from "./types.ts"

export const BOND_LENGTH = 40

/** Clicking an atom, and a sprout tip landing on one. */
export const ATOM_HIT = 12

/** Clicking a bond. */
export const BOND_HIT = 7

/** Hover cue. Wider than the click so the blue circle appears first. */
export const HOVER_ATOM = 18

export const HOVER_BOND = 11

/** Dragging a bond end onto an existing atom. */
export const SNAP_ATOM = 16

/** Chain tool joining a vertex to an existing atom. */
export const SNAP_CHAIN = 10

export const LABEL_SIZE = 15

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
