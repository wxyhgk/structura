import { useState } from "react"
import { Button } from "@/components/ui/button"
import { knownLabel } from "@/chem/label"
import { alternativesOf, GROUP_CLASSES, linkerNames, sharers, variableLabels } from "@/chem/markush/variables"
import type { Alternative, Attachment, GroupClass, Molecule, Variable } from "@/chem/types"
import type { Run } from "@/editor/ops"
import { BOND_WORDS, CLASS_NAMES, describeAlternative, parseLabels } from "./describe.ts"

/**
 * The generic formula's variables beside the canvas: every placeholder label on the
 * drawing (R1, X…) and what each may stand for. Every change is an op, so it can be undone.
 */
export function VariablesPanel({
  mol,
  variables,
  attachments,
  run,
  canEnumerate,
  onEnumerate,
}: {
  mol: Molecule
  variables: Record<string, Variable> | undefined
  attachments: Attachment[] | undefined
  run: Run
  canEnumerate: boolean
  onEnumerate: () => void
}) {
  const onDrawing = variableLabels(mol)
  const linkers = linkerNames({ molecule: mol, arrows: [], nextArrowId: 0, attachments })
  const names = [...new Set([...onDrawing, ...Object.keys(variables ?? {})])]
  if (names.length === 0) return null
  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-[#d0d0d0] bg-[#f7f7f7] text-[12px]" data-testid="variables-panel">
      <header className="border-b border-[#e0e0e0] px-3 py-2 font-medium text-[#333]">通式变量</header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {names.map((name) => (
          <VariableRow key={name} name={name} variables={variables} onDrawing={onDrawing.includes(name)} linker={linkers.has(name)} run={run} />
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

/** For a linker such as L: "a single bond, (C6–C30)arylene or (3–30 membered)heteroarylene". */
const LINKER_PRESETS: Alternative[] = [
  { kind: "bond" },
  { kind: "class", class: "arylene", min: 6, max: 30 },
  { kind: "class", class: "heteroarylene", min: 3, max: 30 },
]

/** The classes patent claims name most, one click each; "更多…" opens the full form. */
const PRESETS: Alternative[] = [
  { kind: "class", class: "alkyl", min: 1, max: 30 },
  { kind: "class", class: "aryl", min: 6, max: 30 },
  { kind: "class", class: "heteroaryl", min: 3, max: 30 },
  { kind: "class", class: "silyl" },
  { kind: "class", class: "amino" },
]

function VariableRow({
  name,
  variables,
  onDrawing,
  linker,
  run,
}: {
  name: string
  variables: Record<string, Variable> | undefined
  onDrawing: boolean
  /** It sits between two atoms (like L), so it offers a bond and divalent rings. */
  linker: boolean
  run: Run
}) {
  const variable = variables?.[name]
  /** The variable whose list this one shares, if it shares one; its own list is then read-only. */
  const shared = variable && "sameAs" in variable ? variable.sameAs : null
  const sharedBy = sharers(variables, name)
  /** Variables with a list of their own, which this one could share. */
  const sources = Object.entries(variables ?? {}).flatMap(([other, item]) => (other !== name && "alternatives" in item ? [other] : []))
  const [text, setText] = useState("")
  const [unknown, setUnknown] = useState<string[]>([])
  /** The class form: adding a new class, or editing the one at this index. */
  const [classForm, setClassForm] = useState<"new" | number | null>(null)
  const alternatives = alternativesOf(variables, name)

  /** Shares another variable's list, or (with "") takes a copy of the shared list as its own. */
  function share(source: string) {
    if (source) run([{ op: "set_variable", name, sameAs: source }], { keepSelection: true })
    else if (alternatives.length > 0) run([{ op: "set_variable", name, alternatives }], { keepSelection: true })
    else run([{ op: "remove_variable", name }], { keepSelection: true })
  }

  /** Saves the new list; an empty list takes the definition away. */
  function save(next: Alternative[]) {
    if (next.length > 0) run([{ op: "set_variable", name, alternatives: next }], { keepSelection: true })
    else if (variable) run([{ op: "remove_variable", name }], { keepSelection: true })
  }

  /** Adds what was typed; words that are no element or abbreviation stay in the field, flagged. */
  function addLabels() {
    const typed = parseLabels(text)
    const bond = typed.some((word) => BOND_WORDS.has(word)) && !alternatives.some((item) => item.kind === "bond")
    const words = typed.filter((word) => !BOND_WORDS.has(word))
    const have = new Set(alternatives.flatMap((item) => (item.kind === "label" ? [item.text] : [])))
    const added = words.filter((label) => knownLabel(label) && !have.has(label))
    const rejected = words.filter((label) => !knownLabel(label))
    const additions: Alternative[] = [...(bond ? [{ kind: "bond" as const }] : []), ...added.map((label) => ({ kind: "label" as const, text: label }))]
    if (additions.length > 0) save([...alternatives, ...additions])
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
        {variable && !shared && sharedBy.length === 0 && (
          <button className="ml-auto text-[#888] hover:text-[#d1242f]" onClick={() => save([])} aria-label={`删除 ${name}`}>
            清空
          </button>
        )}
      </div>
      {sharedBy.length > 0 ? (
        <p className="mb-1 text-[#666]">{sharedBy.join("、")} 与它相同</p>
      ) : (
        (shared || sources.length > 0) && (
          <select
            className="mb-1.5 h-7 w-full rounded-sm border border-[#d0d0d0] bg-white px-1 outline-none focus:border-[#1a73e8]"
            value={shared ?? ""}
            onChange={(event) => share(event.target.value)}
            aria-label={`${name} 的候选项来源`}
          >
            <option value="">自己填写候选项</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                与 {source} 相同
              </option>
            ))}
          </select>
        )
      )}
      <div className="mb-1.5 flex flex-wrap gap-1">
        {alternatives.map((item, index) => (
          <span key={index} className="inline-flex items-center gap-1 rounded-sm border border-[#d0d0d0] bg-white px-1.5 py-0.5" data-testid="alternative">
            {item.kind === "class" && !shared ? (
              <button className="hover:text-[#1a73e8]" onClick={() => setClassForm(index)} title="点击修改范围">
                {describeAlternative(item)}
              </button>
            ) : (
              describeAlternative(item)
            )}
            {!shared && (
              <button className="text-[#999] hover:text-[#d1242f]" onClick={() => save(alternatives.filter((_, other) => other !== index))} aria-label="去掉">
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {shared ? (
        <p className="text-[#888]">要修改，请到 {shared} 里改。</p>
      ) : (
        <>
          <input
            className="h-7 w-full rounded-sm border border-[#d0d0d0] bg-white px-2 outline-none focus:border-[#1a73e8]"
            placeholder={linker ? "单键, O, S… 回车添加" : "H, D, 卤素, CN… 回车添加"}
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
              {(linker ? LINKER_PRESETS : PRESETS).map((preset) => (
                <button
                  key={preset.kind === "class" ? preset.class : preset.kind}
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
        </>
      )}
    </section>
  )
}

/** "C1–C30 烷基", "3–30 元杂芳基": a preset's button text. */
function shortName(item: Alternative): string {
  if (item.kind !== "class") return describeAlternative(item)
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
