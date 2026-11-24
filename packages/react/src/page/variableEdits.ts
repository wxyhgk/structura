import { type Alternative, alternativesFromText, alternativesOf, sameAlternative, type Variable } from "@structura/markush"
import type { Molecule } from "@structura/core/types"
import { captureOps, type Run } from "@structura/engine"

const KEEP = { keepSelection: true }

/**
 * The changes one variable's list can take, each as an undoable op: adding, replacing and
 * removing alternatives, sharing another variable's list, and taking a piece off the canvas.
 */
export function variableEdits(name: string, variables: Record<string, Variable> | undefined, run: Run) {
  const variable = variables?.[name]
  const alternatives = alternativesOf(variables, name)

  /** Saves the new list; an empty list takes the definition away. */
  function save(next: Alternative[]) {
    if (next.length > 0) run([{ op: "set_variable", name, alternatives: next }], KEEP)
    else if (variable) run([{ op: "remove_variable", name }], KEEP)
  }

  return {
    save,
    /** Shares another variable's list, or (with "") takes a copy of the shared list as its own. */
    share(source: string) {
      if (source) run([{ op: "set_variable", name, sameAs: source }], KEEP)
      else if (alternatives.length > 0) run([{ op: "set_variable", name, alternatives }], KEEP)
      else run([{ op: "remove_variable", name }], KEEP)
    },
    /** Adds one alternative, unless the list has it already. */
    add(item: Alternative) {
      if (!alternatives.some((other) => sameAlternative(other, item))) save([...alternatives, item])
    },
    replace(index: number, item: Alternative) {
      save(alternatives.map((other, at) => (at === index ? item : other)))
    },
    remove(index: number) {
      save(alternatives.filter((_, at) => at !== index))
    },
    /** Adds what was typed; returns the words that are no element or abbreviation. */
    addText(text: string): string[] {
      const { add, rejected } = alternativesFromText(text, alternatives)
      if (add.length > 0) save([...alternatives, ...add])
      return rejected
    },
    /** Moves the selected piece off the canvas into the list, as one step; returns why it could not, if it could not. */
    capture(mol: Molecule, selected: number[]): string | null {
      const result = captureOps(name, alternatives, mol, selected)
      if ("problem" in result) return result.problem
      run(result.ops)
      return null
    },
    /** Saves a piece drawn in the sketch pad: new, or in place of the drawn one at `index` (keeping its name). */
    saveSketch(index: number | "new", piece: Molecule, alsoAt: number[]) {
      const old = typeof index === "number" ? alternatives[index] : undefined
      const kept = old?.kind === "fragment" && old.name != null ? { name: old.name } : {}
      const item: Alternative = { kind: "fragment", molecule: piece, ...kept, ...(alsoAt.length > 0 ? { alsoAt } : {}) }
      if (typeof index === "number") save(alternatives.map((other, at) => (at === index ? item : other)))
      else save([...alternatives, item])
    },
  }
}
