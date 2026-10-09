import { useMemo, useState } from "react"
import type { Attachment, Repeat } from "@structura/markush"
import type { Molecule } from "@structura/core/types"
import type { Run } from "@structura/engine"
import { widerSystem } from "./workspace/widerSystem.ts"

const FIELD = "h-6 rounded border border-[#d0d0d0] bg-white px-1 text-center text-[12px] outline-none focus:border-[#1a73e8]"

/**
 * One variable point of attachment in the 位置 tab: which piece, how many positions, and how
 * many times it appears, "(R1)m, m = 0–4". Once by default; the count is ticked on here.
 */
export function AttachmentRow({ attachment, mol, run }: { attachment: Attachment; mol: Molecule; run: Run }) {
  const hub = mol.atoms.find((atom) => atom.id === attachment.atom)
  const name = hub?.alias ?? `#${attachment.atom}`
  const positions = attachment.to.length
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
        <span className="text-[#888]">连在环上 {positions} 个位置之一</span>
      </div>
      {system && (
        <button
          type="button"
          className="mt-1 text-[11px] text-[#1a73e8] hover:underline"
          onClick={() => run([{ op: "set_attachment", atom: attachment.atom, to: system, ...(repeat ? { repeat } : {}) }], { keepSelection: true })}
        >
          扩大到整个稠环体系（{system.length} 个位置）
        </button>
      )}
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
