import { repeatProblem } from "../markush/attachments.ts"
import type { Repeat } from "../markush/types.ts"
import { atomById } from "../molecule/graph.ts"
import type { Bracket, Drawing, Molecule } from "../types.ts"

// Square brackets as part of the drawing: which atoms each holds, and keeping that true as
// atoms come and go. How they are drawn is draw/brackets.ts.

/** What a bracket made a repeat unit counts until told otherwise: n, once to four times. */
export const DEFAULT_REPEAT: Repeat = { min: 1, max: 4, name: "n" }

/** The most times a repeat unit may be counted. */
const MAX_REPEAT = 100

/** Why a repeat bracket cannot have this count, or null when it can. */
export function bracketRepeatProblem(repeat: Repeat): string | null {
  if (typeof repeat?.name !== "string") return "a repeat count needs a name such as n"
  if (Number.isInteger(repeat.max) && repeat.max > MAX_REPEAT) return `a repeat unit can be counted at most ${MAX_REPEAT} times`
  return repeatProblem(repeat, MAX_REPEAT)
}

/** Why a bracket cannot be in this molecule, or null when it can. */
export function bracketProblem(mol: Molecule, bracket: Bracket): string | null {
  if (!Array.isArray(bracket.atoms) || bracket.atoms.length === 0) return `bracket #${bracket.id} holds no atoms`
  if (new Set(bracket.atoms).size !== bracket.atoms.length) return `bracket #${bracket.id} lists an atom twice`
  const missing = bracket.atoms.find((id) => !atomById(mol, id))
  if (missing != null) return `bracket #${bracket.id} lists missing atom #${missing}`
  if (bracket.kind === "group") return bracket.repeat ? `bracket #${bracket.id} is a group and has no repeat count` : null
  if (bracket.kind !== "repeat") return `bracket #${bracket.id} is "${String(bracket.kind)}", not "group" or "repeat"`
  if (!bracket.repeat) return `repeat bracket #${bracket.id} has no count`
  const problem = bracketRepeatProblem(bracket.repeat)
  return problem && `bracket #${bracket.id}: ${problem}`
}

/** The id the next bracket gets. */
export function nextBracketId(drawing: Drawing): number {
  return drawing.nextBracketId ?? 1
}

/** The drawing with one more bracket, and that bracket's id. */
export function addBracket(drawing: Drawing, bracket: Omit<Bracket, "id">): { drawing: Drawing; id: number } {
  const id = nextBracketId(drawing)
  return { drawing: { ...drawing, brackets: [...(drawing.brackets ?? []), { ...bracket, id }], nextBracketId: id + 1 }, id }
}

/** The drawing with its list of brackets replaced; an empty list leaves the field out. */
export function withBrackets(drawing: Drawing, brackets: Bracket[]): Drawing {
  if (brackets.length > 0) return { ...drawing, brackets }
  const { brackets: _gone, ...rest } = drawing
  return rest
}

/** The drawing without atoms since deleted in its brackets; a bracket left empty goes. */
export function pruneBrackets(drawing: Drawing): Drawing {
  if (!drawing.brackets) return drawing
  const mol = drawing.molecule
  let changed = false
  const kept = drawing.brackets.flatMap((bracket) => {
    const atoms = bracket.atoms.filter((id) => atomById(mol, id))
    if (atoms.length === bracket.atoms.length) return [bracket]
    changed = true
    return atoms.length > 0 ? [{ ...bracket, atoms }] : []
  })
  return changed ? withBrackets(drawing, kept) : drawing
}

/** The brackets whose atoms are all among `ids`: what goes with a copy of those atoms. */
export function bracketsWithin(brackets: readonly Bracket[] | undefined, ids: Iterable<number>): Bracket[] {
  const wanted = new Set(ids)
  return (brackets ?? []).filter((bracket) => bracket.atoms.every((id) => wanted.has(id)))
}

/**
 * Copies of `brackets` onto atoms renamed by `map` (old id → new id), with fresh ids; a
 * bracket with an atom `map` does not rename is left out and counted in `skipped`.
 */
export function carryBrackets(drawing: Drawing, brackets: readonly Bracket[], map: ReadonlyMap<number, number>): { drawing: Drawing; ids: number[]; skipped: number } {
  let next = drawing
  const ids: number[] = []
  let skipped = 0
  for (const { id: _old, ...bracket } of brackets) {
    const atoms = bracket.atoms.map((atom) => map.get(atom))
    if (atoms.some((atom) => atom == null)) {
      skipped++
      continue
    }
    const added = addBracket(next, { ...bracket, atoms: atoms as number[], ...(bracket.repeat ? { repeat: { ...bracket.repeat } } : {}) })
    next = added.drawing
    ids.push(added.id)
  }
  return { drawing: next, ids, skipped }
}

/** The bonds with exactly one end among `atoms`: the ones that cross a bracket around them. */
export function crossingBonds(mol: Molecule, atoms: Iterable<number>): number[] {
  const inside = new Set(atoms)
  return mol.bonds.filter((bond) => inside.has(bond.a) !== inside.has(bond.b)).map((bond) => bond.id)
}
