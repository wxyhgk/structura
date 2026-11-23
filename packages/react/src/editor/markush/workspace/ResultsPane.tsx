import { useMemo, useState } from "react"
import { useSave } from "../../save.ts"
import { downloadCompoundTable, downloadCsv, downloadSdf, downloadSmiles, downloadTableCdxml, downloadWord } from "../exportRows.ts"
import { runNotes } from "../notes.ts"
import { generationOf } from "../generation.ts"
import { progressText } from "../progressText.ts"
import { filterRows, rowsOf, type Row } from "../results.ts"
import { emptyReason } from "./emptyState.ts"
import { CompoundTableDialog } from "./CompoundTableDialog.tsx"
import { NumberingControls } from "./NumberingControls.tsx"
import { ResultGrid } from "./ResultGrid.tsx"
import { ResultsToolbar, type ResultOptions } from "./ResultsToolbar.tsx"
import type { WorkspaceProps } from "./types.ts"
import { useGenerationInput } from "./useGenerationInput.ts"
import { useLiveEnumeration } from "./useLiveEnumeration.ts"
import { useNumbering } from "./useNumbering.ts"
import { useTableSettings } from "./useTableSettings.ts"

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
  const [filter, setFilter] = useState("")
  const [notesOpen, setNotesOpen] = useState(false)
  const rows: Row[] = useMemo(() => (result ? rowsOf(result) : []), [result])
  const table = useTableSettings()
  const [tableOpen, setTableOpen] = useState(false)
  /** Counts the times 化合物表 was opened: a new dialog each time, asking afresh what Word can be made. */
  const [tableOpened, setTableOpened] = useState(0)
  // Numbered by the document's numbers, the whole list: a filter only chooses what is shown.
  const numbers = useNumbering({ drawing, run, rows, bySmiles: live.run.dedupe === "on", fallback: table.numbering })
  const kept = useMemo(() => filterRows(numbers.rows, filter), [numbers.rows, filter])
  const notes = empty ? [] : runNotes(result, { limit: options.limit, status, dedupe: live.run.dedupe })
  const running = !empty && status === "running"
  const save = useSave()
  const exporters = { csv: downloadCsv, sdf: downloadSdf, smi: downloadSmiles }

  return (
    <section className="flex h-full min-h-0 flex-col bg-(--c-ffffff)" data-testid="resultsPane" aria-label="生成结果">
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
        // Downloading fixes the numbers, so the file and the document agree.
        onExport={(kind) => void exporters[kind](save, base, filterRows(numbers.pin(), filter))}
        onTable={() => {
          numbers.pin()
          setTableOpened(tableOpened + 1)
          setTableOpen(true)
        }}
      />
      <CompoundTableDialog
        key={tableOpened}
        open={tableOpen}
        onOpenChange={setTableOpen}
        rows={empty ? [] : kept}
        columns={table.columns}
        onColumns={table.setColumns}
        onCdxml={() => downloadTableCdxml(save, base, kept, table.columns)}
        onPackage={() => downloadCompoundTable(save, base, kept, table.columns)}
        wordExport={wordExport}
        onWord={() => downloadWord(save, base, kept, table.columns, wordExport)}
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
        <ResultGrid key={filter} rows={kept} colorHetero={colorHetero} onPlace={onPlace} />
      ) : status !== "running" && rows.length > 0 ? (
        <Empty title="没有符合筛选条件的化合物" hint="换一个词试试，或清空筛选框。" />
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
