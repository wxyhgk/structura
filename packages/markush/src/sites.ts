import { ringMembership } from "@structura/core/molecule"
import { neighbors } from "@structura/core/molecule"
import type { Drawing } from "@structura/core/types"
import { isVariableName } from "@structura/core/markush"

/**
 * How a placeholder sits, which decides what it can become: inside a ring (an atom such as
 * X = O or S), between two atoms (a linker such as L: a bond, a divalent ring, or O/S), or at
 * the end of a branch (a group such as R1 = Me). An atom a variable attachment starts from
 * counts the bond the attachment will make. The panel and enumeration both ask here.
 */
export type SiteKind = "end" | "ring" | "link"

export function siteKind(drawing: Drawing, atom: number): SiteKind {
  const mol = drawing.molecule
  if (ringMembership(mol).count.has(atom)) return "ring"
  const pending = drawing.attachments?.some((attachment) => attachment.atom === atom) ? 1 : 0
  return neighbors(mol, atom).length + pending >= 2 ? "link" : "end"
}

/** Variables with a placeholder of this kind (see siteKind). */
function namesSitting(drawing: Drawing, kind: SiteKind): Set<string> {
  return new Set(
    drawing.molecule.atoms.flatMap((atom) => (atom.alias && isVariableName(atom.alias) && siteKind(drawing, atom.id) === kind ? [atom.alias] : [])),
  )
}

/** Variables with a placeholder that links two atoms (see siteKind). */
export function linkerNames(drawing: Drawing): Set<string> {
  return namesSitting(drawing, "link")
}

/** Variables with a placeholder inside a ring (X = O, N–R5): a piece takes its place by one atom bonded twice. */
export function ringNames(drawing: Drawing): Set<string> {
  return namesSitting(drawing, "ring")
}
