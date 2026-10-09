import type { BondEmphasis, BondLook, BondOrder, BondStereo, Bracket, Drawing, HotTarget, Molecule, Point, RingKind } from "../types.ts"
import type { Alternative, AttachmentShape, BridgeName, Proviso, Repeat, RingClosure } from "../markush/types.ts"
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
  /** One placeholder atom swapped for a drawn piece, joined at its "*" atoms (see the fragment alternative). */
  | { fragment: Molecule }

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
  /**
   * A scaffold template (carbazole, dibenzofuran, pyridine…, see scaffolds.ts) with
   * IUPAC-numbered sites: standing free at `at`; joined by its atom `site` ("N9", "C3") to
   * the atom `to`; or fused by its lettered bond `edge` ("b") onto the bond `onto`. With
   * `as`, its atoms are named `as` (the first) and `as.C3`, `as.N9`… for later ops.
   */
  | { op: "add_scaffold"; name: string; at?: Point; site?: string; to?: Ref; edge?: string; onto?: BondRef; as?: string }
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
  /** Shows abbreviations (Ph, Boc…) as labels, or draws them out: the groups touching `atoms`, or every group. */
  | { op: "set_collapsed"; atoms?: Ref[]; collapsed: boolean }
  /**
   * With `join` (as dragging does), a moved atom that comes down on an atom that stayed
   * becomes that atom: a bond's end dropped on an atom connects there, a bond laid on a
   * bond fuses with it.
   */
  | { op: "move"; atoms: Ref[]; dx: number; dy: number; ringPointer?: boolean; join?: boolean }
  /**
   * Joins two pieces into one: at an atom each (the smaller piece moves so its atom lands
   * on the other's), or at a bond each (the bonds fuse, the smaller piece on the far side).
   */
  | { op: "join"; atoms: [Ref, Ref] }
  | { op: "join"; bonds: [BondRef, BondRef] }
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
  /** A proviso of the claim: an excluded combination of choices, or an excluded compound. */
  | { op: "add_proviso"; proviso: Proviso }
  /** Takes away the proviso at this place in the drawing's list. */
  | { op: "remove_proviso"; index: number }
  /** "R1 and R2 together form a ring": what they may close into (replaces any closure of the same pair). */
  | { op: "set_ring_closure"; closure: RingClosure }
  | { op: "remove_ring_closure"; a: string; b: string }
  /**
   * A variable point of attachment: `atom` is bonded to one of `to`, whichever, as when a
   * line is drawn into a ring's middle. Replaces any earlier one from the same atom.
   */
  | { op: "set_attachment"; atom: Ref; to: Ref[]; repeat?: Repeat; shape?: AttachmentShape }
  /**
   * How `atom`'s attachment is drawn: "line" into one ring, "loop" (an ellipse round the
   * rings and a line to it) or "arc" (the bond sweeping round them); null chooses by itself.
   */
  | { op: "set_attachment_shape"; atom: Ref; shape: AttachmentShape | null }
  /** "(R1)m": how many times the piece on `atom`'s attachment appears; null makes it once again. */
  | { op: "set_repeat"; atom: Ref; repeat: Repeat | null }
  | { op: "remove_attachment"; atom: Ref }
  /**
   * Square brackets around these atoms (an abbreviation's hidden atoms come along), drawn
   * from where they are and crossed by the bonds leaving them. "group" (the default): the
   * piece is one unit, such as a ring system an outside bond joins anywhere; "repeat": a
   * repeat unit [ … ]n, `repeat` defaulting to n = 1–4. The new bracket's id is in the
   * result's `added.brackets`.
   */
  | { op: "add_bracket"; atoms: Ref[]; kind?: Bracket["kind"]; repeat?: Repeat }
  /** Makes a bracket a group or a repeat unit, or changes its count (a repeat bracket only). */
  | { op: "set_bracket"; id: number; kind?: Bracket["kind"]; repeat?: Repeat }
  | { op: "remove_bracket"; id: number }
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
      /** Atoms, bonds, arrows and brackets this batch created (ids are never reused, so this is exact). */
      added: { atoms: number[]; bonds: number[]; arrows: number[]; brackets: number[] }
      /** Atoms that were there before and now sit somewhere else. */
      moved: number[]
      /** Set when the batch ends with a tumble: pass it to the next tumble's `depth`. */
      depth?: Record<number, number>
    }
  | { ok: false; drawing: Drawing; index: number; error: string }
