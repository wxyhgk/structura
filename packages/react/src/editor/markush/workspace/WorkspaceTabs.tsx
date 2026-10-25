import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "../../../components/ui/dropdown-menu.tsx"
import type { Workspace } from "./types.ts"

const TABS: Array<{ id: Workspace; label: string; title: string }> = [
  { id: "draw", label: "绘图", title: "画结构" },
  { id: "markush", label: "通式", title: "定义通式的变量，批量生成化合物" },
]

/** The switch between the two workspaces; both show the same document. */
export function WorkspaceTabs({ value, onChange }: { value: Workspace; onChange: (next: Workspace) => void }) {
  return (
    <div className="flex rounded-sm border border-(--c-cfcfcf) bg-(--c-ffffff) p-0.5 text-[12px]" role="tablist" aria-label="工作区">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          title={tab.title}
          className={`rounded-[2px] px-3 py-0.5 whitespace-nowrap ${value === tab.id ? "bg-(--c-1a73e8) text-white" : "text-(--c-444444) hover:bg-(--c-eef3fb)"}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/** The same switch as menu items, for the ☰ of an editor with no room for the tabs. */
export function WorkspaceItems({ value, onChange }: { value: Workspace; onChange: (next: Workspace) => void }) {
  return (
    <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as Workspace)}>
      {TABS.map((tab) => (
        <DropdownMenuRadioItem key={tab.id} value={tab.id}>
          {tab.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}
