import type { AttachmentShape } from "@structura/markush"

/** How each way of drawing a variable attachment is called in the UI. */
export const SHAPE_NAMES: Record<AttachmentShape, string> = { line: "直线", loop: "椭圆", arc: "弧线" }

/** The choices offered, in order: null is 自动 (chosen from the attachment). */
export const SHAPE_CHOICES: Array<AttachmentShape | null> = [null, "line", "loop", "arc"]
