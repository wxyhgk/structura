import { bracketInto } from "@structura/core/drawing"
import type { Bracket } from "@structura/core/types"
import type { Attachment, AttachmentShape } from "@structura/markush"

/** How each way of drawing a variable attachment is called in the UI. */
export const SHAPE_NAMES: Record<AttachmentShape, string> = { line: "直线", loop: "椭圆", arc: "弧线", bracket: "括号", custom: "自定义" }

/**
 * The choices offered for an attachment, in order: null is 自动 (chosen from the
 * attachment); 括号 only when it goes into a group bracket (its candidates are the
 * bracket's atoms, its atom outside).
 */
export function shapeChoices(attachment: Attachment, brackets: readonly Bracket[] | undefined): Array<AttachmentShape | null> {
  return [null, "line", "loop", "arc", ...(bracketInto(brackets, attachment) ? ["bracket" as const] : [])]
}
