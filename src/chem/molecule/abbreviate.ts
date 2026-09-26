import { angleTo, norm } from "../geometry.ts"
import type { GroupTemplate } from "../templates.ts"
import type { Molecule, Point } from "../types.ts"
import {
  addAtom,
  addBond,
  atomById,
  bumpCharge,
  cloneMolecule,
  deleteSelection,
  groupOf,
  neighbors,
  setElement,
  setIsotope,
} from "./graph.ts"
import { sproutAngle, sproutAt } from "./place.ts"
import { SINGLE } from "../constants.ts"

function rotate(point: Point, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos }
}

/** Direction from the anchor into the rest of the group, used to aim a divalent group. */
function bodyAngle(template: GroupTemplate): number {
  const others = template.atoms.slice(1)
  if (others.length === 0) return 0
  const x = others.reduce((sum, atom) => sum + atom.x, 0)
  const y = others.reduce((sum, atom) => sum + atom.y, 0)
  return Math.atan2(y, x)
}

/**
 * Puts an abbreviation on an atom. A group with one attachment replaces an end atom, or
 * hangs off a new bond when the atom already has two or more neighbours. A group whose
 * attachments all sit on one atom (CO, SO2, NMe) replaces a chain atom with exactly that
 * many bonds. The atom keeps its id and becomes the group's anchor.
 */
export function insertGroup(
  mol: Molecule,
  atomId: number,
  template: GroupTemplate,
  label = template.label,
): { mol: Molecule; id: number } | null {
  if (!atomById(mol, atomId)) return null
  let next = mol
  let host = atomId

  // Retyping a group's label swaps the whole group, not just its anchor.
  const previous = groupOf(next, host)
  if (previous && previous.atoms[0] === host) {
    next = deleteSelection(next, { atoms: previous.atoms.slice(1), bonds: [] })
  }

  const degree = neighbors(next, host).length
  if (template.attachments === 1 && degree >= 2) {
    const hung = sproutAt(next, host, sproutAngle(next, host), SINGLE)
    next = hung.mol
    host = hung.id
  } else if (template.attachments > 1 && degree !== template.attachments) {
    return null
  }

  const anchor = template.atoms[0]
  const hostAtom = atomById(next, host)
  if (!hostAtom) return null
  next = setElement(next, [host], anchor.el)
  next = bumpCharge(next, [host], (anchor.charge ?? 0) - hostAtom.charge)
  if (anchor.isotope != null) next = setIsotope(next, [host], anchor.isotope)

  // The template's first attachment points along -x; turn it toward the real neighbour.
  const bonded = neighbors(next, host)
  let turn = 0
  if (template.attachments === 1 && bonded.length === 1) {
    turn = norm(angleTo(hostAtom, bonded[0]) - Math.PI)
  } else if (template.attachments > 1) {
    turn = norm(sproutAngle(mol, atomId) - bodyAngle(template))
  }

  const ids = [host]
  for (const atom of template.atoms.slice(1)) {
    const offset = rotate(atom, turn)
    const added = addAtom(next, atom.el, hostAtom.x + offset.x, hostAtom.y + offset.y, atom.charge ?? 0)
    next = atom.isotope != null ? setIsotope(added.mol, [added.id], atom.isotope) : added.mol
    ids.push(added.id)
  }
  for (const [a, b, order] of template.bonds) {
    next = addBond(next, ids[a], ids[b], { order, stereo: "none" })?.mol ?? next
  }

  const grouped = cloneMolecule(next)
  grouped.groups.push({ id: grouped.nextGroupId++, label, atoms: ids, collapsed: true })
  return { mol: grouped, id: host }
}
