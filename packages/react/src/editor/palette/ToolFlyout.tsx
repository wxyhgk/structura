import { useState, type ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.tsx"
import { Caret, ToolButton } from "./ToolButton.tsx"

export type FlyoutItem = {
  id: string
  label: string
  /** Tooltip, usually the label with its keys. */
  title: string
  active: boolean
  icon: ReactNode
  onPick: () => void
}

/** A tool button with a caret that opens a grid of variants (bond styles, ring kinds). */
export function ToolFlyout({
  label,
  caretLabel,
  testId,
  active,
  icon,
  onClick,
  items,
}: {
  label: string
  caretLabel: string
  testId: string
  active: boolean
  icon: ReactNode
  onClick: () => void
  items: FlyoutItem[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <ToolButton label={label} active={active} testId={testId} onClick={onClick}>
        {icon}
      </ToolButton>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="flyout-caret" aria-label={caretLabel}>
            <Caret />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-auto p-1">
          <div className="grid grid-cols-3 gap-0.5">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="tool-button"
                data-active={item.active ? "true" : "false"}
                aria-label={item.label}
                title={item.title}
                onClick={() => {
                  item.onPick()
                  setOpen(false)
                }}
              >
                {item.icon}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
