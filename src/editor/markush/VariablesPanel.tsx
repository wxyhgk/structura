import { useState } from "react"
import { Button } from "@/components/ui/button"
import { GROUP_CLASSES, variableLabels } from "@/chem/markush/variables"
import type { Alternative, GroupClass, Molecule, Variable } from "@/chem/types"
import type { Run } from "@/editor/ops"
import { CLASS_NAMES, describeAlternative, parseLabels } from "./describe.ts"

/**
 * The generic formula's variables beside the canvas: every placeholder label on the
 * drawing (R1, X…) and what each may stand for. Every change is an op, so it can be undone.
 */
export function VariablesPanel({
  mol,
  variables,
  run,
  canEnumerate,
  onEnumerate,
}: {
  mol: Molecule
  variables: Record<string, Variable> | undefined
  run: Run
  canEnumerate: boolean
  onEnumerate: () => void
}) {
  const onDrawing = variableLabels(mol)
  const names = [...new Set([...onDrawing, ...Object.keys(variables ?? {})])]
  if (names.length === 0) return null
  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-[#d0d0d0] bg-[#f7f7f7] text-[12px]" data-testid="variables-panel">
      <header className="border-b border-[#e0e0e0] px-3 py-2 font-medium text-[#333]">通式变量</header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {names.map((name) => (
          <VariableRow key={name} name={name} variable={variables?.[name]} onDrawing={onDrawing.includes(name)} run={run} />
        ))}
      </div>
      <footer className="border-t border-[#e0e0e0] p-2">
        <Button size="sm" className="w-full" disabled={!canEnumerate} onClick={onEnumerate}>
          批量生成化合物…
        </Button>
      </footer>
    </aside>
  )
}

function VariableRow({ name, variable, onDrawing, run }: { name: string; variable: Variable | undefined; onDrawing: boolean; run: Run }) {
  const [text, setText] = useState("")
  const [addingClass, setAddingClass] = useState(false)
  const alternatives = variable?.alternatives ?? []

  /** Saves the new list; an empty list takes the definition away. */
  function save(next: Alternative[]) {
    if (next.length > 0) run([{ op: "set_variable", name, alternatives: next }], { keepSelection: true })
    else if (variable) run([{ op: "remove_variable", name }], { keepSelection: true })
  }

  function addLabels() {
    const known = new Set(alternatives.flatMap((item) => (item.kind === "label" ? [item.text] : [])))
    const added = parseLabels(text).filter((label) => !known.has(label))
    if (added.length > 0) save([...alternatives, ...added.map((label) => ({ kind: "label" as const, text: label }))])
    setText("")
  }

  return (
    <section className="border-b border-[#e6e6e6] px-3 py-2" data-testid={`variable-${name}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-[Arial,Helvetica,sans-serif] text-[14px] font-semibold">{name}</span>
        {!variable && <span className="text-[#b26a00]">未定义</span>}
        {!onDrawing && <span className="text-[#888]">图上没有</span>}
        {variable && (
          <button className="ml-auto text-[#888] hover:text-[#d1242f]" onClick={() => save([])} aria-label={`删除 ${name}`}>
            清空
          </button>
        )}
      </div>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {alternatives.map((item, index) => (
          <span key={index} className="inline-flex items-center gap-1 rounded-sm border border-[#d0d0d0] bg-white px-1.5 py-0.5" data-testid="alternative">
            {describeAlternative(item)}
            <button className="text-[#999] hover:text-[#d1242f]" onClick={() => save(alternatives.filter((_, other) => other !== index))} aria-label="去掉">
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="h-7 w-full rounded-sm border border-[#d0d0d0] bg-white px-2 outline-none focus:border-[#1a73e8]"
        placeholder="H, D, 卤素, CN… 回车添加"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") addLabels()
        }}
        aria-label={`${name} 的候选项`}
      />
      {addingClass ? (
        <ClassForm
          onAdd={(item) => {
            save([...alternatives, item])
            setAddingClass(false)
          }}
          onCancel={() => setAddingClass(false)}
        />
      ) : (
        <button className="mt-1 text-[#1a73e8] hover:underline" onClick={() => setAddingClass(true)}>
          + 基团类别
        </button>
      )}
    </section>
  )
}

/** A class alternative: which class, its size range, and whether it may carry substituents. */
function ClassForm({ onAdd, onCancel }: { onAdd: (item: Alternative) => void; onCancel: () => void }) {
  const [group, setGroup] = useState<GroupClass>("alkyl")
  const [min, setMin] = useState("1")
  const [max, setMax] = useState("30")
  const [substituted, setSubstituted] = useState<"either" | "yes" | "no">("either")
  const low = Number(min)
  const high = Number(max)
  const valid = Number.isInteger(low) && Number.isInteger(high) && low >= 1 && high <= 100 && low <= high
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
        <Button
          size="sm"
          disabled={!valid}
          onClick={() =>
            onAdd({ kind: "class", class: group, min: low, max: high, ...(substituted === "either" ? {} : { substituted: substituted === "yes" }) })
          }
        >
          添加
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </span>
    </div>
  )
}
