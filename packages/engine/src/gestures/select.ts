import { emptySelection, selectionFromAtoms } from "@structura/core/molecule"
import { pointInPolygon } from "@structura/core/geometry"
import type { Molecule, Point, Selection } from "@structura/core/types"
import { dragIds, type hitOf } from "../pointer/targeting.ts"
import type { Gesture, GestureKind, PointerHost } from "./types.ts"

type Marquee = Extract<Gesture, { kind: "marquee" }>
type Lasso = Extract<Gesture, { kind: "lasso" }>

/** The atoms picked by a box or a lasso, added to what was selected when Shift was held. */
function picked(mol: Molecule, atoms: number[], gesture: Marquee | Lasso): Selection {
  const fresh = selectionFromAtoms(mol, atoms)
  if (!gesture.additive) return fresh
  return { atoms: [...new Set([...gesture.base.atoms, ...fresh.atoms])], bonds: [...new Set([...gesture.base.bonds, ...fresh.bonds])] }
}

/** The box select tool: the atoms inside the box. */
export const marquee: GestureKind<Marquee> = {
  move(host, gesture, world) {
    host.setPreview({ kind: "marquee", a: gesture.origin, b: world })
  },
  up(host, gesture, world) {
    const [minX, maxX] = [Math.min(gesture.origin.x, world.x), Math.max(gesture.origin.x, world.x)]
    const [minY, maxY] = [Math.min(gesture.origin.y, world.y), Math.max(gesture.origin.y, world.y)]
    const mol = host.props.mol
    const atoms = mol.atoms.filter((atom) => atom.x >= minX && atom.x <= maxX && atom.y >= minY && atom.y <= maxY).map((atom) => atom.id)
    host.props.setSelection(picked(mol, atoms, gesture))
    host.setPreview(null)
  },
}

/** The lasso: the atoms inside the drawn loop. */
export const lasso: GestureKind<Lasso> = {
  move(host, gesture, world) {
    gesture.points = [...gesture.points, world]
    host.setPreview({ kind: "lasso", points: gesture.points })
  },
  up(host, gesture) {
    if (gesture.points.length >= 3) {
      const mol = host.props.mol
      host.props.setSelection(picked(mol, mol.atoms.filter((atom) => pointInPolygon(atom, gesture.points)).map((atom) => atom.id), gesture))
    }
    host.setPreview(null)
  },
}

/**
 * A press on an atom or bond with a select tool (or any tool that does not use it): Shift
 * toggles it in the selection; otherwise it becomes the selection, unless already in it,
 * and dragging moves what is selected.
 */
export function pressOn(host: PointerHost, hit: NonNullable<ReturnType<typeof hitOf>>, world: Point, shift: boolean): Gesture | null {
  const { mol, selection, setSelection } = host.props
  if (shift) {
    if (hit.type === "atom") {
      const atoms = selection.atoms.includes(hit.id) ? selection.atoms.filter((id) => id !== hit.id) : [...selection.atoms, hit.id]
      setSelection(selectionFromAtoms(mol, atoms))
    } else {
      const bonds = selection.bonds.includes(hit.id) ? selection.bonds.filter((id) => id !== hit.id) : [...selection.bonds, hit.id]
      setSelection({ ...selection, bonds })
    }
    return null
  }
  let next = selection
  if (hit.type === "atom" && !selection.atoms.includes(hit.id)) next = { atoms: [hit.id], bonds: [] }
  else if (hit.type === "bond" && !selection.bonds.includes(hit.id)) next = { atoms: [], bonds: [hit.id] }
  if (next !== selection) setSelection(next)
  return { kind: "move", mol, ids: dragIds(mol, next, hit), origin: world }
}

/**
 * A press on a bracket's stroke with a select tool: its atoms become the selection (Shift
 * adds them), and dragging moves them, the bracket with them.
 */
export function pressBracket(host: PointerHost, atoms: readonly number[], world: Point, shift: boolean): Gesture | null {
  const { mol, selection, setSelection } = host.props
  const shown = atoms.filter((id) => mol.atoms.some((atom) => atom.id === id))
  const next = selectionFromAtoms(mol, shift ? [...new Set([...selection.atoms, ...shown])] : shown)
  setSelection(next)
  return shift ? null : { kind: "move", mol, ids: next.atoms, origin: world }
}

/** A press on empty canvas: clears the selection (unless Shift) and starts a box or a lasso. */
export function pressEmpty(host: PointerHost, world: Point, shift: boolean): Gesture {
  const { tool, selection, setSelection } = host.props
  if (!shift) setSelection(emptySelection())
  const base = shift ? selection : emptySelection()
  if (tool === "marquee") {
    host.setPreview({ kind: "marquee", a: world, b: world })
    return { kind: "marquee", origin: world, base, additive: shift }
  }
  host.setPreview({ kind: "lasso", points: [world] })
  return { kind: "lasso", points: [world], base, additive: shift }
}
