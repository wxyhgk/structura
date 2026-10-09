import { type Alternative, fragmentFrom, fragmentMessage, fragmentProblem } from "@structura/markush"
import type { Op } from "@structura/core/ops"
import type { Molecule } from "@structura/core/types"

/** Why a drawn piece will not do as an alternative, in words the chemist can act on; null when it will. */
export function pieceProblem(piece: Molecule): string | null {
  const problem = fragmentProblem(piece)
  if (!problem) return null
  if (problem.code === "no-star") return "片段里要有标成 * 的原子，表示从哪里接到通式上（双击原子输入 *）。"
  if (problem.code === "too-many-stars") return `片段里有 ${problem.count} 个 *，最多两个：接一端用一个，连接基用两个。`
  if (problem.code === "disconnected") return "画的是几块互不相连的结构，片段要连成一整块。"
  return `这个片段用不了：${fragmentMessage(problem)}`
}

/**
 * Taking the selected atoms into a variable as a drawn piece: they leave the canvas and join
 * its list, in one step. Or, in words the chemist can act on, why the selection will not do.
 */
export function captureOps(name: string, alternatives: Alternative[], mol: Molecule, atoms: number[]): { ops: Op[] } | { problem: string } {
  if (atoms.length === 0) return { problem: "先在画布上选中画好的片段。" }
  const picked = new Set(atoms)
  if (mol.bonds.some((bond) => picked.has(bond.a) !== picked.has(bond.b))) return { problem: "选中的原子还连着别的结构。片段要单独画，并整个选中。" }
  const piece = fragmentFrom(mol, atoms)
  const problem = pieceProblem(piece)
  if (problem) return { problem }
  return { ops: [{ op: "set_variable", name, alternatives: [...alternatives, { kind: "fragment", molecule: piece }] }, { op: "remove", atoms }] }
}
