import { alternativeProblem, alternativesFromText, GROUP_CLASSES, isVariableName, sameAlternative, variableProblem } from "@structura/markush"
import type { Op } from "@structura/core/ops"
import type { Alternative, Variable } from "@structura/core/types"
import type { AnswerAlternative, FillAnswer, FillRequest } from "./types.ts"

// The model's answer checked against what the editor can store, before anything is applied:
// each variable's usable definition, and what was dropped and why, for the chemist to read.

/** One variable as the model read it, checked. */
export type ReviewedVariable = {
  name: string
  /** The sentence that defines it, as quoted. */
  source: string
  /** The definition to apply, or null when nothing usable is left. */
  variable: Variable | null
  /** Alternatives that were dropped: what the model wrote and why it cannot be used. */
  rejected: Array<{ text: string; why: string }>
  /** Parts of the definition the editor cannot express, as quoted. */
  unrepresented: string[]
  /** Things to check before applying: a linker given a substituent, a variable not drawn… */
  warnings: string[]
  /** It already has a definition, which applying replaces. */
  replaces: boolean
}

export type Review = { variables: ReviewedVariable[]; notes: string[] }

/** "C1–C30 alkyl", "label Foo": how a dropped alternative is shown. */
function shown(item: AnswerAlternative): string {
  if (item.kind === "label") return item.text
  if (item.kind === "bond") return "bond"
  if (item.kind === "bridge") return item.name
  return item.class
}

/** The model's alternative as the editor stores it (nulls left out), or why it cannot be. */
function converted(item: AnswerAlternative): { add: Alternative[] } | { why: string } {
  if (item.kind === "label") {
    const label: Alternative = { kind: "label", text: item.text.trim() }
    if (!alternativeProblem(label)) return { add: [label] }
    // Words the panel's own field understands: halogen, 单键, ring names.
    const read = alternativesFromText(item.text)
    if (read.add.length > 0 && read.rejected.length === 0) return { add: read.add }
    return { why: "不是元素或已知缩写" }
  }
  const alternative: Alternative =
    item.kind === "class"
      ? {
          kind: "class",
          class: item.class,
          ...(item.min != null ? { min: item.min } : {}),
          ...(item.max != null ? { max: item.max } : {}),
          ...(item.substituted != null ? { substituted: item.substituted } : {}),
        }
      : item.kind === "bridge"
        ? { kind: "bridge", name: item.name as Extract<Alternative, { kind: "bridge" }>["name"] }
        : { kind: "bond" }
  const problem = alternativeProblem(alternative)
  return problem ? { why: problem } : { add: [alternative] }
}

/** Whether the alternative bonds to two atoms (a linker's) rather than one. */
function divalent(alternative: Alternative): boolean {
  if (alternative.kind === "bond" || alternative.kind === "bridge") return true
  return alternative.kind === "class" && GROUP_CLASSES[alternative.class].arity === 2
}

/** Checks the model's answer against the editor's rules and the formula it was asked about. */
export function reviewAnswer(answer: FillAnswer, request: FillRequest): Review {
  const known = new Map(request.variables.map((variable) => [variable.name, variable]))
  const reviewed = answer.variables.map((item): ReviewedVariable => {
    const asked = known.get(item.name)
    const warnings: string[] = []
    const rejected: ReviewedVariable["rejected"] = []
    if (!isVariableName(item.name)) {
      return { name: item.name, source: item.source, variable: null, rejected: [{ text: item.name, why: "不是变量名（像 R1、X、L 这样）" }], unrepresented: item.unrepresented, warnings, replaces: false }
    }
    if (!asked?.onDrawing) warnings.push("图上没有这个变量")
    let variable: Variable | null = null
    if (item.sameAs) {
      variable = { sameAs: item.sameAs }
    } else {
      const alternatives: Alternative[] = []
      for (const alternative of item.alternatives) {
        const result = converted(alternative)
        if ("why" in result) rejected.push({ text: shown(alternative), why: result.why })
        else for (const add of result.add) if (!alternatives.some((other) => sameAlternative(other, add))) alternatives.push(add)
      }
      if (alternatives.length > 0) variable = { alternatives }
      const misfits = alternatives.filter((alternative) => asked && divalent(alternative) !== asked.linker)
      if (misfits.length > 0) warnings.push(asked?.linker ? "它连在两个原子之间，有些候选项只能接一端" : "它只接一个原子，单键和二价环放不上")
    }
    return { name: item.name, source: item.source, variable, rejected, unrepresented: item.unrepresented, warnings, replaces: asked?.current != null }
  })
  // A "same as" must point at a list that will exist: one of these, or one already defined.
  const lists = new Set([
    ...reviewed.flatMap((item) => (item.variable && "alternatives" in item.variable ? [item.name] : [])),
    ...request.variables.flatMap(({ name, current }) => (current && "alternatives" in current && !reviewed.some((item) => item.name === name) ? [name] : [])),
  ])
  for (const item of reviewed) {
    if (item.variable && "sameAs" in item.variable && !lists.has(item.variable.sameAs)) {
      item.rejected.push({ text: `与 ${item.variable.sameAs} 相同`, why: `${item.variable.sameAs} 没有自己的候选项` })
      item.variable = null
    }
  }
  const named = new Set(reviewed.map((item) => item.name))
  const undefinedOnes = request.variables.filter((variable) => variable.onDrawing && !named.has(variable.name)).map((variable) => variable.name)
  const notes = [...answer.notes, ...(undefinedOnes.length > 0 ? [`文字里没有找到 ${undefinedOnes.join("、")} 的定义。`] : [])]
  return { variables: reviewed, notes }
}

/**
 * The ops that apply the chosen variables, lists before the variables that share them.
 * One whose list it shares is neither chosen nor already defined is left out, with why.
 */
export function fillOps(review: Review, chosen: ReadonlySet<string>, existing: Record<string, Variable> = {}): { ops: Op[]; skipped: Array<{ name: string; why: string }> } {
  const picked = review.variables.filter((item) => chosen.has(item.name) && item.variable)
  const table: Record<string, Variable> = { ...existing }
  const ops: Op[] = []
  const skipped: Array<{ name: string; why: string }> = []
  const ordered = [...picked.filter((item) => "alternatives" in item.variable!), ...picked.filter((item) => "sameAs" in item.variable!)]
  for (const item of ordered) {
    const variable = item.variable!
    const problem = variableProblem(item.name, variable, table)
    if (problem) {
      skipped.push({ name: item.name, why: problem })
      continue
    }
    table[item.name] = variable
    ops.push("sameAs" in variable ? { op: "set_variable", name: item.name, sameAs: variable.sameAs } : { op: "set_variable", name: item.name, alternatives: variable.alternatives })
  }
  return { ops, skipped }
}
