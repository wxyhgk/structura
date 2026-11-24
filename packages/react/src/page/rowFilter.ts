import { elementCounts } from "@structura/core/formula"
import { elementOf } from "@structura/core/elements"
import type { Molecule } from "@structura/core/types"
import { choiceText } from "@structura/markush"
import { propertyDef, propertyValue, PROPERTIES, type PropertyKey, type RdProps } from "./properties.ts"
import { rowName, type Row } from "./results.ts"

// Filtering the generated compounds, as pure functions: the words of the filter box (a
// variable's value, an element count, free text), a property's range, and the stage that
// keeps what contains a structure (its matches come from RDKit, the caller's).

/** Everything the filter can ask for. */
export type RowFilter = {
  /** Words, "且": R1=H, N, N2, 式2, or free text. See parseWords. */
  text: string
  /** A SMILES or SMARTS the compound must contain. */
  structure: string
  /** A property's bounds as typed; an empty one is open. */
  ranges: Partial<Record<PropertyKey, { min: string; max: string }>>
  /** At most one of Lipinski's four limits broken. */
  ruleOfFive: boolean
}

export const NO_FILTER: RowFilter = { text: "", structure: "", ranges: {}, ruleOfFive: false }

/** One property's bounds, parsed. */
export type Range = { key: PropertyKey; min?: number; max?: number }

/** The bounds that were filled in with numbers. */
export function rangesOf(filter: RowFilter): Range[] {
  const number = (text: string | undefined) => (text != null && text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : undefined)
  return PROPERTIES.flatMap(({ key }) => {
    const min = number(filter.ranges[key]?.min)
    const max = number(filter.ranges[key]?.max)
    return min != null || max != null ? [{ key, min, max }] : []
  })
}

/** Whether the filter asks for anything beyond showing everything. */
export const filterActive = (filter: RowFilter): boolean => filter.text.trim() !== "" || filter.structure.trim() !== "" || rangesOf(filter).length > 0 || filter.ruleOfFive

/** Whether a property that comes from RDKit is asked for, so those compounds must be read. */
export const needsRdProps = (filter: RowFilter): boolean => filter.ruleOfFive || rangesOf(filter).some(({ key }) => propertyDef(key).descriptor != null)

/** Text compared the lenient way: case and spaces do not matter. */
const plain = (text: string): string => text.toLowerCase().replace(/\s+/g, "")

/** `name = value | value`: a variable became one of the values (or, with `not`, none of them). */
export type VariableTest = { name: string; not: boolean; values: string[] }
/** An element's count between `min` and `max`. */
export type ElementTest = { symbol: string; min: number; max: number }

/** The filter box's words, sorted into what each asks. */
export type Words = { variables: VariableTest[]; elements: ElementTest[]; formulas: number[]; free: string[]; problems: string[] }

/** A word split at its first "=" (or "!=") outside quotes, if it has one. */
function condition(word: string): { name: string; not: boolean; value: string } | null {
  let quoted = false
  for (let at = 0; at < word.length; at++) {
    if (word[at] === '"') quoted = !quoted
    else if (word[at] === "=" && !quoted) {
      const not = word[at - 1] === "!"
      return { name: word.slice(0, not ? at - 1 : at), not, value: word.slice(at + 1) }
    }
  }
  return null
}

/** An element count written as a formula part: N (at least one), N2 (exactly), N2+ (at least), N2- (at most), N0 (none). */
function elementTests(word: string): ElementTest[] | null {
  if (!/^(?:[A-Z][a-z]?\d*[+-]?)+$/.test(word)) return null
  const tests: ElementTest[] = []
  for (const [, symbol, digits, sign] of word.matchAll(/([A-Z][a-z]?)(\d*)([+-]?)/g)) {
    if (!elementOf(symbol) && symbol !== "D" && symbol !== "T") return null
    const count = digits === "" ? 1 : Number(digits)
    if (digits === "") tests.push({ symbol, min: 1, max: Infinity })
    else tests.push({ symbol, min: sign === "-" ? 0 : count, max: sign === "+" ? Infinity : count })
  }
  return tests
}

/**
 * Sorts the filter box's words (separated by spaces or commas, all of which must hold):
 * - `R1=H`: variable R1 became H, exactly (case and spaces do not matter); `R1=H|Cl` either;
 *   `R1!=H` neither; a value with spaces goes in quotes, `R1="a b"`.
 * - an element count, from the elements' own symbols: `N` holds nitrogen, `N2` exactly two,
 *   `N2+` two or more, `N2-` two or fewer, `N0` none; `C6H4N` mixes them.
 * - `式2`: the compound came from formula 2.
 * - anything else: free text, found in a variable's name or value or in the compound's number.
 */
export function parseWords(text: string): Words {
  const words: Words = { variables: [], elements: [], formulas: [], free: [], problems: [] }
  const spaced = text.replace(/\s*(!?=)\s*/g, "$1")
  for (const raw of spaced.match(/(?:[^\s,"]|"[^"]*")+/g) ?? []) {
    const word = raw.replace(/"/g, "")
    const tested = condition(raw)
    if (tested) {
      const name = tested.name.replace(/"/g, "").trim()
      const values = tested.value.replace(/"/g, "").split("|").map(plain).filter(Boolean)
      if (!name) words.problems.push(`“${word}” 前面要写变量名，如 R1=H`)
      else if (values.length === 0) words.problems.push(`“${word}” 后面要写取值，如 ${name}=H`)
      else words.variables.push({ name, not: tested.not, values })
      continue
    }
    const formula = /^式(\d+)$/.exec(word)
    if (formula) words.formulas.push(Number(formula[1]))
    else {
      const elements = elementTests(word)
      if (elements) words.elements.push(...elements)
      else words.free.push(word.toLowerCase())
    }
  }
  return words
}

/** The variable names the words ask for that none of `known` is, so the filter can say it matches nothing for that reason. */
export function unknownVariables(words: Words, known: readonly string[]): string[] {
  const names = new Set(known.map(plain))
  return [...new Set(words.variables.filter((test) => !names.has(plain(test.name))).map((test) => test.name))]
}

/** What each variable of a combination became, by name (case and spaces ignored): every value it took, a count as its number. */
function valuesOf(row: Row): Map<string, string[]> {
  const values = new Map<string, string[]>()
  for (const pick of row.picks) {
    if ("position" in pick) continue
    const text = "count" in pick ? String(pick.count) : choiceText(pick.choice)
    values.set(plain(pick.name), [...(values.get(plain(pick.name)) ?? []), text])
  }
  return values
}

/** The rows the words hold for, each word being a test of its own. */
export function keepWords(rows: readonly Row[], words: Words): Row[] {
  if (words.variables.length + words.elements.length + words.formulas.length + words.free.length === 0) return rows.slice()
  return rows.filter((row) => {
    if (words.formulas.some((number) => row.formula !== number)) return false
    if (words.elements.length > 0) {
      const have = elementCounts(row.mol)
      if (words.elements.some(({ symbol, min, max }) => (have.get(symbol) ?? 0) < min || (have.get(symbol) ?? 0) > max)) return false
    }
    if (words.variables.length + words.free.length === 0) return true
    const values = valuesOf(row)
    for (const { name, not, values: wanted } of words.variables) {
      const took = (values.get(plain(name)) ?? []).map(plain)
      if (wanted.some((value) => took.includes(value)) === not) return false
    }
    if (words.free.length === 0) return true
    const haystack = [rowName(row), ...[...values].flatMap(([name, taken]) => [name, ...taken])].join("\n").toLowerCase()
    return words.free.every((word) => haystack.includes(word))
  })
}

/** The rows the filter box's words hold for. */
export const filterRows = (rows: readonly Row[], text: string): Row[] => keepWords(rows, parseWords(text))

/** What a stage that needs RDKit left of the rows: those that pass, those not yet known, those RDKit cannot read. */
export type Stage = { rows: Row[]; pending: number; unreadable: number }

/** The rows `matches` says contain the structure; undefined: not asked yet, null: RDKit cannot read the molecule (it counts as not containing it). */
export function keepMatching(rows: readonly Row[], matches: (mol: Molecule) => boolean | null | undefined): Stage {
  const stage: Stage = { rows: [], pending: 0, unreadable: 0 }
  for (const row of rows) {
    const found = matches(row.mol)
    if (found === undefined) stage.pending++
    else if (found === null) stage.unreadable++
    else if (found) stage.rows.push(row)
  }
  return stage
}

/** How many of Lipinski's limits (weight 500, cLogP 5, donors 5, acceptors 10) the compound exceeds. */
export function ruleOfFiveBreaks(mol: Molecule, rd: RdProps): number {
  return [propertyValue("mw", mol, rd)! > 500, rd.logp > 5, rd.hbd > 5, rd.hba > 10].filter(Boolean).length
}

/** The rows within every range (and the rule of five, when asked); those RDKit has not computed yet are pending, those it cannot read left out. */
export function keepInRanges(rows: readonly Row[], filter: RowFilter, props: (mol: Molecule) => RdProps | null | undefined): Stage {
  const ranges = rangesOf(filter)
  const stage: Stage = { rows: [], pending: 0, unreadable: 0 }
  const needsRd = needsRdProps(filter)
  for (const row of rows) {
    const rd = needsRd ? props(row.mol) : undefined
    if (needsRd && rd === undefined) {
      stage.pending++
      continue
    }
    if (needsRd && rd === null) {
      stage.unreadable++
      continue
    }
    const within = ranges.every(({ key, min, max }) => {
      const value = propertyValue(key, row.mol, rd)
      return value != null && (min == null || value >= min) && (max == null || value <= max)
    })
    if (within && (!filter.ruleOfFive || ruleOfFiveBreaks(row.mol, rd!) <= 1)) stage.rows.push(row)
  }
  return stage
}
