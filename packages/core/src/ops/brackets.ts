import { addBracket, bracketProblem, bracketsWithin, carryBrackets, DEFAULT_REPEAT, withBrackets } from "../drawing/brackets.ts"
import { withGroupMembers } from "../molecule/collapse.ts"
import { duplicateAtoms } from "../molecule.ts"
import type { Bracket, Drawing } from "../types.ts"
import { OpError, type Context } from "./context.ts"
import type { DocumentStep } from "./document.ts"
import type { Op } from "./types.ts"

const KINDS = new Set<unknown>(["group", "repeat"])

/** A bracket's kind and count as an op gives them: a repeat unit counts n = 1–4 unless told. */
function shaped(kind: Bracket["kind"], repeat: Bracket["repeat"]): Pick<Bracket, "kind" | "repeat"> {
  if (!KINDS.has(kind)) throw new OpError(`a bracket is "group" or "repeat", not "${String(kind)}"`)
  if (kind === "group") {
    if (repeat) throw new OpError("only a repeat bracket has a count: give kind \"repeat\"")
    return { kind }
  }
  return { kind, repeat: repeat ? { ...repeat, name: String(repeat.name).trim() } : { ...DEFAULT_REPEAT } }
}

function checked(drawing: Drawing, bracket: Bracket): Bracket {
  const problem = bracketProblem(drawing.molecule, bracket)
  if (problem) throw new OpError(problem)
  return bracket
}

/**
 * Ops on brackets, and duplicating atoms, which takes along the brackets wholly inside
 * what it copies. Returns null for ops it does not handle.
 */
export function bracketOp(drawing: Drawing, op: Op, ctx: Context): DocumentStep | null {
  switch (op.op) {
    case "add_bracket": {
      const atoms = withGroupMembers(drawing.molecule, [...new Set(op.atoms.map(ctx.atom))])
      if (atoms.length === 0) throw new OpError("a bracket needs atoms to go around")
      const kind = op.kind ?? (op.repeat ? "repeat" : "group")
      const bracket = { atoms, ...shaped(kind, op.repeat) }
      checked(drawing, { ...bracket, id: 0 })
      return { drawing: addBracket(drawing, bracket).drawing }
    }
    case "set_bracket": {
      const old = drawing.brackets?.find((bracket) => bracket.id === op.id)
      if (!old) throw new OpError(`there is no bracket #${op.id}`)
      const kind = op.kind ?? (op.repeat ? "repeat" : old.kind)
      const bracket = checked(drawing, { id: old.id, atoms: old.atoms, ...shaped(kind, op.repeat ?? (kind === "repeat" ? old.repeat : undefined)) })
      return { drawing: { ...drawing, brackets: drawing.brackets!.map((item) => (item === old ? bracket : item)) } }
    }
    case "remove_bracket": {
      if (!drawing.brackets?.some((bracket) => bracket.id === op.id)) throw new OpError(`there is no bracket #${op.id}`)
      return { drawing: withBrackets(drawing, drawing.brackets.filter((bracket) => bracket.id !== op.id)) }
    }
    case "duplicate": {
      const mol = drawing.molecule
      const ids = withGroupMembers(mol, op.atoms.map(ctx.atom))
      const copy = duplicateAtoms(mol, ids)
      // The copy's atoms come in the order of the originals in the molecule (see subMolecule).
      const wanted = new Set(ids)
      const originals = mol.atoms.filter((atom) => wanted.has(atom.id)).map((atom) => atom.id)
      const map = new Map(originals.map((id, index) => [id, copy.ids[index]]))
      const carried = carryBrackets({ ...drawing, molecule: copy.mol }, bracketsWithin(drawing.brackets, ids), map)
      return { drawing: carried.drawing, next: null }
    }
    default:
      return null
  }
}
