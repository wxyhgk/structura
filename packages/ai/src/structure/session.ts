import { emptyDrawing } from "@structura/core"
import { plainFormula } from "@structura/core/formula"
import { isVariableName } from "@structura/core/markush"
import { applyOps, type Op } from "@structura/core/ops"
import type { Drawing, Molecule } from "@structura/core/types"
import { validate } from "@structura/core/validate"
import type { Action } from "./types.ts"

/** Valence problems in the drawing, as text. */
export function valenceProblems(mol: Molecule): string[] {
  return validate(mol).filter((problem) => problem.code === "valence").map((problem) => problem.message)
}

/**
 * R-group variables a build wrote onto atoms inside a ring or chain (two or more bonds): the
 * ring atom itself became R1, where a substituent R1 was nearly always meant. Other letters
 * (X, Y, L, A) are often ring or chain members by design and are left alone; even for R this
 * is a warning, not a refusal.
 */
function variablesInside(ops: Op[], mol: Molecule, names: Record<string, number>): string[] {
  return ops.flatMap((op) => {
    if (op.op !== "label" || !isVariableName(op.text) || !/^R/.test(op.text)) return []
    const id = typeof op.atom === "number" ? op.atom : typeof op.atom === "string" ? names[op.atom] : undefined
    const neighbours = mol.bonds.flatMap((bond) => (bond.a === id ? [bond.b] : bond.b === id ? [bond.a] : []))
    return id != null && neighbours.length >= 2 ? [`atom ${id} is now ${op.text} itself, bonded to ${neighbours.join(", ")}`] : []
  })
}

/** The drawing as the model reads it back: formula, every atom (with the names it has) and what it is bonded to, and problems. */
export function describe(mol: Molecule, names: ReadonlyMap<string, number> = new Map()): string {
  if (mol.atoms.length === 0) return "The drawing is empty."
  const bonded = (id: number) =>
    mol.bonds.flatMap((bond) => (bond.a === id ? [`${bond.b}${bond.order === 2 ? "=" : bond.order === 3 ? "#" : ""}`] : bond.b === id ? [`${bond.a}${bond.order === 2 ? "=" : bond.order === 3 ? "#" : ""}`] : []))
  const named = (id: number) => [...names].flatMap(([name, atom]) => (atom === id ? [name] : []))
  const atoms = mol.atoms.map((atom) => {
    const known = named(atom.id)
    return `${atom.id} ${atom.alias ?? atom.el}${atom.charge ? (atom.charge > 0 ? "+" : "-") : ""}${known.length > 0 ? ` (${known.join(", ")})` : ""}: ${bonded(atom.id).join(" ")}`
  })
  const problems = valenceProblems(mol)
  return [
    `Formula ${plainFormula(mol) || "(none)"}, ${mol.atoms.length} atoms, ${mol.bonds.length} bonds.`,
    `Atoms (id label (names): bonded ids, = double, # triple):`,
    ...atoms,
    ...(problems.length > 0 ? [`Valence problems: ${problems.join("; ")}`] : []),
  ].join("\n")
}

/** The op fields that hold atoms or bonds; a name there (cz.C3) is swapped for its atom's id. */
const REF_KEYS = new Set(["to", "a", "b", "atom", "atoms", "between", "onto", "from", "bond", "bonds"])

/** `value` with every name in a reference field replaced by the atom it names, at any depth. */
function resolve(value: unknown, names: ReadonlyMap<string, number>, inRef = false): unknown {
  if (typeof value === "string") return inRef && names.has(value) ? names.get(value) : value
  if (Array.isArray(value)) return value.map((item) => resolve(item, names, inRef))
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item, names, inRef || REF_KEYS.has(key))]))
  return value
}

/**
 * The scratch drawing an agent builds on, and what each of its actions does to it: build
 * applies ops (all or nothing), reset starts again, look and done change nothing. Every
 * answer is text for the model; the loop adds the picture for look.
 */
export function createSession() {
  let drawing: Drawing = emptyDrawing()
  /** Names given with `as` in any build (cz, cz.C3…), kept for later builds while their atom is there. */
  let names = new Map<string, number>()
  return {
    drawing: () => drawing,
    names: (): ReadonlyMap<string, number> => names,
    act(action: Action): { ok: boolean; message: string } {
      if (action.action === "reset") {
        drawing = emptyDrawing()
        names = new Map()
        return { ok: true, message: "Cleared. The drawing is empty." }
      }
      if (action.action !== "build") return { ok: true, message: describe(drawing.molecule, names) }
      let ops: Op[]
      try {
        // Servers that do not enforce the schema let some models send the array itself.
        const raw: unknown = action.ops
        ops = typeof raw === "string" ? JSON.parse(raw) : raw
        if (!Array.isArray(ops)) throw new Error("not an array")
      } catch (error) {
        return { ok: false, message: `ops must be a JSON array of ops (${error instanceof Error ? error.message : String(error)}). Nothing changed.` }
      }
      // Names from earlier builds are known here as ids; a name given again in this build wins.
      const result = applyOps(drawing, resolve(ops, names) as Op[])
      if (!result.ok) return { ok: false, message: `Op ${result.index} failed: ${result.error}. Nothing changed; fix it and build again.` }
      drawing = result.drawing
      const present = new Set(drawing.molecule.atoms.map((atom) => atom.id))
      names = new Map([...names, ...Object.entries(result.names)].filter(([, id]) => present.has(id)))
      const inside = variablesInside(resolve(ops, names) as Op[], drawing.molecule, result.names)
      const warning = inside.length > 0 ? [`Warning: ${inside.join("; ")}. Such a variable is part of the ring or chain, not a substituent on it. If the picture shows it as a substituent (a bond from the ring out to the label), undo with set_element back to C and instead add_atom bonded to that ring atom, then label the new atom.`] : []
      return { ok: true, message: [`Applied ${ops.length} ops.`, ...warning, describe(drawing.molecule, names)].join("\n") }
    },
  }
}
