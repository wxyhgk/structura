import type { ReactElement, ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function Hint({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function ToolButton({
  label,
  active,
  testId,
  onClick,
  children,
}: {
  label: string
  active: boolean
  testId: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Hint label={label}>
      <button
        type="button"
        data-testid={testId}
        data-active={active ? "true" : "false"}
        aria-label={label}
        aria-pressed={active}
        className="tool-button"
        onClick={onClick}
      >
        {children}
      </button>
    </Hint>
  )
}

export function Caret() {
  return (
    <svg viewBox="0 0 8 8" width="7" height="7" aria-hidden="true">
      <path d="M1 2.2 L4 5.6 L7 2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
