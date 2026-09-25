import { elementAt, type ElementCategory, type ElementRecord } from "@/chem/elements/index"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const CATEGORY_BG: Record<ElementCategory, string> = {
  alkali: "#f8d0d4",
  alkaline: "#fde4c8",
  transition: "#f8f1c8",
  "post-transition": "#d7f2dc",
  metalloid: "#d5f0c8",
  nonmetal: "#d4eef8",
  halogen: "#f8efc0",
  noble: "#eddff8",
  lanthanide: "#d4f0ea",
  actinide: "#f8dce6",
}

const MAIN_ROWS = [1, 2, 3, 4, 5, 6, 7]
const SERIES_ROWS = [9, 10]

type PeriodicTableProps = {
  open: boolean
  current: string
  onOpenChange: (open: boolean) => void
  onPick: (symbol: string) => void
}

export function PeriodicTable({ open, current, onOpenChange, onPick }: PeriodicTableProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-[calc(100%-1.5rem)] sm:max-w-[40rem]">
        <DialogHeader>
          <DialogTitle>元素周期表</DialogTitle>
          <DialogDescription>点一个元素，再点原子可以替换，点空白处可以放下它。</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <div className="flex w-max flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              {MAIN_ROWS.map((row) => (
                <ElementRow key={row} row={row} current={current} onPick={onPick} />
              ))}
            </div>
            <div className="flex flex-col gap-0.5">
              {SERIES_ROWS.map((row) => (
                <ElementRow key={row} row={row} current={current} onPick={onPick} />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ElementRow({
  row,
  current,
  onPick,
}: {
  row: number
  current: string
  onPick: (symbol: string) => void
}) {
  return (
    <div className="grid grid-cols-[repeat(18,1.9rem)] gap-0.5">
      {Array.from({ length: 18 }, (_, index) => {
        const col = index + 1
        const element = elementAt(col, row)
        if (!element) {
          const marker = (row === 6 && col === 3) || (row === 7 && col === 3)
          return (
            <div key={col} className="flex h-8 items-center justify-center text-[9px] text-neutral-400">
              {marker ? "*" : ""}
            </div>
          )
        }
        return <ElementCell key={element.symbol} element={element} current={current} onPick={onPick} />
      })}
    </div>
  )
}

function ElementCell({
  element,
  current,
  onPick,
}: {
  element: ElementRecord
  current: string
  onPick: (symbol: string) => void
}) {
  const selected = element.symbol === current
  return (
    <button
      type="button"
      data-testid={`element-${element.symbol}`}
      title={`${element.z} ${element.name} ${element.mass}`}
      aria-label={`${element.name} ${element.symbol}`}
      aria-pressed={selected}
      className="flex h-8 flex-col items-center justify-center rounded-sm leading-none hover:ring-1 hover:ring-neutral-500"
      style={{
        background: CATEGORY_BG[element.category],
        color: element.color ?? "#222222",
        boxShadow: selected ? "inset 0 0 0 1.5px #1a73e8" : undefined,
      }}
      onClick={() => onPick(element.symbol)}
    >
      <span className="text-[8px] text-neutral-500">{element.z}</span>
      <span className="font-[Arial,Helvetica,sans-serif] text-[11px] font-semibold">{element.symbol}</span>
    </button>
  )
}
