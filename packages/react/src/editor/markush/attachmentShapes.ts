import { bracketInto } from "@structura/core/drawing"
import type { Bracket } from "@structura/core/types"
import type { Attachment, AttachmentShape } from "@structura/markush"

/** How each way of drawing a variable attachment is called in the UI. */
export const SHAPE_NAMES: Record<AttachmentShape, string> = { line: "直线", loop: "椭圆", arc: "弧线", bracket: "括号", custom: "自定义" }

/**
 * The choices offered for an attachment, in order: null is 自动 (chosen from the
 * attachment); 括号 only when it goes into a group bracket (its candidates are the
 * bracket's atoms, its atom outside); 自定义 last, a curve through nodes, starting from how
 * it looks now (or the curve it had).
 */
export function shapeChoices(attachment: Attachment, brackets: readonly Bracket[] | undefined): Array<AttachmentShape | null> {
  return [null, "line", "loop", "arc", ...(bracketInto(brackets, attachment) ? ["bracket" as const] : []), "custom"]
}

/** What 自定义 does, as its tooltip. */
export const CUSTOM_HINT = "自定义：变成一条穿过几个节点的平滑曲线，从现在的样子开始；用套索或框选点一下曲线，就能拖动节点，点曲线加节点，双击节点或按 Delete 删掉"
