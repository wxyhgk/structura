import type { Drawing } from "@structura/core/types"
import type { Run } from "@structura/engine"
import { AttachmentRow } from "../AttachmentRow.tsx"
import { Empty } from "./EmptyNote.tsx"

/** The formula's variable points of attachment: where each may sit, and how many times it repeats. */
export function PositionsTab({ drawing, run }: { drawing: Drawing; run: Run }) {
  const attachments = drawing.attachments ?? []
  if (attachments.length === 0)
    return <Empty>还没有可变连接。用键工具从环的中心往外拖，就得到一个可接在环上任意位置的取代基。</Empty>
  return (
    <div data-testid="constraints-positions">
      {attachments.map((attachment) => (
        <AttachmentRow key={attachment.atom} attachment={attachment} mol={drawing.molecule} brackets={drawing.brackets} run={run} />
      ))}
    </div>
  )
}
