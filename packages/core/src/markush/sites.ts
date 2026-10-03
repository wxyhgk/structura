import { ringMembership } from "../molecule/cycles.ts"
import { neighbors } from "../molecule/graph.ts"
import type { Drawing } from "../types.ts"
import { isVariableName } from "./names.ts"

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

/** Variables with a placeholder that links two atoms (see siteKind). */
export function linkerNames(drawing: Drawing): Set<string> {
  return new Set(
    drawing.molecule.atoms.flatMap((atom) =>
      atom.alias && isVariableName(atom.alias) && siteKind(drawing, atom.id) === "link" ? [atom.alias] : [],
    ),
  )
}
