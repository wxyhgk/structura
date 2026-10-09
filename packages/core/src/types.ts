import type { Attachment, Proviso, RingClosure, Variable } from "./markush/types.ts"
import type { BondEmphasis, BondLook, BondOrder, BondStereo, Molecule } from "./types/molecule.ts"

export type { Atom, Bond, BondEmphasis, BondLook, BondOrder, BondStereo, Group, Molecule } from "./types/molecule.ts"

export type Arrow = {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
}

/** The whole canvas: the molecule plus the non-chemical marks drawn around it. */
export type Drawing = {
  molecule: Molecule
  arrows: Arrow[]
  nextArrowId: number
  /**
   * A generic (Markush) formula's variables, by the label their placeholder atoms carry
   * (R1, X, Ar…). Absent for an ordinary drawing.
   */
  variables?: Record<string, Variable>
  /** A generic formula's variable points of attachment (a line drawn into a ring's middle). */
  attachments?: Attachment[]
  /** What the claim excludes ("provided that…"): combinations of choices, or particular compounds. */
  provisos?: Proviso[]
  /** "R1 and R2, together with the atoms they are attached to, form a ring": which pairs may close, and into what. */
  ringClosures?: RingClosure[]
}

export type Point = { x: number; y: number }

export type BondStyle = { order: BondOrder; stereo: BondStereo; look?: BondLook; emphasis?: BondEmphasis }

export type RingKind =
  | "benzene"
  | "cyclohexane"
  | "cycloheptane"
  | "cyclooctane"
  | "cyclopentane"
  | "cyclopentene"
  | "cyclobutane"
  | "cyclopropane"

export type Selection = { atoms: number[]; bonds: number[] }

/** Where the next key press lands: the atom or bond under the pointer, or the one a key left behind. */
export type HotTarget = { type: "atom"; id: number } | { type: "bond"; id: number }
