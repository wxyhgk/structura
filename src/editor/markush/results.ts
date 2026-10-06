import { displayFormula, molecularWeight, plainFormula } from "@structura/core/formula"
import { pickFields, type Pick } from "@structura/markush"
import type { Molecule } from "@structura/core/types"

// The generated compounds as the dialog lists, filters and exports them. Pure, so tested
// without a browser; SMILES come from the caller (RDKit lives in the page).

/** One generated compound: its place in the list (1-based), the molecule and what each variable became. */
export type Row = { number: number; mol: Molecule; picks: readonly Pick[] }

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

/**
 * The rows a filter keeps: every word must appear in the compound's formula or in what its
 * variables became (R1=Cl, Cl, C6H4…), ignoring case and spaces around "=".
 */
export function filterRows(rows: readonly Row[], filter: string): Row[] {
  const words = filter.toLowerCase().replace(/\s*=\s*/g, "=").split(/\s+/).filter(Boolean)
  if (words.length === 0) return rows.slice()
  return rows.filter((row) => {
    const fields = pickFields(row.picks)
    const haystack = [plainFormula(row.mol), ...Object.entries(fields).flatMap(([name, value]) => [`${name}=${value}`, value])].join(" ").toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}

/** A CSV cell: quoted when it holds a comma, a quote or a line break. */
const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/**
 * The rows as CSV for a spreadsheet: number, SMILES, formula, molecular weight, then one
 * column per variable (and per attachment position), in the order they first appear.
 */
export function rowsToCsv(rows: readonly Row[], smiles: (mol: Molecule) => string): string {
  const columns: string[] = []
  for (const row of rows) for (const name of Object.keys(pickFields(row.picks))) if (!columns.includes(name)) columns.push(name)
  const head = ["No", "SMILES", "Formula", "MW", ...columns]
  const lines = rows.map((row) => {
    const fields = pickFields(row.picks)
    return [String(row.number), smiles(row.mol), displayFormula(plainFormula(row.mol)).normalize("NFKC"), molecularWeight(row.mol).toFixed(2), ...columns.map((name) => fields[name] ?? "")]
      .map(cell)
      .join(",")
  })
  // A byte order mark, so Excel reads the Chinese and the subscripts as UTF-8.
  return `﻿${[head.map(cell).join(","), ...lines].join("\n")}\n`
}

/** The rows as a SMILES file: one compound a line, its number as the name. */
export function rowsToSmiles(rows: readonly Row[], smiles: (mol: Molecule) => string): string {
  return rows.map((row) => `${smiles(row.mol)}\t${row.number}`).join("\n") + "\n"
}
