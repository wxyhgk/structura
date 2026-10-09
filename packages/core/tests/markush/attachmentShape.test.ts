import assert from "node:assert/strict"
import test from "node:test"
import { readDocument, toDocument } from "@structura/core/document"
import { attachmentMarks, attachmentShape, buildScene, clearance, ELLIPSE_PAD, fitEllipse, sceneToSvg } from "@structura/core/draw"
import { ringSystemPositions } from "@structura/core/markush"
import { applyOps, type Op } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { build, run } from "@structura/testkit"

// Curved variable attachments: an ellipse round a fused system (a loop) or the bond sweeping
// round it (an arc), chosen from the attachment unless it says.

/** Anthracene (atoms 1–14) with a free-standing Rx (15), attached at `to` (the whole system when left out). */
function anthracene(extra: Op[] = [], to?: number[]): Drawing {
  const base = build([
    { op: "add_scaffold", name: "anthracene", at: { x: 0, y: 0 } },
    { op: "place_atom", el: "C", at: { x: -40, y: -120 } },
    { op: "label", atom: 15, text: "Rx" },
  ])
  const positions = to ?? ringSystemPositions(base.molecule, [1])!
  return run(base, [{ op: "set_attachment", atom: 15, to: positions }, ...extra])
}

const marksOf = (drawing: Drawing) => attachmentMarks(drawing.molecule, drawing.attachments, buildScene(drawing.molecule, false).labels)

test("the ellipse holds every candidate atom with room to spare, its long axis along the fused system", () => {
  const drawing = anthracene()
  const atoms = drawing.molecule.atoms.filter((atom) => drawing.attachments![0].to.includes(atom.id))
  const e = fitEllipse(atoms)
  assert.ok(clearance(e, atoms) >= ELLIPSE_PAD * 0.95, "no atom comes near the outline")
  for (const atom of atoms) {
    const dx = atom.x - e.cx
    const dy = atom.y - e.cy
    const u = (dx * Math.cos(e.angle) + dy * Math.sin(e.angle)) / e.rx
    const v = (-dx * Math.sin(e.angle) + dy * Math.cos(e.angle)) / e.ry
    assert.ok(u * u + v * v < 1, `atom #${atom.id} is inside`)
  }
  // Anthracene is drawn level: the long axis lies level, and well longer than the short one.
  const xs = atoms.map((atom) => atom.x)
  const level = Math.max(...xs) - Math.min(...xs) > 100
  assert.ok(level)
  assert.ok(Math.abs(Math.sin(e.angle)) < 0.05, `angle ${e.angle}`)
  assert.ok(e.rx > e.ry * 1.5)
  // Turned with the molecule, the ellipse turns with it.
  const turned = run(drawing, [{ op: "rotate", atoms: drawing.molecule.atoms.map((atom) => atom.id), angle: Math.PI / 3 }])
  const turnedAtoms = turned.molecule.atoms.filter((atom) => turned.attachments![0].to.includes(atom.id))
  const t = fitEllipse(turnedAtoms)
  // How far the atoms really turned (on the page, y downwards), read off one bond.
  const bondAngle = (d: Drawing) => {
    const [a, b] = [1, 2].map((id) => d.molecule.atoms.find((atom) => atom.id === id)!)
    return Math.atan2(b.y - a.y, b.x - a.x)
  }
  const turn = bondAngle(turned) - bondAngle(drawing)
  assert.ok(Math.abs(Math.sin(turn)) > 0.5)
  assert.ok(Math.abs(Math.sin(t.angle - e.angle - turn)) < 0.05, `turned angle ${t.angle}, turn ${turn}`)
  assert.ok(Math.abs(t.rx - e.rx) < 1 && Math.abs(t.ry - e.ry) < 1, `${t.rx} ${t.ry} vs ${e.rx} ${e.ry}`)
})

test("a row of two atoms still gets a round outline, never a sliver", () => {
  const e = fitEllipse([
    { x: 0, y: 0 },
    { x: 40, y: 0 },
  ])
  assert.ok(e.ry >= 0.6 * 40 - 1e-9)
})

test("left to itself, one ring is a line; a fused system is a loop for a free piece and an arc for a bonded one", () => {
  const benzene = build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "place_atom", el: "C", at: { x: 80, y: -70 } },
    { op: "label", atom: 7, text: "R1" },
    { op: "set_attachment", atom: 7, to: [1, 2, 3, 4, 5, 6] },
  ])
  assert.equal(attachmentShape(benzene.molecule, benzene.attachments![0]), "line")
  const loose = anthracene()
  assert.equal(attachmentShape(loose.molecule, loose.attachments![0]), "loop")
  // Within one ring of the fused system, still a line.
  const oneRing = anthracene([], [1, 2, 3, 4])
  assert.equal(attachmentShape(oneRing.molecule, oneRing.attachments![0]), "line")
  // Bonded to the rest (a linker), the bond sweeps round the rings.
  const linker = anthracene([{ op: "add_atom", el: "N", to: 15 }])
  assert.equal(attachmentShape(linker.molecule, linker.attachments![0]), "arc")
  // Repeated, "(R)n": a loop even when bonded.
  const repeated = run(linker, [{ op: "set_repeat", atom: 15, repeat: { min: 0, max: 3, name: "n" } }])
  assert.equal(attachmentShape(repeated.molecule, repeated.attachments![0]), "loop")
  // Said outright, it is drawn as said.
  const said = run(linker, [{ op: "set_attachment_shape", atom: 15, shape: "line" }])
  assert.equal(attachmentShape(said.molecule, said.attachments![0]), "line")
})

test("each shape is one path: a straight line, a closed ellipse with a line to it, an open curve", () => {
  const loop = marksOf(anthracene())[0]
  assert.equal(loop.shape, "loop")
  assert.match(loop.path, /^M [\d. -]+ L [\d. -]+ M [\d. -]+( C [\d. -]+){4} Z$/)
  const arc = marksOf(anthracene([{ op: "set_attachment_shape", atom: 15, shape: "arc" }]))[0]
  assert.equal(arc.shape, "arc")
  assert.ok(!arc.path.includes("Z"), "an arc is left open")
  assert.ok((arc.path.match(/ C /g) ?? []).length >= 3)
  const line = marksOf(anthracene([{ op: "set_attachment_shape", atom: 15, shape: "line" }]))[0]
  assert.match(line.path, /^M [\d. -]+ L [\d. -]+$/)
  // The same drawing gives the same path, and moving the atoms moves the curve with them.
  assert.equal(marksOf(anthracene())[0].path, loop.path)
  const moved = run(anthracene(), [{ op: "move", atoms: Array.from({ length: 15 }, (_, i) => i + 1), dx: 50, dy: 0 }])
  const after = marksOf(moved)[0]
  assert.ok(Math.abs(after.bounds.left - loop.bounds.left - 50) < 1e-6)
})

test("the exported SVG draws the curve and makes room for all of it", () => {
  const drawing = anthracene()
  const svg = sceneToSvg(drawing.molecule, false, [], drawing.attachments)
  const mark = marksOf(drawing)[0]
  assert.ok(svg.includes(`<path d="${mark.path}" fill="none"`))
  const [x, y, width, height] = svg.match(/viewBox="([^"]+)"/)![1].split(" ").map(Number)
  assert.ok(x <= mark.bounds.left && y <= mark.bounds.top && x + width >= mark.bounds.right && y + height >= mark.bounds.bottom)
})

test("the shape is checked, kept by the other attachment ops, saved, and goes back to choosing by itself", () => {
  const drawing = anthracene([{ op: "set_attachment_shape", atom: 15, shape: "arc" }])
  assert.equal(drawing.attachments![0].shape, "arc")
  const counted = run(drawing, [{ op: "set_repeat", atom: 15, repeat: { min: 0, max: 2, name: "n" } }])
  assert.equal(counted.attachments![0].shape, "arc")
  const read = readDocument(toDocument(counted))
  assert.ok("drawing" in read)
  assert.deepEqual(read.drawing.attachments, counted.attachments)
  const auto = run(counted, [{ op: "set_attachment_shape", atom: 15, shape: null }])
  assert.equal(auto.attachments![0].shape, undefined)
  assert.ok(!toDocument(auto).includes('"shape"'))
  const made = run(anthracene(), [{ op: "set_attachment", atom: 15, to: [1, 2, 3, 4], shape: "loop" }])
  assert.equal(made.attachments![0].shape, "loop")
  for (const op of [
    { op: "set_attachment_shape", atom: 1, shape: "loop" },
    { op: "set_attachment_shape", atom: 15, shape: "zigzag" },
  ] as Op[]) {
    const outcome = applyOps(drawing, [op])
    assert.ok(!outcome.ok, JSON.stringify(op))
  }
  const bad = toDocument(drawing).replace('"shape": "arc"', '"shape": "zigzag"')
  assert.ok("error" in readDocument(bad))
})
