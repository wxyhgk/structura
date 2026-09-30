import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { sceneToSvg } from "@/chem/draw"
import { displayFormula, plainFormula } from "@/chem/formula"
import { enumerate } from "@/chem/markush/enumerate"
import { toMolfile } from "@/chem/molfile"
import type { Drawing } from "@/chem/types"
import { download } from "@/editor/browser"
import { useOverlayMark } from "@/editor/input/overlays"
import { representativeName } from "./describe.ts"

/** Generated at most; the SD file holds them all. */
const LIMIT = 500
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
  const result = useMemo(() => (open ? enumerate(drawing, { limit: LIMIT, representatives }) : null), [open, drawing, representatives])
  const pictures = useMemo(
    () => (result?.molecules ?? []).slice(0, SHOWN).map((mol) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sceneToSvg(mol, colorHetero))}`),
    [result, colorHetero],
  )
  const notes = result ? notesOf(result) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...overlayMark} className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>批量生成化合物</DialogTitle>
          <DialogDescription>
            {result && result.total > 0
              ? `共 ${result.total} 种组合，已生成 ${result.molecules.length} 个${result.molecules.length > SHOWN ? `，下面显示前 ${SHOWN} 个` : ""}。`
              : "没有可以生成的化合物。"}
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={representatives} onChange={(event) => setRepresentatives(event.target.checked)} />
          基团类别用代表结构展开（如烷基用甲基、乙基、异丙基、叔丁基）
        </label>
        {notes.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-[#8a5a00]">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        <div className="grid max-h-[55vh] grid-cols-4 gap-2 overflow-y-auto" data-testid="enumerated">
          {pictures.map((src, index) => (
            <figure key={index} className="rounded-sm border border-[#e0e0e0] bg-white p-1 text-center">
              <img src={src} alt="" className="mx-auto h-24 w-full object-contain" />
              <figcaption className="text-[11px] text-[#666]">
                {index + 1}. {displayFormula(plainFormula(result!.molecules[index]))}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            disabled={!result || result.molecules.length === 0}
            onClick={() => {
              const sdf = result!.molecules.map((mol, index) => `${toMolfile(mol, `Structura ${index + 1}`)}$$$$\n`).join("")
              download("通式展开.sdf", sdf, "chemical/x-mdl-sdfile")
            }}
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

/** What the user should know about what was, and was not, generated. */
function notesOf(result: ReturnType<typeof enumerate>): string[] {
  const notes: string[] = []
  for (const [name, labels] of Object.entries(result.represented)) {
    notes.push(`${name} 的基团类别用代表结构展开：${labels.map(representativeName).join("、")}。`)
  }
  if (result.onlyClasses.length > 0) {
    notes.push(`${result.onlyClasses.join("、")} 只有基团类别，且没有可用的代表结构；请勾选上面的选项，或补充具体候选项（如 H、Me、Ph）。`)
  }
  for (const [name, count] of Object.entries(result.classesLeftOut)) {
    if (!result.onlyClasses.includes(name)) notes.push(`${name} 有 ${count} 个基团类别没有展开，只用了具体候选项。`)
  }
  if (result.undefinedNames.length > 0) notes.push(`${result.undefinedNames.join("、")} 还没有候选项，生成的结构里保留为占位符。`)
  if (result.failed > 0) {
    const first = result.failures[0]
    notes.push(`${result.failed} 种组合没能生成，例如 ${first.choice.map((item) => `${item.name} = ${item.text}`).join("，")}（${first.error}）。`)
  }
  if (result.total > result.molecules.length + result.failed) notes.push(`组合太多，只生成了前 ${LIMIT} 种。`)
  return notes
}
