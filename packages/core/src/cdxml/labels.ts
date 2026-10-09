import { atomHydrogens } from "../formula.ts"
import { neighbors } from "../molecule/graph.ts"
import type { Atom, Molecule } from "../types.ts"

// Atom labels as ChemDraw keeps them: text runs, each plain, subscript or superscript, and
// which end of the text sits on the atom.

/** CDXML font faces (bits): plain, italic, subscript, superscript. */
export const FACE = { plain: 0, italic: 2, sub: 32, sup: 64 } as const

export type Run = { text: string; face: number }

/** "Left": the first character sits on the atom (OH, R1); "Right": the last one does (HO, H2N). */
export type Label = { runs: Run[]; justify: "Left" | "Right" }

/** Atom label size, in points. */
export const LABEL_SIZE = 10

/** About how wide `text` is in Arial at `size` points: enough to place a label, not to typeset it. */
export function textWidth(text: string, size: number): number {
  let width = 0
  for (const char of text) width += /[()'il|.,:;]/.test(char) ? 0.3 : /[A-Z]/.test(char) ? 0.68 : char.codePointAt(0)! >= 0x2e80 ? 1 : 0.55
  return width * size
}

/** How wide the runs are, sub- and superscripts drawn smaller. */
export function runsWidth(runs: readonly Run[]): number {
  return runs.reduce((sum, run) => sum + textWidth(run.text, run.face & (FACE.sub | FACE.sup) ? LABEL_SIZE * 0.7 : LABEL_SIZE), 0)
}

/**
 * A label typed on an atom (R1, CO2Me, Ar'), split where a number follows a letter or a
 * closing bracket: that number is small, low as chemists write formulas, or raised when
 * asked (R¹, as many patents print variables). The same rule the canvas draws by.
 */
export function typedRuns(text: string, raised: boolean): Run[] {
  const runs: Run[] = []
  for (const piece of text.split(/(?<=[A-Za-z)])(\d+)/)) {
    if (!piece) continue
    const face = /^\d+$/.test(piece) && runs.length > 0 ? (raised ? FACE.sup : FACE.sub) : FACE.plain
    const last = runs.at(-1)
    if (last && last.face === face) last.text += piece
    else runs.push({ text: piece, face })
  }
  return runs
}

/** Whether the atom's bonds lead off to its right, so a label reads towards it (HO, H2N, MeO). */
export function pointsLeft(mol: Molecule, atom: Atom): boolean {
  const bonded = neighbors(mol, atom.id)
  if (bonded.length === 0) return false
  return bonded.reduce((sum, item) => sum + item.x, 0) / bonded.length - atom.x > 4
}

function chargeText(charge: number): string {
  const sign = charge > 0 ? "+" : "-"
  return Math.abs(charge) === 1 ? sign : `${Math.abs(charge)}${sign}`
}

/**
 * An element's label, as the canvas shows it (heteroatoms, charged or isotopic carbon, a
 * lone atom), with its hydrogens and how many; null for a plain carbon. `hydrogens` is the
 * count written into the file, so ChemDraw does not work out its own.
 */
export function elementLabel(mol: Molecule, atom: Atom): { label: Label; hydrogens: number } | null {
  const { h, error } = atomHydrogens(mol, atom.id)
  const lone = neighbors(mol, atom.id).length === 0
  if (atom.el === "C" && atom.charge === 0 && atom.isotope == null && !error && !lone) return null
  const hydrogens = !error && atom.el !== "H" ? h : 0
  const named = atom.el === "H" && (atom.isotope === 2 || atom.isotope === 3)
  const symbol: Run[] = [
    ...(atom.isotope != null && !named ? [{ text: String(atom.isotope), face: FACE.sup }] : []),
    { text: named ? (atom.isotope === 2 ? "D" : "T") : atom.el, face: FACE.plain },
  ]
  const hs: Run[] = hydrogens === 0 ? [] : [{ text: "H", face: FACE.plain }, ...(hydrogens > 1 ? [{ text: String(hydrogens), face: FACE.sub }] : [])]
  const charge: Run[] = atom.charge === 0 ? [] : [{ text: chargeText(atom.charge), face: FACE.sup }]
  const left = hs.length > 0 && pointsLeft(mol, atom)
  const runs = left ? [...hs, ...symbol, ...charge] : [...symbol, ...hs, ...charge]
  return { label: { runs: merge(runs), justify: left ? "Right" : "Left" }, hydrogens }
}

/** "(R1)m": the label in round brackets with the count after it, small and italic. */
export function repeated(label: Label, name: string): Label {
  return { ...label, runs: merge([{ text: "(", face: FACE.plain }, ...label.runs, { text: ")", face: FACE.plain }, { text: name, face: FACE.sub | FACE.italic }]) }
}

/** Neighbouring runs of the same face as one. */
function merge(runs: Run[]): Run[] {
  const merged: Run[] = []
  for (const run of runs) {
    const last = merged.at(-1)
    if (last && last.face === run.face) last.text += run.text
    else merged.push({ ...run })
  }
  return merged
}
