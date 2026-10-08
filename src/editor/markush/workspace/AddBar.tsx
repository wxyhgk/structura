import { useState } from "react"
import { HelpLink, type GuideTopic } from "@/guide"
import { describeAlternative } from "../describe.ts"
import { LINKER_PRESETS, PRESETS, shortName } from "../presets.ts"
import type { variableEdits } from "../variableEdits.ts"

const CHIP = "rounded-full border border-dashed border-[#9fc3ee] px-2.5 py-0.5 text-[#1a73e8] hover:bg-[#e8f1fb]"
const ACTION =
  "rounded-sm border border-[#9fc3ee] bg-white px-2.5 py-1 text-[#1a73e8] hover:bg-[#e8f1fb] disabled:border-[#ddd] disabled:text-[#aaa] disabled:hover:bg-transparent"

/**
 * The ways to add to a variable's list: typing elements and abbreviations, one-click classes,
 * the full class form, drawing a piece, or taking the piece selected on the canvas.
 */
export function AddBar({
  name,
  linker,
  empty,
  canCapture,
  edits,
  onCapture,
  onClass,
  onSketch,
  onHelp,
}: {
  name: string
  linker: boolean
  /** The list is empty, so the field says what to type. */
  empty: boolean
  /** Atoms are selected on the canvas. */
  canCapture: boolean
  edits: ReturnType<typeof variableEdits>
  /** Takes the selection in; returns why it could not, if it could not. */
  onCapture: () => string | null
  onClass: () => void
  onSketch: () => void
  onHelp: (topic: GuideTopic) => void
}) {
  const [text, setText] = useState("")
  const [unknown, setUnknown] = useState<string[]>([])
  /** Why the selection could not be taken in as a piece, until the next try. */
  const [captureProblem, setCaptureProblem] = useState<string | null>(null)

  /** Adds what was typed; words that are no element or abbreviation stay in the field, flagged. */
  function addLabels() {
    const rejected = edits.addText(text)
    setUnknown(rejected)
    setText(rejected.join(", "))
  }

  return (
    <div className="space-y-2">
      <input
        className="h-8 w-full rounded-sm border border-[#d0d0d0] bg-white px-2.5 text-[13px] outline-none focus:border-[#1a73e8]"
        placeholder={linker ? "输入候选项：单键, O, (CH2)1-3…，回车添加" : empty ? "输入候选项：H, Cl, CN, Me, Ph；环里 N, CR3…，回车添加" : "继续输入，回车添加"}
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
        <p className="text-[#b26a00]">看不懂：{unknown.join("、")}。只能填元素或缩写（如 H、Cl、CN、Me、Ph）；烷基、芳基这类范围请用类别。</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[#888]">常用：</span>
        {(linker ? LINKER_PRESETS : PRESETS).map((preset) => (
          <button key={preset.kind === "class" ? preset.class : preset.kind} className={CHIP} onClick={() => edits.add(preset)} title={`添加：${describeAlternative(preset)}`}>
            + {shortName(preset)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={ACTION} onClick={onClass} title="选类别，填碳数范围和取代情况">
          + 类别…
        </button>
        <button className={`${ACTION} font-medium`} onClick={onSketch} title="在卡片里展开画板，画出这个基团，再加进候选项">
          ✎ 画一个
        </button>
        <button
          className={ACTION}
          disabled={!canCapture}
          onClick={() => setCaptureProblem(onCapture())}
          title="在画布上单独画出片段，用 * 标出接到通式上的位置（双击原子输入 *；连接基画两个 *），选中整个片段后点这里"
        >
          + 用选中的结构
        </button>
        <span className="ml-1 flex items-center">
          <HelpLink onClick={() => onHelp("fragments")} label="片段怎么画" />
        </span>
      </div>
      {captureProblem && <p className="text-[#b26a00]">{captureProblem}</p>}
    </div>
  )
}
