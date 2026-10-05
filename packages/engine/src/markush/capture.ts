import { fragmentEnds, fragmentFrom, fragmentProblem } from "@structura/markush"
import { componentOf } from "@structura/core/molecule"
import type { Op } from "@structura/core/ops"
import type { Alternative, Molecule } from "@structura/core/types"

/**
 * Taking the selected atoms into a variable as a drawn piece: they leave the canvas and join
 * its list, in one step. Or, in words the chemist can act on, why the selection will not do.
 */
export function captureOps(name: string, alternatives: Alternative[], mol: Molecule, atoms: number[]): { ops: Op[] } | { problem: string } {
  if (atoms.length === 0) return { problem: "先在画布上选中画好的片段。" }
  const picked = new Set(atoms)
  if (mol.bonds.some((bond) => picked.has(bond.a) !== picked.has(bond.b))) return { problem: "选中的原子还连着别的结构。片段要单独画，并整个选中。" }
  const piece = fragmentFrom(mol, atoms)
  const ends = fragmentEnds(piece).length
  if (ends === 0) return { problem: "片段里要有标成 * 的原子，表示从哪里接到通式上（双击原子输入 *）。" }
  if (ends > 2) return { problem: `片段里有 ${ends} 个 *，最多两个：接一端用一个，连接基用两个。` }
  if (componentOf(piece, piece.atoms[0].id).length !== piece.atoms.length) return { problem: "选中的是几块互不相连的结构，片段要连成一整块。" }
  const problem = fragmentProblem(piece)
  if (problem) return { problem: `这个片段用不了：${problem}` }
  return { ops: [{ op: "set_variable", name, alternatives: [...alternatives, { kind: "fragment", molecule: piece }] }, { op: "remove", atoms }] }
}
