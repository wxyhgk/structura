import { useState } from "react"
import { Button } from "@/components/ui/button"
import { HelpLink } from "@/guide"
import { AttachmentRow } from "../AttachmentRow.tsx"
import { variableNames } from "../variableNames.ts"
import type { WorkspaceProps } from "./types.ts"
import { VariableCard, type SketchTarget } from "./VariableCard.tsx"

/**
 * The generic-formula workspace's variables: a card for every placeholder (on the drawing,
 * defined, or inside a piece) with what it may stand for, and the variable attachments.
 */
export function VariablesBoard({ drawing, run, selected, colorHetero, onHelp, onFill }: WorkspaceProps) {
  const { molecule: mol, variables, attachments } = drawing
  const { names, onDrawing, nested, linkers, siteOf } = variableNames(mol, variables, attachments)
  /** The one inline sketch pad that is open, if any: which variable, and new or which drawn alternative. */
  const [sketch, setSketch] = useState<SketchTarget | null>(null)

  return (
    <div className="flex flex-col gap-3 p-4 text-[12px] text-[#333]" data-testid="variablesBoard">
      <header className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold">变量</h2>
        {names.length > 0 && <span className="rounded-full bg-[#e8eaed] px-2 py-px text-[11px] text-[#555]">{names.length}</span>}
        <div className="ml-auto flex items-center gap-2">
          {onFill && (
            <Button size="sm" variant="outline" onClick={onFill}>
              从专利文字填写…
            </Button>
          )}
          <HelpLink onClick={() => onHelp("markush")} label="通式变量怎么用" />
        </div>
      </header>

      {names.length === 0 ? (
        <EmptyState />
      ) : (
        names.map((name) => (
          <VariableCard
            key={name}
            name={name}
            variables={variables}
            onDrawing={onDrawing.includes(name)}
            nested={nested.has(name)}
            linker={linkers.has(name)}
            site={siteOf(name)}
            mol={mol}
            selected={selected}
            colorHetero={colorHetero}
            run={run}
            onHelp={onHelp}
            sketch={sketch?.name === name ? sketch.index : null}
            onSketch={(index) => setSketch(index == null ? null : { name, index })}
          />
        ))
      )}

      {attachments && attachments.length > 0 && (
        <section className="overflow-hidden rounded-md border border-[#d0d0d0] bg-white">
          <h3 className="border-b border-[#e6e6e6] bg-[#fafafa] px-3 py-1.5 text-[12px] font-medium text-[#555]">可变连接</h3>
          {attachments.map((attachment) => (
            <AttachmentRow key={attachment.atom} attachment={attachment} mol={mol} run={run} />
          ))}
        </section>
      )}
    </div>
  )
}

/** What to do first, while the formula has no variables yet. */
function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-[#c8c8c8] bg-white px-5 py-6 text-[13px] leading-relaxed text-[#555]" data-testid="variables-empty">
      <p className="mb-2 font-medium text-[#333]">还没有变量</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>在左边的画布上画出通式的骨架（母核）。</li>
        <li>双击要变化的原子，输入 R1、X、Ar 这样的名字，它就成了变量。</li>
        <li>变量会出现在这里，再给每个变量填上候选项：元素、缩写、类别，或者直接画一个基团。</li>
      </ol>
    </div>
  )
}
