import type { ReactNode } from "react"
import { ConstraintsPane } from "./ConstraintsPane.tsx"
import { ResultsPane } from "./ResultsPane.tsx"
import type { WorkspaceProps } from "./types.ts"
import { VariablesBoard } from "./VariablesBoard.tsx"

/**
 * The generic-formula workspace: the formula's canvas (passed in, the same editor as the
 * drawing workspace) with its constraints below it on the left, the variables on the right,
 * and the compounds it generates along the bottom, kept up to date as it changes.
 */
export function MarkushWorkspace({ canvas, ...props }: WorkspaceProps & { canvas: ReactNode }) {
  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(360px,5fr)_minmax(360px,4fr)] grid-rows-[minmax(0,3fr)_minmax(180px,2fr)] bg-[#f7f7f7]" data-testid="markush-workspace">
      <div className="flex min-h-0 min-w-0 flex-col border-r border-b border-[#d0d0d0]">
        <div className="flex min-h-0 flex-1 bg-white">{canvas}</div>
        <ConstraintsPane {...props} />
      </div>
      <div className="min-h-0 overflow-y-auto border-b border-[#d0d0d0]">
        <VariablesBoard {...props} />
      </div>
      <div className="col-span-2 min-h-0">
        <ResultsPane {...props} />
      </div>
    </div>
  )
}
