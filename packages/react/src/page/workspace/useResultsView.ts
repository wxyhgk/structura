import { useMemo } from "react"
import type { Molecule } from "@structura/core/types"
import type { RdProps } from "../properties.ts"
import { columnsOf, sortNeedsRdkit, sortRows, valueOrder, type Column, type Sort } from "../resultColumns.ts"
import type { Row } from "../results.ts"
import { keepInRanges, keepMatching, keepWords, needsRdProps, parseWords, unknownVariables, type RowFilter } from "../rowFilter.ts"
import type { RdkitState } from "./useRdkit.ts"
import { useProperties } from "./useProperties.ts"
import { useStructureMatch } from "./useStructureMatch.ts"

const NONE: readonly Molecule[] = []

export type ResultsView = {
  /** The compounds that pass the filter, with their numbers, in the order asked for. */
  rows: Row[]
  /** The table's columns, from all the compounds (a filter does not take a variable's column away). */
  columns: Column[]
  /** How many are still being looked at by RDKit (structure, ranges, sort), so the filter's answer is not complete yet. */
  pending: number
  /** What the user should hear about the filter: a word that matches nothing, a structure that is not one, RDKit missing. */
  notes: string[]
  /** RDKit's properties, as far as computed. */
  props: (mol: Molecule) => RdProps | null | undefined
  /** For each variable, the order of its values (its candidates' order). */
  order: ReturnType<typeof valueOrder>
}

/** The filter without what only RDKit can answer, for when there is none. */
function withoutRdkit(filter: RowFilter): RowFilter {
  const ranges = Object.fromEntries(Object.entries(filter.ranges).filter(([key]) => key === "mw" || key === "exact"))
  return { ...filter, ranges, ruleOfFive: false }
}

/**
 * The generated compounds as the pane shows them: the filter's words first (cheap), then
 * the structure and the property ranges, which RDKit answers in slices and only for what
 * is left, then the sort. The rows come numbered (the document's numbers): neither changes them.
 */
export function useResultsView(rows: readonly Row[], filter: RowFilter, sort: Sort, rdkit: RdkitState): ResultsView {
  const columns = useMemo(() => columnsOf(rows), [rows])
  const order = useMemo(() => valueOrder(rows), [rows])
  const words = useMemo(() => parseWords(filter.text), [filter.text])
  const byWords = useMemo(() => keepWords(rows, words), [rows, words])

  // The structure: asked of the compounds the words left.
  const structure = useStructureMatch(filter.structure, useMemo(() => byWords.map((row) => row.mol), [byWords]), rdkit)
  const skipped = structure.state === "off" || structure.state === "invalid" || structure.state === "unavailable"
  const byStructure = useMemo(() => (skipped ? { rows: byWords, pending: 0, unreadable: 0 } : keepMatching(byWords, structure.matches)), [skipped, byWords, structure])

  // The ranges: RDKit's properties of what is left, unless RDKit is not to be had.
  const noRdkit = rdkit.state === "unavailable"
  const ranged = useMemo(() => (noRdkit ? withoutRdkit(filter) : filter), [noRdkit, filter])
  const rdMols = useMemo(() => (needsRdProps(ranged) ? byStructure.rows.map((row) => row.mol) : NONE), [ranged, byStructure])
  const rangeWork = useProperties(rdMols, rdkit)
  const byRanges = useMemo(() => keepInRanges(byStructure.rows, ranged, rangeWork.get), [byStructure, ranged, rangeWork])

  const numbered = byRanges.rows
  const sortMols = useMemo(() => (sortNeedsRdkit(sort) ? numbered.map((row) => row.mol) : NONE), [sort, numbered])
  const sortWork = useProperties(sortMols, rdkit)
  const sorted = useMemo(() => sortRows(numbered, sort, columns, { order, props: sortWork.get }), [numbered, sort, columns, order, sortWork])

  const notes = useMemo(() => {
    const found = words.problems.slice()
    const unknown = unknownVariables(words, columns.flatMap((column) => (column.kind === "variable" ? [column.name!] : [])))
    for (const name of unknown) found.push(`没有叫 ${name} 的变量，没有化合物符合它。`)
    if (structure.state === "invalid") found.push("结构不是有效的 SMILES 或 SMARTS，没有用它筛选。")
    if (noRdkit && (filter.structure.trim() || needsRdProps(filter))) found.push("RDKit 没有加载（需要联网下载），结构和 cLogP 等性质的筛选用不了。")
    const unreadable = byStructure.unreadable + byRanges.unreadable
    if (unreadable > 0) found.push(`有 ${unreadable} 个化合物 RDKit 读不了，按不符合处理。`)
    return found
  }, [words, columns, structure.state, noRdkit, filter, byStructure.unreadable, byRanges.unreadable])

  return { rows: sorted, columns, pending: byStructure.pending + byRanges.pending + sortWork.pending, notes, props: sortWork.get, order }
}
