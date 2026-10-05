import { useEffect, useState } from "react"
import { plainFormula, displayFormula } from "@structura/core/formula"
import type { Drawing } from "@structura/core/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MoleculeThumb } from "@/editor/common/MoleculeThumb"
import { useOverlayMark } from "@/editor/input/overlays"
import { firstPicture, pictureFrom } from "./image.ts"
import { useRecognition, type RecognizeStructure } from "./useRecognition.ts"

const ACTION_NAMES = { build: "搭建", look: "查看", reset: "重来", done: "完成" } as const

/**
 * A picture in, a structure out: the model rebuilds what it sees step by step (building,
 * looking at its own drawing, fixing), each step shown as it happens. Nothing changes in
 * the drawing until 应用, which adds the result as one undoable step.
 */
export function StructureDialog({
  open,
  onOpenChange,
  recognize,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recognize: RecognizeStructure
  onApply: (drawing: Drawing) => void
}) {
  const overlayMark = useOverlayMark()
  const [picture, setPicture] = useState<string | null>(null)
  const [hint, setHint] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  const run = useRecognition(recognize)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (run.started == null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [run.started])

  const take = async (file: Blob | null) => {
    if (!file) return setProblem("没有找到图片。")
    setProblem(null)
    try {
      setPicture(await pictureFrom(file))
    } catch {
      setProblem("这张图片打不开。")
    }
  }
  const latest = run.steps.at(-1)?.drawing
  const shown = run.result?.ok ? run.result.drawing : latest
  const running = run.status === "running"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && running) run.stop()
        onOpenChange(next)
      }}
    >
      <DialogContent
        {...overlayMark}
        className="flex max-h-[88vh] flex-col gap-3 overflow-hidden sm:max-w-4xl"
        data-testid="structure-dialog"
        onPaste={(event) => {
          const file = firstPicture(event.clipboardData.files)
          if (file) {
            event.preventDefault()
            void take(file)
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>从图片识别结构</DialogTitle>
          <DialogDescription>粘贴（⌘V）、拖进来或选择一张结构图。AI 会一步步搭出结构、对照检查，你可以随时停止；满意后再应用到画布。</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-hidden">
          <div className="flex min-h-0 flex-col gap-2">
            <label
              className="flex min-h-48 flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#c8c8c8] bg-[#fafafa] text-[13px] text-[#888]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                void take(firstPicture(event.dataTransfer.files))
              }}
            >
              {picture ? <img src={picture} alt="要识别的结构" className="max-h-full max-w-full object-contain" /> : "粘贴、拖入或点这里选择图片"}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void take(firstPicture(event.target.files))} aria-label="选择图片" />
            </label>
            <input
              className="h-8 rounded-md border border-[#d0d0d0] px-2 text-[13px] outline-none focus:border-[#1a73e8]"
              placeholder="补充说明（可选），如：这是专利里的通式，R 基照原样保留"
              value={hint}
              onChange={(event) => setHint(event.target.value)}
              aria-label="补充说明"
            />
            {problem && <p className="text-[12px] text-[#d1242f]">{problem}</p>}
            <div className="flex items-center gap-2">
              {running ? (
                <Button variant="outline" onClick={run.stop}>
                  停止
                </Button>
              ) : (
                <Button disabled={!picture} onClick={() => picture && run.start({ image: picture, hint })} data-testid="structure-start">
                  {run.status === "idle" ? "识别" : "重新识别"}
                </Button>
              )}
              {running && <span className="text-[12px] text-[#666]">AI 正在识别，已 {Math.round((now - (run.started ?? now)) / 1000)} 秒（通常要一到几分钟）</span>}
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex h-48 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f7]" data-testid="structure-preview">
              {shown && shown.molecule.atoms.length > 0 ? <MoleculeThumb mol={shown.molecule} className="max-h-44 max-w-full object-contain" /> : <span className="text-[12px] text-[#999]">识别结果会显示在这里</span>}
            </div>
            {shown && shown.molecule.atoms.length > 0 && <div className="text-[12px] text-[#555]">{displayFormula(plainFormula(shown.molecule))}，{shown.molecule.atoms.length} 个原子</div>}
            <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto text-[12px]" data-testid="structure-steps">
              {run.steps.map((step, index) => (
                <li key={index} className="flex gap-2">
                  <span className={`shrink-0 rounded px-1.5 ${step.ok ? "bg-[#eef3fd] text-[#1a73e8]" : "bg-[#fdecea] text-[#d1242f]"}`}>{ACTION_NAMES[step.action]}</span>
                  <span>{step.note}</span>
                </li>
              ))}
              {run.result && !run.result.ok && <li className="text-[#d1242f]">{run.result.error}</li>}
              {run.status === "stopped" && <li className="text-[#888]">已停止。</li>}
            </ol>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            disabled={!shown || shown.molecule.atoms.length === 0 || running}
            onClick={() => {
              if (!shown) return
              onApply(shown)
              onOpenChange(false)
            }}
            data-testid="structure-apply"
          >
            应用到画布
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
