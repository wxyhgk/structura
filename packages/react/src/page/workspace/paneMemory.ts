import { useState } from "react"

/** The constraints pane's tabs. */
export type ConstraintTab = "overview" | "provisos" | "closures" | "positions"

const TABS: ConstraintTab[] = ["overview", "provisos", "closures", "positions"]
const KEY = "structura.constraintsPane"

type Memory = { open: boolean; tab: ConstraintTab }

function load(): Memory {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Memory>
    return { open: saved.open !== false, tab: TABS.includes(saved.tab as ConstraintTab) ? (saved.tab as ConstraintTab) : "overview" }
  } catch {
    return { open: true, tab: "overview" }
  }
}

function save(memory: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    // Storage may be blocked; the pane still works, it just forgets.
  }
}

/** Whether the pane is open and which tab shows, remembered in this browser. Picking a tab opens it. */
export function usePaneMemory() {
  const [memory, setMemory] = useState(load)
  const update = (next: Partial<Memory>) => {
    const merged = { ...memory, ...next }
    save(merged)
    setMemory(merged)
  }
  return { ...memory, setOpen: (open: boolean) => update({ open }), setTab: (tab: ConstraintTab) => update({ tab, open: true }) }
}
