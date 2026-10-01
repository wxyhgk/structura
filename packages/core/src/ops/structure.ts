import { RING_SHAPES, ringKindFor } from "../constants.ts"
import { setAtomLabel } from "../label.ts"
import {
  addAtom,
  addBond,
  attachChairAt,
  atomById,
  bondById,
  bumpCharge,
  deleteSelection,
  duplicateAtoms,
  fuseChairAt,
  fuseRingAt,
  growRing,
  insertGroup,
  placeRing,
  setBondLook,
  setBondOrder,
  setElement,
  setIsotope,
  sproutAngle,
  spotBeside,
  sproutAt,
} from "../molecule.ts"
import { RECIPES } from "../molecule/recipes.ts"
import { templateFor } from "../templates.ts"
import type { HotTarget, Molecule } from "../types.ts"
import { OpError, type Context, type Step } from "./context.ts"
import { replaceFragment } from "./replace.ts"
import type { Op } from "./types.ts"

/** A chair cyclohexane on an atom or bond: the add_ring op with `chair` given. */
function chairRing(mol: Molecule, op: Extract<Op, { op: "add_ring" }>, ctx: Context): Step {
  if ((op.kind ?? "cyclohexane") !== "cyclohexane" || (op.size ?? 6) !== 6 || op.aromatic) {
    throw new OpError("a chair is always cyclohexane")
  }
  if ((op.atom == null) === (op.bond == null) || op.at) throw new OpError("give exactly one of atom or bond for a chair")
  const ring = op.atom != null ? attachChairAt(mol, ctx.atom(op.atom), op.chair!) : fuseChairAt(mol, ctx.bond(op.bond!), op.chair!)
  if (ring.mol === mol) throw new OpError("the chair could not be placed there")
  ctx.name(op.as, ring.far)
  return { mol: ring.mol, next: { type: "atom", id: ring.far } }
}

/** Ops that change what is bonded to what. Returns null for ops it does not handle. */
export function structureOp(mol: Molecule, op: Op, ctx: Context): Step | null {
  switch (op.op) {
    case "add_atom": {
      ctx.element(op.el)
      const order = op.order ?? 1
      if (order !== 1 && op.stereo && op.stereo !== "none") throw new OpError(`only a single bond can carry ${op.stereo}`)
      const style = { order, stereo: op.stereo ?? "none" }
      if (op.to != null) {
        if (op.angle != null && !Number.isFinite(op.angle)) throw new OpError(`angle ${op.angle} is not a number`)
        const from = ctx.atom(op.to)
        const grown = sproutAt(mol, from, op.angle ?? sproutAngle(mol, from), style, op.el)
        if (grown.id === from) throw new OpError(`could not grow from atom #${from}`)
        ctx.name(op.as, grown.id)
        return { mol: grown.mol, next: { type: "atom", id: grown.id } }
      }
      if (op.stereo != null || op.angle != null) throw new OpError("stereo and angle describe the bond to `to`; give `to` too")
      const spot = spotBeside(mol)
      const added = addAtom(mol, op.el, spot.x, spot.y)
      ctx.name(op.as, added.id)
      return { mol: added.mol, next: { type: "atom", id: added.id } }
    }
    case "add_bond": {
      const a = ctx.atom(op.a)
      const b = ctx.atom(op.b)
      const made = addBond(mol, a, b, { order: op.order ?? 1, stereo: op.stereo ?? "none" }, false)
      if (!made) throw new OpError(`cannot bond atom #${a} to itself`)
      if (made.mol === mol) throw new OpError(`atoms #${a} and #${b} are already bonded`)
      return { mol: made.mol, next: { type: "bond", id: made.id } }
    }
    case "set_element": {
      ctx.element(op.el)
      const id = ctx.atom(op.atom)
      return { mol: setElement(mol, [id], op.el), next: { type: "atom", id } }
    }
    case "set_charge": {
      if (!Number.isInteger(op.charge) || Math.abs(op.charge) > 3) throw new OpError(`charge ${op.charge} is outside -3…3`)
      const id = ctx.atom(op.atom)
      return { mol: bumpCharge(mol, [id], op.charge - (atomById(mol, id)?.charge ?? 0)), next: { type: "atom", id } }
    }
    case "set_isotope": {
      if (op.isotope != null && !(Number.isInteger(op.isotope) && op.isotope >= 1 && op.isotope <= 999)) {
        throw new OpError(`mass number ${op.isotope} is not a whole number from 1 to 999`)
      }
      const id = ctx.atom(op.atom)
      return { mol: setIsotope(mol, [id], op.isotope ?? undefined), next: { type: "atom", id } }
    }
    case "set_bond": {
      const id = ctx.bond(op.bond)
      const current = bondById(mol, id)
      if (!current) throw new OpError(`bond #${id} does not exist`)
      const order = op.order ?? current.order
      const stereo = op.stereo ?? (order === current.order ? current.stereo : "none")
      const look = op.look === null ? undefined : (op.look ?? current.look)
      const emphasis = op.emphasis === null ? undefined : (op.emphasis ?? current.emphasis)
      if (order !== 1 && op.stereo && op.stereo !== "none") throw new OpError(`only a single bond can carry ${op.stereo}`)
      if (order !== 2 && op.emphasis) throw new OpError("only a double bond has an emphasised side")
      const next: HotTarget = { type: "bond", id }
      if (typeof op.bond !== "number" && stereo !== "none") {
        // Named by its atoms, a wedge starts at the first one.
        const [from, to] = op.bond.between.map(ctx.atom)
        return { mol: addBond(mol, from, to, { order, stereo })?.mol ?? mol, next }
      }
      if (op.stereo == null && op.look === undefined && op.emphasis === undefined) return { mol: setBondOrder(mol, [id], order), next }
      return { mol: setBondLook(mol, id, { order, stereo, look, emphasis }), next }
    }
    case "remove":
      return {
        mol: deleteSelection(mol, { atoms: (op.atoms ?? []).map(ctx.atom), bonds: (op.bonds ?? []).map(ctx.bond) }),
        next: null,
      }
    case "add_ring": {
      if (op.kind != null && !(op.kind in RING_SHAPES)) throw new OpError(`unknown ring kind "${op.kind}"`)
      if (op.chair != null) return chairRing(mol, op, ctx)
      const kind = op.kind ?? (op.size != null ? ringKindFor(op.size, op.aromatic ?? false) : undefined)
      if (!kind) {
        if (op.size == null) throw new OpError("give the ring's size or kind")
        throw new OpError(op.aromatic ? "only a six-membered ring can be aromatic" : `no ring of size ${op.size}`)
      }
      const targets = [op.atom, op.bond, op.at].filter((target) => target != null).length
      if (targets !== 1) throw new OpError("give exactly one of atom, bond or at for the ring")
      if (op.at) return { mol: placeRing(mol, op.at, kind), next: null }
      const ring = op.atom != null ? growRing(mol, ctx.atom(op.atom), kind) : fuseRingAt(mol, ctx.bond(op.bond!), kind, op.side ?? 1)
      if (ring.mol === mol) throw new OpError("the ring could not be placed there")
      ctx.name(op.as, ring.far)
      return { mol: ring.mol, next: { type: "atom", id: ring.far } }
    }
    case "add_group": {
      const template = templateFor(op.name)
      if (!template) throw new OpError(`"${op.name}" is not a known abbreviation`)
      const placed = insertGroup(mol, ctx.atom(op.to), template, op.name)
      if (!placed) throw new OpError(`"${op.name}" does not fit on atom #${ctx.atom(op.to)}`)
      ctx.name(op.as, placed.id)
      return { mol: placed.mol, next: { type: "atom", id: placed.id } }
    }
    case "add_recipe": {
      if (!Object.hasOwn(RECIPES, op.name)) {
        throw new OpError(`"${op.name}" is not a known recipe (${Object.keys(RECIPES).join(", ")})`)
      }
      const result = RECIPES[op.name](mol, ctx.atom(op.to))
      if (result.mol === mol) throw new OpError(`"${op.name}" could not be built on atom #${ctx.atom(op.to)}`)
      if (result.next.type === "atom") ctx.name(op.as, result.next.id)
      return { mol: result.mol, next: result.next }
    }
    case "label": {
      if (/[\r\n]/.test(op.text) || op.text.trim().length > 32) throw new OpError("a label is one line of at most 32 characters")
      const id = ctx.atom(op.atom)
      const next = setAtomLabel(mol, id, op.text)
      return { mol: next, next: atomById(next, id) ? { type: "atom", id } : null }
    }
    case "replace":
      return replaceFragment(mol, op, ctx)
    case "duplicate": {
      const copy = duplicateAtoms(mol, op.atoms.map(ctx.atom))
      return { mol: copy.mol, next: null }
    }
    default:
      return null
  }
}
