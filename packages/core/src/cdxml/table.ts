import { BOND_LENGTH } from "../constants.ts"
import { emptyMolecule, spliceIn } from "../molecule/graph.ts"
import { bondLengthAt } from "../molecule/measure.ts"
import type { Molecule, Point } from "../types.ts"
import { emptyDrawing } from "../drawing.ts"
import { toCdxml } from "./write.ts"

// Compounds as a patent prints them: rows of structures, each one's number under it.

/** One compound of the table: its structure and its number ("C-1"). */
export type TableEntry = { molecule: Molecule; caption: string }

export type TableOptions = {
  /** Compounds to a row; 3 by default. */
  columns?: number
  /** The labels whose numbers are raised (R¹) rather than lowered (R₁). */
  raiseNumbers?: (label: string) => boolean
}

/** Space around a structure for its labels, which reach past the atoms' centres. */
const LABEL_ROOM = 0.6
/** Between two columns, between a row's lowest structure and the numbers, and below the numbers. */
const COLUMN_GAP = 2
const CAPTION_GAP = 1.2
const ROW_GAP = 1.6

/** The molecule at the standard bond length, so every structure of the table is drawn at one scale. */
function atStandardScale(mol: Molecule): Molecule {
  const length = bondLengthAt(mol)
  if (mol.bonds.length === 0 || Math.abs(length - BOND_LENGTH) < 0.01 * BOND_LENGTH) return mol
  const factor = BOND_LENGTH / length
  return { ...mol, atoms: mol.atoms.map((atom) => ({ ...atom, x: atom.x * factor, y: atom.y * factor })) }
}

type Box = { left: number; top: number; right: number; bottom: number }

function boxOf(mol: Molecule): Box {
  const xs = mol.atoms.map((atom) => atom.x)
  const ys = mol.atoms.map((atom) => atom.y)
  const room = LABEL_ROOM * BOND_LENGTH
  return { left: Math.min(...xs) - room, top: Math.min(...ys) - room, right: Math.max(...xs) + room, bottom: Math.max(...ys) + room }
}

/**
 * The compounds as one ChemDraw document laid out as a patent's table of compounds:
 * `columns` to a row in the given order, each structure centred in its column and in its row,
 * its caption (the compound's number) in bold, centred under the row's structures, so a row's
 * numbers line up. Every structure at one bond length (ACS 1996, 14.4 pt). Empty structures
 * keep their place, with only their number.
 */
export function toCdxmlTable(entries: readonly TableEntry[], options: TableOptions = {}): string {
  const columns = Math.max(1, Math.floor(options.columns ?? 3))
  const molecules = entries.map((entry) => atStandardScale(entry.molecule))
  const boxes = molecules.map((mol) => (mol.atoms.length > 0 ? boxOf(mol) : null))
  const width = Math.max(BOND_LENGTH, ...boxes.map((box) => (box ? box.right - box.left : 0)))
  const column = width + COLUMN_GAP * BOND_LENGTH

  let merged = emptyMolecule()
  const captions: Array<{ text: string; at: Point }> = []
  let top = 0
  for (let start = 0; start < entries.length; start += columns) {
    const row = boxes.slice(start, start + columns)
    const height = Math.max(BOND_LENGTH, ...row.map((box) => (box ? box.bottom - box.top : 0)))
    row.forEach((box, offset) => {
      const index = start + offset
      const centre = { x: offset * column + column / 2, y: top + height / 2 }
      if (box) merged = spliceIn(merged, molecules[index], centre.x - (box.left + box.right) / 2, centre.y - (box.top + box.bottom) / 2).mol
      captions.push({ text: entries[index].caption, at: { x: centre.x, y: top + height + CAPTION_GAP * BOND_LENGTH } })
    })
    top += height + (CAPTION_GAP + ROW_GAP) * BOND_LENGTH
  }
  return toCdxml({ ...emptyDrawing(), molecule: merged }, { captions, raiseNumbers: options.raiseNumbers })
}
