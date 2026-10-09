import { knownLabel } from "../label/known.ts"
import { hasVariableShape } from "./shape.ts"

/**
 * Whether text is a variable's label: shaped like one (see shape.ts), no element and no
 * known abbreviation, so typing it on an atom makes a placeholder rather than an atom or a
 * group. Bare Ar counts too: knownLabel leaves it out, as drawings mean aryl by it, not argon.
 */
export function isVariableName(text: string): boolean {
  return hasVariableShape(text) && !knownLabel(text)
}
