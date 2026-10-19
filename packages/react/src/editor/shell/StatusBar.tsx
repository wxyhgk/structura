export function StatusBar({
  toolLabel,
  formula,
  weight,
  valenceErrors,
  atomCount,
  zoom,
}: {
  toolLabel: string
  formula: string
  weight: number
  valenceErrors: number
  atomCount: number
  zoom: number
}) {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-(--c-d0d0d0) bg-(--c-f2f2f2) px-3 text-[12px] text-(--c-333333)">
      <span className="min-w-16 whitespace-nowrap text-(--c-555555)" data-testid="tool-label">
        {toolLabel}
      </span>
      <span className="min-w-16 font-[Arial,Helvetica,sans-serif] text-[13px] tracking-wide" data-testid="formula">
        {formula || "—"}
      </span>
      <span className="text-(--c-666666)" data-testid="mw">
        {formula ? weight.toFixed(2) : ""}
      </span>
      {valenceErrors > 0 && <span className="text-(--c-d1242f)">{valenceErrors} 个原子价态异常</span>}
      <span className="ml-auto text-(--c-666666)">
        {atomCount} 原子 · {Math.round(zoom * 100)}%
      </span>
    </footer>
  )
}
