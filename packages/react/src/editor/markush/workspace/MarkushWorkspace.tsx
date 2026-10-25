import { useRef, useState, type ReactNode } from "react"
import { useLayoutContext } from "../../shell/layout.ts"
import { ConstraintsPane } from "./ConstraintsPane.tsx"
import { ResultsPane } from "./ResultsPane.tsx"
import type { WorkspaceProps } from "./types.ts"
import { SplitHandle } from "./SplitHandle.tsx"
import { useSplits } from "./useSplits.ts"
import { VariablesBoard } from "./VariablesBoard.tsx"

/**
 * The generic-formula workspace: the formula's canvas (passed in, the same editor as the
 * drawing workspace) with its constraints below it on the left, the variables on the right,
 * and the compounds it generates along the bottom, kept up to date as it changes. The
 * dividers between them can be dragged, and are remembered. With no room for that (a compact
 * or mini editor), one of the three at a time, chosen above them.
 */
export function MarkushWorkspace({ canvas, ...props }: WorkspaceProps & { canvas: ReactNode }) {
  if (useLayoutContext() !== "full") return <PaneByPane canvas={canvas} {...props} />
  return <SideBySide canvas={canvas} {...props} />
}

const PANES = [
  { id: "formula", label: "结构" },
  { id: "variables", label: "变量" },
  { id: "results", label: "生成结果" },
] as const

function PaneByPane({ canvas, ...props }: WorkspaceProps & { canvas: ReactNode }) {
  const [pane, setPane] = useState<(typeof PANES)[number]["id"]>("formula")
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-(--c-f7f7f7)" data-testid="markush-workspace">
      <div className="flex shrink-0 border-b border-(--c-d5d5d5) bg-(--c-f2f2f2) px-1 text-[12px]" role="tablist" aria-label="通式">
        {PANES.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={pane === item.id}
            className={`-mb-px border-b-2 px-3 py-1.5 whitespace-nowrap pointer-coarse:py-2.5 ${pane === item.id ? "border-(--c-1a73e8) text-(--c-1a73e8)" : "border-transparent text-(--c-555555) hover:text-(--c-222222)"}`}
            onClick={() => setPane(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {pane === "formula" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 bg-(--c-ffffff)">{canvas}</div>
          <ConstraintsPane {...props} />
        </div>
      )}
      {pane === "variables" && (
        <div className="min-h-0 flex-1">
          <VariablesBoard {...props} />
        </div>
      )}
      {pane === "results" && (
        <div className="min-h-0 flex-1">
          <ResultsPane {...props} />
        </div>
      )}
    </div>
  )
}

function SideBySide({ canvas, ...props }: WorkspaceProps & { canvas: ReactNode }) {
  const whole = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const { splits, set, reset } = useSplits()
  return (
    <div ref={whole} className="flex min-h-0 min-w-0 flex-1 flex-col bg-(--c-f7f7f7)" data-testid="markush-workspace">
      <div ref={top} className="flex min-h-0 min-w-0" style={{ height: `${splits.top * 100}%` }}>
        <div className="flex min-h-0 min-w-0 flex-col" style={{ width: `${splits.left * 100}%` }}>
          <div className="flex min-h-0 flex-1 bg-(--c-ffffff)">{canvas}</div>
          <ConstraintsPane {...props} />
        </div>
        <SplitHandle axis="x" container={() => top.current} onMove={(fraction) => set("left", fraction)} onReset={() => reset("left")} label="调整画布和变量区的宽度" />
        <div className="min-h-0 min-w-0 flex-1 bg-(--c-f7f7f7)">
          <VariablesBoard {...props} />
        </div>
      </div>
      <SplitHandle axis="y" container={() => whole.current} onMove={(fraction) => set("top", fraction)} onReset={() => reset("top")} label="调整上下两部分的高度" />
      <div className="min-h-0 flex-1">
        <ResultsPane {...props} />
      </div>
    </div>
  )
}
