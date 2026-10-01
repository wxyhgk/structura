// Generic (Markush) formulas: what the variables may stand for, and expanding them into compounds.
export { enumerate, enumerateSteps } from "./markush/enumerate.ts"
export type { EnumerateOptions, Enumeration, Pick } from "./markush/enumerate.ts"
export { alternativesFromText } from "./markush/parse.ts"
export { absorbRingPointers, ringPointerAt, ringPositionsAt } from "./markush/pointer.ts"
export { linkerNames, siteKind } from "./markush/sites.ts"
export type { SiteKind } from "./markush/sites.ts"
export {
  alternativeProblem,
  alternativesOf,
  GROUP_CLASSES,
  isVariableName,
  placeholders,
  shareSources,
  sharers,
  undefinedVariables,
  variableLabels,
  variableProblem,
} from "./markush/variables.ts"
