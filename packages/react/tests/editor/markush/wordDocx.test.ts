import assert from "node:assert/strict"
import test from "node:test"
import { build } from "@structura/testkit"
import { numberRows } from "../../../src/editor/markush/numbering.ts"
import type { Row } from "../../../src/editor/markush/results.ts"
import { pictureDocx, tableScale } from "../../../src/editor/markush/wordDocx.ts"
import { unzipEntries } from "../zipReader.ts"

const ring = { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" } as const
const benzene = build([ring]).molecule
const biphenyl = build([ring, { op: "add_group", to: 1, name: "Ph" }]).molecule

/** Stands in for the canvas: a "PNG" naming the SVG's size, which it reads from the SVG. */
const rasterize = async (svg: string) => {
  const [, width, height] = /width="([\d.]+)" height="([\d.]+)"/.exec(svg)!.map(Number)
  return { png: new TextEncoder().encode(`png ${width}x${height}`), width, height }
}

test("one scale for the table: the widest structure fills its column, and none is blown up past 1.5×", () => {
  const scale = tableScale([100, 400], 3)
  assert.ok(Math.abs(400 * (14.4 / 40) * scale - (451.3 / 3) * 0.92) < 0.1)
  assert.equal(tableScale([10], 3), 1.5)
})

test("a .docx of pictures: Word's parts, a picture per compound, rows of structures then of numbers", async () => {
  const rows: Row[] = numberRows(
    [benzene, biphenyl, benzene, benzene].map((mol, index) => ({ number: index + 1, mol, picks: [] })),
    { pattern: "C-{n}", start: 1 },
  )
  const files = unzipEntries(await pictureDocx(rows, 3, rasterize))
  assert.deepEqual([...files.keys()], ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/_rels/document.xml.rels", "word/media/image1.png", "word/media/image2.png", "word/media/image3.png", "word/media/image4.png"])
  const document = new TextDecoder().decode(files.get("word/document.xml"))
  // Two groups of three: 4 table rows, the last group with two empty cells.
  assert.equal(document.match(/<w:tr>/g)?.length, 4)
  assert.deepEqual([...document.matchAll(/<w:t xml:space="preserve">([^<]+)</g)].map((match) => match[1]), ["C-1", "C-2", "C-3", "C-4"])
  assert.equal(document.match(/<w:cantSplit\/>/g)?.length, 4)
  assert.equal(document.match(/<w:keepNext\/>/g)?.length, 4, "each structure kept with its number")
  // Drawn in full: biphenyl's picture is wider than benzene's, at the same scale (cx per px alike).
  const extents = [...document.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/g)].map((match) => [Number(match[1]), Number(match[2])])
  const sizes = [...files.entries()].filter(([name]) => name.startsWith("word/media/")).map(([, png]) => new TextDecoder().decode(png).match(/(\d+(?:\.\d+)?)x/)![1]).map(Number)
  assert.ok(extents[1][0] > extents[0][0])
  assert.ok(Math.abs(extents[0][0] / sizes[0] - extents[1][0] / sizes[1]) < 2, "one scale for all")
  assert.match(new TextDecoder().decode(files.get("word/_rels/document.xml.rels")), /rIdImage4.*media\/image4\.png/)
})
