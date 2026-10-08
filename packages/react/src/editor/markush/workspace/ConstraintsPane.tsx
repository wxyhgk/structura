import { useMemo } from "react"
import { ClosuresSection } from "../ClosuresSection.tsx"
import { ProvisosSection } from "../ProvisosSection.tsx"
import { ConstraintTabs, type TabItem } from "./ConstraintTabs.tsx"
import { Empty } from "./EmptyNote.tsx"
import { formulaFacts } from "./formulaFacts.ts"
import { OverviewTab } from "./OverviewTab.tsx"
import { usePaneMemory } from "./paneMemory.ts"
import { PositionsTab } from "./PositionsTab.tsx"
import type { WorkspaceProps } from "./types.ts"

/**
 * The formula-level settings under its canvas, kept compact so the canvas keeps the height:
 * an overview, the provisos, the ring closures and the variable positions, one tab at a time.
 * Folds down to its tab strip; which tab and whether it is open are remembered.
 */
export function ConstraintsPane({ drawing, run }: WorkspaceProps) {
  const { open, tab, setOpen, setTab } = usePaneMemory()
  const facts = useMemo(() => formulaFacts(drawing), [drawing])
  const provisos = drawing.provisos ?? []
  const closures = drawing.ringClosures ?? []
  const attachments = drawing.attachments ?? []
  const listed = Object.keys(drawing.variables ?? {}).length
  const tabs: TabItem[] = [
    { id: "overview", label: "概览" },
    { id: "provisos", label: "附加条件", count: provisos.length },
    { id: "closures", label: "成环", count: closures.length },
    { id: "positions", label: "位置", count: attachments.length },
  ]
  const folded = facts.names.length > 0 && `变量 ${facts.defined.length}/${facts.names.length} 已定义`

  return (
    <section className="flex shrink-0 flex-col border-t border-[#d0d0d0] bg-white text-[12px]" data-testid="constraintsPane">
      <ConstraintTabs tabs={tabs} active={tab} open={open} onTab={setTab} onToggle={() => setOpen(!open)} folded={folded} />
      {open && (
        <div className="max-h-[240px] overflow-y-auto border-t border-[#e0e0e0]" role="tabpanel">
          {tab === "overview" && <OverviewTab drawing={drawing} facts={facts} run={run} />}
          {tab === "provisos" &&
            (listed === 0 ? (
              <Empty>先在右侧定义变量，再在这里排除某些组合或化合物。</Empty>
            ) : (
              <div className="max-w-[640px]">
                <ProvisosSection provisos={drawing.provisos} variables={drawing.variables} run={run} heading={false} />
              </div>
            ))}
          {tab === "closures" &&
            (listed < 2 ? (
              <Empty>至少定义两个变量后，才能设置“两个变量一起成环”。</Empty>
            ) : (
              <div className="max-w-[640px]">
                <ClosuresSection closures={drawing.ringClosures} variables={drawing.variables} run={run} heading={false} />
              </div>
            ))}
          {tab === "positions" && <PositionsTab drawing={drawing} run={run} />}
        </div>
      )}
    </section>
  )
}
