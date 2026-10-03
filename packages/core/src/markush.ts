// Generic (Markush) formulas: what the variables may stand for, and expanding them into compounds.
export { choiceText, enumerate, enumerateSteps, pickFields } from "./markush/enumerate.ts"
export { fragmentEnds, fragmentFits, fragmentFormula, fragmentFrom, fragmentProblem, fragmentVariables, placeFragment, STAR } from "./markush/fragments.ts"
export type { EnumerateOptions, Enumeration, Pick } from "./markush/enumerate.ts"
export { BRIDGES } from "./markush/bridges.ts"
export { alternativesFromText } from "./markush/parse.ts"
export { absorbRingPointers, ringPointerAt, ringPositionsAt } from "./markush/pointer.ts"
export { linkerNames, siteKind } from "./markush/sites.ts"
export type { SiteKind } from "./markush/sites.ts"
export {
  alternativeProblem,
  alternativesOf,
  GROUP_CLASSES,
  isVariableName,
  nestedVariables,
  placeholders,
  shareSources,
  sharers,
  undefinedVariables,
  variableLabels,
  variableProblem,
} from "./markush/variables.ts"
