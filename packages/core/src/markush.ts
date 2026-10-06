// The generic (Markush) formula as part of the drawing: what makes variables, attachments and
// drawn pieces valid, and the drawing conventions the ops keep them by. Expanding a formula
// into compounds, and the questions the editor asks about it, are @structura/markush.
export { attachmentProblem, pruneAttachments, repeatProblem } from "./markush/attachments.ts"
export { BRIDGES } from "./markush/bridges.ts"
export { fragmentEnds, fragmentFits, fragmentFormula, fragmentFrom, fragmentProblem, fragmentVariables, placeFragment, STAR } from "./markush/fragments.ts"
export type { Placed } from "./markush/fragments.ts"
export { absorbRingPointers, ringPointerAt, ringPositionsAt } from "./markush/pointer.ts"
export { alternativeProblem, alternativesOf, GROUP_CLASSES, isVariableName, nestedVariables, sharers, sizeUnitOf, variableProblem } from "./markush/variables.ts"
