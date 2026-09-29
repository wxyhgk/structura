import { useState } from "react"
import { elementColor, paletteElements } from "@/chem/elements/index"
import type { ToolId } from "@/chem/types"
import { PeriodicTable } from "./PeriodicTable.tsx"
import { ToolButton } from "./ToolButton.tsx"

/** The common elements as buttons, plus the full periodic table in a dialog. */
export function ElementPalette({
  tool,
  atomEl,
  onElement,
}: {
  tool: ToolId
  atomEl: string
  onElement: (el: string) => void
}) {
  const [tableOpen, setTableOpen] = useState(false)
  return (
    <>
      <div className="grid grid-cols-2 gap-px p-1 pb-2">
        <button
          type="button"
          data-testid="open-periodic-table"
          className="col-span-2 mx-0.5 my-1 h-7 rounded-sm border border-[#d0d0d0] bg-white text-[12px] hover:bg-[#e8f1fb]"
          onClick={() => setTableOpen(true)}
        >
          周期表
        </button>
        {paletteElements().map((element) => (
          <ToolButton
            key={element.symbol}
            label={`${element.name} ${element.symbol}`}
            active={tool === "atom" && atomEl === element.symbol}
            testId={`tool-atom-${element.symbol}`}
            onClick={() => onElement(element.symbol)}
          >
            <span
              className="font-[Arial,Helvetica,sans-serif] text-[13px] font-semibold"
              style={{ color: elementColor(element.symbol, true) }}
            >
              {element.symbol}
            </span>
          </ToolButton>
        ))}
      </div>
      <PeriodicTable
        open={tableOpen}
        current={tool === "atom" ? atomEl : ""}
        onOpenChange={setTableOpen}
        onPick={(symbol) => {
          onElement(symbol)
          setTableOpen(false)
        }}
      />
    </>
  )
}
