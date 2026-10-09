import type { Attachment, AttachmentShape } from "@structura/markush"
import type { Bracket, Molecule } from "@structura/core/types"
import { attachmentShape } from "@structura/core/draw"
import type { Run } from "@structura/engine"
import { CUSTOM_HINT, SHAPE_NAMES, shapeChoices } from "./attachmentShapes.ts"

/**
 * "画法：自动 / 直线 / 椭圆 / 弧线 (/ 括号) / 自定义": how one variable attachment is drawn.
 * 自动 says what it picked; 括号 is there when the attachment goes into a group bracket;
 * 自定义 makes it a curve through nodes; each choice is one undoable step.
 */
export function AttachmentShapePicker({ attachment, mol, brackets, run }: { attachment: Attachment; mol: Molecule; brackets?: readonly Bracket[]; run: Run }) {
  const { shape: given, ...plain } = attachment
  const chosen = given ?? null
  const auto = attachmentShape(mol, plain, brackets)
  const pick = (shape: AttachmentShape | null) => {
    if (shape !== chosen) run([{ op: "set_attachment_shape", atom: attachment.atom, shape }], { keepSelection: true })
  }
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[#555]">
      <span>画法</span>
      <div role="radiogroup" aria-label="画法" className="flex overflow-hidden rounded border border-[#d0d0d0]">
        {shapeChoices(attachment, brackets).map((shape) => (
          <button
            key={shape ?? "auto"}
            type="button"
            role="radio"
            aria-checked={shape === chosen}
            title={shape === "custom" ? CUSTOM_HINT : shape ? undefined : `现在画成${SHAPE_NAMES[auto]}`}
            className={`h-6 border-l border-[#d0d0d0] px-1.5 text-[12px] first:border-l-0 ${shape === chosen ? "bg-[#e8f0fe] text-[#1a73e8]" : "bg-white hover:bg-[#f3f3f3]"}`}
            onClick={() => pick(shape)}
          >
            {shape ? SHAPE_NAMES[shape] : "自动"}
          </button>
        ))}
      </div>
      {chosen == null && <span className="text-[11px] text-[#888]">（{SHAPE_NAMES[auto]}）</span>}
    </div>
  )
}
