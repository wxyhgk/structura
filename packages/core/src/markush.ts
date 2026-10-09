// The generic (Markush) formula as part of the drawing: what makes variables, attachments and
// drawn pieces valid, and the drawing conventions the ops keep them by. Expanding a formula
// into compounds, and the questions the editor asks about it, are @structura/markush.
export { ATTACHMENT_SHAPES, attachmentProblem, CURVE_MAX_NODES, curveMinNodes, curveProblem, pruneAttachments, repeatProblem } from "./markush/attachments.ts"
export { curveFrame, curveNodes, intoFrame, outOfFrame } from "./markush/curveFrame.ts"
export type { CurveFrame } from "./markush/curveFrame.ts"
export { attachmentShape, bondHeading } from "./markush/drawnShape.ts"
export { shapeCurve } from "./markush/shapeCurve.ts"
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
export { fragmentFits, placeFragment } from "./markush/placement.ts"
export type { Placed } from "./markush/placement.ts"
export { closureNames, ringClosureProblem } from "./markush/closures.ts"
export { provisoNames, provisoProblem } from "./markush/provisos.ts"
export { absorbRingPointers, ringAt, ringPointerAt, ringPositionsAt, ringSystemPositions } from "./markush/pointer.ts"
export { alternativeProblem, alternativesOf, GROUP_CLASSES, isVariableName, nestedVariables, sharers, sizeUnitOf, variableProblem } from "./markush/variables.ts"
export type { Alternative, Attachment, AttachmentCurve, AttachmentShape, BridgeName, Choice, GroupClass, Proviso, Repeat, RingClosure, SizeUnit, Substituents, Variable } from "./markush/types.ts"
