import { closureNames, ringClosureProblem } from "../markush/closures.ts"
import { provisoNames, provisoProblem } from "../markush/provisos.ts"
import { withGroupMembers } from "../molecule/collapse.ts"
import { addReactionArrow } from "../drawing.ts"
import { attachmentProblem } from "../markush/attachments.ts"
import { curveFrame, intoFrame } from "../markush/curveFrame.ts"
import { shapeCurve } from "../markush/shapeCurve.ts"
import { sharers, variableProblem } from "../markush/variables.ts"
import { boundsCenter, tumbleAtoms } from "../molecule.ts"
import type { Drawing, HotTarget } from "../types.ts"
import type { Attachment, RingClosure, Variable } from "../markush/types.ts"
import { OpError, type Context } from "./context.ts"
import type { Op } from "./types.ts"

/**
 * What an op that needs the whole drawing did. `depth` is set by a tumble: how far each
 * turned atom now sits out of the page, which only the next tumble needs.
 */
export type DocumentStep = { drawing: Drawing; next?: HotTarget | null; depth?: Map<number, number> }

/**
 * An attachment asked to be drawn "custom" with no curve of its own yet gets one that looks
 * the way it is drawn now, to edit from; any other is left as it is.
 */
function withCurve(drawing: Drawing, attachment: Attachment): Attachment {
  if (attachment.shape !== "custom" || attachment.curve) return attachment
  const sampled = shapeCurve(drawing.molecule, attachment, drawing.brackets)
  const frame = curveFrame(drawing.molecule, attachment.to)
  if (!sampled || !frame) return attachment
  return { ...attachment, curve: { nodes: sampled.nodes.map((p) => intoFrame(frame, p)), closed: sampled.closed } }
}

/**
 * Ops that need more than the molecule: arrows sit beside it on the drawing, a tumble
 * carries out-of-page depth from one turn to the next, and generic-formula variables
 * belong to the drawing. `depth` is what the previous op
 * left, if it was a tumble. Returns null for ops it does not handle.
 */
export function documentOp(drawing: Drawing, op: Op, ctx: Context, depth: Map<number, number> | undefined): DocumentStep | null {
  switch (op.op) {
    case "add_arrow": {
      const ids = op.atoms.map(ctx.atom)
      if (ids.length === 0) throw new OpError("an arrow needs atoms to point away from")
      return { drawing: addReactionArrow(drawing, ids, op.direction) }
    }
    case "tumble": {
      if (!Number.isFinite(op.angle)) throw new OpError(`angle ${op.angle} is not a number`)
      const mol = drawing.molecule
      const ids = withGroupMembers(mol, op.atoms.map(ctx.atom))
      const center = op.center ?? boundsCenter(mol, ids)
      if (!center) return { drawing }
      const given = op.depth ? new Map(Object.entries(op.depth).map(([id, z]) => [Number(id), z])) : depth
      const tumbled = tumbleAtoms(mol, ids, center, op.axis, op.angle, given)
      return { drawing: { ...drawing, molecule: tumbled.mol }, depth: tumbled.depth }
    }
    case "set_variable": {
      if (("sameAs" in op) === ("alternatives" in op)) throw new OpError("give either alternatives or sameAs")
      const variable: Variable =
        "sameAs" in op
          ? { sameAs: op.sameAs }
          : { alternatives: op.alternatives.map((item) => (item.kind === "label" ? { kind: "label" as const, text: item.text.trim() } : item)) }
      const problem = variableProblem(op.name, variable, drawing.variables)
      if (problem) throw new OpError(problem)
      return { drawing: { ...drawing, variables: { ...drawing.variables, [op.name]: variable } } }
    }
    case "set_attachment": {
      const made: Attachment = { atom: ctx.atom(op.atom), to: [...new Set(op.to.map(ctx.atom))], ...(op.repeat ? { repeat: op.repeat } : {}), ...(op.shape ? { shape: op.shape } : {}) }
      const attachment = withCurve(drawing, made)
      const problem = attachmentProblem(drawing.molecule, attachment)
      if (problem) throw new OpError(problem)
      const others = (drawing.attachments ?? []).filter((item) => item.atom !== attachment.atom)
      return { drawing: { ...drawing, attachments: [...others, attachment] } }
    }
    case "set_repeat": {
      const atom = ctx.atom(op.atom)
      const attachment = drawing.attachments?.find((item) => item.atom === atom)
      if (!attachment) throw new OpError(`atom #${atom} has no variable attachment`)
      const { repeat: _old, ...plain } = attachment
      const next = op.repeat ? { ...plain, repeat: { ...op.repeat, name: op.repeat.name.trim() } } : plain
      const problem = attachmentProblem(drawing.molecule, next)
      if (problem) throw new OpError(problem)
      return { drawing: { ...drawing, attachments: drawing.attachments!.map((item) => (item === attachment ? next : item)) } }
    }
    case "set_attachment_shape": {
      const atom = ctx.atom(op.atom)
      const attachment = drawing.attachments?.find((item) => item.atom === atom)
      if (!attachment) throw new OpError(`atom #${atom} has no variable attachment`)
      const { shape: _old, ...plain } = attachment
      const next = op.shape ? withCurve(drawing, { ...plain, shape: op.shape }) : plain
      const problem = attachmentProblem(drawing.molecule, next)
      if (problem) throw new OpError(problem)
      return { drawing: { ...drawing, attachments: drawing.attachments!.map((item) => (item === attachment ? next : item)) } }
    }
    case "set_attachment_curve": {
      const atom = ctx.atom(op.atom)
      const attachment = drawing.attachments?.find((item) => item.atom === atom)
      if (!attachment) throw new OpError(`atom #${atom} has no variable attachment`)
      if (!Array.isArray(op.nodes) || !op.nodes.every((node) => Array.isArray(node) && node.length === 2)) throw new OpError("each node of a curve is [x, y], two numbers")
      const frame = curveFrame(drawing.molecule, attachment.to)
      if (!frame) throw new OpError(`atom #${atom}'s attachment has no candidate atoms to draw round`)
      // Checked once in the frame, where how far out a node lies means something.
      const nodes = op.nodes.map(([x, y]) => intoFrame(frame, { x, y }))
      const next = { ...attachment, shape: "custom" as const, curve: { nodes, closed: op.closed } }
      const problem = attachmentProblem(drawing.molecule, next)
      if (problem) throw new OpError(problem)
      return { drawing: { ...drawing, attachments: drawing.attachments!.map((item) => (item === attachment ? next : item)) } }
    }
    case "remove_attachment": {
      const atom = ctx.atom(op.atom)
      if (!drawing.attachments?.some((item) => item.atom === atom)) throw new OpError(`atom #${atom} has no variable attachment`)
      const others = drawing.attachments.filter((item) => item.atom !== atom)
      return { drawing: { ...drawing, attachments: others.length > 0 ? others : undefined } }
    }
    case "add_proviso": {
      const problem = provisoProblem(op.proviso, drawing.variables)
      if (problem) throw new OpError(problem)
      return { drawing: { ...drawing, provisos: [...(drawing.provisos ?? []), op.proviso] } }
    }
    case "remove_proviso": {
      if (!drawing.provisos?.[op.index]) throw new OpError(`there is no proviso #${op.index}`)
      const rest = drawing.provisos.filter((_, index) => index !== op.index)
      return { drawing: { ...drawing, provisos: rest.length > 0 ? rest : undefined } }
    }
    case "set_ring_closure": {
      const problem = ringClosureProblem(op.closure, drawing.variables)
      if (problem) throw new OpError(problem)
      const pair = (closure: RingClosure) => [closure.a, closure.b].sort().join(" ")
      const others = (drawing.ringClosures ?? []).filter((closure) => pair(closure) !== pair(op.closure))
      return { drawing: { ...drawing, ringClosures: [...others, op.closure] } }
    }
    case "remove_ring_closure": {
      const pair = [op.a, op.b].sort().join(" ")
      const rest = (drawing.ringClosures ?? []).filter((closure) => [closure.a, closure.b].sort().join(" ") !== pair)
      if (rest.length === (drawing.ringClosures ?? []).length) throw new OpError(`${op.a} and ${op.b} have no ring closure`)
      return { drawing: { ...drawing, ringClosures: rest.length > 0 ? rest : undefined } }
    }
    case "remove_variable": {
      if (!drawing.variables || !Object.hasOwn(drawing.variables, op.name)) throw new OpError(`there is no variable ${op.name}`)
      const using = sharers(drawing.variables, op.name)
      if (using.length > 0) throw new OpError(`${using.join(", ")} share ${op.name}'s list; change them first`)
      if (provisoNames(drawing.provisos).has(op.name)) throw new OpError(`a proviso speaks of ${op.name}; remove it first`)
      if (closureNames(drawing.ringClosures).has(op.name)) throw new OpError(`${op.name} may close a ring; remove that first`)
      const { [op.name]: _gone, ...rest } = drawing.variables
      return { drawing: { ...drawing, variables: Object.keys(rest).length > 0 ? rest : undefined } }
    }
    default:
      return null
  }
}
