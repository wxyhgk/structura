import assert from "node:assert/strict"
import test from "node:test"
import { readDocument, toDocument } from "@structura/core/document"
import { catmullRom, cubicPoint, nearestOnCubics, simplifyPath } from "@structura/core/curves"
import { attachmentMarks, buildScene, sceneToSvg, structureMarks } from "@structura/core/draw"
import { curveNodes, ringSystemPositions } from "@structura/core/markush"
import { applyOps, type Op } from "@structura/core/ops"
import type { Drawing, Point } from "@structura/core/types"
import { build, run } from "@structura/testkit"

// A variable attachment drawn as the user's own curve: smooth through nodes they set, kept
// relative to the ellipse round the candidates so it goes wherever the rings go.

/** Anthracene (atoms 1–14) with a free-standing Rx (15) attached anywhere on it. */
function anthracene(extra: Op[] = []): Drawing {
  const base = build([
    { op: "add_scaffold", name: "anthracene", at: { x: 0, y: 0 } },
    { op: "place_atom", el: "C", at: { x: -40, y: -120 } },
    { op: "label", atom: 15, text: "Rx" },
  ])
  return run(base, [{ op: "set_attachment", atom: 15, to: ringSystemPositions(base.molecule, [1])! }, ...extra])
}

const ALL = Array.from({ length: 15 }, (_, i) => i + 1)
const near = (a: Point, b: Point, within: number) => Math.hypot(a.x - b.x, a.y - b.y) <= within
const nodesOf = (drawing: Drawing) => curveNodes(drawing.molecule, drawing.attachments![0])!
const marksOf = (drawing: Drawing) => attachmentMarks(drawing.molecule, drawing.attachments, buildScene(drawing.molecule, false).labels)

const OPEN: Array<[number, number]> = [
  [-60, -70],
  [-20, -60],
  [30, -55],
  [80, -40],
]

test("the curve passes through every point it is given, open or closed", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 30, y: -20 },
    { x: 70, y: 10 },
    { x: 100, y: -5 },
  ]
  const open = catmullRom(points)
  assert.equal(open.length, 3)
  open.forEach((cubic, i) => {
    assert.deepEqual(cubic.from, points[i])
    assert.deepEqual(cubic.to, points[i + 1])
  })
  const closed = catmullRom(points, true)
  assert.equal(closed.length, 4, "one piece back round to the first point")
  assert.deepEqual(closed[3].to, points[0])
  // Smooth where the pieces meet: the handles either side of a point are in line.
  const [a, b] = [closed[0], closed[1]]
  const into = { x: a.to.x - a.c2.x, y: a.to.y - a.c2.y }
  const out = { x: b.c1.x - b.from.x, y: b.c1.y - b.from.y }
  assert.ok(Math.abs(into.x * out.y - into.y * out.x) < 1e-6 * Math.hypot(into.x, into.y) * Math.hypot(out.x, out.y) + 1e-9)
  // No overshoot to speak of: the curve stays near the points' box.
  for (const cubic of open) for (let t = 0; t <= 1; t += 0.1) assert.ok(cubicPoint(cubic, t).y > -30 && cubicPoint(cubic, t).y < 20)
  // Points repeated one after another count once; fewer than two make nothing.
  assert.equal(catmullRom([points[0], points[0], points[1]]).length, 1)
  assert.equal(catmullRom([points[0]]).length, 0)
})

test("a hand-drawn path becomes a few corners, within the tolerance and the cap", () => {
  const path = Array.from({ length: 200 }, (_, i) => ({ x: i, y: i < 100 ? 0 : i - 100 }))
  const corners = simplifyPath(path, 5)
  assert.equal(corners.length, 3)
  assert.deepEqual(corners[1], { x: 100, y: 0 })
  const wiggle = Array.from({ length: 400 }, (_, i) => ({ x: i, y: 30 * Math.sin(i / 10) }))
  assert.ok(simplifyPath(wiggle, 1, 12).length <= 12)
})

test("set_attachment_curve keeps the nodes where they were put, and the attachment draws through them", () => {
  const drawing = anthracene([{ op: "set_attachment_curve", atom: 15, nodes: OPEN, closed: false }])
  const attachment = drawing.attachments![0]
  assert.equal(attachment.shape, "custom")
  assert.equal(attachment.curve!.closed, false)
  // Saved relative to the rings, not as drawing coordinates.
  assert.ok(attachment.curve!.nodes.every(([u, v]) => Math.abs(u) < 3 && Math.abs(v) < 3))
  nodesOf(drawing).forEach((p, i) => assert.ok(near(p, { x: OPEN[i][0], y: OPEN[i][1] }, 0.05), `node ${i}`))
  const mark = marksOf(drawing)[0]
  assert.equal(mark.shape, "custom")
  assert.ok(!mark.path.includes("Z"))
  assert.equal(mark.custom!.cubics.length, OPEN.length, "from the atom through each node")
  // It starts where the line leaves the label, and ends at the last node.
  assert.ok(near(mark.to, { x: 80, y: -40 }, 0.05))
  const atom = drawing.molecule.atoms.find((item) => item.id === 15)!
  assert.ok(near(mark.from, atom, 14) && !near(mark.from, atom, 1))
  for (const [x, y] of OPEN) assert.ok(nearestOnCubics(mark.custom!.cubics, { x, y })!.distance < 0.05)
  assert.ok(mark.bounds.right >= 80 && mark.bounds.left <= -60)
})

test("a closed curve is a loop through the nodes with a straight line from the atom to it", () => {
  const nodes: Array<[number, number]> = [
    [-90, -10],
    [0, -70],
    [90, -10],
    [0, 60],
  ]
  const drawing = anthracene([{ op: "set_attachment_curve", atom: 15, nodes, closed: true }])
  const mark = marksOf(drawing)[0]
  assert.match(mark.path, /^M [\d. -]+ L [\d. -]+ M [\d. -]+( C [\d. -]+){4} Z$/)
  assert.ok(nearestOnCubics(mark.custom!.cubics, mark.to)!.distance < 0.01, "the line ends on the loop")
  assert.ok(mark.curve!.top <= -69.5 && mark.curve!.bottom >= 59.5)
})

test("the curve follows the rings: moved, turned, mirrored and resized", () => {
  const drawing = anthracene([{ op: "set_attachment_curve", atom: 15, nodes: OPEN, closed: false }])
  const before = nodesOf(drawing)
  const moved = nodesOf(run(drawing, [{ op: "move", atoms: ALL, dx: 70, dy: -25 }]))
  moved.forEach((p, i) => assert.ok(near(p, { x: before[i].x + 70, y: before[i].y - 25 }, 0.5)))

  // Turned about the origin: each node turns with it (the fitted ellipse is good to about a pixel).
  const angle = 1.1
  const turnedDrawing = run(drawing, [{ op: "rotate", atoms: ALL, angle, center: { x: 0, y: 0 } }])
  const a = drawing.molecule.atoms.find((atom) => atom.id === 1)!
  const b = turnedDrawing.molecule.atoms.find((atom) => atom.id === 1)!
  const turn = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x)
  const spin = (p: Point) => ({ x: p.x * Math.cos(turn) - p.y * Math.sin(turn), y: p.x * Math.sin(turn) + p.y * Math.cos(turn) })
  nodesOf(turnedDrawing).forEach((p, i) => assert.ok(near(p, spin(before[i]), 1.5), `node ${i} turned`))
  // Half a turn too, where the ellipse's own axes would come out the same.
  const flipped = run(drawing, [{ op: "rotate", atoms: ALL, angle: Math.PI, center: { x: 0, y: 0 } }])
  nodesOf(flipped).forEach((p, i) => assert.ok(near(p, { x: -before[i].x, y: -before[i].y }, 1.5), `node ${i} half turned`))

  // Mirrored left to right, the curve is mirrored with the drawing.
  const mirrored = run(drawing, [{ op: "flip", atoms: ALL, axis: "horizontal" }])
  const centre = (d: Drawing) => d.molecule.atoms.filter((atom) => atom.id <= 14).reduce((sum, atom) => sum + atom.x, 0) / 14
  const axis = centre(drawing) + centre(mirrored)
  nodesOf(mirrored).forEach((p, i) => assert.ok(near(p, { x: axis - before[i].x, y: before[i].y }, 1.5), `node ${i} mirrored`))

  // Twice the size: the nodes stay where they were relative to the rings, round the bigger ellipse.
  const grown = nodesOf(run(drawing, [{ op: "scale", atoms: ALL, sx: 2, sy: 2, center: { x: 0, y: 0 } }]))
  grown.forEach((p, i) => assert.ok(Math.hypot(p.x, p.y) > Math.hypot(before[i].x, before[i].y) * 1.5, `node ${i} grew`))
})

test("on one round ring the nodes still turn with it", () => {
  const benzene = build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "place_atom", el: "C", at: { x: 80, y: -70 } },
    { op: "label", atom: 7, text: "R1" },
    { op: "set_attachment", atom: 7, to: [1, 2, 3, 4, 5, 6] },
    {
      op: "set_attachment_curve",
      atom: 7,
      nodes: [
        [40, -40],
        [-40, -30],
        [-30, 40],
      ],
      closed: true,
    },
  ])
  const before = nodesOf(benzene)
  const atom1 = (d: Drawing) => d.molecule.atoms.find((atom) => atom.id === 1)!
  for (const angle of [0.4, 2, 3.5]) {
    const turned = run(benzene, [{ op: "rotate", atoms: [1, 2, 3, 4, 5, 6, 7], angle, center: { x: 0, y: 0 } }])
    const turn = Math.atan2(atom1(turned).y, atom1(turned).x) - Math.atan2(atom1(benzene).y, atom1(benzene).x)
    const spin = (p: Point) => ({ x: p.x * Math.cos(turn) - p.y * Math.sin(turn), y: p.x * Math.sin(turn) + p.y * Math.cos(turn) })
    nodesOf(turned).forEach((p, i) => assert.ok(near(p, spin(before[i]), 1.5), `turned ${angle}: node ${i}`))
  }
})

test("custom with no curve yet starts from how it looks now; the curve is kept through other shapes", () => {
  // A loop: eight nodes round the ellipse, closed.
  const loop = anthracene([{ op: "set_attachment_shape", atom: 15, shape: "custom" }])
  assert.equal(loop.attachments![0].curve!.closed, true)
  assert.equal(loop.attachments![0].curve!.nodes.length, 8)
  // An arc (Rx bonded to the rest): open, along the sweep.
  const arc = anthracene([{ op: "add_atom", el: "N", to: 15 }, { op: "set_attachment_shape", atom: 15, shape: "custom" }])
  assert.equal(arc.attachments![0].curve!.closed, false)
  assert.equal(arc.attachments![0].curve!.nodes.length, 6)
  // The curve is drawn round the same ellipse as the arc was: the nodes lie on it (|(u, v)| = 1) but the tucked end.
  for (const [u, v] of arc.attachments![0].curve!.nodes.slice(0, 5)) assert.ok(Math.abs(Math.hypot(u, v) - 1) < 0.02)

  // Another shape keeps the curve, unused; custom again brings it back as it was.
  const edited = run(loop, [{ op: "set_attachment_curve", atom: 15, nodes: OPEN, closed: false }])
  const asArc = run(edited, [{ op: "set_attachment_shape", atom: 15, shape: "arc" }])
  assert.equal(marksOf(asArc)[0].shape, "arc")
  assert.deepEqual(asArc.attachments![0].curve, edited.attachments![0].curve)
  const back = run(asArc, [{ op: "set_attachment_shape", atom: 15, shape: "custom" }])
  assert.deepEqual(back.attachments![0].curve, edited.attachments![0].curve)
  // Set afresh, the attachment starts over without it.
  const fresh = run(back, [{ op: "set_attachment", atom: 15, to: back.attachments![0].to }])
  assert.equal(fresh.attachments![0].curve, undefined)
})

test("curves are checked by the op and when a file is read, and saved with the drawing", () => {
  const drawing = anthracene()
  const rejects = (op: Op, pattern: RegExp) => {
    const result = applyOps(drawing, [op])
    assert.ok(!result.ok && pattern.test(result.error), JSON.stringify(op))
  }
  rejects({ op: "set_attachment_curve", atom: 15, nodes: [[0, 0]], closed: false }, /2 to 24 nodes/)
  rejects({ op: "set_attachment_curve", atom: 15, nodes: [[0, 0], [10, 0]], closed: true }, /3 to 24 nodes/)
  rejects({ op: "set_attachment_curve", atom: 15, nodes: [[0, 0], [Number.NaN, 0]], closed: false }, /two numbers/)
  rejects({ op: "set_attachment_curve", atom: 2, nodes: OPEN, closed: false }, /no variable attachment/)

  const saved = run(drawing, [{ op: "set_attachment_curve", atom: 15, nodes: OPEN, closed: false }])
  const read = readDocument(toDocument(saved))
  assert.ok("drawing" in read)
  assert.deepEqual(read.drawing.attachments, saved.attachments)
  const tamper = (attachment: object) => readDocument(toDocument({ ...saved, attachments: [{ ...saved.attachments![0], ...attachment }] }))
  assert.match((tamper({ curve: { nodes: [[0, 0]], closed: false } }) as { error: string }).error, /nodes/)
  assert.match((tamper({ curve: { nodes: "no", closed: false } }) as { error: string }).error, /curve needs nodes/)
  assert.match((tamper({ curve: undefined }) as { error: string }).error, /needs its curve/)
  // A file from before custom curves reads as it did.
  assert.ok("drawing" in readDocument(toDocument(drawing)))
})

test("exports draw the curve, and a bracket round the rings makes room for it", () => {
  const nodes: Array<[number, number]> = [
    [-60, -80],
    [40, -90],
    [130, -10],
  ]
  const drawing = anthracene([{ op: "set_attachment_curve", atom: 15, nodes, closed: false }])
  const mark = marksOf(drawing)[0]
  const svg = sceneToSvg(drawing.molecule, false, [], drawing.attachments)
  assert.ok(svg.includes(`<path d="${mark.path}" fill="none"`))
  const [x, , width] = svg.match(/viewBox="([^"]+)"/)![1].split(" ").map(Number)
  assert.ok(x + width >= 130, "the export reaches the far node")
  const bracketed = run(drawing, [{ op: "add_bracket", atoms: Array.from({ length: 14 }, (_, i) => i + 1) }])
  const marks = structureMarks(bracketed.molecule, bracketed.attachments, bracketed.brackets)
  assert.ok(marks.brackets[0].uprights.right > 125, `the bracket stands clear of the curve (${marks.brackets[0].uprights.right})`)
})
