import type { ReactNode } from "react"
import { LIMITS } from "../progressText.ts"

export type ResultOptions = { representatives: boolean; dedupe: boolean; limit: number; order: "first" | "spread" }

const button = "h-6 rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) px-2 text-[12px] text-(--c-333333) hover:bg-(--c-eef3fb) disabled:cursor-default disabled:text-(--c-aaaaaa) disabled:hover:bg-(--c-ffffff)"

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
  filtered,
  scope,
  onScope,
  kept,
  total,
  notes,
  notesOpen,
  onNotesOpen,
  numberControls,
  onExport,
  onExportAll,
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
  /** Whether any filter (the words, a structure, a range) is in force. */
  filtered: boolean
  /** What the downloads hold when filtered: what the filter keeps, or every compound generated. */
  scope: "kept" | "all"
  onScope: (scope: "kept" | "all") => void
  /** How many the filter keeps, of `total`. */
  kept: number
  total: number
  notes: number
  notesOpen: boolean
  onNotesOpen: (open: boolean) => void
  /** How the compounds are numbered (C-1…, on the cards and in every download), and where the numbers stand. */
  numberControls: ReactNode
  onExport: (kind: "csv" | "sdf" | "smi") => void
  /** Opens 导出全部 (the whole library as a file, however many compounds there are). */
  onExportAll: () => void
  /** Opens 导出化合物表 (a patent's table of compounds). */
  onTable: () => void
}) {
  /** How many the downloads hold. */
  const exporting = filtered && scope === "all" ? total : kept
  return (
    <div className="border-b border-(--c-e3e3e3) bg-(--c-ffffff) px-3 pb-1.5 text-[12px] text-(--c-333333)">
      <div className="flex h-9 items-center gap-2">
        <span className="text-[13px] font-semibold text-(--c-222222)">生成结果</span>
        <span className="truncate text-(--c-555555)" data-testid="results-summary">
          {summary}
        </span>
        {stale && auto && !running && <span className="text-(--c-888888)">更新中…</span>}
        {stale && !auto && <span className="rounded-sm bg-(--c-fff4d6) px-1.5 text-(--c-8a5a00)">结构已修改，结果未更新</span>}
        {running && (
          <button type="button" className={button} onClick={onStop}>
            停止
          </button>
        )}
        {notes > 0 && (
          <button
            type="button"
            className="h-6 rounded-sm px-1.5 text-(--c-8a5a00) hover:bg-(--c-fff4d6)"
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
          <button type="button" className={`${button} ${stale ? "border-(--c-1a73e8) text-(--c-1a73e8)" : ""}`} onClick={onRegenerate}>
            重新生成
          </button>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5">
          <input
            className="h-6 w-56 rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) px-2 text-[12px] outline-none focus:border-(--c-1a73e8) disabled:bg-(--c-f0f0f0)"
            placeholder="筛选：R1=H、N、N2、Cl"
            title={"空格或逗号隔开，几个条件都要满足：\nR1=H  变量 R1 取这个值（R1=H|Cl 取其中之一，R1!=H 不取）\nN  含氮，N2  恰好 2 个，N2+  至少 2 个，N0  没有\n式2  来自第 2 个式子\n其他文字在变量名和取值里找"}
            value={filter}
            disabled={total === 0}
            onChange={(event) => onFilter(event.target.value)}
            aria-label="筛选生成的化合物"
          />
          {filtered && (
            <span className="text-(--c-666666)" data-testid="filter-count">
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
        <Option title="组合太多时最多生成这么多个（怎么取见“取样”）；要全部，用“导出全部”">
          最多生成
          <select className="h-6 rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) px-1" value={options.limit} aria-label="最多生成" onChange={(event) => onOptions({ ...options, limit: Number(event.target.value) })}>
            {LIMITS.map((value) => (
              <option key={value} value={value}>
                {value} 个
              </option>
            ))}
          </select>
        </Option>
        <Option title="组合比“最多生成”多时怎么取：按顺序是最前面的那些（靠前的变量一直停在第一个候选项上）；均匀分布是在全部组合里等间隔取，每个变量的各个候选项、各种连接位置和重复次数都轮到。组合不多于上限时两者一样。">
          取样
          <select className="h-6 rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) px-1" value={options.order} onChange={(event) => onOptions({ ...options, order: event.target.value as ResultOptions["order"] })} aria-label="取样方式">
            <option value="spread">均匀分布</option>
            <option value="first">按顺序</option>
          </select>
        </Option>
        {numberControls}
        <span className="ml-auto flex items-center gap-1.5">
          {filtered ? (
            <label className="flex items-center gap-1 text-(--c-888888)" title="筛选只决定下载哪些，编号不变">
              下载
              <select className="h-6 rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) px-1 text-(--c-333333)" value={scope} onChange={(event) => onScope(event.target.value as "kept" | "all")} aria-label="下载的范围" data-testid="export-scope">
                <option value="kept">筛选出的 {kept} 个</option>
                <option value="all">全部 {total} 个</option>
              </select>
            </label>
          ) : (
            <span className="text-(--c-888888)">{total > 0 ? `下载全部 ${total} 个` : "下载"}</span>
          )}
          <button type="button" className={button} disabled={exporting === 0} onClick={() => onExport("csv")}>
            CSV
          </button>
          <button type="button" className={button} disabled={exporting === 0} onClick={() => onExport("sdf")}>
            SDF
          </button>
          <button type="button" className={button} disabled={exporting === 0} onClick={() => onExport("smi")}>
            SMILES
          </button>
          <button type="button" className={button} disabled={total === 0} onClick={onExportAll} title="不受“最多生成”和筛选限制，把整个库写成 CSV 或 SDF 文件，几万、几十万个也行">
            导出全部…
          </button>
          <button type="button" className={`${button} border-(--c-1a73e8) text-(--c-1a73e8)`} disabled={exporting === 0} onClick={onTable} title="像专利那样：结构一行、编号一行（ChemDraw 整表，或 Word 表格用的包）">
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
