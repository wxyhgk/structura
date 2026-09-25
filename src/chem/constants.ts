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

export const RING_SIZE = {
  cyclopropane: 3,
  cyclobutane: 4,
  cyclopentane: 5,
  cyclopentene: 5,
  cyclohexane: 6,
  benzene: 6,
  cycloheptane: 7,
  cyclooctane: 8,
} as const

export const SINGLE: { order: 1; stereo: "none" } = { order: 1, stereo: "none" }
