import { validateDrawing, type ProblemCode } from "@structura/core/validate"
import type { Drawing } from "@structura/core/types"
import { isVariableName } from "@structura/markush"
import { identifierOf } from "../editor/identifiers.ts"

// What edit() tells its caller about the structure it hands back, beyond the structure itself.

/**
 * Something wrong with the saved structure, as the editor marks it in red: an atom over its
 * valence, mostly. `atoms` count from 1 in the molfile handed back with it (the first atom is
 * 1), `text` says it in Chinese for the user, `message` in English, as validateDrawing does.
 */
export type StructureProblem = { code: ProblemCode; severity: "error" | "warning"; atoms: number[]; text: string; message: string }

const PROBLEM_TEXT: Partial<Record<ProblemCode, (atoms: string) => string>> = {
  valence: (atoms) => `${atoms}超出化合价`,
  "self-bond": (atoms) => `${atoms}有一根连到自己的键`,
  "duplicate-bond": (atoms) => `${atoms}之间有重复的键`,
  "stereo-on-multiple-bond": (atoms) => `${atoms}之间的多重键上画了楔形`,
  "bad-bracket": () => "方括号框住的原子不对",
}

/** The drawing's problems, numbered as its molfile numbers atoms, in Chinese as well. */
export function structureProblems(drawing: Drawing): StructureProblem[] {
  const position = new Map(drawing.molecule.atoms.map((atom, index) => [atom.id, index + 1]))
  const element = new Map(drawing.molecule.atoms.map((atom) => [atom.id, atom.alias ?? atom.el]))
  return validateDrawing(drawing).map((problem) => {
    const ids = problem.atoms ?? []
    const atoms = ids.flatMap((id) => position.get(id) ?? [])
    const named = ids.map((id) => `第 ${position.get(id)} 个原子（${element.get(id)}）`).join("、")
    const text = PROBLEM_TEXT[problem.code]?.(named) ?? `${named}${named ? "：" : ""}${problem.message}`
    return { code: problem.code, severity: problem.severity, atoms, text, message: problem.message }
  })
}

/**
 * The drawing's SMILES from RDKit: "" for an empty drawing, null when it has variables (R1, X…,
 * which SMILES cannot say) or RDKit cannot be loaded or read it.
 */
export async function drawingSmiles(drawing: Drawing): Promise<string | null> {
  const mol = drawing.molecule
  if (mol.atoms.length === 0) return ""
  if (mol.atoms.some((atom) => atom.alias && isVariableName(atom.alias)) || Object.keys(drawing.variables ?? {}).length > 0) return null
  try {
    return await identifierOf(mol, [], "smiles")
  } catch {
    return null
  }
}
