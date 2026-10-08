import type { Drawing } from "@structura/core/types"
import type { PressKey } from "../types.ts"
import { build, once } from "./build.ts"

// Pictures for the drawing pages.

/** Key presses pictured, per key table: the host's table does not change while it runs. */
const pressed = new WeakMap<PressKey, Drawing[]>()

/** Hover keys, through the host editor's key table: a bond, then 1 on its end, then A on the new end. */
export function hoverSteps(pressKey: PressKey): Drawing[] {
  const known = pressed.get(pressKey)
  if (known) return known
  const press = (drawing: Drawing, key: string) => {
    const tip = drawing.molecule.atoms.at(-1)!.id
    const ops = pressKey(drawing.molecule, tip, key)
    if (!ops) throw new Error(`guide figure: the key "${key}" does nothing on an atom`)
    return build(ops, drawing)
  }
  const bond = build([{ op: "place_atom", el: "C", at: { x: 0, y: 0 } }, { op: "add_atom", el: "C", to: 1, angle: Math.PI / 6 }])
  const chain = press(bond, "1")
  const made = [bond, chain, press(chain, "a")]
  pressed.set(pressKey, made)
  return made
}

/** The bond kinds: single, double, triple, wedge and hash on one chain. */
export const bondKinds = once(() =>
  build([
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, order: 2, angle: Math.PI / 6, as: "b" },
    { op: "add_atom", el: "C", to: "b", angle: -Math.PI / 6, as: "c" },
    { op: "add_atom", el: "C", to: "c", order: 3, angle: Math.PI / 6, as: "d" },
    { op: "add_atom", el: "C", to: "d", angle: Math.PI / 6, as: "e" },
    { op: "add_atom", el: "O", to: "e", stereo: "up", angle: Math.PI / 2 },
    { op: "add_atom", el: "C", to: "e", stereo: "down", angle: -Math.PI / 6 },
  ]))

/** Rings three ways: on a chain end (cyclohexylbenzene), fused on a bond (naphthalene), spiro on a ring atom. */
export const ringWays = once(() => [
  build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_atom", el: "C", to: 1, as: "end" }, { op: "add_ring", atom: "end", kind: "cyclohexane" }]),
  build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_ring", bond: { between: [1, 2] }, kind: "benzene" }]),
  build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "cyclohexane" }, { op: "add_ring", atom: 1, kind: "cyclopentane" }]),
])

/** Labels: OH and NH2 written with their hydrogens, Me and Boc kept as labels. */
export const labelled = once(() =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "o" },
    { op: "label", atom: "o", text: "OH" },
    { op: "add_atom", el: "C", to: 4, as: "n" },
    { op: "label", atom: "n", text: "NH2" },
    { op: "add_atom", el: "C", to: 2, as: "m" },
    { op: "label", atom: "m", text: "Me" },
    { op: "add_atom", el: "C", to: 6, as: "b" },
    { op: "label", atom: "b", text: "OMe" },
  ]))

