import { fragmentFrom, STAR, type SiteKind } from "@structura/markush"
import { emptyDrawing } from "@structura/core/drawing"
import { atomById, deleteSelection, neighbors } from "@structura/core/molecule"
import { applyOps, type Op } from "@structura/core/ops"
import type { Molecule } from "@structura/core/types"
import { SITE_PROBLEMS } from "../i18n/zh.ts"
import { pieceProblem } from "./capture.ts"

// The sketch pad's points of attachment ("sites"): kept beside the drawing as atom ids, not
// drawn as "*" atoms, so the chemist sees badges on atoms and moves them with a click. They
// become "*" atoms only when the piece is handed over. A linker (L) takes two sites, one at
// each end. A group (R1) or a ring atom (X) takes one or more: each is one more way the piece
// may join (pyridyl at C2, C3 or C4), the first carrying the "*" and the rest kept as the
// piece's other joining atoms (`alsoAt`). A ring atom's "*" is two, the atom bonded twice.

/** The sites after clicking an atom in site mode: added, or taken away if it was one. */
export function pickSite(sites: number[], atom: number, kind: SiteKind): number[] {
  if (sites.includes(atom)) return sites.filter((site) => site !== atom)
  return kind === "link" ? [...sites, atom].slice(-2) : [...sites, atom]
}

/** A drawn piece's "*" atoms taken off into sites, its other joining atoms after them: how a saved piece opens in the pad. */
export function sitesOf(piece: Molecule, alsoAt: number[] = []): { mol: Molecule; sites: number[] } {
  const stars = piece.atoms.filter((atom) => atom.alias === STAR).sort((a, b) => a.id - b.id)
  const heads = stars.flatMap((star) => neighbors(piece, star.id).slice(0, 1).map((atom) => atom.id))
  const sites = [...new Set([...heads, ...alsoAt])]
  if (stars.length === 0) return { mol: piece, sites }
  return { mol: deleteSelection(piece, { atoms: stars.map((star) => star.id), bonds: [] }), sites }
}

/**
 * The sites as they stand: those whose atom is still there, or, for a group with none set,
 * its first atom drawn (`assumed`, so the pad can show it as the default).
 */
export function sitesShown(mol: Molecule, sites: number[], kind: SiteKind): { sites: number[]; assumed: boolean } {
  const kept = [...new Set(sites.filter((site) => atomById(mol, site)))]
  if (kind === "link") return { sites: kept.slice(-2), assumed: false }
  if (kept.length > 0 || kind === "ring" || mol.atoms.length === 0) return { sites: kept, assumed: false }
  return { sites: [Math.min(...mol.atoms.map((atom) => atom.id))], assumed: true }
}

/** What still has to be done about the sites, in words; null when they are complete. */
export function sitesProblem(mol: Molecule, sites: number[], kind: SiteKind): string | null {
  if (mol.atoms.length === 0) return SITE_PROBLEMS.empty
  const shown = sitesShown(mol, sites, kind).sites
  if (kind === "link" && shown.length < 2) return SITE_PROBLEMS.linkNeedsTwo(shown.length === 0)
  if (kind === "ring" && shown.length === 0) return SITE_PROBLEMS.ringNeedsOne
  return null
}

/**
 * The piece drawn in the pad with its sites, as an alternative: a "*" on the first site (two
 * on a ring atom; one on each end of a linker), and the other sites as the atoms it may also
 * join by, in the piece's own numbering. Or why it will not do.
 */
export function sketchedPiece(mol: Molecule, sites: number[], kind: SiteKind): { piece: Molecule; alsoAt: number[] } | { problem: string } {
  const problem = sitesProblem(mol, sites, kind)
  if (problem) return { problem }
  const shown = sitesShown(mol, sites, kind).sites
  const starred = kind === "link" ? shown : kind === "ring" ? [shown[0], shown[0]] : [shown[0]]
  const others = kind === "link" ? [] : shown.slice(1)
  const ops: Op[] = starred.flatMap((site, index): Op[] => [
    { op: "add_atom", el: "C", to: site, as: `site${index}` },
    { op: "label", atom: `site${index}`, text: STAR },
  ])
  const marked = applyOps({ ...emptyDrawing(), molecule: mol }, ops)
  if (!marked.ok) return { problem: marked.error }
  const drawn = marked.drawing.molecule
  const piece = fragmentFrom(drawn, drawn.atoms.map((atom) => atom.id))
  const wrong = pieceProblem(piece)
  if (wrong) return { problem: wrong }
  // fragmentFrom numbers the atoms 1, 2, … in the order they come.
  const renumbered = new Map(drawn.atoms.map((atom, index) => [atom.id, index + 1]))
  return { piece, alsoAt: others.map((site) => renumbered.get(site)!) }
}
