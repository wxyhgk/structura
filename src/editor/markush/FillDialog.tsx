import { useState } from "react"
import { fillOps, type ReviewedVariable } from "@structura/ai"
import type { Drawing } from "@structura/core/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Run } from "@/editor/ops"
import { useOverlayMark } from "@/editor/input/overlays"
import { describeAlternative } from "./describe.ts"
import { useFill, type FillVariables } from "./useFill.ts"

/**
 * Patent text in, variable definitions out: Claude reads the text, the answer is checked,
 * and the chemist ticks what to apply. Nothing changes until 应用, which is one undoable step.
 */
export function FillDialog({
  open,
  onOpenChange,
  drawing,
  run,
  fill,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawing: Drawing
  run: Run
  fill: FillVariables
}) {
  const overlayMark = useOverlayMark()
  const [text, setText] = useState("")
  const { status, review, error, read } = useFill(fill)
  /** Unticked variables; everything usable starts ticked. */
  const [left, setLeft] = useState<Set<string>>(new Set())
  const [rejected, setRejected] = useState<string | null>(null)

  const usable = review?.variables.filter((item) => item.variable) ?? []
  const chosen = new Set(usable.map((item) => item.name).filter((name) => !left.has(name)))

  function start() {
    setLeft(new Set())
    setRejected(null)
    void read(drawing, text)
  }

  function apply() {
    if (!review) return
    const { ops, skipped } = fillOps(review, chosen, drawing.variables)
    let why: string | null = null
    if (ops.length > 0) run(ops, { keepSelection: true, onReject: (reason) => (why = reason.error) })
    if (why || skipped.length > 0) {
      setRejected([why, ...skipped.map((item) => `${item.name}：${item.why}`)].filter(Boolean).join("；"))
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...overlayMark} className="flex max-h-[88vh] flex-col overflow-hidden sm:max-w-3xl" data-testid="fill-dialog">
        <DialogHeader>
          <DialogTitle>从专利文字填写变量</DialogTitle>
          <DialogDescription>粘贴权利要求里定义 R1、X、L 等变量的那几段文字，由 Claude 读出每个变量的候选项。应用前可以逐个检查、取舍。</DialogDescription>
        </DialogHeader>
        <textarea
          className="h-32 w-full shrink-0 resize-y rounded-sm border border-[#d0d0d0] p-2 text-[13px] outline-none focus:border-[#1a73e8]"
          placeholder="例如：其中，X 选自 O 或 S；R1 至 R4 各自独立地选自氢、卤素、取代或未取代的 C1-C30 烷基……"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label="专利文字"
        />
        <div className="flex shrink-0 items-center gap-3">
          <Button onClick={start} disabled={!text.trim() || status === "reading"}>
            {status === "reading" ? "正在读取…" : review ? "重新读取" : "读取"}
          </Button>
          {status === "reading" && <span className="text-[12px] text-[#666]">Claude 正在读，长一点的文字可能要半分钟到一分钟。</span>}
          {error && <span className="text-[12px] text-[#d1242f]">{error}</span>}
        </div>
        {review && (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" data-testid="fill-review">
            {review.notes.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-[#8a5a00]">
                {review.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
            {review.variables.length === 0 && <p className="text-[13px] text-[#666]">文字里没有找到变量的定义。</p>}
            {review.variables.map((item) => (
              <VariableReview
                key={item.name}
                item={item}
                ticked={chosen.has(item.name)}
                onTick={(ticked) => setLeft((now) => {
                  const next = new Set(now)
                  if (ticked) next.delete(item.name)
                  else next.add(item.name)
                  return next
                })}
              />
            ))}
          </div>
        )}
        {rejected && <p className="shrink-0 text-[12px] text-[#d1242f]">没有全部应用：{rejected}</p>}
        <div className="flex shrink-0 justify-end gap-2">
          <Button disabled={chosen.size === 0} onClick={apply}>
            应用 {chosen.size > 0 ? `${chosen.size} 个变量` : ""}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** One variable as read: what will be set, and what was dropped or cannot be expressed. */
function VariableReview({ item, ticked, onTick }: { item: ReviewedVariable; ticked: boolean; onTick: (ticked: boolean) => void }) {
  const { variable } = item
  return (
    <section className="rounded-sm border border-[#e0e0e0] p-2 text-[12px]" data-testid={`fill-${item.name}`}>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={ticked} disabled={!variable} onChange={(event) => onTick(event.target.checked)} />
        <span className="font-[Arial,Helvetica,sans-serif] text-[14px] font-semibold">{item.name}</span>
        {item.replaces && variable && <span className="text-[#b26a00]">会替换现有定义</span>}
        {item.warnings.map((warning) => (
          <span key={warning} className="text-[#b26a00]">
            {warning}
          </span>
        ))}
      </label>
      {variable ? (
        <div className="mt-1 flex flex-wrap gap-1 pl-6">
          {"sameAs" in variable ? (
            <span className="rounded-sm border border-[#d0d0d0] bg-white px-1.5 py-0.5">与 {variable.sameAs} 相同</span>
          ) : (
            variable.alternatives.map((alternative, index) => (
              <span key={index} className="rounded-sm border border-[#d0d0d0] bg-white px-1.5 py-0.5">
                {describeAlternative(alternative)}
              </span>
            ))
          )}
        </div>
      ) : (
        <p className="mt-1 pl-6 text-[#888]">没有可用的候选项。</p>
      )}
      {item.rejected.length > 0 && (
        <p className="mt-1 pl-6 text-[#b26a00]">没有采用：{item.rejected.map((reject) => `${reject.text}（${reject.why}）`).join("、")}</p>
      )}
      {item.unrepresented.length > 0 && <p className="mt-1 pl-6 text-[#8a5a00]">表达不了，需要人工处理：{item.unrepresented.join("；")}</p>}
      {item.source && <p className="mt-1 pl-6 text-[#888]">原文：{item.source}</p>}
    </section>
  )
}
