import { useState, type ReactElement, type ReactNode } from "react"
import { elementColor, paletteElements } from "@/chem/elements/index"
import type { BondStyle, RingKind, ToolId } from "@/chem/types"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  BondIcon,
  ChainIcon,
  ChargeMinusIcon,
  ChargePlusIcon,
  EraserIcon,
  LassoIcon,
  MarqueeIcon,
  RingIcon,
} from "@/editor/icons"
import { PeriodicTable } from "@/editor/PeriodicTable"
import { BOND_STYLES, RING_KINDS, sameStyle } from "@/editor/tools"

type PaletteProps = {
  tool: ToolId
  bondStyle: BondStyle
  ringKind: RingKind
  atomEl: string
  onTool: (tool: ToolId) => void
  onBondStyle: (style: BondStyle) => void
  onRingKind: (kind: RingKind) => void
  onElement: (el: string) => void
}

function Hint({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function ToolButton({
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

export function ToolPalette(props: PaletteProps) {
  const [bondOpen, setBondOpen] = useState(false)
  const [ringOpen, setRingOpen] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)

  return (
    <aside className="flex w-[78px] shrink-0 flex-col border-r border-[#d0d0d0] bg-[#f3f3f3]">
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid grid-cols-2 gap-px p-1">
          <ToolButton label="套索 (V)" active={props.tool === "lasso"} testId="tool-lasso" onClick={() => props.onTool("lasso")}>
            <LassoIcon />
          </ToolButton>
          <ToolButton label="框选 (M)" active={props.tool === "marquee"} testId="tool-marquee" onClick={() => props.onTool("marquee")}>
            <MarqueeIcon />
          </ToolButton>
          <div className="relative">
            <ToolButton label="键 (B)" active={props.tool === "bond"} testId="tool-bond" onClick={() => props.onTool("bond")}>
              <BondIcon style={props.bondStyle} />
            </ToolButton>
            <Popover open={bondOpen} onOpenChange={setBondOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="flyout-caret" aria-label="键的类型">
                  <Caret />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-auto p-1">
                <div className="grid grid-cols-3 gap-0.5">
                  {BOND_STYLES.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="tool-button"
                      data-active={sameStyle(item.style, props.bondStyle) ? "true" : "false"}
                      aria-label={item.label}
                      onClick={() => {
                        props.onBondStyle(item.style)
                        props.onTool("bond")
                        setBondOpen(false)
                      }}
                    >
                      <BondIcon style={item.style} />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <ToolButton label="碳链 (K)" active={props.tool === "chain"} testId="tool-chain" onClick={() => props.onTool("chain")}>
            <ChainIcon />
          </ToolButton>
          <div className="relative">
            <ToolButton label="环 (R)" active={props.tool === "ring"} testId="tool-ring" onClick={() => props.onTool("ring")}>
              <RingIcon kind={props.ringKind} />
            </ToolButton>
            <Popover open={ringOpen} onOpenChange={setRingOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="flyout-caret" aria-label="环的类型">
                  <Caret />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-auto p-1">
                <div className="grid grid-cols-3 gap-0.5">
                  {RING_KINDS.map((item) => (
                    <button
                      key={item.kind}
                      type="button"
                      className="tool-button"
                      data-active={item.kind === props.ringKind ? "true" : "false"}
                      aria-label={item.label}
                      onClick={() => {
                        props.onRingKind(item.kind)
                        props.onTool("ring")
                        setRingOpen(false)
                      }}
                    >
                      <RingIcon kind={item.kind} />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <ToolButton label="橡皮 (E)" active={props.tool === "eraser"} testId="tool-eraser" onClick={() => props.onTool("eraser")}>
            <EraserIcon />
          </ToolButton>
          <ToolButton label="正电荷" active={props.tool === "charge-plus"} testId="tool-charge-plus" onClick={() => props.onTool("charge-plus")}>
            <ChargePlusIcon />
          </ToolButton>
          <ToolButton label="负电荷" active={props.tool === "charge-minus"} testId="tool-charge-minus" onClick={() => props.onTool("charge-minus")}>
            <ChargeMinusIcon />
          </ToolButton>
        </div>
        <Separator />
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
              active={props.tool === "atom" && props.atomEl === element.symbol}
              testId={`tool-atom-${element.symbol}`}
              onClick={() => props.onElement(element.symbol)}
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
      </ScrollArea>
      <PeriodicTable
        open={tableOpen}
        current={props.tool === "atom" ? props.atomEl : ""}
        onOpenChange={setTableOpen}
        onPick={(symbol) => {
          props.onElement(symbol)
          setTableOpen(false)
        }}
      />
    </aside>
  )
}

function Caret() {
  return (
    <svg viewBox="0 0 8 8" width="7" height="7" aria-hidden="true">
      <path d="M1 2.2 L4 5.6 L7 2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
