import { useState } from "react"
import { defaultSite, type Scaffold } from "@structura/core/scaffolds"
import { matchScaffolds } from "./scaffoldSearch.ts"

/**
 * The quick template field `/` opens by the pointer: type part of a name, ↑↓ to choose,
 * Enter to put it on what the pointer was over when `/` was pressed, Esc to leave. Being a
 * field, it keeps every key it gets, so none of them reaches the canvas's hotkeys.
 */
export function QuickScaffold({
  left,
  top,
  target,
  onPick,
  onCancel,
}: {
  left: number
  top: number
  /** What it will act on, frozen when the field opened. */
  target: "atom" | "bond" | null
  onPick: (scaffold: Scaffold) => void
  onCancel: () => void
}) {
  const [text, setText] = useState("")
  const [index, setIndex] = useState(0)
  const found = matchScaffolds(text).slice(0, 8)
  const chosen = found[Math.min(index, found.length - 1)]
  const how = target === "atom" ? "接到这个原子上" : target === "bond" ? "并到这根键上（a 边）" : "放在这里"

  return (
    <div className="absolute z-20 w-56 rounded-lg border border-[#d0d0d0] bg-white p-1.5 text-[12px] shadow-lg" style={{ left: left + 14, top: top + 10 }} data-testid="quick-scaffold">
      <input
        autoFocus
        className="h-7 w-full rounded-md border border-[#d0d0d0] px-2 outline-none focus:border-[#1a73e8]"
        placeholder={`模板名，回车${how}`}
        value={text}
        aria-label="模板名"
        onChange={(event) => {
          setText(event.target.value)
          setIndex(0)
        }}
        onBlur={onCancel}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === "Escape") onCancel()
          else if (event.key === "ArrowDown") setIndex((index + 1) % Math.max(found.length, 1))
          else if (event.key === "ArrowUp") setIndex((index - 1 + found.length) % Math.max(found.length, 1))
          else if (event.key === "Enter" && chosen) onPick(chosen)
          else return
          event.preventDefault()
        }}
      />
      <ul className="mt-1 max-h-60 overflow-y-auto">
        {found.map((item) => (
          <li key={item.name}>
            <button
              className={`flex w-full items-baseline gap-2 rounded px-2 py-1 text-left ${item === chosen ? "bg-[#e8f1fb] text-[#1a73e8]" : "hover:bg-black/5"}`}
              // Keeps the field focused (and the menu open) until the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(item)}
            >
              <span>{item.zh}</span>
              <span className="text-[11px] text-[#888]">{item.name}</span>
              {target === "atom" && <span className="ml-auto text-[11px] text-[#888]">{defaultSite(item)}</span>}
            </button>
          </li>
        ))}
        {found.length === 0 && <li className="px-2 py-1 text-[#888]">没有这个模板</li>}
      </ul>
    </div>
  )
}
