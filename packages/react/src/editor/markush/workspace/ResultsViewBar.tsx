import { useState } from "react"
import { propertyDef, type PropertyKey } from "../properties.ts"
import { filterActive, NO_FILTER, rangesOf, type RowFilter } from "../rowFilter.ts"
import type { Column, Sort } from "../resultColumns.ts"
import type { ViewMode } from "./useViewMode.ts"

const input = "h-6 rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) px-1.5 text-[12px] outline-none focus:border-(--c-1a73e8)"
const button = "h-6 rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) px-2 text-[12px] text-(--c-333333) hover:bg-(--c-eef3fb)"

/** The properties a range can be put on (exact mass is for reading, not for cutting). */
const RANGED: readonly PropertyKey[] = ["mw", "logp", "tpsa", "hbd", "hba", "rotb", "heavy"]

/** What the box asks for, in words, as the hint under it. */
const STRUCTURE_HINT = "SMILES 或 SMARTS（RDKit 读），如 c1ccccc1、C(=O)N、[NX3;H2]：只留含有这个结构的化合物"

/**
 * The row under the toolbar: cards or table, the sort in force, how far the filter's
 * searching has got, and 更多筛选 (a structure to contain, ranges of the properties, the
 * rule of five), with whatever the filter has to say about itself.
 */
export function ResultsViewBar({
  view,
  onView,
  filter,
  onFilter,
  sort,
  columns,
  onSort,
  pending,
  notes,
  disabled,
}: {
  view: ViewMode
  onView: (view: ViewMode) => void
  filter: RowFilter
  onFilter: (filter: RowFilter) => void
  sort: Sort
  columns: readonly Column[]
  onSort: (sort: Sort) => void
  /** How many compounds the filter or sort is still waiting for RDKit on. */
  pending: number
  notes: readonly string[]
  /** Nothing generated yet: nothing to view or filter. */
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  // The words are the toolbar's box; what is counted here is what the panel below holds.
  const extra = (filter.structure.trim() ? 1 : 0) + rangesOf(filter).length + (filter.ruleOfFive ? 1 : 0)
  const sorted = sort && columns.find((column) => column.id === sort.column)
  const setRange = (key: PropertyKey, side: "min" | "max", value: string) => onFilter({ ...filter, ranges: { ...filter.ranges, [key]: { min: filter.ranges[key]?.min ?? "", max: filter.ranges[key]?.max ?? "", [side]: value } } })
  return (
    <div className="border-b border-(--c-e3e3e3) bg-(--c-ffffff) px-3 py-1 text-[12px] text-(--c-333333)">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex overflow-hidden rounded-sm border border-(--c-d0d0d0)" role="group" aria-label="结果的显示方式">
          {(["cards", "table"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`h-6 px-2.5 ${view === mode ? "bg-(--c-e8f0fe) text-(--c-1a73e8)" : "bg-(--c-ffffff) text-(--c-333333) hover:bg-(--c-eef3fb)"}`}
              aria-pressed={view === mode}
              onClick={() => onView(mode)}
              data-testid={`view-${mode}`}
            >
              {mode === "cards" ? "卡片" : "表格"}
            </button>
          ))}
        </span>
        <button type="button" className={`${button} ${extra > 0 ? "border-(--c-1a73e8) text-(--c-1a73e8)" : ""}`} aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)} data-testid="filter-more-toggle">
          {open ? "▾" : "▸"} 子结构和性质筛选{extra > 0 ? `（${extra}）` : ""}
        </button>
        {sorted && sort && (
          <span className="flex items-center gap-1 rounded-sm bg-(--c-eef3fd) px-1.5 py-0.5 text-(--c-1a73e8)" data-testid="sort-chip">
            按 {sorted.label} {sort.descending ? "从大到小" : "从小到大"}
            <button type="button" className="px-0.5 hover:text-(--c-c5221f)" aria-label="恢复生成的顺序" title="恢复生成的顺序" onClick={() => onSort(null)}>
              ×
            </button>
          </span>
        )}
        {pending > 0 && (
          <span className="text-(--c-888888)" data-testid="filter-pending">
            正在用 RDKit 计算，还有 {pending} 个…
          </span>
        )}
        {filterActive(filter) && (
          <button type="button" className="text-(--c-1a73e8) hover:underline" onClick={() => onFilter(NO_FILTER)} data-testid="filter-clear">
            清除全部筛选
          </button>
        )}
      </div>
      {open && (
        <div className="mt-1.5 space-y-1.5 pb-1" data-testid="filter-panel">
          <label className="flex items-center gap-2">
            <span className="w-12 shrink-0">子结构</span>
            <input className={`${input} w-72`} placeholder="如 c1ccccc1 或 [NX3;H2]" title={STRUCTURE_HINT} value={filter.structure} onChange={(event) => onFilter({ ...filter, structure: event.target.value })} aria-label="按子结构筛选" spellCheck={false} />
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="w-12 shrink-0">性质</span>
            {RANGED.map((key) => (
              <span key={key} className="flex items-center gap-1" title={propertyDef(key).title}>
                {propertyDef(key).label}
                <input type="number" className={`${input} w-16`} placeholder="最小" value={filter.ranges[key]?.min ?? ""} onChange={(event) => setRange(key, "min", event.target.value)} aria-label={`${propertyDef(key).label} 下限`} />
                –
                <input type="number" className={`${input} w-16`} placeholder="最大" value={filter.ranges[key]?.max ?? ""} onChange={(event) => setRange(key, "max", event.target.value)} aria-label={`${propertyDef(key).label} 上限`} />
              </span>
            ))}
            <label className="flex items-center gap-1" title="Lipinski 五规则：分子量 ≤ 500、cLogP ≤ 5、氢键供体 ≤ 5、氢键受体 ≤ 10，至多违反一条">
              <input type="checkbox" checked={filter.ruleOfFive} onChange={(event) => onFilter({ ...filter, ruleOfFive: event.target.checked })} />
              符合五规则
            </label>
          </div>
        </div>
      )}
      {notes.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-(--c-8a5a00)" data-testid="filter-notes">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
