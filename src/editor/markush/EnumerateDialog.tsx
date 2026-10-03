import { memo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { displayFormula, plainFormula } from "@structura/core/formula"
import { pickFields } from "@structura/core/markush"
import { toSdf } from "@structura/core/molfile"
import type { Drawing, Molecule } from "@structura/core/types"
import { download } from "@/editor/browser"
import { useOverlayMark } from "@/editor/input/overlays"
import { MoleculeThumb } from "@/editor/common/MoleculeThumb"
import { notesOf } from "./notes.ts"
import { useEnumeration, type EnumerationRun } from "./useEnumeration.ts"

/** How many to generate at most, for the user to pick; the SD file holds them all. */
const LIMITS = [100, 500, 2000]
/** Drawn in the grid; more only slows the dialog down. */
const SHOWN = 120

/** The generic formula expanded into concrete compounds: a preview grid and an SD file. */
export function EnumerateDialog({
  open,
  onOpenChange,
  drawing,
  colorHetero,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawing: Drawing
  colorHetero: boolean
}) {
  const overlayMark = useOverlayMark()
  const [representatives, setRepresentatives] = useState(true)
  const [limit, setLimit] = useState(500)
  const run = useEnumeration(open ? drawing : null, { limit, representatives })
  const { result, status } = run
  const notes = result ? notesOf(result, { limit, status }) : []

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
        <div className="grid max-h-[55vh] grid-cols-4 gap-2 overflow-y-auto" data-testid="enumerated">
          {(result?.molecules ?? []).slice(0, SHOWN).map((mol, index) => (
            <Thumbnail key={index} mol={mol} number={index + 1} colorHetero={colorHetero} />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          {status === "running" && (
            <Button variant="outline" onClick={run.stop}>
              停止
            </Button>
          )}
          <Button
            disabled={!result || result.molecules.length === 0}
            onClick={() => download("通式展开.sdf", toSdf(result!.molecules, "Structura", result!.picks.map(pickFields)), "chemical/x-mdl-sdfile")}
          >
            下载 SDF
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
  return `共 ${result.total} 种组合，已生成 ${made} 个${shown}${status === "stopped" ? "（已停止）" : ""}。`
}

/** One generated compound, numbered, with its formula. */
const Thumbnail = memo(function Thumbnail({ mol, number, colorHetero }: { mol: Molecule; number: number; colorHetero: boolean }) {
  return (
    <figure className="rounded-sm border border-[#e0e0e0] bg-white p-1 text-center">
      <MoleculeThumb mol={mol} colorHetero={colorHetero} className="mx-auto h-24 w-full object-contain" />
      <figcaption className="text-[11px] text-[#666]">
        {number}. {displayFormula(plainFormula(mol))}
      </figcaption>
    </figure>
  )
})
