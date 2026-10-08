import { fragmentEnds, fragmentFrom, fragmentProblem, STAR } from "@structura/markush"
import { emptyDrawing } from "@structura/core/drawing"
import { atomById, componentOf, deleteSelection, neighbors } from "@structura/core/molecule"
import { applyOps, type Op } from "@structura/core/ops"
import type { Alternative, Molecule } from "@structura/core/types"

/** Why a drawn piece will not do as an alternative, in words the chemist can act on; null when it will. */
function pieceProblem(piece: Molecule): string | null {
  const ends = fragmentEnds(piece).length
  if (ends === 0) return "片段里要有标成 * 的原子，表示从哪里接到通式上（双击原子输入 *）。"
  if (ends > 2) return `片段里有 ${ends} 个 *，最多两个：接一端用一个，连接基用两个。`
  if (componentOf(piece, piece.atoms[0].id).length !== piece.atoms.length) return "画的是几块互不相连的结构，片段要连成一整块。"
  const problem = fragmentProblem(piece)
  return problem ? `这个片段用不了：${problem}` : null
}

/**
 * Clicking in the sketch pad's attachment mode: on an atom, marks a point of attachment on
 * it (a ring atom such as N–R5 takes two, so a second click adds a second); on a mark,
 * takes it away.
 */
export function toggleEndOps(mol: Molecule, atom: number): Op[] {
  const picked = atomById(mol, atom)
  if (!picked) return []
  if (picked.alias === STAR) return [{ op: "remove", atoms: [atom] }]
  return [
    { op: "add_atom", el: "C", to: atom, as: "end" },
    { op: "label", atom: "end", text: STAR },
  ]
}

/**
 * A piece drawn on its own (in the sketch pad), as an alternative: all of it, or why it will
 * not do. A group with no point of attachment marked joins by the first atom drawn; a linker
 * needs its two marked.
 */
export function sketchedPiece(mol: Molecule, { linker = false } = {}): { piece: Molecule } | { problem: string } {
  // A mark left on its own (its atom erased) marks nothing.
  const loose = mol.atoms.filter((atom) => atom.alias === STAR && neighbors(mol, atom.id).length === 0).map((atom) => atom.id)
  let drawn = loose.length > 0 ? deleteSelection(mol, { atoms: loose, bonds: [] }) : mol
  if (drawn.atoms.length === 0) return { problem: "还没有画结构。" }
  const marks = drawn.atoms.filter((atom) => atom.alias === STAR).length
  if (marks === 0) {
    if (linker) return { problem: "连接基要标出两个连接点：点“连接点”，再点两端的原子。" }
    const first = Math.min(...drawn.atoms.map((atom) => atom.id))
    const marked = applyOps({ ...emptyDrawing(), molecule: drawn }, toggleEndOps(drawn, first))
    if (!marked.ok) return { problem: marked.error }
    drawn = marked.drawing.molecule
  }
  if (linker && marks === 1) return { problem: "连接基要两个连接点，还差一个。" }
  const piece = fragmentFrom(drawn, drawn.atoms.map((atom) => atom.id))
  const problem = pieceProblem(piece)
  return problem ? { problem } : { piece }
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
