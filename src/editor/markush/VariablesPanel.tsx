import { useState } from "react"
import { Button } from "@/components/ui/button"
import { knownLabel } from "@/chem/label"
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

/** The classes patent claims name most, one click each; "更多…" opens the full form. */
const PRESETS: Alternative[] = [
  { kind: "class", class: "alkyl", min: 1, max: 30 },
  { kind: "class", class: "aryl", min: 6, max: 30 },
  { kind: "class", class: "heteroaryl", min: 3, max: 30 },
  { kind: "class", class: "silyl" },
  { kind: "class", class: "amino" },
]

function VariableRow({ name, variable, onDrawing, run }: { name: string; variable: Variable | undefined; onDrawing: boolean; run: Run }) {
  const [text, setText] = useState("")
  const [unknown, setUnknown] = useState<string[]>([])
  /** The class form: adding a new class, or editing the one at this index. */
  const [classForm, setClassForm] = useState<"new" | number | null>(null)
  const alternatives = variable?.alternatives ?? []

  /** Saves the new list; an empty list takes the definition away. */
  function save(next: Alternative[]) {
    if (next.length > 0) run([{ op: "set_variable", name, alternatives: next }], { keepSelection: true })
    else if (variable) run([{ op: "remove_variable", name }], { keepSelection: true })
  }

  /** Adds what was typed; words that are no element or abbreviation stay in the field, flagged. */
  function addLabels() {
    const typed = parseLabels(text)
    const have = new Set(alternatives.flatMap((item) => (item.kind === "label" ? [item.text] : [])))
    const added = typed.filter((label) => knownLabel(label) && !have.has(label))
    const rejected = typed.filter((label) => !knownLabel(label))
    if (added.length > 0) save([...alternatives, ...added.map((label) => ({ kind: "label" as const, text: label }))])
    setUnknown(rejected)
    setText(rejected.join(", "))
  }

  function addClass(item: Alternative) {
    const same = alternatives.some((other) => JSON.stringify(other) === JSON.stringify(item))
    if (!same) save([...alternatives, item])
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
            {item.kind === "class" ? (
              <button className="hover:text-[#1a73e8]" onClick={() => setClassForm(index)} title="点击修改范围">
                {describeAlternative(item)}
              </button>
            ) : (
              describeAlternative(item)
            )}
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
        onChange={(event) => {
          setText(event.target.value)
          setUnknown([])
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") addLabels()
        }}
        aria-label={`${name} 的候选项`}
      />
      {unknown.length > 0 && (
        <p className="mt-1 text-[#b26a00]">
          看不懂：{unknown.join("、")}。只能填元素或缩写（如 H、Cl、CN、Me、Ph）；烷基、芳基这类范围请用下面的类别。
        </p>
      )}
      {classForm != null ? (
        <ClassForm
          initial={typeof classForm === "number" ? alternatives[classForm] : undefined}
          onSave={(item) => {
            if (typeof classForm === "number") save(alternatives.map((other, index) => (index === classForm ? item : other)))
            else addClass(item)
            setClassForm(null)
          }}
          onCancel={() => setClassForm(null)}
        />
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.kind === "class" ? preset.class : ""}
              className="rounded-sm border border-dashed border-[#9fc3ee] px-1.5 py-0.5 text-[#1a73e8] hover:bg-[#e8f1fb]"
              onClick={() => addClass(preset)}
              title={`添加：${describeAlternative(preset)}`}
            >
              + {shortName(preset)}
            </button>
          ))}
          <button className="rounded-sm px-1.5 py-0.5 text-[#1a73e8] hover:underline" onClick={() => setClassForm("new")}>
            更多…
          </button>
        </div>
      )}
    </section>
  )
}

/** "C1–C30 烷基", "3–30 元杂芳基": a preset's button text. */
function shortName(item: Alternative): string {
  if (item.kind === "label") return item.text
  const range = item.min != null ? (GROUP_CLASSES[item.class].size === "members" ? `${item.min}–${item.max} 元` : `C${item.min}–C${item.max} `) : ""
  return `${range}${CLASS_NAMES[item.class]}`
}

/**
 * A class alternative: which class, its size range (left empty for none, as for silyl),
 * and whether it may carry substituents. Opens filled in when editing one.
 */
function ClassForm({ initial, onSave, onCancel }: { initial?: Alternative; onSave: (item: Alternative) => void; onCancel: () => void }) {
  const start = initial?.kind === "class" ? initial : undefined
  const [group, setGroup] = useState<GroupClass>(start?.class ?? "alkyl")
  const [min, setMin] = useState(start ? String(start.min ?? "") : "1")
  const [max, setMax] = useState(start ? String(start.max ?? "") : "30")
  const [substituted, setSubstituted] = useState<"either" | "yes" | "no">(start?.substituted == null ? "either" : start.substituted ? "yes" : "no")
  const ranged = min.trim() !== "" || max.trim() !== ""
  const low = Number(min)
  const high = Number(max)
  const valid = !ranged || (Number.isInteger(low) && Number.isInteger(high) && low >= 1 && high <= 100 && low <= high)
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
            onSave({
              kind: "class",
              class: group,
              ...(ranged ? { min: low, max: high } : {}),
              ...(substituted === "either" ? {} : { substituted: substituted === "yes" }),
            })
          }
        >
          {initial ? "保存" : "添加"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </span>
    </div>
  )
}
