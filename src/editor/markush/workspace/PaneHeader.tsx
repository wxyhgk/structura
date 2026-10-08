import type { ReactNode } from "react"

/** The title bar every pane of the generic-formula workspace starts with, so the three read as one page. */
export function PaneHeader({ title, count, children }: { title: ReactNode; count?: number; children?: ReactNode }) {
  return (
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-[#e3e3e3] bg-white px-3 text-[12px]">
      <h2 className="text-[13px] font-semibold text-[#222]">{title}</h2>
      {count != null && count > 0 && <span className="rounded-full bg-[#eef1f5] px-1.5 text-[11px] leading-[18px] text-[#555]">{count}</span>}
      {children}
    </header>
  )
}
