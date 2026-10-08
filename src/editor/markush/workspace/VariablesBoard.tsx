import { useState } from "react"
import { Button } from "@/components/ui/button"
import { HelpLink } from "@/guide"
import { alternativesOf } from "@structura/markush"
import { variableEdits } from "../variableEdits.ts"
import { variableNames } from "../variableNames.ts"
import { InlineSketch } from "./InlineSketch.tsx"
import { PaneHeader } from "./PaneHeader.tsx"
import type { WorkspaceProps } from "./types.ts"
import { VariableCard, type SketchTarget } from "./VariableCard.tsx"

/**
 * The generic-formula workspace's variables: a card for every placeholder (on the drawing,
 * defined, or inside a piece) with what it may stand for (the variable attachments are in the constraints pane, under 位置).
 */
export function VariablesBoard({ drawing, run, selected, colorHetero, onHelp, onFill }: WorkspaceProps) {
  const { molecule: mol, variables, attachments } = drawing
  const { names, onDrawing, nested, linkers, siteOf } = variableNames(mol, variables, attachments)
  /** The one inline sketch pad that is open, if any: which variable, and new or which drawn alternative. */
  const [sketch, setSketch] = useState<SketchTarget | null>(null)

  if (sketch) {
    const drawn = typeof sketch.index === "number" ? alternativesOf(variables, sketch.name)[sketch.index] : undefined
    const close = () => setSketch(null)
    return (
      <InlineSketch
        key={`${sketch.name}:${sketch.index}`}
        name={sketch.name}
        kind={siteOf(sketch.name)}
        initial={drawn?.kind === "fragment" ? drawn : undefined}
        onSave={(piece, alsoAt) => {
          variableEdits(sketch.name, variables, run).saveSketch(sketch.index, piece, alsoAt)
          close()
        }}
        onCancel={close}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-[12px] text-[#333]" data-testid="variablesBoard">
      <PaneHeader title="变量" count={names.length}>
        <div className="ml-auto flex items-center gap-2">
          {onFill && (
            <Button size="sm" variant="outline" onClick={onFill}>
              从专利文字填写…
            </Button>
          )}
          <HelpLink onClick={() => onHelp("markush")} label="通式变量怎么用" />
        </div>
      </PaneHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
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
            sketch={null}
            onSketch={(index) => setSketch(index == null ? null : { name, index })}
          />
        ))
      )}
      </div>
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
