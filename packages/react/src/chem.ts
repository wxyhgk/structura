// chem-structura/chem: Structura's algorithms on one molecule, for a page or a Node program that
// lays out, finds rings in or draws structures itself, without the editor. No React and no
// browser. Every function leaves the molecule it is given as it was and returns a new one; an
// atom or bond id that is not in the molecule throws. Coordinates are in units where one bond
// is BOND_LENGTH (40) long, y growing downwards as on a screen; molfiles and SMILES read here
// are scaled to that, and toMolfile writes ångströms with y up again.
import type { MainModule } from "@rdkit/rdkit"
import { BOND_LENGTH, SINGLE } from "@structura/core/constants"
import { sceneToSvg } from "@structura/core/draw"
import { attachRingAt, fuseRingAt, insertGroup, placeRing, relax as relaxAtoms, sproutAngle, sproutAt, untangleGroups as untangle } from "@structura/core/layout"
import { atomById, bondById, kekulizeAromaticReport, ringMembership as membership, setCollapsed, sideBySide as inARow, smallestRings } from "@structura/core/molecule"
import { toMolfile as writeMolfile } from "@structura/core/molfile"
import { readMolfile } from "@structura/core/sdf"
import { templateFor } from "@structura/core/templates"
import type { BondOrder, Molecule, Point, RingKind } from "@structura/core/types"
import type { Problem } from "@structura/core/validate"
import { levelled, smilesToMolfile } from "@structura/rdkit"
import { drawOptions } from "./editor/drawOptions.ts"

export type { Atom, Bond, BondOrder, Group, Molecule, Point, RingKind } from "@structura/core/types"
export type { Problem } from "@structura/core/validate"

/** One bond's length in a molecule's coordinates. */
export { BOND_LENGTH }

function needAtom(mol: Molecule, id: number): void {
  if (!atomById(mol, id)) throw new Error(`no atom with id ${id} in the molecule`)
}

// ── Reading and writing ──────────────────────────────────────────────────────────────────────

/**
 * A molfile (V2000 or V3000) as a molecule, scaled so its median bond is BOND_LENGTH.
 * `problems` says what could not be read; when nothing could, the molecule is empty.
 */
export function moleculeFromMolfile(text: string): { molecule: Molecule; problems: Problem[] } {
  const read = readMolfile(text)
  return { molecule: read.mol, problems: read.problems }
}

/**
 * One SMILES as a molecule, laid out by RDKit (pass the module @rdkit/rdkit's initRDKitModule()
 * gives) and turned so its longest axis lies level. The editor first calls
 * rdkit.prefer_coordgen(true) for CoordGen's layouts; that setting is left to the caller.
 * Throws, with RDKit's reason, for a SMILES RDKit cannot read.
 */
export function moleculeFromSmiles(rdkit: MainModule, smiles: string): Molecule {
  const result = smilesToMolfile(rdkit, smiles.trim())
  if ("error" in result) throw new Error(result.error)
  return levelled(readMolfile(result.molfile).mol)
}

/** The molecule as V2000 molfile text (V3000 when it is too large for V2000). */
export function toMolfile(mol: Molecule, title = "Structura"): string {
  return writeMolfile(mol, title)
}

// ── Rings ─────────────────────────────────────────────────────────────────────────────────────

/** The smallest set of smallest rings, each as its atom ids in order round the ring. */
export function findRings(mol: Molecule): number[][] {
  return smallestRings(mol)
}

/** How many of findRings' rings each atom is in; atoms in no ring are left out. */
export function ringMembership(mol: Molecule): Map<number, number> {
  // A copy: the counts are cached per molecule inside, for the editor's pointer moves.
  return new Map(membership(mol).count)
}

/**
 * Aromatic bonds given single and double bonds in turn (as RDKit's Kekulize does), and how
 * many aromatic pieces could not be given a clean alternation (left as they were).
 */
export function kekulize(mol: Molecule): { molecule: Molecule; unresolved: number } {
  const done = kekulizeAromaticReport(mol)
  return { molecule: done.mol, unresolved: done.unresolved }
}

// ── Layout ────────────────────────────────────────────────────────────────────────────────────

/** A new ring, not bonded to anything, centred on `center`. */
export function addRing(mol: Molecule, center: Point, kind: RingKind): Molecule {
  return placeRing(mol, center, kind)
}

/**
 * A new ring hanging off an atom by a single bond, pointing where there is most room. `ring`
 * is the new ring's atom ids, the one bonded to `atomId` first.
 */
export function attachRing(mol: Molecule, atomId: number, kind: RingKind): { molecule: Molecule; ring: number[] } {
  needAtom(mol, atomId)
  const done = attachRingAt(mol, atomId, kind)
  return { molecule: done.mol, ring: done.ids }
}

/**
 * A new ring sharing the bond `bondId`, on `side` of it (1 or -1, the two sides going from the
 * bond's first atom to its second), or, without `side`, on the side with more room. On a bond
 * of a ring the new ring always goes outside that ring. A ring that cannot fit cleanly is still
 * drawn, its crowded atoms left for the caller to sort out.
 */
export function fuseRing(mol: Molecule, bondId: number, kind: RingKind, side?: 1 | -1): Molecule {
  if (!bondById(mol, bondId)) throw new Error(`no bond with id ${bondId} in the molecule`)
  return fuseRingAt(mol, bondId, kind, side).mol
}

/**
 * A new atom bonded to `atomId`, at the angle a chemist would draw it (zigzag for a chain, out
 * of a ring, between two neighbours). `atom` is the new atom's id.
 */
export function growBond(mol: Molecule, atomId: number, options: { element?: string; order?: BondOrder } = {}): { molecule: Molecule; atom: number } {
  needAtom(mol, atomId)
  const style = { ...SINGLE, order: options.order ?? 1 }
  const grown = sproutAt(mol, atomId, sproutAngle(mol, atomId), style, options.element ?? "C")
  return { molecule: grown.mol, atom: grown.id }
}

/**
 * An abbreviation (Boc, Ph, CO2Me, OTs…) drawn out atom by atom on an atom: an end atom becomes
 * the group's anchor, an atom with two or more neighbours gets it on a new bond. Common ones
 * (Me, Ph, Boc…) stay remembered as a group, drawn out. Throws for an abbreviation Structura
 * does not know.
 */
export function expandGroup(mol: Molecule, atomId: number, abbreviation: string): Molecule {
  needAtom(mol, atomId)
  const template = templateFor(abbreviation)
  if (!template) throw new Error(`unknown abbreviation "${abbreviation}"`)
  const done = insertGroup(mol, atomId, template)
  if (!done) throw new Error(`no atom with id ${atomId} in the molecule`)
  const added = done.mol.groups.filter((group) => !mol.groups.some((old) => old.id === group.id)).map((group) => group.id)
  return setCollapsed(done.mol, added, false)
}

/**
 * Tidies the listed atoms: they move towards even bond lengths, ideal angles and regular rings,
 * and off atoms they overlap, staying near where they were. An atom of a group (from
 * expandGroup, say) brings its whole group, which moves as one. Every other atom, and those
 * in `locked`, stays put; no wedge and no double bond comes to mean the other stereoisomer.
 */
export function relax(mol: Molecule, options: { atoms: Iterable<number>; locked?: Iterable<number>; iterations?: number }): Molecule {
  return relaxAtoms(mol, options)
}

/**
 * The given groups (from expandGroup, say) moved off each other and off the rest, each moving
 * whole; nothing outside them moves. As it was when nothing overlaps.
 */
export function untangleGroups(mol: Molecule, groupIds: Iterable<number>): Molecule {
  return untangle(mol, groupIds)
}

/** Several molecules as one, laid out left to right two bonds apart on one line, ids renumbered. */
export function sideBySide(molecules: Molecule[]): Molecule {
  return inARow(molecules)
}

// ── Drawing ───────────────────────────────────────────────────────────────────────────────────

/** How moleculeSvg draws. */
export type SvgOptions = {
  /** O, N, Cl… in their own colours (true, the default), or all in `color`. */
  colorHetero?: boolean
  /** The ground: a colour ("#ffffff" by default), or false for none, so the page shows through. */
  background?: string | false
  /** Bonds, carbon and uncoloured labels: "#222222" by default; "currentColor" takes the page's text colour. */
  color?: string
  /** Variables' numbers raised (R¹) instead of lowered (R₁). Default false. */
  raisedNumbers?: boolean
}

/** The molecule as a standalone SVG, the way the editor draws it, fitted with a margin. Empty for no atoms. */
export function moleculeSvg(mol: Molecule, options: SvgOptions = {}): string {
  return sceneToSvg(mol, options.colorHetero ?? true, [], undefined, drawOptions(options.raisedNumbers ?? false), { background: options.background, ink: options.color })
}
