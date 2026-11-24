import { displayFormula, molecularWeight, plainFormula } from "@structura/core/formula"
import { compoundFields, pickFields, type Enumeration, type Pick } from "@structura/markush"
import type { Molecule } from "@structura/core/types"

// The generated compounds as the dialog lists, filters and exports them. Pure, so tested
// without a browser; SMILES come from the caller (RDKit lives in the page).

/**
 * One generated compound: its place in the list (1-based), the molecule, what each variable
 * became, and which formula it came from when the drawing holds several (式 1, 式 2…). `id`
 * is its compound number once the list is numbered (C-1…, see numbering.ts).
 */
export type Row = { number: number; mol: Molecule; picks: readonly Pick[]; formula?: number; id?: string }

/** Whether two rows show the same: the list rebuilds its rows (numbering, filtering) on every update, so it is their content that counts, not their identity. */
export const sameRow = (a: Row, b: Row): boolean => a.mol === b.mol && a.picks === b.picks && a.number === b.number && a.id === b.id && a.formula === b.formula

/** What a row is called: its compound number, else its place in the list. */
export const rowName = (row: Row): string => row.id ?? String(row.number)

/** An enumeration's compounds as rows, numbered from 1, tagged with their formula when there are several. */
export function rowsOf(result: Enumeration): Row[] {
  return result.molecules.map((mol, index) => ({ number: index + 1, mol, picks: result.picks[index], ...(result.formulas > 1 ? { formula: result.formulaOf[index] } : {}) }))
}

/** A row's fields as SD data items and CSV columns: which formula first (when there are several), then each variable. */
export function rowFields(row: Row): Record<string, string> {
  return compoundFields(row.picks, row.formula)
}

/**
 * What the variables became, briefly, each name once: "R1 在 #1、#3，R1 = Cl、F，X = O";
 * an attachment that appears no times (m = 0) is "R1 不出现".
 */
export function picksText(picks: readonly Pick[]): string {
  const where = new Map<string, string>()
  const values = new Map<string, string[]>()
  for (const pick of picks) {
    if ("position" in pick) where.set(pick.name, pick.position === "none" ? `${pick.name} 不出现` : `${pick.name} 在 ${pick.position.split(", ").join("、")}`)
    else values.set(pick.name, [...(values.get(pick.name) ?? []), pickFields([pick])[pick.name]])
  }
  return [...where.values(), ...[...values].map(([name, chosen]) => `${name} = ${chosen.join("、")}`)].join("，")
}

/** A CSV cell: quoted when it holds a comma, a quote or a line break. */
const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** A byte order mark at the start of a CSV, so Excel reads the Chinese and the subscripts as UTF-8. */
export const CSV_BOM = "\uFEFF"

/** The CSV's first line: number, SMILES, formula, molecular weight, the `extras` (properties), then the variables' `columns`. */
export const csvHead = (columns: readonly string[], extras: readonly string[] = []): string => ["No", "SMILES", "Formula", "MW", ...extras, ...columns].map(cell).join(",")

/** One compound's line under `csvHead(columns, extras)`, `more` holding the extras' values; a column the row has no value for is left empty. */
export function csvLine(row: Row, columns: readonly string[], smiles: (mol: Molecule) => string, extras: readonly string[] = [], more: Record<string, string> = {}): string {
  const fields = rowFields(row)
  return [rowName(row), smiles(row.mol), displayFormula(plainFormula(row.mol)).normalize("NFKC"), molecularWeight(row.mol).toFixed(2), ...extras.map((name) => more[name] ?? ""), ...columns.map((name) => fields[name] ?? "")]
    .map(cell)
    .join(",")
}

/**
 * The rows as CSV for a spreadsheet: number, SMILES, formula, molecular weight, the
 * properties given (exact mass, cLogP…), then one column per variable (and per
 * attachment position), in the order they first appear.
 */
export function rowsToCsv(rows: readonly Row[], smiles: (mol: Molecule) => string, properties?: { columns: readonly string[]; of: (row: Row) => Record<string, string> }): string {
  const columns: string[] = []
  for (const row of rows) for (const name of Object.keys(rowFields(row))) if (!columns.includes(name)) columns.push(name)
  const extras = properties?.columns ?? []
  return `${CSV_BOM}${[csvHead(columns, extras), ...rows.map((row) => csvLine(row, columns, smiles, extras, properties?.of(row)))].join("\n")}\n`
}

/** The rows as a SMILES file: one compound a line, its number as the name; a compound with no SMILES (RDKit cannot read it) has no line. */
export function rowsToSmiles(rows: readonly Row[], smiles: (mol: Molecule) => string): string {
  return rows.flatMap((row) => (smiles(row.mol) ? [`${smiles(row.mol)}\t${rowName(row)}`] : [])).join("\n") + "\n"
}
