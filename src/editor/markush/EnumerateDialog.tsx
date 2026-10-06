import { memo, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { displayFormula, plainFormula } from "@structura/core/formula"
import { pickFields } from "@structura/markush"
import { toSdf } from "@structura/core/molfile"
import type { Drawing, Molecule } from "@structura/core/types"
import { download } from "@/editor/browser"
import { useOverlayMark } from "@/editor/input/overlays"
import { MoleculeThumb } from "@/editor/common/MoleculeThumb"
import { notesOf } from "./notes.ts"
import { canonicalIdentity } from "./identity.ts"
import { filterRows, picksText, rowsToCsv, rowsToSmiles, type Row } from "./results.ts"
import { useEnumeration, type EnumerationRun } from "./useEnumeration.ts"
import { loadRDKit } from "@/editor/rdkit"

/** How many to generate at most, for the user to pick; the SD file holds them all. */
const LIMITS = [100, 500, 2000]
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
  const [limit, setLimit] = useState(500)
  const [dedupe, setDedupe] = useState(true)
  const run = useEnumeration(open ? drawing : null, { limit, representatives, dedupe })
  const { result, status } = run
  const [filter, setFilter] = useState("")
  const rows: Row[] = useMemo(() => (result ? result.molecules.map((mol, index) => ({ number: index + 1, mol, picks: result.picks[index] })) : []), [result])
  const kept = useMemo(() => filterRows(rows, filter), [rows, filter])
  /** Writes the kept rows as SMILES-bearing text; RDKit is loaded for it on first use. */
  async function exportWith(write: (rows: Row[], smiles: (mol: Molecule) => string) => string, extension: string, type: string) {
    const rdkit = await loadRDKit()
    const identity = canonicalIdentity(rdkit)
    download(`${base} 展开.${extension}`, write(kept, (mol) => identity(mol) ?? ""), type)
  }
  const notes = [
    ...(result ? notesOf(result, { limit, status }) : []),
    ...(run.dedupe === "unavailable" ? ["没能加载 RDKit，这次没有去掉重复的化合物。"] : []),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...overlayMark} className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>批量生成化合物</DialogTitle>
          <DialogDescription data-testid="enumeration-progress">{progressText(run, limit)}</DialogDescription>
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
            <Thumbnail
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
            onClick={() => download(`${base} 展开.sdf`, toSdf(kept.map((row) => row.mol), "Structura", kept.map((row) => pickFields(row.picks))), "chemical/x-mdl-sdfile")}
          >
            下载 SDF
          </Button>
          <Button variant="outline" disabled={kept.length === 0} onClick={() => void exportWith(rowsToSmiles, "smi", "chemical/x-daylight-smiles")}>
            SMILES
          </Button>
          <Button variant="outline" disabled={kept.length === 0} onClick={() => void exportWith(rowsToCsv, "csv", "text/csv")}>
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

/** The line under the title: progress while generating, then what was made. */
function progressText({ result, status }: EnumerationRun, limit: number): string {
  if (!result) return status === "running" ? "正在生成…" : "没有可以生成的化合物。"
  const made = result.molecules.length
  if (status === "running") return `正在生成：已生成 ${made} / 共 ${Math.min(result.total, limit)}…`
  if (result.total === 0) return "没有可以生成的化合物。"
  const shown = made > SHOWN ? `，下面显示前 ${SHOWN} 个` : ""
  const repeats = result.duplicates > 0 ? `（合并了 ${result.duplicates} 个重复的）` : ""
  return `共 ${result.total} 种组合，得到 ${made} 个${result.duplicates > 0 ? "不同的" : ""}化合物${repeats}${shown}${status === "stopped" ? "（已停止）" : ""}。`
}

/** One generated compound: numbered, its formula, what its variables became, and a way onto the canvas. */
const Thumbnail = memo(function Thumbnail({ row, colorHetero, onPlace }: { row: Row; colorHetero: boolean; onPlace: () => void }) {
  const picks = picksText(row.picks)
  return (
    <figure className="group relative rounded-sm border border-[#e0e0e0] bg-white p-1 text-center" data-testid="enumerated-compound">
      <MoleculeThumb mol={row.mol} colorHetero={colorHetero} className="mx-auto h-24 w-full object-contain" />
      <figcaption className="text-[11px] text-[#666]">
        {row.number}. {displayFormula(plainFormula(row.mol))}
        {picks && (
          <span className="block truncate text-[10px] text-[#888]" title={picks}>
            {picks}
          </span>
        )}
      </figcaption>
      <button
        type="button"
        className="absolute top-1 right-1 rounded-sm bg-[#1a73e8] px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
        onClick={onPlace}
      >
        放到画布
      </button>
    </figure>
  )
})
