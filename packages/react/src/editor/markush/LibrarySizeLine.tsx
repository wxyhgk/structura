import { useMemo } from "react"
import { type Attachment, librarySize, type RingClosure, type Variable } from "@structura/markush"
import type { Molecule } from "@structura/core/types"
import { sizeText } from "./sizeText.ts"

/**
 * How many compounds the formula stands for, counted as it is edited, before anything is
 * generated (classes by their typical members, as the generate dialog does by default).
 */
export function LibrarySizeLine({
  mol,
  variables,
  attachments,
  ringClosures,
}: {
  mol: Molecule
  variables: Record<string, Variable> | undefined
  attachments: Attachment[] | undefined
  ringClosures: RingClosure[] | undefined
}) {
  const text = useMemo(() => {
    if (!variables || Object.keys(variables).length === 0) return null
    try {
      return sizeText(librarySize({ molecule: mol, arrows: [], nextArrowId: 1, variables, attachments, ringClosures }))
    } catch {
      return null
    }
  }, [mol, variables, attachments, ringClosures])
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
