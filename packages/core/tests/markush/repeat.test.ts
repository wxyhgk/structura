import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core/drawing"
import type { Drawing, Repeat } from "@structura/core/types"
import { label, run } from "@structura/testkit"

/** Benzene (atoms 1–6) with (R1)m drawn into it: R1 is atom 7, m from `min` to `max`, R1 = Cl or F. */
function formula(repeat: Repeat): Drawing {
  return run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "place_atom", el: "C", at: { x: 150, y: 0 } },
    { op: "label", atom: 7, text: "R1" },
    { op: "set_attachment", atom: 7, to: [1, 2, 3, 4, 5, 6], repeat },
    { op: "set_variable", name: "R1", alternatives: [label("Cl"), label("F")] },
  ])
}

test("deleting ring positions shrinks the count with them", () => {
  const drawing = formula({ min: 0, max: 6, name: "m" })
  const fewer = run(drawing, [{ op: "remove", atoms: [5, 6] }])
  assert.deepEqual(fewer.attachments?.[0].to, [1, 2, 3, 4])
  assert.equal(fewer.attachments?.[0].repeat?.max, 4)
})

test("exported SVG draws the attachment line and (R1)m, and canvas and export share the geometry", async () => {
  const { sceneToSvg, attachmentMarks, buildScene } = await import("@structura/core/draw")
  const drawing = formula({ min: 0, max: 4, name: "m" })
  const svg = sceneToSvg(drawing.molecule, false, [], drawing.attachments)
  const marks = attachmentMarks(drawing.molecule, drawing.attachments, buildScene(drawing.molecule, false).labels)
  assert.equal(marks.length, 1)
  assert.deepEqual(marks[0].texts.map((text) => text.text), ["(", ")", "m"])
  assert.ok(svg.includes(`x2="${marks[0].to.x.toFixed(2)}"`), "the line into the ring is in the SVG")
  assert.ok(/font-style="italic"[^>]*>m</.test(svg), "the count is written in italics")
  assert.ok(svg.includes(">(<") && svg.includes(">)<"))
  // Without attachments passed, nothing extra is drawn.
  assert.ok(!sceneToSvg(drawing.molecule, false).includes(">(<"))
})
