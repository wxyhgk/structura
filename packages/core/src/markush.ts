// The generic (Markush) formula as part of the drawing: what makes variables, attachments and
// drawn pieces valid, and the drawing conventions the ops keep them by. Expanding a formula
// into compounds, and the questions the editor asks about it, are @structura/markush.
export { attachmentProblem, pruneAttachments, repeatProblem } from "./markush/attachments.ts"
export { BRIDGES } from "./markush/bridges.ts"
export {
  alsoAtProblem,
  fragmentEnds,
  fragmentFormula,
  fragmentFrom,
  fragmentMessage,
  fragmentProblem,
  fragmentProblemText,
  fragmentVariables,
  STAR,
} from "./markush/fragments.ts"
export type { FragmentProblem } from "./markush/fragments.ts"
export { fragmentAt, fragmentFits, fragmentVersions, placeFragment } from "./markush/placement.ts"
export type { Placed } from "./markush/placement.ts"
export { closureNames, ringClosureProblem } from "./markush/closures.ts"
export { provisoNames, provisoProblem } from "./markush/provisos.ts"
export { absorbRingPointers, ringPointerAt, ringPositionsAt, ringSystemPositions } from "./markush/pointer.ts"
export { alternativeProblem, alternativesOf, GROUP_CLASSES, isVariableName, nestedVariables, sharers, sizeUnitOf, variableProblem } from "./markush/variables.ts"
export { libraryProblem, TEMPLATE_SITES, templateProblem } from "./markush/templates.ts"
export type { ImportReport, Template, TemplateInput, TemplateLibrary, TemplateSite } from "./markush/templates.ts"
