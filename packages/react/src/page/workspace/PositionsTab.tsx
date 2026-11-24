import { useMemo } from "react"
import { repeatSkips, repeatStraddles } from "@structura/markush"
import type { Drawing } from "@structura/core/types"
import type { Run } from "@structura/engine"
import { AttachmentRow } from "../AttachmentRow.tsx"
import { GroupBracketRow } from "../GroupBracketRow.tsx"
import { RepeatBracketRow } from "../RepeatBracketRow.tsx"
import { Empty } from "./EmptyNote.tsx"

/**
 * Where things go on the formula: its variable points of attachment (where each may sit,
 * how it is drawn, how many times it repeats), its repeat units [ … ]n with their counts,
 * and its group brackets with what is attached into them.
 */
export function PositionsTab({ drawing, run }: { drawing: Drawing; run: Run }) {
  const attachments = drawing.attachments ?? []
  const brackets = drawing.brackets ?? []
  const skips = useMemo(() => repeatSkips(drawing), [drawing])
  const straddles = useMemo(() => repeatStraddles(drawing), [drawing])
  if (attachments.length === 0 && brackets.length === 0)
    return <Empty>还没有可变连接或方括号。用键工具从环的中心往外拖，就得到一个可接在环上任意位置的取代基；选中原子后 结构 → 加方括号，可设基团或重复单元。</Empty>
  return (
    <div data-testid="constraints-positions">
      {attachments.map((attachment) => (
        <AttachmentRow key={attachment.atom} attachment={attachment} drawing={drawing} run={run} />
      ))}
      {brackets.map((bracket) =>
        bracket.kind === "repeat" ? (
          <RepeatBracketRow key={bracket.id} bracket={bracket} skip={skips.find((skip) => skip.bracket === bracket.id)} straddles={straddles.filter((straddle) => straddle.bracket === bracket.id)} run={run} />
        ) : (
          <GroupBracketRow key={bracket.id} bracket={bracket} drawing={drawing} />
        ),
      )}
    </div>
  )
}
