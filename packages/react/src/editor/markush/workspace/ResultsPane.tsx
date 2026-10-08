import { useMemo, useState } from "react"
import { downloadCsv, downloadSdf, downloadSmiles } from "../exportRows.ts"
import { runNotes } from "../notes.ts"
import { DEFAULT_LIMIT, progressText } from "../progressText.ts"
import { filterRows, rowsOf, type Row } from "../results.ts"
import { emptyReason } from "./emptyState.ts"
import { ResultGrid } from "./ResultGrid.tsx"
import { ResultsToolbar, type ResultOptions } from "./ResultsToolbar.tsx"
import type { WorkspaceProps } from "./types.ts"
import { useLiveEnumeration } from "./useLiveEnumeration.ts"

/**
 * The compounds the formula generates, kept up to date as it is edited: what was made, a
 * filter, the generation options, any compound put on the drawing, and the list as files.
 */
export function ResultsPane({ drawing, colorHetero, base, onPlace }: WorkspaceProps) {
  const empty = useMemo(() => emptyReason(drawing), [drawing])
  const [options, setOptions] = useState<ResultOptions>({ representatives: true, dedupe: true, limit: DEFAULT_LIMIT })
  const live = useLiveEnumeration(empty ? null : drawing, options)
  const { result, status } = live.run
  const [filter, setFilter] = useState("")
  const [notesOpen, setNotesOpen] = useState(false)
  const rows: Row[] = useMemo(() => (result ? rowsOf(result) : []), [result])
  const kept = useMemo(() => filterRows(rows, filter), [rows, filter])
  const notes = empty ? [] : runNotes(result, { limit: options.limit, status, dedupe: live.run.dedupe })
  const running = !empty && status === "running"
  const exporters = { csv: downloadCsv, sdf: downloadSdf, smi: downloadSmiles }

  return (
    <section className="flex h-full min-h-0 flex-col bg-white" data-testid="resultsPane" aria-label="生成结果">
      <ResultsToolbar
        summary={empty ? "" : progressText(live.run, options.limit)}
        running={running}
        onStop={live.run.stop}
        auto={live.auto}
        onAuto={live.setAuto}
        stale={!empty && live.stale}
        onRegenerate={live.regenerate}
        options={options}
        onOptions={setOptions}
        filter={filter}
        onFilter={setFilter}
        kept={empty ? 0 : kept.length}
        total={empty ? 0 : rows.length}
        notes={notes.length}
        notesOpen={notesOpen}
        onNotesOpen={setNotesOpen}
        onExport={(kind) => void exporters[kind](base, kept)}
      />
      {running && result && <Progress made={result.molecules.length} of={Math.min(result.total, options.limit)} />}
      {notesOpen && notes.length > 0 && (
        <ul className="max-h-24 list-disc space-y-0.5 overflow-y-auto border-b border-[#f0e2bf] bg-[#fffaf0] py-1.5 pr-3 pl-8 text-[12px] text-[#8a5a00]" data-testid="enumeration-notes">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {empty ? (
        <Empty title={empty.title} hint={empty.hint} />
      ) : kept.length > 0 ? (
        <ResultGrid key={filter} rows={kept} colorHetero={colorHetero} onPlace={onPlace} />
      ) : status !== "running" && rows.length > 0 ? (
        <Empty title="没有符合筛选条件的化合物" hint="换一个词试试，或清空筛选框。" />
      ) : status !== "running" ? (
        <Empty title="没有可以生成的化合物" hint={notes.length > 0 ? "点上面的“提示”看看原因。" : "检查右边的变量是否都填了候选项。"} />
      ) : null}
    </section>
  )
}

/** A thin bar under the toolbar while generating. */
function Progress({ made, of }: { made: number; of: number }) {
  return (
    <div className="h-0.5 bg-[#e8eefa]">
      <div className="h-full bg-[#1a73e8] transition-[width]" style={{ width: `${of > 0 ? Math.min(100, (made / of) * 100) : 0}%` }} />
    </div>
  )
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-4 text-center" data-testid="results-empty">
      <div className="text-[13px] font-medium text-[#555]">{title}</div>
      <div className="max-w-md text-[12px] leading-relaxed text-[#888]">{hint}</div>
    </div>
  )
}
