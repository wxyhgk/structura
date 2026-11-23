import { useEffect, useMemo, useRef, useState } from "react"
import { librarySize } from "@structura/markush"
import type { CompoundNumbering } from "@structura/markush"
import type { Drawing } from "@structura/core/types"
import { Button } from "../../../components/ui/button.tsx"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog.tsx"
import { useOverlayMark } from "../../input/overlays.ts"
import type { Save } from "../../save.ts"
import { loadRDKit } from "../../rdkit.ts"
import { CONFIRM_ABOVE, EXPORT_CAP, EXPORT_TYPES, exportAll, type ExportAllKind, type ExportAllProgress } from "../exportAll.ts"
import { canonicalIdentity, canonicalSmiles } from "../identity.ts"
import { numberText, rowKey, type Numbering } from "../numbering.ts"
import { totalText } from "../sizeText.ts"

/**
 * The whole library as one CSV or SD file, however many compounds there are: nothing is
 * drawn on the page, the file is written as the compounds are made, in slices (with 取消),
 * with the same columns and fields as 下载 above. The generation limit and the filter do not
 * apply; the options for classes and repeats do. A compound whose number is fixed in the document
 * is written with it; the others with none (a number for each of a whole library is not kept).
 * Asks first when the library is big.
 * Remounted each time it opens (the pane gives it a new key), so it starts fresh.
 */
export function ExportAllDialog({
  open,
  onOpenChange,
  drawing,
  representatives,
  dedupe,
  numbering,
  base,
  save,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawing: Drawing
  representatives: boolean
  dedupe: boolean
  /** The document's numbers: how they are written, and which compound has which. */
  numbering: Numbering & Pick<CompoundNumbering, "assigned">
  base: string
  save: Save
}) {
  const overlayMark = useOverlayMark()
  const [run, setRun] = useState<{ kind: ExportAllKind; progress: ExportAllProgress | null } | null>(null)
  const [message, setMessage] = useState<{ text: string; failed?: boolean } | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const stop = useRef<AbortController | null>(null)
  // How big the library is: counted when the dialog opens (not generated, so quick), for the drawing as it is then.
  const size = useMemo(() => {
    if (!open) return null
    try {
      return librarySize(drawing, { representatives })
    } catch {
      return null
    }
  }, [open, drawing, representatives])
  useEffect(() => () => stop.current?.abort(), [])

  const big = size != null && size.combinations > CONFIRM_ABOVE
  const blocked = size != null && size.onlyClasses.length > 0
  const empty = size != null && !blocked && size.combinations === 0

  async function start(kind: ExportAllKind) {
    const controller = new AbortController()
    stop.current = controller
    setMessage(null)
    setRun({ kind, progress: null })
    try {
      // RDKit gives the SMILES column and tells repeats apart; CSV cannot be made without it, SDF can.
      let rdkit: Awaited<ReturnType<typeof loadRDKit>> | null = null
      try {
        rdkit = await loadRDKit()
      } catch {
        if (kind === "csv") throw new Error("没能加载 RDKit，写不出 SMILES 列")
      }
      const identity = rdkit ? canonicalIdentity(rdkit) : null
      const outcome = await exportAll(drawing, {
        kind,
        representatives,
        identities: dedupe && rdkit && identity ? { identity, identifySmiles: canonicalSmiles(rdkit) } : undefined,
        smiles: identity ?? (() => null),
        numbering,
        // Told apart as the page tells them (canonical SMILES when repeats are dropped, else what each variable became).
        numberOf: (row, identity) => {
          const n = numbering.assigned?.[identity ? `s:${identity}` : rowKey(row, undefined)]
          return n == null ? "" : numberText(numbering.pattern, n)
        },
        signal: controller.signal,
        onProgress: (progress) => setRun({ kind, progress }),
      })
      if (outcome.cancelled) return setMessage({ text: "已取消，没有写文件。" })
      const name = `${base} 全部展开.${EXPORT_TYPES[kind].extension}`
      save(name, outcome.file, EXPORT_TYPES[kind].type)
      const left = [outcome.duplicates > 0 && `合并了 ${outcome.duplicates} 个重复的`, outcome.excluded > 0 && `按附加条件排除了 ${outcome.excluded} 个`, outcome.failed > 0 && `${outcome.failed} 种组合没能生成`].filter(Boolean)
      setMessage({
        text: `已导出 ${outcome.written} 个化合物到“${name}”${left.length > 0 ? `（${left.join("，")}）` : ""}${outcome.capped ? `；到 ${EXPORT_CAP.toLocaleString("zh-CN")} 个为止，其余没有导出` : ""}。${dedupe && !rdkit ? "没能加载 RDKit，没有去掉重复的化合物。" : ""}`,
      })
    } catch (error) {
      setMessage({ text: `导出失败：${error instanceof Error ? error.message : String(error)}`, failed: true })
    } finally {
      stop.current = null
      setRun(null)
    }
  }

  const running = run != null
  const progress = run?.progress
  const needConfirm = big && !confirmed
  return (
    <Dialog open={open} onOpenChange={(next) => !running && onOpenChange(next)}>
      <DialogContent {...overlayMark} className="sm:max-w-lg" data-testid="export-all-dialog">
        <DialogHeader>
          <DialogTitle>导出全部</DialogTitle>
          <DialogDescription>
            把整个库写成一个文件，不受“最多生成”和筛选的限制，也不在页面上画结构；列和下载的 CSV、SDF 一样，只是不含 cLogP、TPSA 这些要 RDKit 逐个算的性质。固定过编号的化合物带着它的编号，其余的编号一栏空着。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-[13px] text-(--c-555555)" data-testid="export-all-size">
          {size == null ? (
            <p>数不出这个通式的规模。</p>
          ) : blocked ? (
            <p>{size.onlyClasses.join("、")} 只有基团类别，没有具体候选项，还不能生成。</p>
          ) : (
            <p>
              全库共 <span className="font-medium text-(--c-222222)">{totalText(size.combinations, size.estimated)}</span> 种组合
              {representatives ? "（基团类别按代表结构展开）" : ""}。
              {dedupe ? "写出时去掉重复的化合物（按标准 SMILES 判断，已写出的都要记在内存里）。" : "没有勾选“去重”，每种组合写一条。"}
            </p>
          )}
          {big && (
            <p className="rounded-sm bg-(--c-fff4d6) px-2 py-1.5 text-(--c-8a5a00)" data-testid="export-all-warning">
              组合很多：导出要花几分钟甚至更久，文件也会很大（一个文件最多写 {EXPORT_CAP.toLocaleString("zh-CN")} 个）。导出时页面照常能用，随时可以取消。
              <label className="mt-1 flex items-center gap-1.5">
                <input type="checkbox" checked={confirmed} disabled={running} onChange={(event) => setConfirmed(event.target.checked)} />
                我知道了，仍然导出
              </label>
            </p>
          )}
          {empty && <p>没有可以生成的化合物。</p>}
        </div>
        {running && (
          <div className="space-y-1.5" data-testid="export-all-progress">
            <div className="h-1.5 overflow-hidden rounded-full bg-(--c-e8eefa)">
              <div className="h-full bg-(--c-1a73e8) transition-[width]" style={{ width: `${progress && progress.total > 0 ? Math.min(100, (progress.tried / progress.total) * 100) : 0}%` }} />
            </div>
            <p className="text-[12px] text-(--c-555555)">
              {progress ? `已处理 ${progress.tried.toLocaleString("zh-CN")} / ${totalText(progress.total, size?.estimated)} 种组合，写出 ${progress.written.toLocaleString("zh-CN")} 个…` : "正在准备…"}
            </p>
          </div>
        )}
        {message && (
          <p className={`text-[13px] ${message.failed ? "text-(--c-c5221f)" : "text-(--c-1a7f37)"}`} data-testid="export-all-message">
            {message.text}
          </p>
        )}
        <div className="flex justify-end gap-2">
          {running ? (
            <Button size="sm" variant="outline" onClick={() => stop.current?.abort()}>
              取消
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" disabled={size == null || blocked || empty || needConfirm} onClick={() => void start("sdf")}>
                导出 SDF
              </Button>
              <Button size="sm" disabled={size == null || blocked || empty || needConfirm} onClick={() => void start("csv")}>
                导出 CSV
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
