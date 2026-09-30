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
  /** Mass number, such as 13 for ¹³C. Deuterium is H with 2, tritium H with 3. */
  isotope?: number
  /** Nickname drawn instead of the element, such as Me, Boc, Ph. */
  alias?: string
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

/**
 * An abbreviation such as Ph or Boc. Its atoms are real atoms of the molecule; the group
 * only remembers that they belong together and how to show them.
 */
export type Group = {
  id: number
  /** What the collapsed group shows, as typed: Me, CH3, Ph… */
  label: string
  /** atoms[0] is the anchor: it carries the label and the bonds to the rest of the molecule. */
  atoms: number[]
  /** Shown as the label, or drawn out atom by atom while still remembered as a group. */
  collapsed: boolean
}

export type Molecule = {
  atoms: Atom[]
  bonds: Bond[]
  groups: Group[]
  nextAtomId: number
  nextBondId: number
  nextGroupId: number
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
}

/** What a placeholder may stand for. Every atom carrying the label chooses on its own. */
export type Variable = { alternatives: Alternative[] }

/**
 * One choice for a variable: a label as typed on an atom (O, S, H, D, CN, OMe, Ph…), or a
 * class of groups kept as a class, as a patent claim states it. `min`/`max` bound its
 * size (carbons, or ring members for heteroaryl and heterocycloalkyl); `substituted`
 * left out means "substituted or unsubstituted".
 */
export type Alternative =
  | { kind: "label"; text: string }
  | { kind: "class"; class: GroupClass; min?: number; max?: number; substituted?: boolean }

export type GroupClass =
  | "alkyl"
  | "alkenyl"
  | "alkynyl"
  | "cycloalkyl"
  | "heterocycloalkyl"
  | "aryl"
  | "heteroaryl"
  | "alkoxy"
  | "aryloxy"
  | "silyl"
  | "amino"

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
