import { type Alternative, fragmentFrom, fragmentMessage, fragmentProblem } from "@structura/markush"
import type { Op } from "@structura/core/ops"
import type { Molecule } from "@structura/core/types"
import { PIECE_PROBLEMS } from "../i18n/zh.ts"

/** Why a drawn piece will not do as an alternative, in words the chemist can act on; null when it will. */
export function pieceProblem(piece: Molecule): string | null {
  const problem = fragmentProblem(piece)
  if (!problem) return null
  if (problem.code === "no-star") return PIECE_PROBLEMS.noStar
  if (problem.code === "too-many-stars") return PIECE_PROBLEMS.tooManyStars(problem.count)
  if (problem.code === "disconnected") return PIECE_PROBLEMS.disconnected
  return PIECE_PROBLEMS.other(fragmentMessage(problem))
}

/**
 * Taking the selected atoms into a variable as a drawn piece: they leave the canvas and join
 * its list, in one step. Or, in words the chemist can act on, why the selection will not do.
 */
export function captureOps(name: string, alternatives: Alternative[], mol: Molecule, atoms: number[]): { ops: Op[] } | { problem: string } {
  if (atoms.length === 0) return { problem: PIECE_PROBLEMS.nothingSelected }
  const picked = new Set(atoms)
  if (mol.bonds.some((bond) => picked.has(bond.a) !== picked.has(bond.b))) return { problem: PIECE_PROBLEMS.stillConnected }
  const piece = fragmentFrom(mol, atoms)
  const problem = pieceProblem(piece)
  if (problem) return { problem }
  return { ops: [{ op: "set_variable", name, alternatives: [...alternatives, { kind: "fragment", molecule: piece }] }, { op: "remove", atoms }] }
}
