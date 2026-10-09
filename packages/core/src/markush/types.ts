import type { Molecule } from "../types/molecule.ts"

// The generic (Markush) formula's part of a drawing: variables and what they may stand for,
// attachments, provisos and ring closures.

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
 * position of this ring". Drawn as patents draw it (see `shape`); the bond is only made
 * when the formula is expanded into concrete compounds.
 */
export type Attachment = { atom: number; to: number[]; repeat?: Repeat; shape?: AttachmentShape; curve?: AttachmentCurve }

/**
 * How a variable attachment is drawn: a straight line into the middle of one ring, a closed
 * ellipse round a whole fused system with a line to it ("n Rx anywhere on these rings"),
 * the bond itself sweeping round the system as an open curve ("L joined at any position
 * of these rings"), or a bond crossing a group bracket's upright and ending inside it ("L
 * joined at any position of the bracketed group"), which only applies when the candidates
 * are exactly that bracket's atoms and the attached atom is outside it; or "custom", a
 * smooth curve through nodes the user set (`curve`). Left out, it is chosen from the
 * attachment (markush/drawnShape.ts).
 */
export type AttachmentShape = "line" | "loop" | "arc" | "bracket" | "custom"

/**
 * A curve drawn the user's way, smooth through its `nodes` in order: `closed`, a loop round
 * the rings that a straight line from the atom joins (like "loop"); open, the bond itself,
 * from the atom through the nodes (like "arc"). Each node is kept in the frame of the
 * ellipse round the candidate atoms, as [u, v]: the point c + u·a·e1 + v·b·e2, where c is
 * the ellipse's centre, a and b its semi-axes and e1, e2 their directions (markush/curveFrame.ts),
 * so the curve moves, turns and grows with the rings. 2–24 nodes (3 or more when closed).
 * Kept when the shape is changed, so going back to "custom" brings it back; only drawn as "custom".
 */
export type AttachmentCurve = { nodes: Array<[number, number]>; closed: boolean }

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
  | { kind: "class"; class: GroupClass; min?: number; max?: number; substituted?: boolean; unit?: SizeUnit; substituents?: Substituents }
  /**
   * A drawn piece: carbazol-9-yl for Ar, 2,6-naphthylene for L, N–R5 for a ring's X. Atoms
   * labelled "*" mark where it joins the formula, one per bond of the placeholder: the atom
   * bonded to a "*" takes that bond (both "*" on one atom: it takes both, as X in a ring).
   * Placeholders inside it (R5) are variables too. `name` is how it is shown, if given.
   */
  | {
      kind: "fragment"
      molecule: Molecule
      name?: string
      /**
       * Other atoms of the piece it may join by instead of the one its "*" marks are on, each
       * one more choice ("pyridyl, joined at C2, C3 or C4"). Not for a linker, whose two
       * marks sit on two atoms.
       */
      alsoAt?: number[]
    }

/** The divalent rings a linker can be (see markush/joinBridge.ts for how each is built). */
export type BridgeName = "p-phenylene" | "m-phenylene" | "4,4'-biphenylene" | "2,5-pyridinediyl"

/** One concrete thing a placeholder can become: an alternative that is not a class. */
export type Choice = Exclude<Alternative, { kind: "class" }>

/**
 * What a class's size counts: carbon atoms ("C2–C30 heteroaryl", as OLED patents write it)
 * or ring members ("5–10 membered heteroaryl", as drug patents do). Left out, the class's
 * usual unit (see GROUP_CLASSES).
 */
export type SizeUnit = "carbons" | "members"

/**
 * "Optionally substituted with 1 to 3 groups selected from F, Cl, CN and Me": what a class's
 * members may carry (labels as typed), and how many of them.
 */
export type Substituents = { from: string[]; min: number; max: number }

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
