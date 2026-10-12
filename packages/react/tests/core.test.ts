import assert from "node:assert/strict"
import { dirname, join, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { importsOf } from "@structura/testkit/arch"
import * as core from "../src/core.ts"

const SRC = fileURLToPath(new URL("../src/", import.meta.url))

const FORMULA: core.Op[] = [
  { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
  { op: "add_atom", el: "C", as: "r" },
  { op: "label", atom: "r", text: "R1" },
  { op: "move", atoms: ["r"], dx: 110, dy: -70 },
  { op: "set_attachment", atom: "r", to: [1, 2, 3, 4, 5, 6] },
  { op: "add_atom", el: "C", to: 4, as: "c" },
  { op: "add_atom", el: "O", to: "c" },
  { op: "add_bracket", atoms: ["c"], kind: "repeat" },
  { op: "set_variable", name: "R1", alternatives: [{ kind: "label", text: "H" }, { kind: "label", text: "Cl" }] },
]

function formula(): core.Drawing {
  const result = core.applyOps(core.emptyDrawing(), FORMULA)
  assert.ok(result.ok, "the formula builds")
  return result.drawing
}

/** Every file src/core.ts reaches through relative imports, itself included. */
function reached(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen
  seen.add(file)
  for (const spec of importsOf(file)) if (spec.startsWith(".")) reached(resolve(dirname(file), spec), seen)
  return seen
}

test("chem-structura/core reaches no React, UI kit or editor component: only Structura's own packages", () => {
  const offenders = [...reached(join(SRC, "core.ts"))].flatMap((file) =>
    importsOf(file)
      .filter((spec) => !spec.startsWith(".") && !/^@structura\/(core|markush|engine)(\/|$)/.test(spec))
      .map((spec) => `${file.slice(SRC.length)}: ${spec}`),
  )
  assert.deepEqual(offenders, [])
})

test("a drawing goes out as molfile and comes back as the same drawing, brackets included", () => {
  const drawing = formula()
  const molfile = core.drawingMolfile(drawing)
  assert.match(molfile, /^M {2}STY .* SRU/m, "the repeat bracket as an Sgroup")
  const { drawing: back, notes } = core.drawingFromMolfile(molfile)
  assert.deepEqual(notes, [])
  assert.equal(back.molecule.atoms.length, drawing.molecule.atoms.length)
  assert.equal(back.molecule.bonds.length, drawing.molecule.bonds.length)
  assert.equal(back.brackets?.length, 1)
})

test("an SD file opens as one drawing holding all its molecules", () => {
  const one = core.drawingMolfile(core.applyOps(core.emptyDrawing(), [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).drawing)
  const sdf = `${one}$$$$\n${one}$$$$\n`
  const { drawing, notes } = core.drawingFromMolfile(sdf)
  assert.deepEqual(notes, [])
  assert.equal(drawing.molecule.atoms.length, 12)
})

test("text that is not a molfile opens nothing and says why", () => {
  const { drawing, notes } = core.drawingFromMolfile("not a molfile")
  assert.equal(drawing.molecule.atoms.length, 0)
  assert.equal(notes.length, 1)
})

test("the SVG pictures the whole drawing, the variable attachment and its label included", () => {
  const svg = core.drawingSvg(formula())
  assert.match(svg, /^<\?xml/)
  assert.match(svg, />R</)
  assert.equal(core.drawingSvg(core.emptyDrawing()), "")
})

test("raised numbers are written the way the editor's export writes them", () => {
  assert.notEqual(core.drawingSvg(formula(), { raisedNumbers: true }), core.drawingSvg(formula()))
})

test("the CDXML is the editor's export: the definitions written under the structure", () => {
  const cdxml = core.drawingCdxml(formula())
  assert.match(cdxml, /<CDXML/)
  assert.match(cdxml, /R1 = H、Cl/)
})

test("a generic formula expands into compounds, counted the same before and after", () => {
  const drawing = formula()
  const result = core.enumerate(drawing)
  assert.equal(core.librarySize(drawing).combinations, 5 * 2 * 4, "five open places (the chain takes one), two choices, n = 1–4")
  assert.ok(result.molecules.length > 0)
  assert.match(core.enumerationSdf(result), /\$\$\$\$/)
})

test("a document saved by the editor reads back as the same drawing", () => {
  const drawing = formula()
  const read = core.readDocument(core.toDocument(drawing))
  assert.ok("drawing" in read)
  assert.deepEqual(JSON.parse(core.toDocument(read.drawing)), JSON.parse(core.toDocument(drawing)))
})

test("the standalone build offers everything chem-structura/core does, for pages that load only it", async () => {
  const source = (await import("node:fs")).readFileSync(join(SRC, "standalone.tsx"), "utf8")
  const offered = new Set([...source.matchAll(/export (?:type )?\{([^}]*)\} from "\.\/core\.ts"/g)].flatMap((match) => match[1].split(",").map((name) => name.trim())))
  const missing = Object.keys(core).filter((name) => !offered.has(name))
  assert.deepEqual(missing, [])
})
