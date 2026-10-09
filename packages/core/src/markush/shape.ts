/**
 * How a variable's label may look: R, R1, R', X, L, Ar, Ar1, ETU… A short name starting with a
 * capital, optionally numbered. Only its shape: whether it is also an element or a known
 * abbreviation is names.ts's question, which needs the abbreviation table.
 */
export function hasVariableShape(text: string): boolean {
  return /^[A-Z][A-Za-z]{0,3}\d{0,3}'{0,2}$/.test(text)
}
