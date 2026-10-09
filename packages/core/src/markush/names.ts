import { knownLabel } from "../label/known.ts"

/**
 * How a variable's label may look: R, R1, R', X, L, Ar, Ar1, ETU… A short name starting with a
 * capital, optionally numbered, that is no element and no known abbreviation, so typing
 * it on an atom makes a placeholder rather than an atom or a group.
 * Bare Ar counts too: knownLabel leaves it out, as drawings mean aryl by it, not argon.
 */
const VARIABLE_SHAPE = /^[A-Z][A-Za-z]{0,3}\d{0,3}'{0,2}$/

export function isVariableName(text: string): boolean {
  return VARIABLE_SHAPE.test(text) && !knownLabel(text)
}
