import { useState } from "react"
import type { RepeatSkip, RepeatStraddle } from "@structura/markush"
import type { Bracket } from "@structura/core/types"
import type { Run } from "@structura/engine"
import { bracketCountOf, type CountDraft } from "./bracketCount.ts"
import { repeatSkipText, repeatStraddleText } from "./describe.ts"

const FIELD = "h-6 rounded border border-[#d0d0d0] bg-white px-1 text-center text-[12px] outline-none focus:border-[#1a73e8]"

/**
 * One repeat unit [ … ]n in the 位置 tab: how many atoms it holds, and its count "n = 1 到 4
 * 次", changed in place; each valid change is one undoable step. `skip` says why it cannot
 * be written out, if it cannot; `straddles`, the attachments across it that are not copied.
 */
export function RepeatBracketRow({ bracket, skip, straddles = [], run }: { bracket: Bracket; skip?: RepeatSkip; straddles?: RepeatStraddle[]; run: Run }) {
  const repeat = bracket.repeat ?? { name: "n", min: 1, max: 4 }
  /** What is being typed, until it makes a valid count. */
  const [draft, setDraft] = useState<CountDraft | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const shown = draft ?? { name: repeat.name, min: String(repeat.min), max: String(repeat.max) }

  function edit(field: keyof CountDraft, value: string) {
    const next = { ...shown, [field]: value }
    setDraft(next)
    if (next.name.trim() === "" || next.min.trim() === "" || next.max.trim() === "") return
    const count = bracketCountOf(next)
    if (typeof count === "string") return setProblem(count)
    // The op checks the count too; a refused one changes nothing.
    if (!run([{ op: "set_bracket", id: bracket.id, repeat: count }], { keepSelection: true })) return setProblem("这个次数用不了")
    setProblem(null)
    setDraft(null)
  }

  return (
    <div className="border-b border-[#e8e8e8] px-3 py-2" data-testid="repeat-bracket-row">
      <div className="flex items-center gap-1.5 text-[#333]">
        <span className="font-medium">[ … ]{repeat.name}</span>
        <span className="text-[#888]">重复单元，{bracket.atoms.length} 个原子，生成时按次数首尾相接写出</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[#555]">
        <input className={`${FIELD} w-7 italic`} value={shown.name} onChange={(event) => edit("name", event.target.value)} aria-label="重复单元次数的名字" />
        <span>=</span>
        <input className={`${FIELD} w-8`} inputMode="numeric" value={shown.min} onChange={(event) => edit("min", event.target.value)} aria-label="重复单元最少次数" />
        <span>到</span>
        <input className={`${FIELD} w-8`} inputMode="numeric" value={shown.max} onChange={(event) => edit("max", event.target.value)} aria-label="重复单元最多次数" />
        <span>次</span>
      </div>
      {problem && <p className="mt-1 text-[11px] text-[#d1242f]">{problem}</p>}
      {skip && <p className="mt-1 text-[11px] text-[#8a5300]">{repeatSkipText(skip)}</p>}
      {straddles.map((straddle) => (
        <p key={straddle.atom} className="mt-1 text-[11px] text-[#8a5300]">
          {repeatStraddleText(straddle)}
        </p>
      ))}
    </div>
  )
}
