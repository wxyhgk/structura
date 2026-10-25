import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import { build, run } from "@structura/testkit"
import { readDocument } from "../src/document.ts"
import { emptyDrawing } from "../src/drawing.ts"
import { RECIPES, type RecipeName } from "../src/molecule/recipes.ts"
import type { Op } from "../src/ops.ts"
import { defaultSite, scaffolds } from "../src/scaffolds.ts"
import { readSdf } from "../src/sdf.ts"
import { abbreviationList } from "../src/templates.ts"
import type { Drawing, Molecule, RingKind } from "../src/types.ts"
import { geometryProblems, validateDrawing, type Problem } from "../src/validate.ts"

const slips = (drawing: Drawing) => validateDrawing(drawing).filter((problem) => ["atoms-overlap", "atom-on-bond", "long-bond", "short-bond"].includes(problem.code))
const brief = (problems: Problem[]) => problems.map(({ code, atoms, bonds, severity }) => ({ code, atoms, bonds, severity }))

/** Propane bent at atom 2, then `ops`. */
const propane = (ops: Op[] = []) =>
  build([{ op: "place_atom", el: "C", at: { x: 0, y: 0 } }, { op: "add_atom", el: "C", to: 1, angle: Math.PI / 6 }, { op: "add_atom", el: "C", to: 2, angle: -Math.PI / 6 }, ...ops])

/** The drawing with atom `id` moved to (x, y), as no op would put it. */
const placed = (drawing: Drawing, id: number, x: number, y: number): Drawing => ({
  ...drawing,
  molecule: { ...drawing.molecule, atoms: drawing.molecule.atoms.map((atom) => (atom.id === id ? { ...atom, x, y } : atom)) },
})

test("two atoms drawn on top of each other are reported, as one heap", () => {
  const apart = propane([{ op: "place_atom", el: "O", at: { x: 200, y: 0 } }, { op: "place_atom", el: "N", at: { x: 300, y: 0 } }])
  const drawing = placed(placed(apart, 4, 2, 1), 5, -1, 2)
  assert.deepEqual(brief(slips(drawing)), [{ code: "atoms-overlap", atoms: [1, 4, 5], bonds: undefined, severity: "warning" }])
  // An atom on top of one it is bonded to is no overlap (in a bigger molecule, a short bond).
  const [one, two] = drawing.molecule.atoms
  const squashed = run(propane(), [{ op: "move", atoms: [2], dx: one.x - two.x + 1, dy: one.y - two.y }])
  assert.deepEqual(slips(squashed).map((problem) => problem.code), [])
})

test("an atom lying on a bond it is not part of is reported with the bond", () => {
  const drawing = propane()
  const [a, , c] = drawing.molecule.atoms
  // Half way along the line from atom 1 to atom 3, which no bond joins.
  const across = run(drawing, [{ op: "add_bond", a: 1, b: 3 }])
  const middle = { x: (a.x + c.x) / 2 + 3, y: (a.y + c.y) / 2 + 1 }
  const chlorine = run(across, [{ op: "place_atom", el: "Cl", at: { x: 300, y: 0 } }])
  assert.deepEqual(brief(slips(placed(chlorine, 4, middle.x, middle.y))), [{ code: "atom-on-bond", atoms: [4, 1, 3], bonds: [3], severity: "warning" }])
  // A little way off the line is fine.
  assert.deepEqual(slips(placed(chlorine, 4, middle.x, middle.y + 8)), [])
})

test("bonds far longer or shorter than the molecule's usual one are reported", () => {
  const chain = build([
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, angle: Math.PI / 6 },
    { op: "add_atom", el: "C", to: 2, angle: -Math.PI / 6 },
    { op: "add_atom", el: "C", to: 3, angle: Math.PI / 6 },
  ])
  const end = chain.molecule.atoms[3]
  const long = run(chain, [{ op: "move", atoms: [4], dx: 200 - end.x, dy: 0 }])
  assert.deepEqual(brief(slips(long)), [{ code: "long-bond", atoms: [3, 4], bonds: [3], severity: "warning" }])
  const third = chain.molecule.atoms[2]
  const short = run(chain, [{ op: "move", atoms: [4], dx: third.x + 8 - end.x, dy: third.y - end.y }])
  assert.deepEqual(brief(slips(short)), [{ code: "short-bond", atoms: [3, 4], bonds: [3], severity: "warning" }])
  // Two bonds say too little about the usual length.
  assert.deepEqual(slips(run(propane(), [{ op: "move", atoms: [3], dx: 200, dy: 0 }])), [])
})

test("size alone is no slip: a drawing, or one molecule in it, may be drawn larger or smaller", () => {
  const benzene = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_ring", at: { x: 400, y: 0 }, kind: "cyclohexane" }])
  const scaled = (factor: number, ids: Set<number>): Molecule => ({ ...benzene.molecule, atoms: benzene.molecule.atoms.map((atom) => (ids.has(atom.id) ? { ...atom, x: atom.x * factor, y: atom.y * factor } : atom)) })
  const every = new Set(benzene.molecule.atoms.map((atom) => atom.id))
  assert.deepEqual(geometryProblems(scaled(3, every)), [])
  assert.deepEqual(geometryProblems(scaled(0.3, every)), [])
  assert.deepEqual(geometryProblems(scaled(0.5, new Set([1, 2, 3, 4, 5, 6]))), [])
})

test("atoms behind a collapsed label are not looked at", () => {
  const drawing = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_group", to: 1, name: "Ph" }])
  const hidden = drawing.molecule.groups[0].atoms.slice(1)
  // Fold the phenyl's hidden ring onto the label: drawn out, it would be a heap of atoms.
  const anchor = drawing.molecule.atoms.find((atom) => atom.id === drawing.molecule.groups[0].atoms[0])!
  const folded = { ...drawing, molecule: { ...drawing.molecule, atoms: drawing.molecule.atoms.map((atom) => (hidden.includes(atom.id) ? { ...atom, x: anchor.x + 1, y: anchor.y } : atom)) } }
  assert.deepEqual(slips(folded), [])
  assert.ok(slips(run(folded, [{ op: "set_collapsed", collapsed: false }])).length > 0)
})

test("a tip pushed into a ring on top of a ring atom is caught", () => {
  const [crowded] = readSdf(readFileSync(new URL("./fixtures/crowded.mol", import.meta.url), "utf8"))
  assert.deepEqual(brief(slips({ ...emptyDrawing(), molecule: crowded.mol })), [{ code: "atoms-overlap", atoms: [7, 15], bonds: undefined, severity: "warning" }])
})

/** Every structure that comes with the editor or its tests, drawn the way a person or agent would. */
function shipped(): Array<[string, Drawing]> {
  const out: Array<[string, Drawing]> = []
  const add = (name: string, ops: Op[]) => {
    const drawing = build(ops)
    out.push([name, drawing], [`${name}, drawn out`, run(drawing, [{ op: "set_collapsed", collapsed: false }])])
  }
  const rings: RingKind[] = ["benzene", "cyclohexane", "cycloheptane", "cyclooctane", "cyclopentane", "cyclopentene", "cyclobutane", "cyclopropane"]
  for (const kind of rings) {
    add(kind, [{ op: "add_ring", at: { x: 0, y: 0 }, kind }])
    add(`${kind} fused to benzene`, [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_ring", bond: { between: [1, 2] }, kind }])
    add(`${kind} on benzene`, [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_ring", atom: 1, kind }])
  }
  for (const { label, attachments } of abbreviationList()) {
    if (attachments !== 1) continue
    add(`${label} on benzene`, [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_group", to: 1, name: label }])
    add(`${label} on a chain`, [{ op: "place_atom", el: "C", at: { x: 0, y: 0 } }, { op: "add_atom", el: "C", to: 1 }, { op: "add_group", to: 2, name: label }])
  }
  for (const scaffold of scaffolds()) {
    add(scaffold.name, [{ op: "add_scaffold", name: scaffold.name, at: { x: 0, y: 0 } }])
    add(`${scaffold.name} on benzene`, [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_scaffold", name: scaffold.name, to: 1, site: defaultSite(scaffold) }])
  }
  for (const name of Object.keys(RECIPES) as RecipeName[]) {
    add(`${name} on a chain`, [{ op: "place_atom", el: "C", at: { x: 0, y: 0 } }, { op: "add_atom", el: "C", to: 1 }, { op: "add_recipe", to: 2, name }])
    add(`${name} on benzene`, [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_recipe", to: 1, name }])
  }
  // The test files, but for the one made crowded on purpose.
  for (const dir of [new URL("./fixtures/", import.meta.url), new URL("../../../e2e/fixtures/", import.meta.url)]) {
    for (const file of readdirSync(dir).filter((name) => name !== "crowded.mol")) {
      const text = readFileSync(new URL(file, dir), "utf8")
      if (/\.(sdf|mol)$/.test(file)) readSdf(text).forEach((record, index) => out.push([`${file} record ${index + 1}`, { ...emptyDrawing(), molecule: record.mol }]))
      const read = file.endsWith(".structura") ? readDocument(text) : null
      if (read && "drawing" in read) out.push([file, read.drawing])
    }
  }
  return out
}

test("nothing the editor ships or tests with is reported: templates, scaffolds, rings, recipes, test files", () => {
  const drawings = shipped()
  assert.ok(drawings.length > 1000, `${drawings.length} drawings`)
  for (const [name, drawing] of drawings) assert.deepEqual(slips(drawing), [], name)
})
