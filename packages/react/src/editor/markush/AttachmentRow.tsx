import { useMemo, useState } from "react"
import { type Attachment, openPositions, type Repeat } from "@structura/markush"
import { bracketInto } from "@structura/core/drawing"
import type { Drawing } from "@structura/core/types"
import type { Run } from "@structura/engine"
import { AttachmentShapePicker } from "./AttachmentShapePicker.tsx"
import { widerSystem } from "./workspace/widerSystem.ts"

const FIELD = "h-6 rounded border border-[#d0d0d0] bg-white px-1 text-center text-[12px] outline-none focus:border-[#1a73e8]"

/**
 * One variable point of attachment in the 位置 tab: which piece, how many positions it can
 * take (those with a hydrogen to give up, as generating finds them), how it is drawn, and
 * how many times it appears, "(R1)m, m = 0–4". Once by default; the count is ticked on here.
 */
export function AttachmentRow({ attachment, drawing, run }: { attachment: Attachment; drawing: Drawing; run: Run }) {
  const { molecule: mol, brackets } = drawing
  const hub = mol.atoms.find((atom) => atom.id === attachment.atom)
  const name = hub?.alias ?? `#${attachment.atom}`
  const positions = attachment.to.length
  const open = useMemo(() => openPositions(drawing, attachment.to).length, [drawing, attachment])
  const intoBracket = bracketInto(brackets, attachment) != null
  const repeat = attachment.repeat
  /** The whole fused system's free positions, when it is wider than the ring drawn into (carbazole from one benzo ring). */
  const system = useMemo(() => widerSystem(mol, attachment), [mol, attachment])
  /** What is being typed, until it makes a valid count. */
  const [draft, setDraft] = useState<{ min: string; max: string; name: string } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const shown = draft ?? (repeat ? { min: String(repeat.min), max: String(repeat.max), name: repeat.name } : null)

  function save(next: Repeat | null) {
    // The op checks the range too; a refused one changes nothing.
    if (!run([{ op: "set_repeat", atom: attachment.atom, repeat: next }], { keepSelection: true })) setProblem("这个次数用不了")
    else {
      setProblem(null)
      setDraft(null)
    }
  }

  function edit(field: "min" | "max" | "name", value: string) {
    const next = { ...shown!, [field]: value }
    setDraft(next)
    const min = Number(next.min)
    const max = Number(next.max)
    if (next.min.trim() === "" || next.max.trim() === "" || !next.name.trim()) return
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || min > max || max > positions) return setProblem(`次数要在 0 到 ${positions} 之间，且最少不大于最多`)
    if (!/^[a-z]\d{0,2}'?$/.test(next.name.trim())) return setProblem("次数的名字用一个小写字母，如 m、n")
    save({ min, max, name: next.name.trim() })
  }

  return (
    <div className="border-b border-[#e8e8e8] px-3 py-2" data-testid="attachment-row">
      <div className="flex items-center gap-1.5 text-[#333]">
        <span className="font-medium">{repeat ? `(${name})${repeat.name}` : name}</span>
        <span className="text-[#888]">{intoBracket ? `连在方括号里的基团上，${open} 个可接位置之一` : `连在环上 ${open} 个可接位置之一`}</span>
      </div>
      {system && (
        <button
          type="button"
          className="mt-1 text-[11px] text-[#1a73e8] hover:underline"
          onClick={() => run([{ op: "set_attachment", atom: attachment.atom, to: system, ...(repeat ? { repeat } : {}), ...(attachment.shape ? { shape: attachment.shape } : {}) }], { keepSelection: true })}
        >
          扩大到整个稠环体系（{openPositions(drawing, system).length} 个位置）
        </button>
      )}
      <AttachmentShapePicker attachment={attachment} mol={mol} brackets={brackets} run={run} />
      <label className="mt-1.5 flex items-center gap-1.5 text-[#555]">
        <input
          type="checkbox"
          checked={repeat != null}
          onChange={(event) => (event.target.checked ? save({ min: 0, max: Math.min(4, positions), name: "m" }) : save(null))}
          aria-label={`${name} 重复出现`}
        />
        重复出现（每个各选各的，位置互不相同）
      </label>
      {shown && (
        <div className="mt-1.5 flex items-center gap-1 text-[#555]">
          <input className={`${FIELD} w-7 italic`} value={shown.name} onChange={(event) => edit("name", event.target.value)} aria-label="次数的名字" />
          <span>=</span>
          <input className={`${FIELD} w-8`} inputMode="numeric" value={shown.min} onChange={(event) => edit("min", event.target.value)} aria-label="最少次数" />
          <span>到</span>
          <input className={`${FIELD} w-8`} inputMode="numeric" value={shown.max} onChange={(event) => edit("max", event.target.value)} aria-label="最多次数" />
          <span>次</span>
        </div>
      )}
      {problem && <p className="mt-1 text-[11px] text-[#d1242f]">{problem}</p>}
    </div>
  )
}
