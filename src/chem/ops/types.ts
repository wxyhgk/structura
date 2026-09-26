import type { BondLook, BondOrder, BondStereo, HotTarget, Molecule, Point, RingKind } from "../types.ts"
import type { RecipeName } from "../molecule/recipes.ts"
import type { Problem } from "../validate.ts"

/** An atom: its id, or a name given with `as` earlier in the same batch. */
export type Ref = number | string

/** A bond: its id, or the two atoms it joins. `between[0]` is where a wedge starts. */
export type BondRef = number | { between: [Ref, Ref] }

/**
 * One edit, as plain JSON so a person, a hotkey or an agent can produce it. Nothing here
 * takes coordinates for new atoms: the layout rules place them.
 */
export type Op =
  | { op: "add_atom"; el: string; to?: Ref; order?: BondOrder; as?: string }
  | { op: "add_bond"; a: Ref; b: Ref; order?: BondOrder; stereo?: BondStereo }
  | { op: "set_element"; atom: Ref; el: string }
  | { op: "set_charge"; atom: Ref; charge: number }
  | { op: "set_isotope"; atom: Ref; isotope: number | null }
  | { op: "set_bond"; bond: BondRef; order?: BondOrder; stereo?: BondStereo; look?: BondLook | null }
  | { op: "remove"; atoms?: Ref[]; bonds?: BondRef[] }
  /** On a bond, `side` picks which side the new ring grows on; leave it out to let the layout choose. */
  /**
   * Give one of atom, bond or at (a free spot on the canvas), and either size (plus aromatic
   * for benzene) or kind, which also covers cyclopentene.
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
      as?: string
    }
  | { op: "add_group"; to: Ref; name: string; as?: string }
  /** A named group built from an atom: nitro, tert-butyl, carbonyl… (see molecule/recipes.ts). */
  | { op: "add_recipe"; to: Ref; name: RecipeName; as?: string }
  | { op: "label"; atom: Ref; text: string }
  | { op: "hotkey"; atom?: Ref; bond?: BondRef; key: string; as?: string }
  | { op: "duplicate"; atoms: Ref[] }
  | { op: "move"; atoms: Ref[]; dx: number; dy: number }
  | { op: "rotate"; atoms: Ref[]; angle: number; center?: Point }
  | { op: "flip"; atoms: Ref[]; axis: "horizontal" | "vertical" }
  | { op: "scale"; atoms: Ref[]; sx: number; sy: number; center?: Point }
  /**
   * Drawing with the mouse, where positions come from the pointer. These join nearby atoms
   * the way the drawing tools do; an agent normally uses add_atom and add_ring instead.
   */
  | { op: "place_atom"; el: string; at: Point }
  | { op: "draw_bond"; from?: Ref; start?: Point; end?: Point; order?: BondOrder; stereo?: BondStereo; look?: BondLook }
  | { op: "draw_chain"; from?: Ref; points: Point[] }

export type OpsResult =
  | {
      ok: true
      mol: Molecule
      /** Ids of the atoms named with `as`. */
      names: Record<string, number>
      /** Warnings such as an overfilled atom. The edit still went through. */
      problems: Problem[]
      /** Where the last hotkey-style op leaves the cursor, for chained key presses. */
      next: HotTarget | null
      /** Atoms and bonds this batch created (ids are never reused, so this is exact). */
      added: { atoms: number[]; bonds: number[] }
    }
  | { ok: false; mol: Molecule; index: number; error: string }
