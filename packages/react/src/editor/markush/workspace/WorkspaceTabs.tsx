import type { Workspace } from "./types.ts"

const TABS: Array<{ id: Workspace; label: string; title: string }> = [
  { id: "draw", label: "绘图", title: "画结构" },
  { id: "markush", label: "通式", title: "定义通式的变量，批量生成化合物" },
]

/** The switch between the two workspaces; both show the same document. */
export function WorkspaceTabs({ value, onChange }: { value: Workspace; onChange: (next: Workspace) => void }) {
  return (
    <div className="flex rounded-sm border border-[#cfcfcf] bg-white p-0.5 text-[12px]" role="tablist" aria-label="工作区">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          title={tab.title}
          className={`rounded-[2px] px-3 py-0.5 ${value === tab.id ? "bg-[#1a73e8] text-white" : "text-[#444] hover:bg-[#eef3fb]"}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
