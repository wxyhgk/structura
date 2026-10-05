import { BOND_LENGTH } from "../constants.ts"
import { atomHydrogens } from "../formula.ts"
import { bondById, spliceIn } from "../molecule.ts"
import { attachPiece } from "../molecule/attach.ts"
import { fuseBonds } from "../molecule/join.ts"
import { kekulizeAromaticReport } from "../molecule/kekule.ts"
import { freeSites, fusableEdges, scaffoldNamed, scaffolds, siteAtom, type Scaffold } from "../scaffolds.ts"
import type { Molecule } from "../types.ts"
import { OpError, type Context, type Step } from "./context.ts"
import type { Op } from "./types.ts"

type AddScaffold = Extract<Op, { op: "add_scaffold" }>

/** Gives the new atoms the names `as`, `as.C3`, `as.N9`…, so later ops in the batch can reach them. */
function nameSites(ctx: Context, as: string | undefined, scaffold: Scaffold, idOf: (atom: number) => number) {
  if (as == null) return
  ctx.name(as, idOf(1))
  for (const [locant, atom] of Object.entries(scaffold.atoms)) ctx.name(`${as}.${locant}`, idOf(atom))
}

/**
 * A scaffold template put into the drawing: standing free (at `at`), joined by its atom
 * `site` to the atom `to` (as a substituent, pointing away from it), or fused by its bond
 * `edge` onto the bond `onto` (lying across from the rest, the alternation redone).
 */
export function addScaffold(mol: Molecule, op: AddScaffold, ctx: Context): Step {
  const scaffold = scaffoldNamed(op.name)
  if (!scaffold) throw new OpError(`no scaffold "${op.name}" (${scaffolds().map((item) => item.name).join(", ")})`)
  if (op.to != null && op.onto != null) throw new OpError("join at an atom (site + to) or fuse at a bond (edge + onto), not both")

  if (op.onto != null) {
    if (!op.edge || !Object.hasOwn(scaffold.edges, op.edge)) throw new OpError(`say which bond of ${op.name} to fuse: edge ${fusableEdges(scaffold).join(", ")}`)
    if (!fusableEdges(scaffold).includes(op.edge)) throw new OpError(`bond ${op.edge} of ${op.name} cannot fuse: it holds a heteroatom or a fusion atom (fusable: ${fusableEdges(scaffold).join(", ")})`)
    const target = bondById(mol, ctx.bond(op.onto))!
    // Put it apart first, so it is a piece of its own, then lay its bond on the target.
    const right = Math.max(0, ...mol.atoms.map((atom) => atom.x)) + 6 * BOND_LENGTH
    const spliced = spliceIn(mol, scaffold.molecule, right, 0)
    const ids = new Map(scaffold.molecule.atoms.map((atom, index) => [atom.id, spliced.ids[index]]))
    const [e1, e2] = scaffold.edges[op.edge].map((atom) => ids.get(atom)!)
    const fused = fuseBonds(spliced.mol, target, { a: e1, b: e2 }, true)
    if ("error" in fused) throw new OpError(`cannot fuse: ${fused.error}`)
    const into = new Map(fused.pairs)
    const idOf = (atom: number) => into.get(ids.get(atom)!) ?? ids.get(atom)!
    const near = new Set([...ids.values()].map((id) => into.get(id) ?? id))
    const crowded = fused.pairs.map(([, stayed]) => stayed).filter((id) => atomHydrogens(fused.mol, id).error)
    if (crowded.length > 0) throw new OpError(`atom #${crowded[0]} has no room for another ring there`)
    nameSites(ctx, op.as, scaffold, idOf)
    return { mol: kekulizeAromaticReport(fused.mol, near).mol, next: null }
  }

  if (op.to != null) {
    const site = op.site != null ? siteAtom(scaffold, op.site) : undefined
    if (site == null) throw new OpError(`say which atom of ${op.name} joins: site ${freeSites(scaffold).join(", ")}`)
    if (atomHydrogens(scaffold.molecule, site).h < 1) throw new OpError(`${op.site} of ${op.name} carries no hydrogen, so nothing can join there (free sites: ${freeSites(scaffold).join(", ")})`)
    const anchor = ctx.atom(op.to)
    if (atomHydrogens(mol, anchor).h < 1) throw new OpError(`atom #${anchor} has no hydrogen left to swap for ${op.name}`)
    const placed = attachPiece(mol, anchor, scaffold.molecule, site)
    const idOf = (atom: number) => placed.ids.get(atom)!
    nameSites(ctx, op.as, scaffold, idOf)
    return { mol: placed.mol, next: { type: "atom", id: idOf(site) } }
  }

  const at = op.at ?? { x: 0, y: 0 }
  const spliced = spliceIn(mol, scaffold.molecule, at.x, at.y)
  nameSites(ctx, op.as, scaffold, (atom) => spliced.ids[scaffold.molecule.atoms.findIndex((item) => item.id === atom)])
  return { mol: spliced.mol, next: null }
}
