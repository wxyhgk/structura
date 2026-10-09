import { useState, type ReactNode } from "react"
import { scaffoldNamed } from "@structura/core/scaffolds"
import type { AttachmentShape } from "@structura/markush"
import type { BondStyle, Bracket, RingKind } from "@structura/core/types"
import { ATTACH_SHAPES, BOND_STYLES, BRACKET_KINDS, keysFor, RING_KINDS, sameStyle, type ScaffoldPick, type ToolId, withKeys } from "@structura/engine"
import { ScrollArea } from "../../components/ui/scroll-area.tsx"
import { Separator } from "../../components/ui/separator.tsx"
import { ElementPalette } from "./ElementPalette.tsx"
import { ScaffoldPicker } from "./ScaffoldPicker.tsx"
import {
  AttachIcon,
  BondIcon,
  BracketIcon,
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
  scaffold: ScaffoldPick
  bracketKind: Bracket["kind"]
  attachShape: AttachmentShape | null
  /** Whether to offer the bracket and attachment tools (not in a sketch pad, which draws neither). */
  structureTools?: boolean
  onTool: (tool: ToolId) => void
  /** The bracket tool, of a kind if picked; selected atoms are bracketed at once. */
  onBracket: (kind?: Bracket["kind"]) => void
  /** The attachment tool, with a shape if picked; selected attachments take it. */
  onAttach: (shape?: AttachmentShape | null) => void
  onBondStyle: (style: BondStyle) => void
  onRingKind: (kind: RingKind) => void
  onElement: (el: string) => void
  onScaffold: (pick: ScaffoldPick) => void
}

/** What each bracket kind is for, as its flyout entry's tooltip. */
const BRACKET_HINTS: Record<Bracket["kind"], string> = {
  group: "基团 [ ]：括住的部分当作一个整体，外面的键可以连进括号",
  repeat: "重复单元 [ ]n：括住的部分重复 n 次（先是 1–4，右键括号可改）",
}

/** What each way of drawing does, as its flyout entry's tooltip; picking one also redraws the selected attachments. */
const SHAPE_HINTS: Record<AttachmentShape | "auto", string> = {
  auto: "自动：一个环里画直线，跨几个环画椭圆或弧线（也改选中的可变连接）",
  line: "直线：一根线连进环的中心（也改选中的可变连接）",
  loop: "椭圆：椭圆圈住这些环，取代基连到椭圆上（也改选中的可变连接）",
  arc: "弧线：键绕这些环转大约四分之三圈（也改选中的可变连接）",
  bracket: "括号：一根键连进方括号",
}

/** Label with the keys that select this tool, taken from the key table. */
function toolTitle(label: string, tool: string): string {
  return withKeys(label, keysFor((entry) => entry.tool === tool))
}

export function ToolPalette(props: PaletteProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
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
          {props.structureTools !== false && (
            <>
              <ToolFlyout
                label={toolTitle("方括号：拖框括住原子；先选中原子再点也可以", "bracket")}
                caretLabel="括号的种类"
                testId="tool-bracket"
                active={props.tool === "bracket"}
                icon={<BracketIcon kind={props.bracketKind} />}
                onClick={() => props.onBracket()}
                labelled
                items={BRACKET_KINDS.map((item) => ({
                  id: item.kind,
                  label: item.label,
                  title: BRACKET_HINTS[item.kind],
                  active: item.kind === props.bracketKind,
                  icon: <BracketIcon kind={item.kind} />,
                  onPick: () => props.onBracket(item.kind),
                }))}
              />
              <ToolFlyout
                label={toolTitle("可变连接：从原子拖过环，划过的环都是可接的位置", "attach")}
                caretLabel="可变连接的画法"
                testId="tool-attach"
                active={props.tool === "attach"}
                icon={<AttachIcon shape={props.attachShape ?? "arc"} />}
                onClick={() => props.onAttach()}
                labelled
                items={ATTACH_SHAPES.map((item) => ({
                  id: item.shape ?? "auto",
                  label: item.label,
                  title: SHAPE_HINTS[item.shape ?? "auto"],
                  active: item.shape === props.attachShape,
                  icon: <AttachIcon shape={item.shape ?? "auto"} />,
                  onPick: () => props.onAttach(item.shape),
                }))}
              />
            </>
          )}
        </div>
        <Separator />
        <div className="p-1">
          <button
            type="button"
            data-testid="open-scaffolds"
            className={`mx-0.5 my-1 h-7 w-[calc(100%-4px)] truncate rounded-sm border px-1 text-[12px] ${props.tool === "scaffold" ? "border-[#1a73e8] bg-[#e8f1fb] text-[#1a73e8]" : "border-[#d0d0d0] bg-white hover:bg-[#e8f1fb]"}`}
            title="模板分子：常用环系，带编号的连接位点"
            onClick={() => setPickerOpen(true)}
          >
            {props.tool === "scaffold" ? scaffoldNamed(props.scaffold.name)?.zh : "模板"}
          </button>
        </div>
        <ScaffoldPicker key={pickerOpen ? "open" : "closed"} open={pickerOpen} onOpenChange={setPickerOpen} current={props.scaffold} onPick={props.onScaffold} />
        <Separator />
        <ElementPalette tool={props.tool} atomEl={props.atomEl} onElement={props.onElement} />
      </ScrollArea>
    </aside>
  )
}
