import { useEffect, useMemo, useState } from "react"
import { librarySize } from "@structura/markush"
import type { Drawing } from "@structura/core/types"
import { sizeText } from "./sizeText.ts"

/** How long the formula must stay as it is before it is counted again: dragging an atom changes it on every move. */
const SETTLE_MS = 150

/** `value`, held back until it has stayed the same for `ms` (the first value is not held back). */
function useSettled<T>(value: T, ms: number): T {
  const [held, setHeld] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setHeld(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return held
}

/**
 * How many compounds the formula stands for, counted as it is edited, before anything is
 * generated (classes by their typical members, as the generate dialog does by default):
 * every count of each repeat unit, every placement, every choice.
 */
export function LibrarySizeLine({ drawing }: { drawing: Drawing }) {
  const { molecule, variables, attachments, ringClosures, brackets } = useSettled(drawing, SETTLE_MS)
  const text = useMemo(() => {
    // Something varies: a variable, a variable attachment or a repeat unit.
    const repeats = brackets?.some((bracket) => bracket.kind === "repeat") ?? false
    if (Object.keys(variables ?? {}).length === 0 && !attachments?.length && !repeats) return null
    try {
      return sizeText(librarySize({ molecule, arrows: [], nextArrowId: 1, variables, attachments, ringClosures, brackets }))
    } catch {
      return null
    }
  }, [molecule, variables, attachments, ringClosures, brackets])
  if (!text) return null
  return (
    <div className="px-0.5 text-[11px] leading-snug text-(--c-555555)" data-testid="library-size">
      <div className="font-medium text-(--c-333333)">{text.headline}</div>
      {text.notes.map((note) => (
        <div key={note} className="text-(--c-888888)">
          {note}
        </div>
      ))}
    </div>
  )
}
