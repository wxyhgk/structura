import type { Drawing } from "@structura/core/types"
import type { Repeat } from "@structura/markush"
import { closureText, describeAlternative, provisoText } from "./describe.ts"
import { variableNames } from "./variableNames.ts"

// The definitions a generic formula is printed with, a line each, as they go under the
// structure in an exported file: "R1 = H、Cl、取代或未取代的(C1–C6)烷基", "n = 1–4".

/** "n = 1–4", or "n = 2" when it is one count. */
function countText(repeat: Repeat): string {
  return `${repeat.name} = ${repeat.min === repeat.max ? repeat.min : `${repeat.min}–${repeat.max}`}`
}

/**
 * Every variable with a definition, in the order the 通式 workspace lists them, then the
 * counts of repeated attachments and repeat units, the ring closures and the provisos.
 * Empty for an ordinary drawing.
 */
export function definitionLines(drawing: Drawing): string[] {
  const variables = drawing.variables ?? {}
  const { names } = variableNames(drawing.molecule, drawing.variables, drawing.attachments)
  const defined = names.flatMap((name) => {
    const variable = variables[name]
    if (!variable) return []
    if ("sameAs" in variable) return [`${name} = 同 ${variable.sameAs}`]
    return [`${name} = ${variable.alternatives.map(describeAlternative).join("、")}`]
  })
  const repeats = [...(drawing.attachments ?? []).flatMap((attachment) => attachment.repeat ?? []), ...(drawing.brackets ?? []).flatMap((bracket) => bracket.repeat ?? [])]
  const counts = [...new Set(repeats.map(countText))]
  return [...defined, ...counts, ...(drawing.ringClosures ?? []).map(closureText), ...(drawing.provisos ?? []).map(provisoText)]
}
