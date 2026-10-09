import { useMemo } from "react"
import { librarySize } from "@structura/markush"
import type { Drawing } from "@structura/core/types"
import { sizeText } from "./sizeText.ts"

/**
 * How many compounds the formula stands for, counted as it is edited, before anything is
 * generated (classes by their typical members, as the generate dialog does by default):
 * every count of each repeat unit, every placement, every choice.
 */
export function LibrarySizeLine({ drawing }: { drawing: Drawing }) {
  const { molecule, variables, attachments, ringClosures, brackets } = drawing
  const text = useMemo(() => {
    const repeats = brackets?.some((bracket) => bracket.kind === "repeat") ?? false
    if ((!variables || Object.keys(variables).length === 0) && !repeats) return null
    try {
      return sizeText(librarySize({ molecule, arrows: [], nextArrowId: 1, variables, attachments, ringClosures, brackets }))
    } catch {
      return null
    }
  }, [molecule, variables, attachments, ringClosures, brackets])
  if (!text) return null
  return (
    <div className="px-0.5 text-[11px] leading-snug text-[#555]" data-testid="library-size">
      <div className="font-medium text-[#333]">{text.headline}</div>
      {text.notes.map((note) => (
        <div key={note} className="text-[#888]">
          {note}
        </div>
      ))}
    </div>
  )
}
