import { selectionFromAtoms } from "@structura/core/molecule"
import type { Point } from "@structura/core/types"
import { bracketAt } from "../pointer/brackets.ts"
import type { hitOf } from "../pointer/targeting.ts"
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

/** Pressing with the bracket tool: on a bracket's stroke, its atoms become the selection; anywhere else starts a box. */
export function startBracket(host: PointerHost, hit: ReturnType<typeof hitOf>, world: Point): Gesture | null {
  const { mol, brackets, attachments, setSelection } = host.props
  const bracket = hit ? null : bracketAt(mol, brackets, world, host.zoom(), attachments)
  if (bracket) {
    setSelection(selectionFromAtoms(mol, bracket.atoms.filter((id) => mol.atoms.some((atom) => atom.id === id))))
    return null
  }
  host.setPreview({ kind: "bracket", a: world, b: world, atoms: [], bracketKind: host.props.bracketKind })
  return { kind: "bracket", origin: world }
}
