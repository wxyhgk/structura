import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Drawing, Molecule } from "@structura/core/types"
import { useOverlayMark } from "@/editor/input/overlays"
import { CompoundThumbnail } from "./CompoundThumbnail.tsx"
import { downloadCsv, downloadSdf, downloadSmiles } from "./exportRows.ts"
import { runNotes } from "./notes.ts"
import { DEFAULT_LIMIT, LIMITS, progressText } from "./progressText.ts"
import { filterRows, rowsOf, type Row } from "./results.ts"
import { useEnumeration } from "./useEnumeration.ts"

/** Drawn in the grid; more only slows the dialog down. */
const SHOWN = 120

/**
 * The generic formula expanded into concrete compounds: a grid showing what each variable
 * became, a filter, any compound put on the canvas, and the list as SD, SMILES or CSV.
 */
export function EnumerateDialog({
  open,
  onOpenChange,
  drawing,
  colorHetero,
  base,
  onPlace,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawing: Drawing
  colorHetero: boolean
  /** The document's name, for the files written. */
  base: string
  /** Puts one generated compound on the canvas (as one undoable step). */
  onPlace: (mol: Molecule) => void
}) {
  const overlayMark = useOverlayMark()
  const [representatives, setRepresentatives] = useState(true)
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
  const [dedupe, setDedupe] = useState(true)
  const run = useEnumeration(open ? drawing : null, { limit, representatives, dedupe })
  const { result, status } = run
  const [filter, setFilter] = useState("")
  const rows: Row[] = useMemo(() => (result ? rowsOf(result) : []), [result])
  const kept = useMemo(() => filterRows(rows, filter), [rows, filter])
  const notes = runNotes(result, { limit, status, dedupe: run.dedupe })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...overlayMark} className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>批量生成化合物</DialogTitle>
          <DialogDescription data-testid="enumeration-progress">{progressText(run, limit, SHOWN)}</DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={representatives} onChange={(event) => setRepresentatives(event.target.checked)} />
          基团类别用代表结构展开（如烷基用甲基、乙基、异丙基、叔丁基）
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={dedupe} onChange={(event) => setDedupe(event.target.checked)} />
          去掉重复的化合物（对称位置、取 H 后相同的组合等，按 RDKit 标准 SMILES 判断）
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          最多生成
          <select className="rounded-sm border border-[#ccc] px-1 py-0.5" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            {LIMITS.map((value) => (
              <option key={value} value={value}>
                {value} 个
              </option>
            ))}
          </select>
        </label>
        {notes.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-[#8a5a00]">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        {rows.length > 0 && (
          <label className="flex items-center gap-2 text-[13px]">
            筛选
            <input
              className="h-7 flex-1 rounded-sm border border-[#d0d0d0] px-2 text-[13px] outline-none focus:border-[#1a73e8]"
              placeholder="如 Cl、R1=OMe、C6H4（几个词都要满足）"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="筛选生成的化合物"
            />
            {filter.trim() && <span className="text-[12px] text-[#666]" data-testid="filter-count">{kept.length} / {rows.length}</span>}
          </label>
        )}
        <div className="grid max-h-[50vh] grid-cols-4 gap-2 overflow-y-auto" data-testid="enumerated">
          {kept.slice(0, SHOWN).map((row) => (
            <CompoundThumbnail
              key={row.number}
              row={row}
              colorHetero={colorHetero}
              onPlace={() => {
                onPlace(row.mol)
                onOpenChange(false)
              }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          {status === "running" && (
            <Button variant="outline" onClick={run.stop}>
              停止
            </Button>
          )}
          <span className="mr-auto self-center text-[12px] text-[#888]">{filter.trim() ? `下载的是筛选出的 ${kept.length} 个` : ""}</span>
          <Button
            variant="outline"
            disabled={kept.length === 0}
            onClick={() => downloadSdf(base, kept)}
          >
            下载 SDF
          </Button>
          <Button variant="outline" disabled={kept.length === 0} onClick={() => void downloadSmiles(base, kept)}>
            SMILES
          </Button>
          <Button variant="outline" disabled={kept.length === 0} onClick={() => void downloadCsv(base, kept)}>
            CSV
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
