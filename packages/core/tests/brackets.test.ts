import assert from "node:assert/strict"
import test from "node:test"
import { readDocument, toDocument } from "@structura/core/document"
import { bracketMarks, buildScene, sceneToSvg } from "@structura/core/draw"
import { crossingBonds, emptyDrawing } from "@structura/core/drawing"
import { historyReducer, emptyHistory } from "@structura/core/history"
import { toMolfile } from "@structura/core/molfile"
import { readMolfile } from "@structura/core/sdf"
import type { Drawing } from "@structura/core/types"
import { validateDrawing } from "@structura/core/validate"
import { build, run, tryRun } from "@structura/testkit"

/** A chain of five carbons, atoms 1–5, left to right. */
const chain = (): Drawing =>
  build([
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "C", to: 2 },
    { op: "add_atom", el: "C", to: 3 },
    { op: "add_atom", el: "C", to: 4 },
  ])

test("add_bracket makes a group bracket with a fresh id; a repeat one counts n = 1–4 unless told", () => {
  const first = tryRun(chain(), [{ op: "add_bracket", atoms: [2, 3, 4] }])
  assert.ok(first.ok)
  assert.deepEqual(first.added.brackets, [1])
  assert.deepEqual(first.drawing.brackets, [{ id: 1, atoms: [2, 3, 4], kind: "group" }])
  assert.equal(first.drawing.nextBracketId, 2)
  const second = run(first.drawing, [{ op: "add_bracket", atoms: [3], kind: "repeat" }])
  assert.deepEqual(second.brackets?.[1], { id: 2, atoms: [3], kind: "repeat", repeat: { min: 1, max: 4, name: "n" } })
})

test("set_bracket switches the kind and the count; remove_bracket takes it away", () => {
  const drawing = run(chain(), [{ op: "add_bracket", atoms: [3] }])
  const repeat = run(drawing, [{ op: "set_bracket", id: 1, kind: "repeat" }])
  assert.deepEqual(repeat.brackets?.[0].repeat, { min: 1, max: 4, name: "n" })
  const counted = run(repeat, [{ op: "set_bracket", id: 1, repeat: { min: 2, max: 6, name: "m" } }])
  assert.deepEqual(counted.brackets?.[0], { id: 1, atoms: [3], kind: "repeat", repeat: { min: 2, max: 6, name: "m" } })
  // Back to a group: the count goes; made a repeat again, it starts from n = 1–4.
  const group = run(counted, [{ op: "set_bracket", id: 1, kind: "group" }])
  assert.deepEqual(group.brackets?.[0], { id: 1, atoms: [3], kind: "group" })
  const gone = run(group, [{ op: "remove_bracket", id: 1 }])
  assert.equal(gone.brackets, undefined)
  assert.equal(gone.nextBracketId, 2, "the id is not handed out again")
})

test("bracket ops refuse what cannot be, with a reason", () => {
  const drawing = run(chain(), [{ op: "add_bracket", atoms: [3] }])
  const refused = (ops: Parameters<typeof tryRun>[1]) => {
    const result = tryRun(drawing, ops)
    assert.ok(!result.ok, JSON.stringify(ops))
    return result.error
  }
  assert.match(refused([{ op: "add_bracket", atoms: [] }]), /needs atoms/)
  assert.match(refused([{ op: "add_bracket", atoms: [99] }]), /atom #99 does not exist/)
  assert.match(refused([{ op: "add_bracket", atoms: [1], kind: "group", repeat: { min: 1, max: 2, name: "n" } }]), /only a repeat bracket/)
  assert.match(refused([{ op: "add_bracket", atoms: [1], kind: "round" as "group" }]), /"group" or "repeat"/)
  assert.match(refused([{ op: "set_bracket", id: 7, kind: "repeat" }]), /no bracket #7/)
  assert.match(refused([{ op: "set_bracket", id: 1, repeat: { min: 3, max: 1, name: "n" } }]), /not a range/)
  assert.match(refused([{ op: "set_bracket", id: 1, repeat: { min: 1, max: 4, name: "N" } }]), /lower-case letter/)
  assert.match(refused([{ op: "set_bracket", id: 1, repeat: { min: 1, max: 500, name: "n" } }]), /at most 100/)
  assert.match(refused([{ op: "remove_bracket", id: 2 }]), /no bracket #2/)
})

test("deleted atoms leave their brackets, and a bracket left empty goes", () => {
  const drawing = run(chain(), [
    { op: "add_bracket", atoms: [2, 3] },
    { op: "add_bracket", atoms: [5] },
  ])
  const fewer = run(drawing, [{ op: "remove", atoms: [3, 5] }])
  assert.deepEqual(fewer.brackets, [{ id: 1, atoms: [2], kind: "group" }])
  const none = run(fewer, [{ op: "remove", atoms: [2] }])
  assert.equal(none.brackets, undefined)
  // Removing only a bond keeps the bracket as it is.
  assert.deepEqual(run(drawing, [{ op: "remove", bonds: [{ between: [2, 3] }] }]).brackets, drawing.brackets)
})

test("validation catches brackets on missing atoms, repeated ids and ids at the counter", () => {
  const base = run(chain(), [{ op: "add_bracket", atoms: [3] }])
  const codes = (drawing: Drawing) => validateDrawing(drawing).map((problem) => problem.code)
  assert.deepEqual(codes(base), [])
  assert.ok(codes({ ...base, brackets: [{ id: 1, atoms: [42], kind: "group" }] }).includes("bad-bracket"))
  assert.ok(codes({ ...base, brackets: [{ id: 1, atoms: [], kind: "group" }] }).includes("bad-bracket"))
  assert.ok(codes({ ...base, brackets: [base.brackets![0], base.brackets![0]] }).includes("duplicate-id"))
  assert.ok(codes({ ...base, nextBracketId: 1 }).includes("id-not-below-counter"))
  assert.ok(codes({ ...base, brackets: [{ id: 1, atoms: [3], kind: "repeat" }] }).includes("bad-bracket"), "a repeat bracket needs its count")
})

test("brackets round-trip through the document; old documents load without any", () => {
  const drawing = run(chain(), [
    { op: "add_bracket", atoms: [2, 3, 4] },
    { op: "add_bracket", atoms: [3], kind: "repeat", repeat: { min: 1, max: 3, name: "m" } },
  ])
  const read = readDocument(toDocument(drawing))
  assert.ok("drawing" in read)
  assert.deepEqual(read.drawing, drawing)
  const old = readDocument(toDocument(chain()))
  assert.ok("drawing" in old)
  assert.equal(old.drawing.brackets, undefined)
  assert.equal(old.drawing.nextBracketId, undefined)
  // A file that lists brackets but no counter gets one past the highest id.
  const { nextBracketId: _counter, ...uncounted } = drawing
  const recounted = readDocument(toDocument(uncounted))
  assert.ok("drawing" in recounted)
  assert.equal(recounted.drawing.nextBracketId, 3)
  const broken = readDocument(toDocument({ ...drawing, brackets: [{ id: 1, atoms: [77], kind: "group" }] }))
  assert.ok("error" in broken && /missing atom #77/.test(broken.error))
})

test("duplicating atoms takes along the brackets wholly inside them", () => {
  const drawing = run(chain(), [
    { op: "add_bracket", atoms: [2, 3] },
    { op: "add_bracket", atoms: [4, 5] },
  ])
  const result = tryRun(drawing, [{ op: "duplicate", atoms: [1, 2, 3, 4] }])
  assert.ok(result.ok)
  // The copy is atoms 6–9 (of 1–4); only the bracket on 2–3 lies wholly inside.
  assert.deepEqual(result.added.atoms, [6, 7, 8, 9])
  assert.deepEqual(result.added.brackets, [3])
  assert.deepEqual(result.drawing.brackets?.[2], { id: 3, atoms: [7, 8], kind: "group" })
})

test("undo and redo bring brackets back, and the counter never goes back", () => {
  const start = { ...emptyHistory(), present: chain() }
  const added = historyReducer(start, { type: "commit", drawing: run(chain(), [{ op: "add_bracket", atoms: [3] }]) })
  const undone = historyReducer(added, { type: "undo" })
  assert.equal(undone.present.brackets, undefined)
  assert.equal(undone.present.nextBracketId, 2)
  const redone = historyReducer(undone, { type: "redo" })
  assert.deepEqual(redone.present.brackets, [{ id: 1, atoms: [3], kind: "group" }])
})

test("crossing bonds are those with exactly one end inside", () => {
  const drawing = chain()
  const bonds = crossingBonds(drawing.molecule, [3])
  assert.equal(bonds.length, 2)
  assert.deepEqual(crossingBonds(drawing.molecule, [1, 2, 3, 4, 5]), [])
})

test("a group bracket encloses its atoms and their labels with room, its serifs pointing in", () => {
  const drawing = run(chain(), [
    { op: "label", atom: 5, text: "OMe" },
    { op: "add_bracket", atoms: [5] },
  ])
  const mol = drawing.molecule
  const scene = buildScene(mol, false)
  const [mark] = bracketMarks(mol, drawing.brackets, scene.labels)
  const label = scene.labels.find((item) => item.atomId === 5)!
  const [open, close] = mark.figures
  const x = (figure: typeof open, index: number) => figure.points[index].x
  assert.ok(x(open, 1) < label.box.left - 10, "\"[\" stands clear left of the label")
  assert.ok(x(close, 1) > label.box.right + 10, "\"]\" stands clear right of the label")
  assert.ok(open.points[1].y < label.box.top && open.points[2].y > label.box.bottom)
  assert.ok(x(open, 0) > x(open, 1) && x(close, 0) < x(close, 1), "serifs point inwards")
  assert.equal(mark.text, null)
  // Without the scene's labels it works them out the same.
  assert.deepEqual(bracketMarks(mol, drawing.brackets)[0].figures, mark.figures)
})

test("a repeat bracket reaches across the bonds through it, its count italic at the lower right, and follows its atoms", () => {
  const drawing = run(chain(), [{ op: "add_bracket", atoms: [3], kind: "repeat" }])
  const mol = drawing.molecule
  const [mark] = bracketMarks(mol, drawing.brackets)
  const [open, close] = mark.figures
  const atom = mol.atoms.find((item) => item.id === 3)!
  assert.ok(open.points[1].x < atom.x && close.points[1].x > atom.x)
  // Each upright crosses the bond on its side between its two ends.
  for (const [figure, other] of [[open, 2], [close, 4]] as const) {
    const outer = mol.atoms.find((item) => item.id === other)!
    const x = figure.points[1].x
    const y = atom.y + ((outer.y - atom.y) * (x - atom.x)) / (outer.x - atom.x)
    assert.ok(figure.points[1].y < y && figure.points[2].y > y, "the bond passes through the bracket")
    assert.ok(Math.min(atom.x, outer.x) < x && x < Math.max(atom.x, outer.x))
  }
  assert.equal(mark.text?.text, "n")
  assert.ok(mark.text!.italic && mark.text!.x > close.points[1].x && mark.text!.y > atom.y)
  const moved = run(drawing, [{ op: "move", atoms: [1, 2, 3, 4, 5], dx: 100, dy: 50 }])
  const [after] = bracketMarks(moved.molecule, moved.brackets)
  assert.equal(after.figures[0].points[1].x, open.points[1].x + 100)
  assert.equal(after.figures[0].points[1].y, open.points[1].y + 50)
})

test("the exported SVG draws the brackets and the count, and its bounds take them in", () => {
  const drawing = run(chain(), [{ op: "add_bracket", atoms: [1, 2, 3, 4, 5], kind: "repeat" }])
  const plain = sceneToSvg(drawing.molecule, false)
  const svg = sceneToSvg(drawing.molecule, false, [], undefined, {}, { brackets: drawing.brackets })
  const [mark] = bracketMarks(drawing.molecule, drawing.brackets)
  const points = mark.figures[0].points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")
  assert.ok(svg.includes(`points="${points}"`), "the same \"[\" as on the canvas")
  assert.ok(/font-style="italic"[^>]*>n</.test(svg))
  const width = (text: string) => Number(/width="([\d.]+)"/.exec(text)![1])
  assert.ok(width(svg) > width(plain) + 20, "wider, to hold the brackets and the count")
})

test("brackets round-trip through molfile Sgroups: SRU with its label and crossing bonds, GEN", () => {
  const drawing = run(chain(), [
    { op: "add_bracket", atoms: [3], kind: "repeat", repeat: { min: 2, max: 6, name: "m" } },
    { op: "add_bracket", atoms: [1, 2], kind: "group" },
  ])
  const text = toMolfile(drawing.molecule, "Structura", drawing.brackets)
  assert.match(text, /^M {2}STY {2}3 {3}1 SRU {3}2 GEN {3}3 DAT$/m)
  assert.match(text, /^M {2}SAL {3}1 {2}1 {3}3$/m)
  assert.match(text, /^M {2}SBL {3}1 {2}2 {3}2 {3}3$/m)
  assert.match(text, /^M {2}SMT {3}1 m$/m)
  assert.match(text, /^M {2}SCN {2}1 {3}1 HT $/m)
  assert.equal(text.match(/^M {2}SDI/gm)?.length, 4, "two bracket lines per Sgroup")
  // The label is the name alone; the range goes alongside as data on the same atoms.
  assert.match(text, /^M {2}SAL {3}3 {2}1 {3}3$/m)
  assert.match(text, /^M {2}SDT {3}3 STRUCTURA_REPEAT {14}T$/m)
  assert.match(text, /^M {2}SED {3}3 2-6$/m)
  const read = readMolfile(text)
  assert.deepEqual(read.brackets, [
    { id: 1, atoms: [3], kind: "repeat", repeat: { min: 2, max: 6, name: "m" } },
    { id: 2, atoms: [1, 2], kind: "group" },
  ])
  assert.ok(!read.problems.some((problem) => /Sgroup/.test(problem.message)))
  // Without brackets nothing changes.
  assert.ok(!toMolfile(drawing.molecule).includes("M  STY"))
})

test("other Sgroups are still noted as ignored; an SRU labelled with a range reads as n over it", () => {
  const text = toMolfile(chain().molecule)
    .replace("M  END", ["M  STY  2   1 SUP   2 SRU", "M  SAL   1  1   5", "M  SMT   1 Me", "M  SAL   2  2   2   3", "M  SMT   2 2-5", "M  END"].join("\n"))
  const read = readMolfile(text)
  assert.deepEqual(read.brackets, [{ id: 1, atoms: [2, 3], kind: "repeat", repeat: { min: 2, max: 5, name: "n" } }])
  assert.ok(read.problems.some((problem) => /SUP/.test(problem.message)))
})

test("a repeat unit's range reads from its data Sgroup first, whatever the order and even split over lines", () => {
  const sgroups = [
    "M  STY  3   1 DAT   2 SRU   3 DAT",
    "M  SAL   1  2   3   2",
    "M  SDT   1 STRUCTURA_REPEAT              T",
    "M  SCD   1 1-",
    "M  SED   1 12",
    "M  SAL   2  2   2   3",
    "M  SMT   2 k",
    "M  SAL   3  1   4",
    "M  SDT   3 COMMENT                       T",
    "M  SED   3 hello",
  ]
  const read = readMolfile(toMolfile(chain().molecule).replace("M  END", [...sgroups, "M  END"].join("\n")))
  assert.deepEqual(read.brackets, [{ id: 1, atoms: [2, 3], kind: "repeat", repeat: { min: 1, max: 12, name: "k" } }])
  // Another data field is still noted as ignored; the repeat range is not.
  assert.equal(read.problems.filter((problem) => /Sgroups other/.test(problem.message)).length, 1)
  assert.match(read.problems.find((problem) => /Sgroups other/.test(problem.message))!.message, /\(DAT:/)
  assert.ok(!read.problems.some((problem) => /ignored "M  S/.test(problem.message)))
})

test("opening or pasting molecules with brackets puts the brackets on the atoms' new ids", () => {
  const drawing = run(chain(), [{ op: "add_bracket", atoms: [2, 3], kind: "repeat" }])
  const read = readMolfile(toMolfile(drawing.molecule, "x", drawing.brackets))
  const page = { ...emptyHistory(), present: run(emptyDrawing(), [{ op: "place_atom", el: "N", at: { x: 0, y: 0 } }]) }
  const pasted = historyReducer(page, { type: "append", molecules: [read.mol], brackets: [read.brackets] }).present
  // The page had atom 1; the pasted chain is atoms 2–6, so its atoms 2 and 3 are now 3 and 4.
  assert.deepEqual(pasted.brackets, [{ id: 1, atoms: [3, 4], kind: "repeat", repeat: { min: 1, max: 4, name: "n" } }])
  assert.deepEqual(validateDrawing(pasted), [])
  const opened = historyReducer(page, { type: "open", molecules: [read.mol, read.mol], brackets: [read.brackets, read.brackets] }).present
  assert.deepEqual(opened.brackets?.map((bracket) => bracket.atoms), [[3, 4], [8, 9]])
  assert.deepEqual(validateDrawing(opened), [])
})
