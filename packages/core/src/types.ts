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
  /** A generic formula's variable points of attachment (a line drawn into a ring's middle). */
  attachments?: Attachment[]
  /** What the claim excludes ("provided that…"): combinations of choices, or particular compounds. */
  provisos?: Proviso[]
  /** "R1 and R2, together with the atoms they are attached to, form a ring": which pairs may close, and into what. */
  ringClosures?: RingClosure[]
}

/**
 * Two variables that may, instead of each choosing on its own, together become one ring
 * piece joining the atoms they hang from: `ring` lists the pieces (two "*" each, one for
 * each atom), such as –(CH2)3– or –OCH2O–.
 */
export type RingClosure = { a: string; b: string; ring: Alternative[] }

/**
 * A claim's proviso. `combination`: these choices together are excluded, every condition
 * holding at once ("when X is O, R1 is not H" excludes X = O with R1 = H); a variable that
 * appears more than once meets its condition if any of its placeholders does. `compound`:
 * one compound, given as SMILES, is excluded ("provided the compound is not …").
 */
export type Proviso =
  | { kind: "combination"; when: Array<{ name: string; is: Alternative[] }> }
  | { kind: "compound"; smiles: string; note?: string }

/**
 * A bond from `atom` to one of the `to` atoms, whichever: "–L–ETU is attached to any free
 * position of this ring". Drawn as one line into the middle of the candidates; the bond
 * is only made when the formula is expanded into concrete compounds.
 */
export type Attachment = { atom: number; to: number[]; repeat?: Repeat }

/**
 * "(R1)m, m = 0–4": the attached piece appears `min` to `max` times, each copy on a
 * different candidate atom and each choosing on its own. `name` is the count as drawn (m, n).
 */
export type Repeat = { min: number; max: number; name: string }

/**
 * What a placeholder may stand for: its own list, or the same list as another variable
 * ("R1 to R4 each independently are…"). Every atom carrying the label chooses on its own.
 */
export type Variable = { alternatives: Alternative[] } | { sameAs: string }

/**
 * One choice for a variable: a label as typed on an atom (O, S, H, D, CN, OMe, Ph…), or a
 * class of groups kept as a class, as a patent claim states it. `min`/`max` bound its
 * size (carbons, or ring members for heteroaryl and heterocycloalkyl); `substituted`
 * left out means "substituted or unsubstituted".
 */
export type Alternative =
  | { kind: "label"; text: string }
  /** A direct bond, for a placeholder between two atoms: "L is a single bond". */
  | { kind: "bond" }
  /** A divalent ring joining the two atoms a placeholder sits between: "L is p-phenylene". */
  | { kind: "bridge"; name: BridgeName }
  | { kind: "class"; class: GroupClass; min?: number; max?: number; substituted?: boolean; unit?: SizeUnit }
  /**
   * A drawn piece: carbazol-9-yl for Ar, 2,6-naphthylene for L, N–R5 for a ring's X. Atoms
   * labelled "*" mark where it joins the formula, one per bond of the placeholder: the atom
   * bonded to a "*" takes that bond (both "*" on one atom: it takes both, as X in a ring).
   * Placeholders inside it (R5) are variables too. `name` is how it is shown, if given.
   */
  | { kind: "fragment"; molecule: Molecule; name?: string }

/** The divalent rings a linker can be (see markush/bridges.ts for how each is built). */
export type BridgeName = "p-phenylene" | "m-phenylene" | "4,4'-biphenylene" | "2,5-pyridinediyl"

/** One concrete thing a placeholder can become: an alternative that is not a class. */
export type Choice = Exclude<Alternative, { kind: "class" }>

/**
 * What a class's size counts: carbon atoms ("C2–C30 heteroaryl", as OLED patents write it)
 * or ring members ("5–10 membered heteroaryl", as drug patents do). Left out, the class's
 * usual unit (see GROUP_CLASSES).
 */
export type SizeUnit = "carbons" | "members"

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
  /** Divalent, for a placeholder between two atoms (a linker such as L). */
  | "arylene"
  | "heteroarylene"

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
