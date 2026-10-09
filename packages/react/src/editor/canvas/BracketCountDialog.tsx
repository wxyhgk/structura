import { useState } from "react"
import type { Repeat } from "@structura/markush"
import type { Bracket } from "@structura/core/types"
import { Button } from "../../components/ui/button.tsx"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog.tsx"
import { useOverlayMark } from "../input/overlays.ts"

const FIELD = "h-7 rounded border border-[#d0d0d0] bg-white px-1 text-center text-[13px] outline-none focus:border-[#1a73e8]"

/** What is typed, as a count, or why it cannot be one. */
function countOf(draft: { name: string; min: string; max: string }): Repeat | string {
  const name = draft.name.trim()
  if (!/^[a-z]\d{0,2}'?$/.test(name)) return "次数的名字用一个小写字母，如 n、m"
  const min = Number(draft.min)
  const max = Number(draft.max)
  if (draft.min.trim() === "" || draft.max.trim() === "" || !Number.isInteger(min) || !Number.isInteger(max)) return "最少和最多次数要写整数"
  if (min < 0 || min > max || max > 100) return "次数要在 0 到 100 之间，且最少不大于最多"
  return { name, min, max }
}

/**
 * 重复次数: the name written at the lower right of "]" and the range it stands for
 * ("n = 1–4"). Saving makes the bracket a repeat unit if it was a group.
 */
export function BracketCountDialog({ bracket, onSave, onClose }: { bracket: Bracket | null; onSave: (id: number, repeat: Repeat) => boolean; onClose: () => void }) {
  return (
    <Dialog open={bracket != null} onOpenChange={(open) => !open && onClose()}>
      {bracket && <CountForm key={bracket.id} bracket={bracket} onSave={onSave} onClose={onClose} />}
    </Dialog>
  )
}

function CountForm({ bracket, onSave, onClose }: { bracket: Bracket; onSave: (id: number, repeat: Repeat) => boolean; onClose: () => void }) {
  const overlayMark = useOverlayMark()
  const start = bracket.repeat ?? { name: "n", min: 1, max: 4 }
  const [draft, setDraft] = useState({ name: start.name, min: String(start.min), max: String(start.max) })
  const [problem, setProblem] = useState<string | null>(null)
  const field = (key: keyof typeof draft) => ({
    value: draft[key],
    onChange: (event: { target: { value: string } }) => {
      setDraft({ ...draft, [key]: event.target.value })
      setProblem(null)
    },
  })

  function save() {
    const count = countOf(draft)
    if (typeof count === "string") return setProblem(count)
    // The op checks the count too; a refused one changes nothing.
    if (!onSave(bracket.id, count)) return setProblem("这个次数用不了")
    onClose()
  }

  return (
    <DialogContent {...overlayMark} className="sm:max-w-sm" data-testid="bracket-count-dialog">
      <DialogHeader>
        <DialogTitle>重复次数</DialogTitle>
        <DialogDescription>括号右下角写的名字，以及它代表的次数范围。</DialogDescription>
      </DialogHeader>
      <form
        className="flex items-center gap-1.5 text-[13px] text-[#555]"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <input className={`${FIELD} w-10 italic`} {...field("name")} aria-label="次数的名字" autoFocus />
        <span>=</span>
        <input className={`${FIELD} w-12`} inputMode="numeric" {...field("min")} aria-label="最少次数" />
        <span>到</span>
        <input className={`${FIELD} w-12`} inputMode="numeric" {...field("max")} aria-label="最多次数" />
        <span>次</span>
        <Button type="submit" size="sm" className="ml-auto" data-testid="bracket-count-save">
          确定
        </Button>
      </form>
      {problem && <p className="text-[12px] text-[#d1242f]">{problem}</p>}
    </DialogContent>
  )
}
