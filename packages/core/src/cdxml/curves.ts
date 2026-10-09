import { arcCubics, arcJoin, loopJoin } from "../curves/arc.ts"
import { type Cubic, cubicsBounds, nearestOnCubics } from "../curves/cubic.ts"
import { ellipseCubics, fitEllipse } from "../curves/ellipse.ts"
import { catmullRom } from "../curves/spline.ts"
import { curveNodes } from "../markush/curveFrame.ts"
import { attachmentShape, bondHeading } from "../markush/drawnShape.ts"
import type { Attachment } from "../markush/types.ts"
import { atomById } from "../molecule/graph.ts"
import type { Bracket, Drawing, Molecule, Point } from "../types.ts"
import { el, num, type XmlNode } from "./xml.ts"

// A curved variable attachment for ChemDraw: its VariableAttachment node sits where the
// straight part ends (where the bond meets the ellipse or the loop, or at a custom curve's
// first node), so the bond ChemDraw draws to it is that straight part, and the rest of the
// curve is a Curve graphic beside it.

/** Where a curved attachment's straight part ends, and the curve from there on (closed for a loop); null for a straight one. */
export function attachmentCourse(mol: Molecule, attachment: Attachment, brackets?: readonly Bracket[]): { join: Point; cubics: Cubic[]; closed: boolean } | null {
  const from = atomById(mol, attachment.atom)
  const targets = attachment.to.flatMap((id) => atomById(mol, id) ?? [])
  if (!from || targets.length === 0) return null
  const shape = attachmentShape(mol, attachment, brackets)
  if (shape === "custom") {
    const nodes = curveNodes(mol, attachment)!
    if (attachment.curve!.closed) {
      const loop = catmullRom(nodes, true)
      return { join: nearestOnCubics(loop, from)!.point, cubics: loop, closed: true }
    }
    // The first piece, from the atom, is the bond; the curve goes on from the first node.
    const cubics = catmullRom([from, ...nodes])
    return { join: nodes[0], cubics: cubics.slice(1), closed: false }
  }
  if (shape !== "arc" && shape !== "loop") return null
  const ellipse = fitEllipse(targets)
  if (shape === "arc") {
    const join = arcJoin(ellipse, from, bondHeading(mol, from.id))
    return { join: join.point, cubics: arcCubics(ellipse, join), closed: false }
  }
  return { join: loopJoin(ellipse, from), cubics: ellipseCubics(ellipse, 0, 2 * Math.PI), closed: true }
}

/** The corners of the box round each curved attachment's curve, for fitting the page round them. */
export function curveReach(drawing: Drawing): Point[] {
  return (drawing.attachments ?? []).flatMap((attachment) => {
    const course = attachmentCourse(drawing.molecule, attachment, drawing.brackets)
    if (!course || course.cubics.length === 0) return []
    const box = cubicsBounds(course.cubics)
    return [
      { x: box.left, y: box.top },
      { x: box.right, y: box.bottom },
    ]
  })
}

/**
 * The pieces as ChemDraw's Curve: its points in threes, the handle coming in, the point, the
 * handle going out, for each point the curve passes through (an open curve's ends have no
 * handle on their outer side: the point itself stands there). `at` takes them onto the page.
 */
export function curveElement(id: number, cubics: readonly Cubic[], closed: boolean, at: (p: Point) => Point): XmlNode | null {
  if (cubics.length === 0) return null
  const n = cubics.length
  const triples: Point[][] = closed
    ? cubics.map((cubic, i) => [cubics[(i - 1 + n) % n].c2, cubic.from, cubic.c1])
    : [[cubics[0].from, cubics[0].from, cubics[0].c1], ...cubics.map((cubic, i) => [cubic.c2, cubic.to, i + 1 < n ? cubics[i + 1].c1 : cubic.to])]
  const points = triples.flat().map((p) => {
    const q = at(p)
    return `${num(q.x)} ${num(q.y)}`
  })
  return el("curve", { id, CurveType: closed ? 1 : undefined, Closed: closed ? "yes" : undefined, CurvePoints: points.join(" ") })
}
