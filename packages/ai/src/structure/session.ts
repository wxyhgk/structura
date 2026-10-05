import { emptyDrawing } from "@structura/core"
import { plainFormula } from "@structura/core/formula"
import { applyOps, type Op } from "@structura/core/ops"
import type { Drawing, Molecule } from "@structura/core/types"
import { validate } from "@structura/core/validate"
import type { Action } from "./types.ts"

/** The drawing as the model reads it back: formula, every atom with what it is bonded to, and problems. */
export function describe(mol: Molecule): string {
  if (mol.atoms.length === 0) return "The drawing is empty."
  const bonded = (id: number) =>
    mol.bonds.flatMap((bond) => (bond.a === id ? [`${bond.b}${bond.order === 2 ? "=" : bond.order === 3 ? "#" : ""}`] : bond.b === id ? [`${bond.a}${bond.order === 2 ? "=" : bond.order === 3 ? "#" : ""}`] : []))
  const atoms = mol.atoms.map((atom) => `${atom.id} ${atom.alias ?? atom.el}${atom.charge ? (atom.charge > 0 ? "+" : "-") : ""}: ${bonded(atom.id).join(" ")}`)
  const problems = validate(mol).filter((problem) => problem.code === "valence").map((problem) => problem.message)
  return [
    `Formula ${plainFormula(mol) || "(none)"}, ${mol.atoms.length} atoms, ${mol.bonds.length} bonds.`,
    `Atoms (id label: bonded ids, = double, # triple):`,
    ...atoms,
    ...(problems.length > 0 ? [`Valence problems: ${problems.join("; ")}`] : []),
  ].join("\n")
}

/**
 * The scratch drawing an agent builds on, and what each of its actions does to it: build
 * applies ops (all or nothing), reset starts again, look and done change nothing. Every
 * answer is text for the model; the loop adds the picture for look.
 */
export function createSession() {
  let drawing: Drawing = emptyDrawing()
  return {
    drawing: () => drawing,
    act(action: Action): { ok: boolean; message: string } {
      if (action.action === "reset") {
        drawing = emptyDrawing()
        return { ok: true, message: "Cleared. The drawing is empty." }
      }
      if (action.action !== "build") return { ok: true, message: describe(drawing.molecule) }
      let ops: Op[]
      try {
        ops = JSON.parse(action.ops)
        if (!Array.isArray(ops)) throw new Error("not an array")
      } catch (error) {
        return { ok: false, message: `ops must be a JSON array of ops (${error instanceof Error ? error.message : String(error)}). Nothing changed.` }
      }
      const result = applyOps(drawing, ops)
      if (!result.ok) return { ok: false, message: `Op ${result.index} failed: ${result.error}. Nothing changed; fix it and build again.` }
      drawing = result.drawing
      const names = Object.entries(result.names)
      return {
        ok: true,
        message: [
          `Applied ${ops.length} ops.`,
          ...(names.length > 0 ? [`Names from this build (they last only within it; use the ids from now on): ${names.map(([name, id]) => `${name}=${id}`).join(", ")}`] : []),
          describe(drawing.molecule),
        ].join("\n"),
      }
    },
  }
}
