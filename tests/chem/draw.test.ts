import assert from "node:assert/strict"
import test from "node:test"
import { buildScene, type DrawLine } from "../../src/chem/draw.ts"
import { addAtom, addBond, emptyMolecule, paintBond, setBondLook, setBondOrder } from "../../src/chem/molecule.ts"

function lineDistance(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  return (dx * (point.y - a.y) - dy * (point.x - a.x)) / length
}

test("a chain double bond keeps one line on the backbone", () => {
  let mol = emptyMolecule()
  const first = addAtom(mol, "C", 0, 0)
  mol = first.mol
  const second = addAtom(mol, "C", 40, 0)
  mol = second.mol
  const third = addAtom(mol, "C", 60, -34.641)
  mol = third.mol
  const fourth = addAtom(mol, "C", 100, -34.641)
  mol = fourth.mol
  mol = addBond(mol, first.id, second.id, { order: 1, stereo: "none" })!.mol
  mol = addBond(mol, second.id, third.id, { order: 2, stereo: "none" })!.mol
  mol = addBond(mol, third.id, fourth.id, { order: 1, stereo: "none" })!.mol

  const start = { x: 40, y: 0 }
  const end = { x: 60, y: -34.641 }
  const lines = buildScene(mol, false).figures.filter((figure): figure is DrawLine => figure.kind === "line")
  const parallel = lines.filter((line) => {
    const along = Math.hypot(end.x - start.x, end.y - start.y)
    const span = Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
    const dot = Math.abs((end.x - start.x) * (line.x2 - line.x1) + (end.y - start.y) * (line.y2 - line.y1))
    return span > 1 && dot / (along * span) > 0.98
  })
  const onAxis = parallel.filter((line) => {
    return (
      Math.abs(lineDistance({ x: line.x1, y: line.y1 }, start, end)) < 0.4 &&
      Math.abs(lineDistance({ x: line.x2, y: line.y2 }, start, end)) < 0.4
    )
  })
  const flank = parallel.filter(
    (line) => Math.abs(lineDistance({ x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 }, start, end)) > 3,
  )
  assert.ok(onAxis.length >= 1)
  assert.ok(flank.length >= 1)
  const signs = new Set(flank.map((line) => Math.sign(lineDistance({ x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 }, start, end))))
  assert.equal(signs.size, 1)
  const lengthOf = (line: DrawLine) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
  const axisLength = onAxis.reduce((sum, line) => sum + lengthOf(line), 0)
  const flankLength = flank.reduce((sum, line) => sum + lengthOf(line), 0)
  assert.ok(flankLength < axisLength - 4)
})

test("bold, dashed, and shadow bonds produce their strokes", () => {
  let mol = emptyMolecule()
  const first = addAtom(mol, "C", 0, 0)
  mol = first.mol
  const second = addAtom(mol, "C", 40, 0)
  mol = second.mol
  mol = addBond(mol, first.id, second.id, { order: 1, stereo: "none", look: "bold" })!.mol
  assert.ok(buildScene(mol, false).figures.some((figure) => figure.kind === "line" && figure.width > 3))
  mol = addBond(mol, first.id, second.id, { order: 1, stereo: "none", look: "dashed" })!.mol
  assert.ok(buildScene(mol, false).figures.some((figure) => figure.kind === "line" && figure.dash === "5 4"))
  mol = addBond(mol, first.id, second.id, { order: 1, stereo: "none", look: "shadow" })!.mol
  assert.ok(buildScene(mol, false).figures.filter((figure) => figure.kind === "line").length >= 5)
})

test("a drawing look and chemical stereo never sit on the same bond", () => {
  let mol = emptyMolecule()
  const first = addAtom(mol, "C", 0, 0)
  mol = first.mol
  const second = addAtom(mol, "C", 40, 0)
  mol = second.mol
  mol = addBond(mol, first.id, second.id, { order: 1, stereo: "none", look: "bold" })!.mol
  assert.equal(mol.bonds[0].look, "bold")

  const wedged = addBond(mol, first.id, second.id, { order: 1, stereo: "up" })!.mol
  assert.equal(wedged.bonds[0].stereo, "up")
  assert.equal(wedged.bonds[0].look, undefined)

  const doubled = setBondOrder(mol, [mol.bonds[0].id], 2)
  assert.equal(doubled.bonds[0].look, undefined)

  const plain = paintBond(mol, mol.bonds[0].id, { order: 1, stereo: "none" })
  assert.equal(plain.bonds[0].order, 1)
  assert.equal(plain.bonds[0].look, undefined)

  const looked = setBondLook(mol, mol.bonds[0].id, { order: 1, stereo: "down", look: "dashed" })
  assert.equal(looked.bonds[0].stereo, "down")
  assert.equal(looked.bonds[0].look, undefined)
})

test("a bond squeezed between two labels is still drawn", () => {
  let mol = emptyMolecule()
  const n = addAtom(mol, "N", 0, 0, 1)
  mol = n.mol
  const o = addAtom(mol, "O", 14, 0, -1)
  mol = o.mol
  mol = addBond(mol, n.id, o.id, { order: 1, stereo: "none" })!.mol
  assert.ok(buildScene(mol, false).figures.length > 0)
})

test("a double bond to an end atom is two lines centred on the bond", () => {
  let mol = emptyMolecule()
  const left = addAtom(mol, "C", 0, 0)
  mol = left.mol
  const carbonyl = addAtom(mol, "C", 34.641, -20)
  mol = carbonyl.mol
  const oxygen = addAtom(mol, "O", 34.641, -60)
  mol = oxygen.mol
  const right = addAtom(mol, "C", 69.282, 0)
  mol = right.mol
  mol = addBond(mol, left.id, carbonyl.id, { order: 1, stereo: "none" })!.mol
  mol = addBond(mol, carbonyl.id, oxygen.id, { order: 2, stereo: "none" })!.mol
  mol = addBond(mol, carbonyl.id, right.id, { order: 1, stereo: "none" })!.mol

  const start = { x: 34.641, y: -20 }
  const end = { x: 34.641, y: -60 }
  const vertical = buildScene(mol, false).figures.filter(
    (figure): figure is DrawLine => figure.kind === "line" && Math.abs(figure.x1 - figure.x2) < 0.01,
  )
  const offsets = vertical.map((line) => lineDistance({ x: line.x1, y: line.y1 }, start, end)).sort((a, b) => a - b)
  assert.equal(offsets.length, 2)
  assert.ok(Math.abs(offsets[0] + offsets[1]) < 0.01, "the two lines sit symmetrically")
  assert.ok(offsets[1] > 1)
})
