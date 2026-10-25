import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"
import type { ConstraintTab } from "./paneMemory.ts"

export type TabItem = { id: ConstraintTab; label: string; count?: number }

/** The constraints pane's header: its tabs, with counts, and the chevron that folds the body away. */
export function ConstraintTabs({
  tabs,
  active,
  open,
  onTab,
  onToggle,
  folded,
}: {
  tabs: TabItem[]
  active: ConstraintTab
  open: boolean
  onTab: (tab: ConstraintTab) => void
  onToggle: () => void
  /** Shown at the right while folded, so the gist stays in view. */
  folded?: ReactNode
}) {
  return (
    <div className="flex h-9 shrink-0 items-stretch gap-0.5 border-t border-(--c-e3e3e3) bg-(--c-ffffff) pr-1.5 pl-1 text-[12px]">
      <div className="flex min-w-0 items-stretch overflow-x-auto" role="tablist" aria-label="通式约束">
        {tabs.map((tab) => {
          const selected = open && tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`relative flex shrink-0 items-center gap-1 px-2.5 whitespace-nowrap ${selected ? "font-medium text-(--c-1a73e8)" : "text-(--c-555555) hover:text-(--c-222222)"}`}
              onClick={() => onTab(tab.id)}
            >
              {tab.label}
              {tab.count != null && (
                <span className={`min-w-4 rounded-full px-1 text-center text-[11px] leading-4 font-normal ${tab.count > 0 ? (selected ? "bg-(--c-e3edfc) text-(--c-1a73e8)" : "bg-(--c-e6e6e6) text-(--c-555555)") : "text-(--c-aaaaaa)"}`}>
                  {tab.count}
                </span>
              )}
              {selected && <span className="absolute inset-x-1.5 bottom-0 h-[2px] rounded-full bg-(--c-1a73e8)" />}
            </button>
          )
        })}
      </div>
      <span className="flex-1" />
      {!open && folded && <div className="flex min-w-0 items-center truncate text-[11px] text-(--c-777777)">{folded}</div>}
      <button
        type="button"
        className="my-auto ml-1 flex size-6 shrink-0 items-center justify-center rounded-sm text-(--c-666666) hover:bg-(--c-e8e8e8)"
        aria-label={open ? "收起约束" : "展开约束"}
        aria-expanded={open}
        title={open ? "收起，让画布更高" : "展开"}
        onClick={onToggle}
      >
        <ChevronDown className={`size-4 transition-transform ${open ? "" : "rotate-180"}`} />
      </button>
    </div>
  )
}
