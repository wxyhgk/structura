import { selectionFromAtoms } from "@structura/core/molecule"
import type { Bracket, Point } from "@structura/core/types"
import { atomsInBox } from "./select.ts"
import type { Gesture, GestureKind, PointerHost } from "./types.ts"

type BracketBox = Extract<Gesture, { kind: "bracket" }>

/** The bracket tool: a box dragged round atoms puts a bracket of the picked kind round them, as one step. */
export const bracketBox: GestureKind<BracketBox> = {
  move(host, gesture, world) {
    host.setPreview({ kind: "bracket", a: gesture.origin, b: world, atoms: atomsInBox(host.props.mol, gesture.origin, world), bracketKind: host.props.bracketKind })
  },
  up(host, gesture, world) {
    host.setPreview(null)
    const atoms = atomsInBox(host.props.mol, gesture.origin, world)
    if (atoms.length > 0) host.props.run([{ op: "add_bracket", atoms, kind: host.props.bracketKind }])
  },
}

/** Pressing with the bracket tool: on a bracket's stroke (`bracket`, what the pointer aims at), its atoms become the selection; anywhere else starts a box. */
export function startBracket(host: PointerHost, bracket: Bracket | null, world: Point): Gesture | null {
  const { mol, setSelection } = host.props
  if (bracket) {
    setSelection(selectionFromAtoms(mol, bracket.atoms.filter((id) => mol.atoms.some((atom) => atom.id === id))))
    return null
  }
  host.setPreview({ kind: "bracket", a: world, b: world, atoms: [], bracketKind: host.props.bracketKind })
  return { kind: "bracket", origin: world }
}
