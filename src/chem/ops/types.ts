import type { Alternative, BondEmphasis, BridgeName, BondLook, BondOrder, BondStereo, Drawing, HotTarget, Point, RingKind } from "../types.ts"
import type { RecipeName } from "../molecule/recipes.ts"
import type { Problem } from "../validate.ts"

/** An atom: its id, or a name given with `as` earlier in the same batch. */
export type Ref = number | string

/** What a fragment is replaced with (see the replace op). */
export type Replacement =
  | { label: string }
  | { ring: RingKind }
  | { recipe: RecipeName }
  /** For a fragment joined by two bonds: join its two neighbours directly, or through a divalent ring. */
  | { bond: true }
  | { bridge: BridgeName }

/** A bond: its id, or the two atoms it joins. `between[0]` is where a wedge starts. */
export type BondRef = number | { between: [Ref, Ref] }

/**
 * One edit, as plain JSON so a person, a hotkey or an agent can produce it. Nothing here
 * takes coordinates for new atoms: the layout rules place them.
 */
export type Op =
  /**
   * With `to`, the new atom is bonded to that atom; `stereo` wedges a single bond from it,
   * and `angle` (radians, counterclockwise from +x as drawn, so π/2 is straight up)
   * replaces the direction the layout would pick.
   */
  | { op: "add_atom"; el: string; to?: Ref; order?: BondOrder; stereo?: BondStereo; angle?: number; as?: string }
  | { op: "add_bond"; a: Ref; b: Ref; order?: BondOrder; stereo?: BondStereo }
  | { op: "set_element"; atom: Ref; el: string }
  | { op: "set_charge"; atom: Ref; charge: number }
  | { op: "set_isotope"; atom: Ref; isotope: number | null }
  /** `emphasis` is the bold or dashed second stroke of a double bond; null clears it. */
  | {
      op: "set_bond"
      bond: BondRef
      order?: BondOrder
      stereo?: BondStereo
      look?: BondLook | null
      emphasis?: BondEmphasis | null
    }
  | { op: "remove"; atoms?: Ref[]; bonds?: BondRef[] }
  /** On a bond, `side` picks which side the new ring grows on; leave it out to let the layout choose. */
  /**
   * Give one of atom, bond or at (a free spot on the canvas), and either size (plus aromatic
   * for benzene) or kind, which also covers cyclopentene. `chair` draws cyclohexane as a
   * chair on an atom or bond instead; -1 mirrors it.
   */
  | {
      op: "add_ring"
      atom?: Ref
      bond?: BondRef
      at?: Point
      size?: number
      aromatic?: boolean
      kind?: RingKind
      side?: 1 | -1
      chair?: 1 | -1
      as?: string
    }
  | { op: "add_group"; to: Ref; name: string; as?: string }
  /** A named group built from an atom: nitro, tert-butyl, carbonyl… (see molecule/recipes.ts). */
  | { op: "add_recipe"; to: Ref; name: RecipeName; as?: string }
  | { op: "label"; atom: Ref; text: string }
  /**
   * Swaps a fragment (these atoms) for another piece: a label as typed on an atom (an
   * element or abbreviation such as "Ph", "OMe", "Boc"), a ring, or a recipe. A fragment
   * hanging off the rest by one bond is rebuilt on the same atom, the way it pointed; a
   * free-standing one is replaced where it was. Only the new atoms are tidied. `as` names
   * the new piece's first atom.
   */
  | { op: "replace"; atoms: Ref[]; with: Replacement; as?: string }
  | { op: "duplicate"; atoms: Ref[] }
  | { op: "move"; atoms: Ref[]; dx: number; dy: number; ringPointer?: boolean }
  | { op: "rotate"; atoms: Ref[]; angle: number; center?: Point }
  | { op: "flip"; atoms: Ref[]; axis: "horizontal" | "vertical" }
  | { op: "scale"; atoms: Ref[]; sx: number; sy: number; center?: Point }
  /**
   * Turns atoms out of the page about a horizontal (x) or vertical (y) axis through
   * `center` and projects them back, like tilting a model. Pass the previous tumble's
   * result `depth` so that repeated small turns keep turning the same 3D shape.
   */
  | { op: "tumble"; atoms: Ref[]; axis: "x" | "y"; angle: number; center?: Point; depth?: Record<number, number> }
  /**
   * Defines (or redefines) a generic-formula variable: what atoms labelled `name` (R1, X…)
   * may stand for. Alternatives are labels as typed on an atom ("O", "H", "CN", "OMe") or
   * classes kept as classes ({ kind: "class", class: "alkyl", min: 1, max: 30 }). A label
   * must be an element or a known abbreviation.
   */
  | { op: "set_variable"; name: string; alternatives: Alternative[] }
  /** Makes a variable share another's list: "R1 to R4 each independently are…". */
  | { op: "set_variable"; name: string; sameAs: string }
  | { op: "remove_variable"; name: string }
  /**
   * A variable point of attachment: `atom` is bonded to one of `to`, whichever, as when a
   * line is drawn into a ring's middle. Replaces any earlier one from the same atom.
   */
  | { op: "set_attachment"; atom: Ref; to: Ref[] }
  | { op: "remove_attachment"; atom: Ref }
  /** A reaction arrow beside these atoms, pointing away from them. */
  | { op: "add_arrow"; atoms: Ref[]; direction: "left" | "right" | "up" | "down" }
  /**
   * Tidies the atoms (all of them when left out): even bonds, ideal angles, regular rings,
   * no overlaps. Only these atoms move, and never the locked ones.
   */
  | { op: "clean"; atoms?: Ref[]; lock?: Ref[] }
  /**
   * Drawing with the mouse, where positions come from the pointer. These join nearby atoms
   * the way the drawing tools do; an agent normally uses add_atom and add_ring instead.
   * With `ringPointer` (as the drawing tools pass, and on a `move` of one atom), an end left
   * inside a ring's middle becomes a variable point of attachment to that ring (Markush drawing).
   */
  | { op: "place_atom"; el: string; at: Point }
  | { op: "draw_bond"; from?: Ref; start?: Point; end?: Point; order?: BondOrder; stereo?: BondStereo; look?: BondLook; ringPointer?: boolean }
  | { op: "draw_chain"; from?: Ref; points: Point[]; ringPointer?: boolean }

export type OpsResult =
  | {
      ok: true
      drawing: Drawing
      /** Ids of the atoms named with `as`. */
      names: Record<string, number>
      /** Warnings such as an overfilled atom. The edit still went through. */
      problems: Problem[]
      /**
       * Where the last op that aims at an atom or bond leaves the cursor, for chained key
       * presses: the new tip, or the atom or bond it changed.
       */
      next: HotTarget | null
      /** Atoms, bonds and arrows this batch created (ids are never reused, so this is exact). */
      added: { atoms: number[]; bonds: number[]; arrows: number[] }
      /** Atoms that were there before and now sit somewhere else. */
      moved: number[]
      /** Set when the batch ends with a tumble: pass it to the next tumble's `depth`. */
      depth?: Record<number, number>
    }
  | { ok: false; drawing: Drawing; index: number; error: string }
