import { memo, useMemo, useState } from "react"
import type { Molecule } from "@structura/core/types"
import { MoleculeThumb } from "../../editor/common/MoleculeThumb.tsx"
import type { RdProps } from "../properties.ts"
import { cellText, type Column, type Sort } from "../resultColumns.ts"
import { sameRow, type Row } from "../results.ts"
import { PAGE } from "./ResultGrid.tsx"
import type { RdkitState } from "./useRdkit.ts"
import { useProperties } from "./useProperties.ts"

/** The structure's heading: not a column of data, so not sortable. */
const STRUCTURE: Column = { id: "structure", kind: "number", label: "结构", numeric: false }

const cell = "border-b border-(--c-eeeeee) px-2 py-1 align-middle"

/** What a property cell holds when RDKit has no number for it: a mark, and why. */
type Blank = { mark: string; why: string }
const COMPUTING: Blank = { mark: "…", why: "正在计算" }
const NO_RDKIT: Blank = { mark: "—", why: "RDKit 没有加载，算不了" }
const UNREADABLE: Blank = { mark: "—", why: "RDKit 读不了这个结构" }

type RowProps = {
  row: Row
  columns: readonly Column[]
  /** RDKit's properties of the row: undefined while computing (or RDKit loading), null when RDKit cannot read it. */
  rd: RdProps | null | undefined
  /** What a property RDKit gives shows when it has no number. */
  blank: Blank
  colorHetero: boolean
  onPlace: (mol: Molecule) => void
}

/** One compound as a row of the table; redrawn only when something it shows changed. */
const TableRow = memo(
  function TableRow({ row, columns, rd, blank, colorHetero, onPlace }: RowProps) {
    const show = (column: Column) => {
      const text = cellText(column, row, rd)
      if (column.kind === "number")
        return (
          <td key={column.id} className={`${cell} whitespace-nowrap`}>
            <span className="font-semibold text-(--c-333333)" data-testid="compound-id">
              {text}
            </span>
          </td>
        )
      const fromRdkit = column.kind === "property" && column.property !== "mw" && column.property !== "exact"
      return (
        <td key={column.id} className={`${cell} ${column.numeric ? "text-right tabular-nums" : ""} ${column.kind === "formula" ? "whitespace-nowrap" : ""}`} data-column={column.id} title={fromRdkit && !text ? blank.why : undefined}>
          {fromRdkit && !text ? <span className="text-(--c-aaaaaa)">{blank.mark}</span> : text}
        </td>
      )
    }
    const [number, ...rest] = columns
    return (
      <tr className="hover:bg-(--c-f5f8fd)" data-testid="result-row">
        {show(number)}
        <td className={`${cell} text-center`}>
          <MoleculeThumb mol={row.mol} colorHetero={colorHetero} className="mx-auto h-14 w-28 object-contain" />
        </td>
        {rest.map(show)}
        <td className={`${cell} text-right`}>
          <button type="button" className="rounded-sm px-1.5 py-0.5 text-[11px] whitespace-nowrap text-(--c-1a73e8) hover:bg-(--c-eef3fb)" onClick={() => onPlace(row.mol)}>
            在绘图页打开
          </button>
        </td>
      </tr>
    )
  },
  (a, b) => sameRow(a.row, b.row) && a.columns === b.columns && a.rd === b.rd && a.blank === b.blank && a.colorHetero === b.colorHetero && a.onPlace === b.onPlace,
)

/** The mark for a property RDKit has no number for: still computing, no RDKit, or a compound it cannot read. */
const blankFor = (rd: RdProps | null | undefined, rdkit: RdkitState): Blank => (rd === null ? UNREADABLE : rdkit.state === "unavailable" ? NO_RDKIT : COMPUTING)

/**
 * The generated compounds as a table: one row each, a column for the number, the structure,
 * each variable, the formula and the properties; a click on a heading sorts by it. Only the
 * first PAGE rows are drawn (more on request), and RDKit's properties are computed for those
 * only. Remount it (a new key) to start again from the first page.
 */
export function ResultTable({
  rows,
  columns,
  sort,
  onSort,
  colorHetero,
  onPlace,
  rdkit,
}: {
  rows: readonly Row[]
  columns: readonly Column[]
  sort: Sort
  onSort: (column: string) => void
  colorHetero: boolean
  onPlace: (mol: Molecule) => void
  rdkit: RdkitState
}) {
  const [shown, setShown] = useState(PAGE)
  const visible = useMemo(() => rows.slice(0, shown), [rows, shown])
  const work = useProperties(useMemo(() => visible.map((row) => row.mol), [visible]), rdkit)
  const more = rows.length - shown
  const [number, ...rest] = columns
  // The structure follows the number, as in a patent's table; the open button is last.
  const head = [number, STRUCTURE, ...rest]
  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="results-table">
      {rdkit.state === "unavailable" && (
        <div className="border-b border-(--c-f0e2bf) bg-(--c-fffaf0) px-3 py-1 text-[12px] text-(--c-8a5a00)" data-testid="rdkit-missing">
          RDKit 没有加载（需要联网下载），cLogP、TPSA 等性质暂时算不了，显示为“—”。
        </div>
      )}
      <table className="w-full border-separate border-spacing-0 text-[12px] text-(--c-333333)">
        <thead>
          <tr>
            {head.map((column) => {
              const active = sort?.column === column.id
              return (
                <th key={column.id} className={`sticky top-0 z-10 border-b border-(--c-e0e0e0) bg-(--c-f7f7f7) px-2 py-1 font-medium whitespace-nowrap ${column.numeric ? "text-right" : "text-left"}`} aria-sort={active ? (sort.descending ? "descending" : "ascending") : undefined} title={column.title}>
                  {column.id === "structure" ? (
                    column.label
                  ) : (
                    <button type="button" className={`inline-flex items-center gap-0.5 rounded-sm hover:text-(--c-1a73e8) ${active ? "text-(--c-1a73e8)" : ""}`} onClick={() => onSort(column.id)} data-testid={`sort-${column.id}`}>
                      {column.label}
                      <span className="w-2.5 text-[9px]">{active ? (sort.descending ? "▼" : "▲") : ""}</span>
                    </button>
                  )}
                </th>
              )
            })}
            <th className="sticky top-0 z-10 border-b border-(--c-e0e0e0) bg-(--c-f7f7f7)" />
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <TableRow key={row.number} row={row} columns={columns} rd={work.get(row.mol)} blank={blankFor(work.get(row.mol), rdkit)} colorHetero={colorHetero} onPlace={onPlace} />
          ))}
        </tbody>
      </table>
      {more > 0 && (
        <div className="flex justify-center py-2">
          <button type="button" className="rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) px-3 py-1 text-[12px] text-(--c-1a73e8) hover:bg-(--c-eef3fb)" onClick={() => setShown(shown + PAGE)}>
            显示更多（还有 {more} 个）
          </button>
        </div>
      )}
    </div>
  )
}
