import { fragmentFrom, STAR, type SiteKind } from "@structura/markush"
import { emptyDrawing } from "@structura/core/drawing"
import { atomById, deleteSelection, neighbors } from "@structura/core/molecule"
import { applyOps, type Op } from "@structura/core/ops"
import type { Molecule } from "@structura/core/types"
import { pieceProblem } from "./capture.ts"

// The sketch pad's points of attachment ("sites"): kept beside the drawing as atom ids, not
// drawn as "*" atoms, so the chemist sees badges on atoms and moves them with a click. They
// become "*" atoms only when the piece is handed over. A placeholder at the end of a branch
// (R1) takes one site, a linker (L) two on different atoms, and a ring atom (X) one atom
// bonded twice, kept as that atom listed twice.

/** The sites after clicking an atom in site mode. */
export function pickSite(sites: number[], atom: number, kind: SiteKind): number[] {
  if (kind === "end") return sites[0] === atom ? [] : [atom]
  if (kind === "ring") return sites[0] === atom ? [] : [atom, atom]
  if (sites.includes(atom)) return sites.filter((site) => site !== atom)
  return [...sites, atom].slice(-2)
}

/** A drawn piece's "*" atoms taken off into sites (their atoms, in "*" order): how a saved piece opens in the pad. */
export function sitesOf(piece: Molecule): { mol: Molecule; sites: number[] } {
  const stars = piece.atoms.filter((atom) => atom.alias === STAR).sort((a, b) => a.id - b.id)
  if (stars.length === 0) return { mol: piece, sites: [] }
  const sites = stars.flatMap((star) => neighbors(piece, star.id).slice(0, 1).map((atom) => atom.id))
  return { mol: deleteSelection(piece, { atoms: stars.map((star) => star.id), bonds: [] }), sites }
}

/**
 * The sites as they stand: those whose atom is still there, or, for a group with none set,
 * its first atom drawn (`assumed`, so the pad can show it as the default).
 */
export function sitesShown(mol: Molecule, sites: number[], kind: SiteKind): { sites: number[]; assumed: boolean } {
  const kept = sites.filter((site) => atomById(mol, site))
  if (kind === "ring") return { sites: kept.length > 0 ? [kept[0], kept[0]] : [], assumed: false }
  if (kind === "link") return { sites: [...new Set(kept)].slice(-2), assumed: false }
  if (kept.length > 0) return { sites: [kept[0]], assumed: false }
  if (mol.atoms.length === 0) return { sites: [], assumed: false }
  return { sites: [Math.min(...mol.atoms.map((atom) => atom.id))], assumed: true }
}

/** What still has to be done about the sites, in words; null when they are complete. */
export function sitesProblem(mol: Molecule, sites: number[], kind: SiteKind): string | null {
  if (mol.atoms.length === 0) return "还没有画结构。"
  const shown = sitesShown(mol, sites, kind).sites
  if (kind === "link" && shown.length < 2) return `连接基要两个位点（两端各一个），${shown.length === 0 ? "还没有设" : "还差一个"}：点“设位点”，再点原子。`
  if (kind === "ring" && shown.length < 2) return "环里的原子要指定一个原子，它占住环里的位置：点“设位点”，再点那个原子。"
  return null
}

/** The piece drawn in the pad with its sites, as an alternative: a "*" on each site, or why it will not do. */
export function sketchedPiece(mol: Molecule, sites: number[], kind: SiteKind): { piece: Molecule } | { problem: string } {
  const problem = sitesProblem(mol, sites, kind)
  if (problem) return { problem }
  const ops: Op[] = sitesShown(mol, sites, kind).sites.flatMap((site, index): Op[] => [
    { op: "add_atom", el: "C", to: site, as: `site${index}` },
    { op: "label", atom: `site${index}`, text: STAR },
  ])
  const marked = applyOps({ ...emptyDrawing(), molecule: mol }, ops)
  if (!marked.ok) return { problem: marked.error }
  const drawn = marked.drawing.molecule
  const piece = fragmentFrom(drawn, drawn.atoms.map((atom) => atom.id))
  const wrong = pieceProblem(piece)
  return wrong ? { problem: wrong } : { piece }
}
