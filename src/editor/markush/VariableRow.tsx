import { useState } from "react"
import { alternativesFromText, alternativesOf, shareSources, sharers } from "@structura/markush"
import type { Alternative, Molecule, Variable } from "@structura/core/types"
import { captureOps, type Run } from "@structura/engine"
import { HelpLink, type GuideTopic } from "@/guide"
import { ClassForm } from "./ClassForm.tsx"
import { describeAlternative } from "./describe.ts"
import { MoleculeThumb } from "@/editor/common/MoleculeThumb"
import { LINKER_PRESETS, PRESETS, shortName } from "./presets.ts"

/** One variable in the panel: its alternatives, and the ways to add, share or remove them. */
export function VariableRow({
  name,
  variables,
  onDrawing,
  nested,
  linker,
  mol,
  selected,
  run,
  onHelp,
}: {
  name: string
  variables: Record<string, Variable> | undefined
  onDrawing: boolean
  /** A placeholder inside one of the variables' pieces (R5 in Ar = N–R5). */
  nested: boolean
  /** It sits between two atoms (like L), so it offers a bond and divalent rings. */
  linker: boolean
  /** The drawing and the atoms selected on it, for taking a drawn piece into the list. */
  mol: Molecule
  selected: number[]
  run: Run
  onHelp: (topic: GuideTopic) => void
}) {
  const variable = variables?.[name]
  /** The variable whose list this one shares, if it shares one; its own list is then read-only. */
  const shared = variable && "sameAs" in variable ? variable.sameAs : null
  const sharedBy = sharers(variables, name)
  /** Variables with a list of their own, which this one could share. */
  const sources = shareSources(variables, name)
  const [text, setText] = useState("")
  const [unknown, setUnknown] = useState<string[]>([])
  /** The class form: adding a new class, or editing the one at this index. */
  const [classForm, setClassForm] = useState<"new" | number | null>(null)
  /** Why the selection could not be taken in as a piece, until the next try. */
  const [captureProblem, setCaptureProblem] = useState<string | null>(null)
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
    const { add, rejected } = alternativesFromText(text, alternatives)
    if (add.length > 0) save([...alternatives, ...add])
    setUnknown(rejected)
    setText(rejected.join(", "))
  }

  /** Moves the selected piece off the canvas into this variable's list, as one step. */
  function capture() {
    const result = captureOps(name, alternatives, mol, selected)
    if ("problem" in result) return setCaptureProblem(result.problem)
    setCaptureProblem(null)
    run(result.ops)
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
        {!onDrawing && <span className="text-[#888]">{nested ? "在片段里" : "图上没有"}</span>}
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
            {item.kind === "fragment" && <MoleculeThumb mol={item.molecule} className="h-12 w-16 object-contain" />}
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
          {captureProblem && <p className="mt-1 text-[#b26a00]">{captureProblem}</p>}
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
              <button
                className="rounded-sm border border-dashed border-[#9fc3ee] px-1.5 py-0.5 text-[#1a73e8] hover:bg-[#e8f1fb] disabled:border-[#ddd] disabled:text-[#aaa] disabled:hover:bg-transparent"
                disabled={selected.length === 0}
                onClick={capture}
                title="在画布上单独画出片段，用 * 标出接到通式上的位置（双击原子输入 *；连接基画两个 *），选中整个片段后点这里"
              >
                + 用选中的结构
              </button>
              <span className="flex items-center">
                <HelpLink onClick={() => onHelp("fragments")} label="片段怎么画" />
              </span>
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
