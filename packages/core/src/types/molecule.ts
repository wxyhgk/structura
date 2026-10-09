// The molecule itself: atoms, bonds and the groups that collapse them.

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
