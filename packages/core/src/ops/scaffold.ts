import { BOND_LENGTH } from "../constants.ts"
import { atomHydrogens } from "../formula.ts"
import { placeFragment, STAR } from "../markush/fragments.ts"
import { atomById, bondById, neighbors, spliceIn, sproutAngle, sproutAt } from "../molecule.ts"
import { fuseBonds } from "../molecule/join.ts"
import { kekulizeAromaticReport } from "../molecule/kekule.ts"
import { scaffoldNamed, scaffolds, siteAtom, type Scaffold } from "../scaffolds.ts"
import type { Molecule } from "../types.ts"
import { OpError, type Context, type Step } from "./context.ts"
import type { Op } from "./types.ts"

type AddScaffold = Extract<Op, { op: "add_scaffold" }>

/** The scaffold with a "*" on `site`, pointing straight out of the ring: a piece to place on an atom. */
function withStar(scaffold: Scaffold, site: number): Molecule {
  const mol = scaffold.molecule
  const atom = atomById(mol, site)!
  const around = neighbors(mol, site)
  const out = around.reduce((sum, other) => ({ x: sum.x + atom.x - other.x, y: sum.y + atom.y - other.y }), { x: 0, y: 0 })
  const length = Math.hypot(out.x, out.y) || 1
  const star = { id: mol.nextAtomId, el: "C", x: atom.x + (out.x / length) * BOND_LENGTH, y: atom.y + (out.y / length) * BOND_LENGTH, charge: 0, alias: STAR }
  return {
    ...mol,
    atoms: [...mol.atoms, star],
    bonds: [...mol.bonds, { id: mol.nextBondId, a: site, b: star.id, order: 1, stereo: "none" }],
    nextAtomId: mol.nextAtomId + 1,
    nextBondId: mol.nextBondId + 1,
  }
}

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
    if (!op.edge || !Object.hasOwn(scaffold.edges, op.edge)) throw new OpError(`say which bond of ${op.name} to fuse: edge ${Object.keys(scaffold.edges).join(", ")}`)
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
    nameSites(ctx, op.as, scaffold, idOf)
    return { mol: kekulizeAromaticReport(fused.mol, near).mol, next: null }
  }

  if (op.to != null) {
    const site = op.site != null ? siteAtom(scaffold, op.site) : undefined
    if (site == null) throw new OpError(`say which atom of ${op.name} joins: site ${Object.keys(scaffold.atoms).join(", ")}`)
    const anchor = ctx.atom(op.to)
    if (atomHydrogens(mol, anchor).h < 1) throw new OpError(`atom #${anchor} has no hydrogen left to swap for ${op.name}`)
    const sprouted = sproutAt(mol, anchor, sproutAngle(mol, anchor), { order: 1, stereo: "none" })
    const placed = placeFragment(sprouted.mol, sprouted.id, withStar(scaffold, site))
    if ("error" in placed) throw new OpError(`${op.name} cannot join there: ${placed.error}`)
    // The piece's atoms come in the scaffold's order (its "*" was last, and is gone).
    const idOf = (atom: number) => placed.added[scaffold.molecule.atoms.findIndex((item) => item.id === atom)]
    nameSites(ctx, op.as, scaffold, idOf)
    return { mol: placed.mol, next: { type: "atom", id: idOf(site) } }
  }

  const at = op.at ?? { x: 0, y: 0 }
  const spliced = spliceIn(mol, scaffold.molecule, at.x, at.y)
  nameSites(ctx, op.as, scaffold, (atom) => spliced.ids[scaffold.molecule.atoms.findIndex((item) => item.id === atom)])
  return { mol: spliced.mol, next: null }
}
