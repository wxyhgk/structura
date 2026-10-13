import type { ReactNode } from "react"
import type { Numbering } from "../numbering.ts"
import { LIMITS } from "../progressText.ts"

export type ResultOptions = { representatives: boolean; dedupe: boolean; limit: number }

const button = "h-6 rounded-sm border border-[#d0d0d0] bg-white px-2 text-[12px] text-[#333] hover:bg-[#eef3fb] disabled:cursor-default disabled:text-[#aaa] disabled:hover:bg-white"

/**
 * The results pane's two control rows: what was generated (with 停止 while it runs, and
 * automatic updating), then the filter, the generation options, the notes and the downloads.
 */
export function ResultsToolbar({
  summary,
  running,
  onStop,
  auto,
  onAuto,
  stale,
  onRegenerate,
  options,
  onOptions,
  filter,
  onFilter,
  kept,
  total,
  notes,
  notesOpen,
  onNotesOpen,
  numbering,
  onNumbering,
  onExport,
  onTable,
}: {
  summary: string
  running: boolean
  onStop: () => void
  auto: boolean
  onAuto: (auto: boolean) => void
  /** Whether the drawing has changed since the shown results were generated. */
  stale: boolean
  onRegenerate: () => void
  options: ResultOptions
  onOptions: (options: ResultOptions) => void
  filter: string
  onFilter: (filter: string) => void
  /** How many the filter keeps, of `total`. */
  kept: number
  total: number
  notes: number
  notesOpen: boolean
  onNotesOpen: (open: boolean) => void
  /** How the compounds are numbered (C-1…): on the cards and in every download. */
  numbering: Numbering
  onNumbering: (numbering: Numbering) => void
  onExport: (kind: "csv" | "sdf" | "smi") => void
  /** Opens 导出化合物表 (a patent's table of compounds). */
  onTable: () => void
}) {
  return (
    <div className="border-b border-[#e3e3e3] bg-white px-3 pb-1.5 text-[12px] text-[#333]">
      <div className="flex h-9 items-center gap-2">
        <span className="text-[13px] font-semibold text-[#222]">生成结果</span>
        <span className="truncate text-[#555]" data-testid="results-summary">
          {summary}
        </span>
        {stale && auto && !running && <span className="text-[#888]">更新中…</span>}
        {stale && !auto && <span className="rounded-sm bg-[#fff4d6] px-1.5 text-[#8a5a00]">结构已修改，结果未更新</span>}
        {running && (
          <button type="button" className={button} onClick={onStop}>
            停止
          </button>
        )}
        {notes > 0 && (
          <button
            type="button"
            className="h-6 rounded-sm px-1.5 text-[#8a5a00] hover:bg-[#fff4d6]"
            aria-expanded={notesOpen}
            onClick={() => onNotesOpen(!notesOpen)}
            data-testid="notes-toggle"
          >
            {notesOpen ? "▾" : "▸"} 提示 ({notes})
          </button>
        )}
        <span className="ml-auto" />
        <label className="flex shrink-0 items-center gap-1" title="修改结构或变量后，停顿片刻自动重新生成">
          <input type="checkbox" checked={auto} onChange={(event) => onAuto(event.target.checked)} />
          自动更新
        </label>
        {(!auto || stale) && (
          <button type="button" className={`${button} ${stale ? "border-[#1a73e8] text-[#1a73e8]" : ""}`} onClick={onRegenerate}>
            重新生成
          </button>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5">
          <input
            className="h-6 w-56 rounded-sm border border-[#d0d0d0] bg-white px-2 text-[12px] outline-none focus:border-[#1a73e8] disabled:bg-[#f0f0f0]"
            placeholder="筛选：如 Cl、R1=OMe、C6H4"
            title="几个词都要满足；按分子式和各变量的取值筛选"
            value={filter}
            disabled={total === 0}
            onChange={(event) => onFilter(event.target.value)}
            aria-label="筛选生成的化合物"
          />
          {filter.trim() && (
            <span className="text-[#666]" data-testid="filter-count">
              {kept} / {total}
            </span>
          )}
        </span>
        <Option title="基团类别用代表结构展开（如烷基用甲基、乙基、异丙基、叔丁基）">
          <input type="checkbox" checked={options.representatives} onChange={(event) => onOptions({ ...options, representatives: event.target.checked })} />
          代表结构展开
        </Option>
        <Option title="去掉重复的化合物（对称位置、取 H 后相同的组合等，按 RDKit 标准 SMILES 判断）">
          <input type="checkbox" checked={options.dedupe} onChange={(event) => onOptions({ ...options, dedupe: event.target.checked })} />
          去重
        </Option>
        <Option title="组合太多时只生成前这么多个">
          最多生成
          <select className="h-6 rounded-sm border border-[#d0d0d0] bg-white px-1" value={options.limit} onChange={(event) => onOptions({ ...options, limit: Number(event.target.value) })}>
            {LIMITS.map((value) => (
              <option key={value} value={value}>
                {value} 个
              </option>
            ))}
          </select>
        </Option>
        <Option title="编号的写法：{n} 是编号所在的位置，如 C-{n} → C-1、C-2…；化合物{n}；1-{n}">
          编号
          <input
            className="h-6 w-20 rounded-sm border border-[#d0d0d0] bg-white px-1.5 text-[12px] outline-none focus:border-[#1a73e8]"
            value={numbering.pattern}
            placeholder="C-{n}"
            onChange={(event) => onNumbering({ ...numbering, pattern: event.target.value })}
            aria-label="编号的写法"
          />
          从
          <input
            type="number"
            className="h-6 w-14 rounded-sm border border-[#d0d0d0] bg-white px-1 text-[12px] outline-none focus:border-[#1a73e8]"
            value={numbering.start}
            onChange={(event) => onNumbering({ ...numbering, start: Math.trunc(Number(event.target.value)) || 0 })}
            aria-label="起始编号"
          />
        </Option>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="text-[#888]">{filter.trim() && kept > 0 ? `下载筛选出的 ${kept} 个` : "下载"}</span>
          <button type="button" className={button} disabled={kept === 0} onClick={() => onExport("csv")}>
            CSV
          </button>
          <button type="button" className={button} disabled={kept === 0} onClick={() => onExport("sdf")}>
            SDF
          </button>
          <button type="button" className={button} disabled={kept === 0} onClick={() => onExport("smi")}>
            SMILES
          </button>
          <button type="button" className={`${button} border-[#1a73e8] text-[#1a73e8]`} disabled={kept === 0} onClick={onTable} title="像专利那样：结构一行、编号一行（ChemDraw 整表，或 Word 表格用的包）">
            化合物表…
          </button>
        </span>
      </div>
    </div>
  )
}

function Option({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label className="flex shrink-0 items-center gap-1" title={title}>
      {children}
    </label>
  )
}
