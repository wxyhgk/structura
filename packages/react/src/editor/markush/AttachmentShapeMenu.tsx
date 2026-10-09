import type { Attachment, AttachmentShape } from "@structura/markush"
import type { Op } from "@structura/core/ops"
import type { Bracket } from "@structura/core/types"
import { ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "../../components/ui/context-menu.tsx"
import { SHAPE_NAMES, shapeChoices } from "./attachmentShapes.ts"

/** "可变连接画法 ▸ 自动 / 直线 / 椭圆 / 弧线 (/ 括号)" in the right-click menu of an atom that has a variable attachment. */
export function AttachmentShapeMenu({ attachment, brackets, run }: { attachment: Attachment; brackets?: readonly Bracket[]; run: (ops: Op[]) => void }) {
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>可变连接画法</ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuRadioGroup
          value={attachment.shape ?? "auto"}
          onValueChange={(value) => {
            const shape = value === "auto" ? null : (value as AttachmentShape)
            if (shape !== (attachment.shape ?? null)) run([{ op: "set_attachment_shape", atom: attachment.atom, shape }])
          }}
        >
          {shapeChoices(attachment, brackets).map((shape) => (
            <ContextMenuRadioItem key={shape ?? "auto"} value={shape ?? "auto"}>
              {shape ? SHAPE_NAMES[shape] : "自动"}
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}
