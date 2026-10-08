import { useRef, type ReactNode } from "react"
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
 * dividers between them can be dragged, and are remembered.
 */
export function MarkushWorkspace({ canvas, ...props }: WorkspaceProps & { canvas: ReactNode }) {
  const whole = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const { splits, set, reset } = useSplits()
  return (
    <div ref={whole} className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f7f7f7]" data-testid="markush-workspace">
      <div ref={top} className="flex min-h-0 min-w-0" style={{ height: `${splits.top * 100}%` }}>
        <div className="flex min-h-0 min-w-0 flex-col" style={{ width: `${splits.left * 100}%` }}>
          <div className="flex min-h-0 flex-1 bg-white">{canvas}</div>
          <ConstraintsPane {...props} />
        </div>
        <SplitHandle axis="x" container={() => top.current} onMove={(fraction) => set("left", fraction)} onReset={() => reset("left")} label="调整画布和变量区的宽度" />
        <div className="min-h-0 min-w-0 flex-1 bg-[#f7f7f7]">
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
