import { BOND_LENGTH } from "./constants.ts"
import { elementOf } from "./elements/index.ts"
import { applyHotkey, setAtomLabel, type HotTarget } from "./hotkeys.ts"
import {
  addAtom,
  addBond,
  atomById,
  bondById,
  boundsCenter,
  bumpCharge,
  deleteSelection,
  flipAtoms,
  fuseRingAt,
  growRing,
  insertGroup,
  moveAtoms,
  rotateAtoms,
  setBondLook,
  setBondOrder,
  setElement,
  setIsotope,
  sproutAngle,
  sproutAt,
} from "./molecule.ts"
import { templateFor } from "./templates.ts"
import type { BondLook, BondOrder, BondStereo, Molecule, Point, RingKind } from "./types.ts"
import { validate, type Problem } from "./validate.ts"

/** An atom: its id, or a name given with `as` earlier in the same batch. */
export type Ref = number | string

/** A bond: its id, or the two atoms it joins. `between[0]` is where a wedge starts. */
export type BondRef = number | { between: [Ref, Ref] }

/**
 * One edit, as plain JSON so a person, a hotkey or an agent can produce it. Nothing here
 * takes coordinates for new atoms: the layout rules place them.
 */
export type Op =
  | { op: "add_atom"; el: string; to?: Ref; order?: BondOrder; as?: string }
  | { op: "add_bond"; a: Ref; b: Ref; order?: BondOrder; stereo?: BondStereo }
  | { op: "set_element"; atom: Ref; el: string }
  | { op: "set_charge"; atom: Ref; charge: number }
  | { op: "set_isotope"; atom: Ref; isotope: number | null }
  | { op: "set_bond"; bond: BondRef; order?: BondOrder; stereo?: BondStereo; look?: BondLook | null }
  | { op: "remove"; atoms?: Ref[]; bonds?: BondRef[] }
  | { op: "add_ring"; atom?: Ref; bond?: BondRef; size: number; aromatic?: boolean; as?: string }
  | { op: "add_group"; to: Ref; name: string; as?: string }
  | { op: "label"; atom: Ref; text: string }
  | { op: "hotkey"; atom?: Ref; bond?: BondRef; key: string; as?: string }
  | { op: "move"; atoms: Ref[]; dx: number; dy: number }
  | { op: "rotate"; atoms: Ref[]; angle: number; center?: Point }
  | { op: "flip"; atoms: Ref[]; axis: "horizontal" | "vertical" }

export type OpsResult =
  | {
      ok: true
      mol: Molecule
      /** Ids of the atoms named with `as`. */
      names: Record<string, number>
      /** Warnings such as an overfilled atom. The edit still went through. */
      problems: Problem[]
      /** Where the last hotkey-style op leaves the cursor, for chained key presses. */
      next: HotTarget | null
    }
  | { ok: false; mol: Molecule; index: number; error: string }

class OpError extends Error {}

const RINGS: Record<number, RingKind> = {
  3: "cyclopropane",
  4: "cyclobutane",
  5: "cyclopentane",
  6: "cyclohexane",
  7: "cycloheptane",
  8: "cyclooctane",
}

/**
 * Applies a batch of edits all or nothing: if any op fails, nothing changes and the result
 * says which op and why. The whole batch is one step for undo.
 */
export function applyOps(start: Molecule, ops: Op[]): OpsResult {
  let mol = start
  const names: Record<string, number> = {}
  let next: HotTarget | null = null

  const atom = (ref: Ref): number => {
    const id = typeof ref === "string" ? names[ref] : ref
    if (id == null) throw new OpError(`no atom is named "${ref}" yet`)
    if (!atomById(mol, id)) throw new OpError(`atom #${id} does not exist`)
    return id
  }
  const bond = (ref: BondRef): number => {
    if (typeof ref === "number") {
      if (!bondById(mol, ref)) throw new OpError(`bond #${ref} does not exist`)
      return ref
    }
    const [a, b] = ref.between.map(atom)
    const found = mol.bonds.find((item) => (item.a === a && item.b === b) || (item.a === b && item.b === a))
    if (!found) throw new OpError(`atoms #${a} and #${b} are not bonded`)
    return found.id
  }
  const name = (as: string | undefined, id: number) => {
    if (as == null) return
    if (as in names) throw new OpError(`the name "${as}" is already used in this batch`)
    names[as] = id
  }
  const element = (el: string) => {
    if (!elementOf(el)) throw new OpError(`"${el}" is not an element symbol`)
  }

  for (const [index, op] of ops.entries()) {
    try {
      switch (op.op) {
        case "add_atom": {
          element(op.el)
          const style = { order: op.order ?? 1, stereo: "none" as const }
          if (op.to != null) {
            const from = atom(op.to)
            const grown = sproutAt(mol, from, sproutAngle(mol, from), style, op.el)
            if (grown.id === from) throw new OpError(`could not grow from atom #${from}`)
            mol = grown.mol
            name(op.as, grown.id)
            next = { type: "atom", id: grown.id }
          } else {
            const spot = freeSpot(mol)
            const added = addAtom(mol, op.el, spot.x, spot.y)
            mol = added.mol
            name(op.as, added.id)
            next = { type: "atom", id: added.id }
          }
          break
        }
        case "add_bond": {
          const a = atom(op.a)
          const b = atom(op.b)
          const made = addBond(mol, a, b, { order: op.order ?? 1, stereo: op.stereo ?? "none" }, false)
          if (!made) throw new OpError(`cannot bond atom #${a} to itself`)
          if (made.mol === mol) throw new OpError(`atoms #${a} and #${b} are already bonded`)
          mol = made.mol
          next = { type: "bond", id: made.id }
          break
        }
        case "set_element":
          element(op.el)
          mol = setElement(mol, [atom(op.atom)], op.el)
          break
        case "set_charge": {
          if (!Number.isInteger(op.charge) || Math.abs(op.charge) > 3) throw new OpError(`charge ${op.charge} is outside -3…3`)
          const id = atom(op.atom)
          mol = bumpCharge(mol, [id], op.charge - (atomById(mol, id)?.charge ?? 0))
          break
        }
        case "set_isotope": {
          if (op.isotope != null && !(Number.isInteger(op.isotope) && op.isotope >= 1 && op.isotope <= 999)) {
            throw new OpError(`mass number ${op.isotope} is not a whole number from 1 to 999`)
          }
          mol = setIsotope(mol, [atom(op.atom)], op.isotope ?? undefined)
          break
        }
        case "set_bond": {
          const id = bond(op.bond)
          const current = bondById(mol, id)
          if (!current) throw new OpError(`bond #${id} does not exist`)
          const order = op.order ?? current.order
          const stereo = op.stereo ?? (order === current.order ? current.stereo : "none")
          const look = op.look === null ? undefined : (op.look ?? current.look)
          if (order !== 1 && op.stereo && op.stereo !== "none") throw new OpError(`only a single bond can carry ${op.stereo}`)
          if (typeof op.bond !== "number" && stereo !== "none") {
            // Named by its atoms, a wedge starts at the first one.
            const [from, to] = op.bond.between.map(atom)
            mol = addBond(mol, from, to, { order, stereo })?.mol ?? mol
          } else if (op.stereo == null && op.look === undefined) {
            mol = setBondOrder(mol, [id], order)
          } else {
            mol = setBondLook(mol, id, { order, stereo, look, emphasis: current.emphasis })
          }
          next = { type: "bond", id }
          break
        }
        case "remove":
          mol = deleteSelection(mol, { atoms: (op.atoms ?? []).map(atom), bonds: (op.bonds ?? []).map(bond) })
          next = null
          break
        case "add_ring": {
          const kind = op.aromatic ? (op.size === 6 ? "benzene" : null) : RINGS[op.size]
          if (!kind) throw new OpError(op.aromatic ? "only a six-membered ring can be aromatic" : `no ring of size ${op.size}`)
          if ((op.atom == null) === (op.bond == null)) throw new OpError("give either an atom or a bond for the ring")
          const ring = op.atom != null ? growRing(mol, atom(op.atom), kind) : fuseRingAt(mol, bond(op.bond!), kind, 1)
          if (ring.mol === mol) throw new OpError("the ring could not be placed there")
          mol = ring.mol
          name(op.as, ring.far)
          next = { type: "atom", id: ring.far }
          break
        }
        case "add_group": {
          const template = templateFor(op.name)
          if (!template) throw new OpError(`"${op.name}" is not a known abbreviation`)
          const placed = insertGroup(mol, atom(op.to), template, op.name)
          if (!placed) throw new OpError(`"${op.name}" does not fit on atom #${atom(op.to)}`)
          mol = placed.mol
          name(op.as, placed.id)
          next = { type: "atom", id: placed.id }
          break
        }
        case "label": {
          const id = atom(op.atom)
          mol = setAtomLabel(mol, id, op.text)
          next = atomById(mol, id) ? { type: "atom", id } : null
          break
        }
        case "hotkey": {
          if ((op.atom == null) === (op.bond == null)) throw new OpError("give either an atom or a bond for the key")
          const target: HotTarget = op.atom != null ? { type: "atom", id: atom(op.atom) } : { type: "bond", id: bond(op.bond!) }
          const result = applyHotkey(mol, target, op.key)
          if (!result) throw new OpError(`the key "${op.key}" does nothing on this ${target.type}`)
          mol = result.mol
          next = result.next
          if (result.next.type === "atom") name(op.as, result.next.id)
          break
        }
        case "move":
          mol = moveAtoms(mol, op.atoms.map(atom), op.dx, op.dy)
          break
        case "rotate": {
          const ids = op.atoms.map(atom)
          const center = op.center ?? boundsCenter(mol, ids)
          if (center) mol = rotateAtoms(mol, ids, center, op.angle)
          break
        }
        case "flip":
          mol = flipAtoms(mol, op.atoms.map(atom), op.axis)
          break
        default:
          throw new OpError(`unknown op "${(op as { op: string }).op}"`)
      }
    } catch (error) {
      if (!(error instanceof OpError)) throw error
      return { ok: false, mol: start, index, error: error.message }
    }
  }

  const problems = validate(mol)
  const broken = problems.find((problem) => problem.severity === "error")
  if (broken) return { ok: false, mol: start, index: ops.length - 1, error: `the edit would break the molecule: ${broken.message}` }
  return { ok: true, mol, names, problems, next }
}

/** Somewhere clear for an atom that is not attached to anything yet. */
function freeSpot(mol: Molecule): Point {
  if (mol.atoms.length === 0) return { x: 0, y: 0 }
  const ys = mol.atoms.map((atom) => atom.y)
  return { x: Math.max(...mol.atoms.map((atom) => atom.x)) + BOND_LENGTH * 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
}
