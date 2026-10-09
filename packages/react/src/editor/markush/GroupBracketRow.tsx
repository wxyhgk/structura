import { bracketInto } from "@structura/core/drawing"
import type { Bracket, Drawing } from "@structura/core/types"

/**
 * One group bracket in the 位置 tab: how many atoms it holds and what is attached into it
 * ("L1 连在括号里任一位置"), or how to attach something.
 */
export function GroupBracketRow({ bracket, drawing }: { bracket: Bracket; drawing: Drawing }) {
  const into = (drawing.attachments ?? []).filter((attachment) => bracketInto([bracket], attachment))
  const name = (id: number) => {
    const atom = drawing.molecule.atoms.find((item) => item.id === id)
    return atom?.alias ?? `${atom?.el ?? ""}#${id}`
  }
  return (
    <div className="border-b border-[#e8e8e8] px-3 py-2" data-testid="group-bracket-row">
      <div className="flex items-center gap-1.5 text-[#333]">
        <span className="font-medium">[ … ]</span>
        <span className="text-[#888]">基团括号，{bracket.atoms.length} 个原子</span>
      </div>
      <p className="mt-1 text-[#555]">
        {into.length > 0
          ? `${into.map((attachment) => name(attachment.atom)).join("、")} 连在括号里任一位置（${bracket.atoms.length} 个原子之一）`
          : "还没有东西连进来：用键工具从括号外的原子拖进括号里松开即可。"}
      </p>
    </div>
  )
}
