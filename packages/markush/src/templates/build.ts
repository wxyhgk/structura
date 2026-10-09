import { emptyDrawing } from "@structura/core/drawing"
import { fragmentFrom, STAR } from "@structura/core/markush"
import { applyOps, type Op, type Ref } from "@structura/core/ops"
import type { Alternative, BridgeName, GroupClass, SizeUnit } from "@structura/core/types"
import type { Template, TemplateInput } from "./model.ts"

// Small makers for the built-in templates, so each shelf reads as a list of names and
// structures. Drawn pieces are built with the editor's own ops, never with coordinates.

/** A fixed time for built-ins, so they compare equal across runs. */
const SHIPPED = "2026-10-07T00:00:00.000Z"

/** A shipped template: its id is `builtin:<key>`, and the key never changes once shipped. */
export const builtin = (key: string, input: TemplateInput): Template => ({ ...input, id: `builtin:${key}`, source: "builtin", createdAt: SHIPPED, updatedAt: SHIPPED })

/** A shelf's templates: [key, Chinese name, English aliases, alternative], all at one site. */
export type Row = [key: string, name: string, aliases: string[], alternative: Alternative]

export function shelf(group: string, site: TemplateInput["site"], rows: Row[]): Template[] {
  return rows.map(([key, name, aliases, alternative]) => builtin(key, { name, aliases, group, site, alternative }))
}

export const label = (text: string): Alternative => ({ kind: "label", text })

export const bridge = (name: BridgeName): Alternative => ({ kind: "bridge", name })

export const range = (group: GroupClass, min?: number, max?: number, unit?: SizeUnit): Alternative => ({
  kind: "class",
  class: group,
  ...(min != null ? { min } : {}),
  ...(max != null ? { max } : {}),
  ...(unit ? { unit } : {}),
})

/**
 * A drawn piece: `ops` draw it on an empty canvas (name atoms with `as`, or reach a
 * scaffold's atoms as `s.C2`), then a "*" is bonded to each atom of `joins` (an atom
 * twice for a ring atom, two atoms for a linker). `alsoAt` names the other atoms it may
 * join by, each one more choice. Throws if the ops fail: a broken built-in is a bug.
 */
export function drawn(ops: Op[], joins: Ref[], alsoAt: Ref[] = []): Alternative {
  const stars = joins.flatMap((join, index): Op[] => [
    { op: "add_atom", el: "C", to: join, as: `*${index}` },
    { op: "label", atom: `*${index}`, text: STAR },
  ])
  const result = applyOps(emptyDrawing(), [...ops, ...stars])
  if (!result.ok) throw new Error(`built-in piece: op ${result.index} (${JSON.stringify([...ops, ...stars][result.index])}): ${result.error}`)
  const mol = result.drawing.molecule
  // fragmentFrom numbers the atoms 1, 2… in the order they are listed; all are taken.
  const newId = (ref: Ref) => {
    const old = typeof ref === "number" ? ref : result.names[ref]
    const index = mol.atoms.findIndex((atom) => atom.id === old)
    if (index < 0) throw new Error(`built-in piece: no atom ${String(ref)}`)
    return index + 1
  }
  const molecule = fragmentFrom(
    mol,
    mol.atoms.map((atom) => atom.id),
  )
  return alsoAt.length > 0 ? { kind: "fragment", molecule, alsoAt: alsoAt.map(newId) } : { kind: "fragment", molecule }
}

/** A scaffold (see core's scaffolds) standing free, its atoms named `s`, `s.C2`, `s.N9`… */
export const scaffold = (name: string): Op => ({ op: "add_scaffold", name, at: { x: 0, y: 0 }, as: "s" })

/** Scaffold atoms by locant: at("C2", "C3") → ["s.C2", "s.C3"]. */
export const at = (...locants: string[]): string[] => locants.map((locant) => `s.${locant}`)
