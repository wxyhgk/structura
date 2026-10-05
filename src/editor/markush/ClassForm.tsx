import { useState } from "react"
import { Button } from "@/components/ui/button"
import { alternativeProblem, GROUP_CLASSES } from "@structura/markush"
import type { Alternative, GroupClass } from "@structura/core/types"
import { CLASS_NAMES } from "./describe.ts"

/**
 * A class alternative: which class, its size range (left empty for none, as for silyl),
 * and whether it may carry substituents. Opens filled in when editing one.
 */
export function ClassForm({ initial, onSave, onCancel }: { initial?: Alternative; onSave: (item: Alternative) => void; onCancel: () => void }) {
  const start = initial?.kind === "class" ? initial : undefined
  const [group, setGroup] = useState<GroupClass>(start?.class ?? "alkyl")
  const [min, setMin] = useState(start ? String(start.min ?? "") : "1")
  const [max, setMax] = useState(start ? String(start.max ?? "") : "30")
  const [substituted, setSubstituted] = useState<"either" | "yes" | "no">(start?.substituted == null ? "either" : start.substituted ? "yes" : "no")
  const ranged = min.trim() !== "" || max.trim() !== ""
  const low = Number(min)
  const high = Number(max)
  const candidate: Alternative = {
    kind: "class",
    class: group,
    ...(ranged ? { min: low, max: high } : {}),
    ...(substituted === "either" ? {} : { substituted: substituted === "yes" }),
  }
  const valid = alternativeProblem(candidate) == null
  const field = "h-7 rounded-sm border border-[#d0d0d0] bg-white px-1 outline-none focus:border-[#1a73e8]"
  return (
    <div className="mt-1.5 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 rounded-sm border border-[#e0e0e0] bg-white p-2">
      <span>类别</span>
      <select className={field} value={group} onChange={(event) => setGroup(event.target.value as GroupClass)} aria-label="基团类别">
        {(Object.keys(GROUP_CLASSES) as GroupClass[]).map((key) => (
          <option key={key} value={key}>
            {CLASS_NAMES[key]}
          </option>
        ))}
      </select>
      <span>{GROUP_CLASSES[group].size === "members" ? "环大小" : "碳数"}</span>
      <span className="flex items-center gap-1">
        <input className={`${field} w-12`} value={min} onChange={(event) => setMin(event.target.value)} aria-label="最小" />–
        <input className={`${field} w-12`} value={max} onChange={(event) => setMax(event.target.value)} aria-label="最大" />
      </span>
      <span>取代</span>
      <select className={field} value={substituted} onChange={(event) => setSubstituted(event.target.value as typeof substituted)} aria-label="取代">
        <option value="either">取代或未取代</option>
        <option value="no">未取代</option>
        <option value="yes">取代</option>
      </select>
      <span />
      <span className="flex gap-2">
        <Button size="sm" disabled={!valid} onClick={() => onSave(candidate)}>
          {initial ? "保存" : "添加"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </span>
    </div>
  )
}
