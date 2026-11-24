import { displayFormula, plainFormula } from "@structura/core/formula"
import type { Molecule } from "@structura/core/types"
import { choiceText } from "@structura/markush"
import { PROPERTIES, propertyText, propertyValue, type PropertyKey, type RdProps } from "./properties.ts"
import { rowName, type Row } from "./results.ts"

// The columns of the results table: what each shows for a compound, and how it sorts.

/** What a column holds: the compound's number, the formula it came from, a variable (its value, or where it was put), the molecular formula, a property. */
export type ColumnKind = "number" | "which" | "variable" | "position" | "formula" | "property"

export type Column = { id: string; kind: ColumnKind; label: string; title?: string; /** Numbers sit to the right. */ numeric: boolean; name?: string; property?: PropertyKey }

/** The columns the rows call for: number, formula of the drawing (only with several), each variable in the order it first appears, then the properties. */
export function columnsOf(rows: readonly Row[]): Column[] {
  const names: string[] = []
  const placed = new Set<string>()
  for (const row of rows)
    for (const pick of row.picks) {
      if ("position" in pick) placed.add(pick.name)
      if (!names.includes(pick.name)) names.push(pick.name)
    }
  return [
    { id: "number", kind: "number", label: "编号", numeric: false },
    ...(rows.some((row) => row.formula != null) ? [{ id: "which", kind: "which" as const, label: "式", title: "来自画布上的第几个式子", numeric: true }] : []),
    ...names.flatMap((name): Column[] => [
      { id: `v:${name}`, kind: "variable", label: name, title: `${name} 取了什么`, numeric: false, name },
      ...(placed.has(name) ? [{ id: `p:${name}`, kind: "position" as const, label: `${name} 位置`, title: `${name} 接在哪些位置`, numeric: false, name }] : []),
    ]),
    { id: "formula", kind: "formula", label: "分子式", numeric: false },
    ...PROPERTIES.map((def): Column => ({ id: `prop:${def.key}`, kind: "property", label: def.label, title: def.title, numeric: true, property: def.key })),
  ]
}

/** What each variable became in a row, joined when it took several (a variable at two positions). */
function took(row: Row, name: string): string[] {
  return row.picks.flatMap((pick) => (!("position" in pick) && pick.name === name ? ["count" in pick ? String(pick.count) : choiceText(pick.choice)] : []))
}

/** Where a variable went in a row ("#1、#3"), or 不出现 when the attachment took none of its positions. */
const positionOf = (row: Row, name: string): string =>
  row.picks.flatMap((pick) => ("position" in pick && pick.name === name ? [pick.position === "none" ? "不出现" : pick.position.split(", ").join("、")] : [])).join("、")

/** How a column's cell reads; "" when the compound has nothing there. */
export function cellText(column: Column, row: Row, rd: RdProps | null | undefined): string {
  switch (column.kind) {
    case "number":
      return rowName(row)
    case "which":
      return row.formula != null ? String(row.formula) : ""
    case "variable":
      return took(row, column.name!).join("、")
    case "position":
      return positionOf(row, column.name!)
    case "formula":
      return displayFormula(plainFormula(row.mol))
    case "property":
      return propertyText(column.property!, propertyValue(column.property!, row.mol, rd))
  }
}

/** For each variable, its values in the order they first appear among the compounds, which is the order of its candidates. */
export function valueOrder(rows: readonly Row[]): Map<string, Map<string, number>> {
  const order = new Map<string, Map<string, number>>()
  for (const row of rows)
    for (const pick of row.picks) {
      if ("position" in pick) continue
      const ranks = order.get(pick.name) ?? order.set(pick.name, new Map()).get(pick.name)!
      const text = "count" in pick ? String(pick.count) : choiceText(pick.choice)
      if (!ranks.has(text)) ranks.set(text, ranks.size)
    }
  return order
}

/** How the table is ordered: by a column, ascending or not; null is the order of generation. */
export type Sort = { column: string; descending: boolean } | null

/** Where the numbers a column sorts by come from. */
export type SortContext = { order: ReadonlyMap<string, ReadonlyMap<string, number>>; props: (mol: Molecule) => RdProps | null | undefined }

/** A row's place in a column's order; null when it has none (it goes last, whichever way the column sorts). */
function sortKey(column: Column, row: Row, context: SortContext): number | string | null {
  switch (column.kind) {
    case "number":
      return row.number
    case "which":
      return row.formula ?? null
    case "variable": {
      const first = took(row, column.name!)[0]
      return first == null ? null : (context.order.get(column.name!)?.get(first) ?? null)
    }
    case "position": {
      // Not there at all goes with the rows that have no value: last.
      const where = positionOf(row, column.name!)
      return where && where !== "不出现" ? where : null
    }
    case "formula":
      return plainFormula(row.mol)
    case "property":
      return propertyValue(column.property!, row.mol, context.props(row.mol)) ?? null
  }
}

/** Whether sorting by this column needs RDKit's numbers. */
export const sortNeedsRdkit = (sort: Sort): boolean => sort != null && sort.column.startsWith("prop:") && !["prop:mw", "prop:exact"].includes(sort.column)

/** The rows ordered by a column; ties keep the order of generation, and rows with no value come last. */
export function sortRows(rows: readonly Row[], sort: Sort, columns: readonly Column[], context: SortContext): Row[] {
  const column = sort && columns.find((candidate) => candidate.id === sort.column)
  if (!sort || !column) return rows.slice()
  const keyed = rows.map((row) => ({ row, key: sortKey(column, row, context) }))
  keyed.sort((a, b) => {
    if (a.key == null || b.key == null) return a.key == null ? (b.key == null ? a.row.number - b.row.number : 1) : -1
    const order = typeof a.key === "number" && typeof b.key === "number" ? a.key - b.key : String(a.key).localeCompare(String(b.key), undefined, { numeric: true })
    return order !== 0 ? (sort.descending ? -order : order) : a.row.number - b.row.number
  })
  return keyed.map(({ row }) => row)
}
