import { useMemo, useState } from "react"
import { failure } from "../../editor/browser.ts"
import { useSave } from "../../editor/save.ts"
import { downloadCompoundTable, downloadCsv, downloadSdf, downloadSmiles, downloadTableCdxml, downloadWord, exportNote } from "../exportRows.ts"
import { runNotes } from "../notes.ts"
import { generationOf } from "../generation.ts"
import { progressText } from "../progressText.ts"
import { sortNeedsRdkit, type Sort } from "../resultColumns.ts"
import { rowsOf, type Row } from "../results.ts"
import { filterActive, needsRdProps, NO_FILTER, type RowFilter } from "../rowFilter.ts"
import { emptyReason } from "./emptyState.ts"
import { CompoundTableDialog } from "./CompoundTableDialog.tsx"
import { ExportAllDialog } from "./ExportAllDialog.tsx"
import { NumberingControls } from "./NumberingControls.tsx"
import { ResultGrid } from "./ResultGrid.tsx"
import { ResultTable } from "./ResultTable.tsx"
import { ResultsToolbar, type ResultOptions } from "./ResultsToolbar.tsx"
import { ResultsViewBar } from "./ResultsViewBar.tsx"
import type { WorkspaceProps } from "./types.ts"
import { useGenerationInput } from "./useGenerationInput.ts"
import { useLiveEnumeration } from "./useLiveEnumeration.ts"
import { useNumbering } from "./useNumbering.ts"
import { useRdkit } from "./useRdkit.ts"
import { useResultsView } from "./useResultsView.ts"
import { useTableSettings } from "./useTableSettings.ts"
import { useViewMode } from "./useViewMode.ts"

/**
 * The compounds the formula generates, kept up to date as it is edited: what was made, a
 * filter, the generation options, any compound put on the drawing, and the list as files.
 * `active` is false while it is out of sight (a compact editor's other panes): it then keeps
 * what it has and does not generate again until it is shown.
 */
export function ResultsPane({ drawing, run, colorHetero, base, onPlace, wordExport, active = true }: WorkspaceProps & { active?: boolean }) {
  const empty = useMemo(() => emptyReason(drawing), [drawing])
  // The generation options are the document's (the same file generates the same compounds for anyone).
  const options = generationOf(drawing)
  const setOptions = (next: ResultOptions) => void run([{ op: "set_generation", generation: next }], { keepSelection: true })
  const input = useGenerationInput(drawing)
  const live = useLiveEnumeration(empty ? null : input, options, active)
  const { result, status } = live.run
  const [filter, setFilter] = useState<RowFilter>(NO_FILTER)
  const [sort, setSort] = useState<Sort>(null)
  const [view, setView] = useViewMode()
  /** What the downloads hold while a filter is in force. */
  const [scope, setScope] = useState<"kept" | "all">("kept")
  /** What the last download could not do (compounds RDKit cannot read, RDKit missing). */
  const [downloadNote, setDownloadNote] = useState<string | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const rows: Row[] = useMemo(() => (result ? rowsOf(result) : []), [result])
  const table = useTableSettings()
  const [tableOpen, setTableOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  /** Counts the times 导出全部 was opened: a new dialog each time, counting the library afresh. */
  const [allOpened, setAllOpened] = useState(0)
  /** Counts the times 化合物表 was opened: a new dialog each time, asking afresh what Word can be made. */
  const [tableOpened, setTableOpened] = useState(0)
  // Numbered by the document's numbers, the whole list: a filter or a sort only chooses what is shown, and in what order.
  const numbers = useNumbering({ drawing, run, rows, bySmiles: live.run.dedupe === "on", fallback: table.numbering })
  const filtered = filterActive(filter)
  const rdkit = useRdkit(view === "table" || filter.structure.trim() !== "" || needsRdProps(filter) || sortNeedsRdkit(sort))
  const shown = useResultsView(numbers.rows, filter, sort, rdkit)
  const kept = shown.rows
  const exported = filtered && scope === "all" ? numbers.rows : kept
  const notes = empty ? [] : runNotes(result, { limit: options.limit, status, dedupe: live.run.dedupe })
  const running = !empty && status === "running"
  const save = useSave()
  /** A new filter or sort starts the list again from its first page. */
  const viewKey = JSON.stringify([filter, sort])
  const exporters = { csv: downloadCsv, sdf: downloadSdf, smi: downloadSmiles }
  const download = (kind: keyof typeof exporters) => {
    setDownloadNote(null)
    // Downloading fixes the numbers, so the file and the document agree (the numbers shown are those written).
    numbers.pin()
    exporters[kind](save, base, exported).then(
      (report) => setDownloadNote(exportNote(kind, report)),
      (error: unknown) => setDownloadNote(`下载失败：${failure(error)}`),
    )
  }
  /** A click on a heading: ascending, then descending, then the order of generation. */
  const sortBy = (column: string) => setSort(sort?.column !== column ? { column, descending: false } : sort.descending ? null : { column, descending: true })

  return (
    <section className="flex h-full min-h-0 flex-col bg-(--c-ffffff)" data-testid="resultsPane" aria-label="生成结果">
      <ResultsToolbar
        // Nothing asked for yet (out of sight since the formula came): nothing to say, not "nothing to generate".
        summary={empty || (!result && status === "done" && live.run.error == null) ? "" : progressText(live.run, options.limit)}
        running={running}
        onStop={live.run.stop}
        auto={live.auto}
        onAuto={live.setAuto}
        stale={!empty && live.stale}
        onRegenerate={live.regenerate}
        options={options}
        onOptions={setOptions}
        filter={filter.text}
        onFilter={(text) => setFilter({ ...filter, text })}
        filtered={filtered}
        scope={scope}
        onScope={setScope}
        kept={empty ? 0 : kept.length}
        total={empty ? 0 : rows.length}
        notes={notes.length}
        notesOpen={notesOpen}
        onNotesOpen={setNotesOpen}
        numberControls={
          <NumberingControls
            numbering={numbers.numbering}
            onNumbering={(next) => {
              table.setNumbering(next)
              numbers.setNumbering(next)
            }}
            taken={numbers.taken}
            fresh={empty ? 0 : numbers.fresh}
            unstable={!empty && (!options.dedupe || live.run.dedupe === "unavailable")}
            onPin={numbers.pin}
            onRenumber={() => confirm("丢掉已有的编号，按现在的顺序从头编？已经写进专利的编号会变。可以撤销。") && numbers.renumber()}
          />
        }
        onExport={download}
        onExportAll={() => {
          setAllOpened(allOpened + 1)
          setAllOpen(true)
        }}
        onTable={() => {
          numbers.pin()
          setTableOpened(tableOpened + 1)
          setTableOpen(true)
        }}
      />
      <ExportAllDialog key={`all${allOpened}`} open={allOpen} onOpenChange={setAllOpen} drawing={drawing} representatives={options.representatives} dedupe={options.dedupe} numbering={{ ...numbers.numbering, assigned: drawing.numbering?.assigned }} base={base} save={save} />
      <ResultsViewBar view={view} onView={setView} filter={filter} onFilter={setFilter} sort={sort} columns={shown.columns} onSort={setSort} pending={empty ? 0 : shown.pending} notes={empty ? [] : shown.notes} disabled={empty != null || rows.length === 0} />
      {downloadNote && (
        <div className="flex items-start gap-2 border-b border-(--c-f0e2bf) bg-(--c-fffaf0) px-3 py-1 text-[12px] text-(--c-8a5a00)" role="status" data-testid="download-note">
          <span className="flex-1">{downloadNote}</span>
          <button type="button" className="px-1 hover:text-(--c-c5221f)" aria-label="关闭提示" onClick={() => setDownloadNote(null)}>
            ×
          </button>
        </div>
      )}
      <CompoundTableDialog
        key={tableOpened}
        open={tableOpen}
        onOpenChange={setTableOpen}
        rows={empty ? [] : exported}
        columns={table.columns}
        onColumns={table.setColumns}
        onCdxml={() => downloadTableCdxml(save, base, exported, table.columns)}
        onPackage={() => downloadCompoundTable(save, base, exported, table.columns)}
        wordExport={wordExport}
        onWord={() => downloadWord(save, base, exported, table.columns, wordExport)}
      />
      {running && result && <Progress made={result.molecules.length} of={Math.min(result.total, options.limit)} />}
      {notesOpen && notes.length > 0 && (
        <ul className="max-h-24 list-disc space-y-0.5 overflow-y-auto border-b border-(--c-f0e2bf) bg-(--c-fffaf0) py-1.5 pr-3 pl-8 text-[12px] text-(--c-8a5a00)" data-testid="enumeration-notes">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {empty ? (
        <Empty title={empty.title} hint={empty.hint} />
      ) : kept.length > 0 ? (
        view === "table" ? (
          <ResultTable key={viewKey} rows={kept} columns={shown.columns} sort={sort} onSort={sortBy} colorHetero={colorHetero} onPlace={onPlace} rdkit={rdkit} />
        ) : (
          <ResultGrid key={viewKey} rows={kept} colorHetero={colorHetero} onPlace={onPlace} />
        )
      ) : shown.pending > 0 ? (
        <Empty title="正在筛选…" hint="RDKit 正在逐个检查化合物，结果出来后会列在这里。" />
      ) : status !== "running" && rows.length > 0 ? (
        <Empty title="没有符合筛选条件的化合物" hint="换一个条件试试，或点上面的“清除全部筛选”。" />
      ) : status !== "running" ? (
        <Empty title={live.run.error != null ? "生成时出错" : "没有可以生成的化合物"} hint={live.run.error != null ? live.run.error : notes.length > 0 ? "点上面的“提示”看看原因。" : "检查右边的变量是否都填了候选项。"} />
      ) : null}
    </section>
  )
}

/** A thin bar under the toolbar while generating. */
function Progress({ made, of }: { made: number; of: number }) {
  return (
    <div className="h-0.5 bg-(--c-e8eefa)">
      <div className="h-full bg-(--c-1a73e8) transition-[width]" style={{ width: `${of > 0 ? Math.min(100, (made / of) * 100) : 0}%` }} />
    </div>
  )
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-4 text-center" data-testid="results-empty">
      <div className="text-[13px] font-medium text-(--c-555555)">{title}</div>
      <div className="max-w-md text-[12px] leading-relaxed text-(--c-888888)">{hint}</div>
    </div>
  )
}
