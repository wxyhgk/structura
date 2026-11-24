import { useState } from "react"
import type { Drawing } from "@structura/core/types"

/** Whether two drawings hold the very same parts. */
function sameParts(a: Drawing, b: Drawing): boolean {
  const x = a as unknown as Record<string, unknown>
  const y = b as unknown as Record<string, unknown>
  const keys = Object.keys(x)
  return keys.length === Object.keys(y).length && keys.every((key) => x[key] === y[key])
}

/**
 * The drawing without what only says how it is generated and numbered, as one object for
 * as long as the rest is unchanged: changing the numbers or the options (which are the
 * document's, but do not change the formula) must not make the results stale and generate
 * everything again.
 */
export function useGenerationInput(drawing: Drawing): Drawing {
  const { generation: _generation, numbering: _numbering, ...rest } = drawing
  const [kept, setKept] = useState<Drawing>(rest)
  if (sameParts(kept, rest)) return kept
  setKept(rest)
  return rest
}
