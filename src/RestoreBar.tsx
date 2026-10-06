import { Button } from "@/components/ui/button"
import type { Unsaved } from "@/autosave"

/** Offers back the drawing left unsaved last time, until it is restored or dropped. */
export function RestoreBar({ unsaved, onRestore, onDiscard }: { unsaved: Unsaved; onRestore: () => void; onDiscard: () => void }) {
  const when = new Date(unsaved.at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[#f0d58a] bg-[#fff8e1] px-3 py-1.5 text-[12px] text-[#5c4a00]" data-testid="restore-bar">
      <span>上次有一张没保存的绘图（{when}），要恢复吗？</span>
      <Button size="sm" className="h-6" onClick={onRestore}>
        恢复
      </Button>
      <Button size="sm" variant="ghost" className="h-6" onClick={onDiscard}>
        丢弃
      </Button>
    </div>
  )
}
