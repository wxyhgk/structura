import { useEffect, useState } from "react"
import { Button } from "../../../components/ui/button.tsx"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog.tsx"
import { useOverlayMark } from "../../input/overlays.ts"
import type { WordResult } from "../exportRows.ts"
import { rowName, type Row } from "../results.ts"
import type { WordExport } from "../wordExport.ts"

const COLUMNS = [2, 3, 4, 5, 6]

/**
 * The generated compounds as a patent's table of compounds: how many to a row, then a Word
 * document (editable ChemDraw objects when the host can make them, else pictures), the whole
 * table as one ChemDraw document, or the package a Word table is built from elsewhere
 * (chem2office). Structures are drawn in full, at one bond length, each under its number.
 */
export function CompoundTableDialog({
  open,
  onOpenChange,
  rows,
  columns,
  onColumns,
  onCdxml,
  onPackage,
  wordExport,
  onWord,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The compounds, numbered, in the table's order. */
  rows: readonly Row[]
  columns: number
  onColumns: (columns: number) => void
  onCdxml: () => void
  onPackage: () => Promise<void>
  /** The host's way to editable Word; asked, when the dialog opens, whether it can now. */
  wordExport?: WordExport
  onWord: () => Promise<WordResult>
}) {
  const overlayMark = useOverlayMark()
  const [busy, setBusy] = useState(false)
  /** What 导出 Word will make: being found out, editable, or pictures and why. Fresh each time it opens (the pane remounts it). */
  const [word, setWord] = useState<"checking" | { available: true } | { available: false; reason: string }>(() =>
    wordExport ? "checking" : { available: false, reason: "这个页面没有连接 chem2office" },
  )
  const [made, setMade] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !wordExport) return
    let current = true
    wordExport.check().then(
      (answer) => current && setWord(answer),
      () => current && setWord({ available: false, reason: "检查 chem2office 时出错" }),
    )
    return () => {
      current = false
    }
  }, [open, wordExport])
  const first = rows[0] ? rowName(rows[0]) : ""
  const last = rows.at(-1) ? rowName(rows.at(-1)!) : ""

  async function pack() {
    setBusy(true)
    try {
      await onPackage()
    } finally {
      setBusy(false)
    }
  }

  async function makeWord() {
    setBusy(true)
    setMade(null)
    try {
      const result = await onWord()
      setMade(result.editable ? "已导出：每个结构都是可编辑的 ChemDraw 对象。" : `已导出图片版${result.reason ? `（${result.reason}）` : ""}。`)
    } catch (error) {
      setMade(`导出失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const wordNote =
    word === "checking"
      ? "正在检查能否生成可编辑的 ChemDraw 对象…"
      : word.available
        ? "一行结构、一行编号。每个结构是可编辑的 ChemDraw 对象（由本机的 chem2office 生成），在 Word 里双击就能修改。"
        : `一行结构、一行编号。结构是图片：${word.reason}。`

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent {...overlayMark} className="sm:max-w-lg" data-testid="compound-table-dialog">
        <DialogHeader>
          <DialogTitle>导出化合物表</DialogTitle>
          <DialogDescription>
            像专利那样排：每个结构下面是它的编号，所有结构同一键长、与通式同一朝向，缩写（Ph、OMe…）全部画出来。共 {rows.length} 个
            {rows.length > 0 && `（${first}${rows.length > 1 ? ` … ${last}` : ""}）`}，编号在“生成结果”上方设置。
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-[13px]">
          每行
          <select className="h-7 rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) px-1" value={columns} onChange={(event) => onColumns(Number(event.target.value))} aria-label="每行几个">
            {COLUMNS.map((value) => (
              <option key={value} value={value}>
                {value} 个
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-3 text-[13px]">
          <div className="flex items-start justify-between gap-3" data-testid="word-option">
            <p className="text-(--c-555555)">
              <span className="font-medium text-(--c-222222)">Word 文档（.docx）</span>
              <br />
              <span data-testid="word-note">{wordNote}</span>
              {made && (
                <span className="mt-1 block text-(--c-1a7f37)" data-testid="word-made">
                  {made}
                </span>
              )}
            </p>
            <Button size="sm" disabled={rows.length === 0 || busy || word === "checking"} onClick={() => void makeWord()}>
              {busy ? "生成中…" : "下载"}
            </Button>
          </div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-(--c-555555)">
              <span className="font-medium text-(--c-222222)">ChemDraw 整表（.cdxml）</span>
              <br />
              整张表画在一个 ChemDraw 文档里，打开后可以直接复制到 Word。
            </p>
            <Button size="sm" variant="outline" disabled={rows.length === 0 || busy} onClick={onCdxml}>
              下载
            </Button>
          </div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-(--c-555555)">
              <span className="font-medium text-(--c-222222)">Word 表格用的包（.zip）</span>
              <br />
              每个化合物一个 CDXML，加上编号清单（manifest.json、compounds.csv）；交给 chem2office 生成“一行结构、一行编号”的 Word 表格，每个结构都是可编辑的 ChemDraw 对象。
            </p>
            <Button size="sm" variant="outline" disabled={rows.length === 0 || busy} onClick={() => void pack()}>
              下载
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
