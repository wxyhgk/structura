import type { ReactNode } from "react"
import type { BondStyle, RingKind } from "@structura/core/types"
import type { ToolId } from "@/editor/tools/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { BOND_STYLES, RING_KINDS, sameStyle } from "@/editor/tools/catalog"
import { keysFor, withKeys } from "@/editor/tools/bindings"
import { ElementPalette } from "./ElementPalette.tsx"
import {
  BondIcon,
  ChainIcon,
  ChargeMinusIcon,
  ChargePlusIcon,
  EraserIcon,
  LassoIcon,
  MarqueeIcon,
  RingIcon,
} from "./icons.tsx"
import { ToolButton } from "./ToolButton.tsx"
import { ToolFlyout } from "./ToolFlyout.tsx"

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

/** Label with the keys that select this tool, taken from the key table. */
function toolTitle(label: string, tool: string): string {
  return withKeys(label, keysFor((entry) => entry.tool === tool))
}

export function ToolPalette(props: PaletteProps) {
  const simple = (tool: ToolId, label: string, icon: ReactNode) => (
    <ToolButton label={toolTitle(label, tool)} active={props.tool === tool} testId={`tool-${tool}`} onClick={() => props.onTool(tool)}>
      {icon}
    </ToolButton>
  )

  return (
    <aside className="flex w-[78px] shrink-0 flex-col border-r border-[#d0d0d0] bg-[#f3f3f3]">
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid grid-cols-2 gap-px p-1">
          {simple("lasso", "套索", <LassoIcon />)}
          {simple("marquee", "框选", <MarqueeIcon />)}
          <ToolFlyout
            label={withKeys("键", keysFor((entry) => entry.key === "b"))}
            caretLabel="键的类型"
            testId="tool-bond"
            active={props.tool === "bond"}
            icon={<BondIcon style={props.bondStyle} />}
            onClick={() => props.onTool("bond")}
            items={BOND_STYLES.map((item) => ({
              id: item.label,
              label: item.label,
              title: withKeys(item.label, keysFor((entry) => entry.tool === "bond" && sameStyle(entry.style, item.style))),
              active: sameStyle(item.style, props.bondStyle),
              icon: <BondIcon style={item.style} />,
              onPick: () => {
                props.onBondStyle(item.style)
                props.onTool("bond")
              },
            }))}
          />
          {simple("chain", "碳链", <ChainIcon />)}
          <ToolFlyout
            label={toolTitle("环", "ring-current")}
            caretLabel="环的类型"
            testId="tool-ring"
            active={props.tool === "ring"}
            icon={<RingIcon kind={props.ringKind} />}
            onClick={() => props.onTool("ring")}
            items={RING_KINDS.map((item) => ({
              id: item.kind,
              label: item.label,
              title: withKeys(item.label, keysFor((entry) => entry.tool === "ring" && entry.ring === item.kind)),
              active: item.kind === props.ringKind,
              icon: <RingIcon kind={item.kind} />,
              onPick: () => {
                props.onRingKind(item.kind)
                props.onTool("ring")
              },
            }))}
          />
          {simple("eraser", "橡皮", <EraserIcon />)}
          {simple("charge-plus", "正电荷", <ChargePlusIcon />)}
          {simple("charge-minus", "负电荷", <ChargeMinusIcon />)}
        </div>
        <Separator />
        <ElementPalette tool={props.tool} atomEl={props.atomEl} onElement={props.onElement} />
      </ScrollArea>
    </aside>
  )
}
