import { useMemo } from "react"
import { librarySize } from "@structura/markush"
import type { Attachment, Molecule, Variable } from "@structura/core/types"
import { sizeText } from "./sizeText.ts"

/**
 * How many compounds the formula stands for, counted as it is edited, before anything is
 * generated (classes by their typical members, as the generate dialog does by default).
 */
export function LibrarySizeLine({ mol, variables, attachments }: { mol: Molecule; variables: Record<string, Variable> | undefined; attachments: Attachment[] | undefined }) {
  const text = useMemo(() => {
    if (!variables || Object.keys(variables).length === 0) return null
    try {
      return sizeText(librarySize({ molecule: mol, arrows: [], nextArrowId: 1, variables, attachments }))
    } catch {
      return null
    }
  }, [mol, variables, attachments])
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
