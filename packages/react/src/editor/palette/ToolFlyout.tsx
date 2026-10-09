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

/**
 * A tool button with a caret that opens its variants: a grid of icons (bond styles, ring
 * kinds), or with `labelled` a list of icons with their names (bracket kinds, attachment shapes).
 */
export function ToolFlyout({
  label,
  caretLabel,
  testId,
  active,
  icon,
  onClick,
  items,
  labelled = false,
}: {
  label: string
  caretLabel: string
  testId: string
  active: boolean
  icon: ReactNode
  onClick: () => void
  items: FlyoutItem[]
  labelled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <ToolButton label={label} active={active} testId={testId} onClick={onClick}>
        {icon}
      </ToolButton>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="flyout-caret" aria-label={caretLabel} data-testid={`${testId}-caret`}>
            <Caret />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-auto p-1">
          <div className={labelled ? "flex flex-col gap-0.5" : "grid grid-cols-3 gap-0.5"}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={labelled ? "tool-button gap-2 pr-3 pl-1 text-[12px] whitespace-nowrap" : "tool-button"}
                style={labelled ? { width: "auto", justifyContent: "flex-start" } : undefined}
                data-active={item.active ? "true" : "false"}
                data-testid={`${testId}-option-${item.id}`}
                aria-label={item.label}
                title={item.title}
                onClick={() => {
                  item.onPick()
                  setOpen(false)
                }}
              >
                {item.icon}
                {labelled && <span>{item.label}</span>}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
