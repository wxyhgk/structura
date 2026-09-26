export type BondOrder = 1 | 2 | 3

/** Chemical stereo, written to MOL files. A wedge starts at `a`. */
export type BondStereo = "none" | "up" | "down" | "either"

/** How a plain single bond is drawn. Carries no chemistry and is never exported. */
export type BondLook = "bold" | "dashed" | "shadow"

export type BondEmphasis = "bold" | "dashed"

export type Atom = {
  id: number
  el: string
  x: number
  y: number
  charge: number
  /** Nickname drawn instead of the element, such as Me, Boc, Ph. */
  alias?: string
  /** When set, replaces the calculated implicit hydrogen count. */
  hydrogens?: number
}

export type Bond = {
  id: number
  a: number
  b: number
  order: BondOrder
  stereo: BondStereo
  /** Only on a single bond with no stereo. */
  look?: BondLook
  /** Belongs to a benzene ring. Double bonds are assigned across the whole aromatic piece. */
  aromatic?: boolean
  /** Second stroke of a double bond: thicker, or dashed. */
  emphasis?: BondEmphasis
}

export type Arrow = {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export type Molecule = {
  atoms: Atom[]
  bonds: Bond[]
  nextAtomId: number
  nextBondId: number
}

/** The whole canvas: the molecule plus the non-chemical marks drawn around it. */
export type Drawing = {
  molecule: Molecule
  arrows: Arrow[]
  nextArrowId: number
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

export type ToolId =
  | "lasso"
  | "marquee"
  | "bond"
  | "chain"
  | "ring"
  | "eraser"
  | "charge-plus"
  | "charge-minus"
  | "atom"

export type Selection = { atoms: number[]; bonds: number[] }

export type Hit =
  | { type: "atom"; id: number }
  | { type: "bond"; id: number }
