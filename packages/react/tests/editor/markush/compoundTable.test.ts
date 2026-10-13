import assert from "node:assert/strict"
import test from "node:test"
import { build } from "@structura/testkit"
import { compoundTableFiles, drawnInFull, fileNames, ionsBeside, TABLE_FORMAT } from "../../../src/editor/markush/compoundTable.ts"
import { compoundId, numberRows } from "../../../src/editor/markush/numbering.ts"
import { rowsToCsv, type Row } from "../../../src/editor/markush/results.ts"

const ring = { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" } as const
// Biphenyl as a patent would not draw it: the second ring collapsed to "Ph".
const biphenyl = build([ring, { op: "add_group", to: 1, name: "Ph" }]).molecule
const anisole = build([ring, { op: "add_atom", el: "O", to: 1, as: "o" }, { op: "add_atom", el: "C", to: "o" }]).molecule
const rows: Row[] = [
  { number: 1, mol: biphenyl, picks: [{ name: "R1", choice: { kind: "label", text: "Ph" } }] },
  { number: 2, mol: anisole, picks: [{ name: "R1", choice: { kind: "label", text: "OMe" } }] },
]

test("compounds are numbered by a pattern, {n} where the number goes, from a start", () => {
  assert.equal(compoundId({ pattern: "C-{n}", start: 1 }, 0), "C-1")
  assert.equal(compoundId({ pattern: "化合物{n}", start: 10 }, 2), "化合物12")
  assert.equal(compoundId({ pattern: "1-", start: 1 }, 4), "1-5", "without {n}, the number follows")
  assert.equal(compoundId({ pattern: " ", start: Number.NaN }, 0), "C-1", "an empty pattern or a start that is no number falls back")
  assert.deepEqual(numberRows(rows, { pattern: "C-{n}", start: 1 }).map((row) => row.id), ["C-1", "C-2"])
})

test("the numbers go into every download: CSV and SMILES name compounds by them", () => {
  const numbered = numberRows(rows, { pattern: "C-{n}", start: 7 })
  const csv = rowsToCsv(numbered, () => "*")
  assert.deepEqual(csv.trim().split("\n").slice(1).map((line) => line.split(",")[0]), ["C-7", "C-8"])
})

test("a patent draws every abbreviation in full", () => {
  assert.equal(biphenyl.groups.length, 1)
  const drawn = drawnInFull(biphenyl)
  assert.ok(drawn.groups.every((group) => !group.collapsed))
  assert.equal(drawn.atoms.length, 12)
  assert.equal(drawnInFull(anisole), anisole, "nothing to expand, nothing changed")
})

test("file names are safe and never two alike", () => {
  assert.deepEqual(fileNames(["C-1", "a/b", "c:d e", "C-1", "c-1", ".."]), ["C-1", "a_b", "c_d_e", "C-1-2", "c-1-3", "_"])
})

test("the package: manifest in the table's order, a CDXML file each, the CSV and the whole table", () => {
  const numbered = numberRows(rows, { pattern: "C-{n}", start: 1 })
  const files = compoundTableFiles(numbered, { columns: 3, source: "专利 1", smiles: (mol) => (mol === anisole ? "COc1ccccc1" : null) })
  assert.deepEqual(files.map((file) => file.path), ["manifest.json", "compounds.csv", "cdxml/C-1.cdxml", "cdxml/C-2.cdxml", "table.cdxml"])
  const manifest = JSON.parse(files[0].contents as string)
  assert.equal(manifest.format, TABLE_FORMAT)
  assert.equal(manifest.version, 1)
  assert.equal(manifest.columns, 3)
  assert.equal(manifest.source, "专利 1")
  assert.deepEqual(manifest.compounds[1], { id: "C-2", file: "cdxml/C-2.cdxml", smiles: "COc1ccccc1", formula: "C7H8O", mw: 108.14, fields: { R1: "OMe" } })
  assert.ok(!("smiles" in manifest.compounds[0]), "no SMILES rather than a wrong one")
  const csv = (files[1].contents as string).replace(/^﻿/, "").trim().split("\n")
  assert.deepEqual(csv, ["编号,文件,SMILES,分子式,分子量,R1", "C-1,cdxml/C-1.cdxml,,C12H10,154.21,Ph", "C-2,cdxml/C-2.cdxml,COc1ccccc1,C7H8O,108.14,OMe"])
  // Drawn in full: the collapsed Ph is no Fragment of its own in the compound's CDXML.
  const first = files[2].contents as string
  assert.ok(!first.includes('NodeType="Fragment"'), "no abbreviation left")
  assert.equal((first.match(/<n /g) ?? []).length, 12)
  const table = files[4].contents as string
  assert.ok(table.includes(">C-1<") && table.includes(">C-2<"))
})

/** Sodium benzoate, Na⁺ drawn `dx` to the right of where an atom first goes (2.2 bond lengths from the nearest O). */
const benzoate = (dx: number) =>
  build([
    ring,
    { op: "add_atom", el: "C", to: 1, as: "c" },
    { op: "add_atom", el: "O", to: "c", order: 2 },
    { op: "add_atom", el: "O", to: "c", as: "o" },
    { op: "set_charge", atom: "o", charge: -1 },
    { op: "add_atom", el: "Na", as: "na" },
    { op: "move", atoms: ["na"], dx, dy: 0 },
    { op: "set_charge", atom: "na", charge: 1 },
  ]).molecule

const gapToNa = (mol: ReturnType<typeof benzoate>) => {
  const na = mol.atoms.find((atom) => atom.el === "Na")!
  return Math.min(...mol.atoms.filter((atom) => atom.el !== "Na").map((atom) => Math.hypot(atom.x - na.x, atom.y - na.y))) / 40
}

test("a salt's ion drawn far from the other is put beside it in the table; one drawn close stays; the larger ion never moves", () => {
  const far = benzoate(400)
  assert.ok(gapToNa(far) > 5)
  const tight = ionsBeside(far)
  assert.ok(Math.abs(gapToNa(tight) - 1.4) < 0.01, `gap ${gapToNa(tight)}`)
  const anion = (mol: typeof far) => mol.atoms.filter((atom) => atom.el !== "Na").map((atom) => [atom.x, atom.y])
  assert.deepEqual(anion(tight), anion(far))
  const close = benzoate(-40)
  assert.deepEqual(ionsBeside(close), close)
  // The table's CDXML has it beside the anion too: about 1.4 × 14.4 pt from the nearest atom.
  const cdxml = compoundTableFiles(numberRows([{ number: 1, mol: far, picks: [] }], { pattern: "C-{n}", start: 1 }), { columns: 3, source: "s" })[2].contents as string
  const points = [...cdxml.matchAll(/<n id="\d+" p="([\d.]+) ([\d.]+)"( Element="(\d+)")?/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]), na: match[4] === "11" }))
  const na = points.find((point) => point.na)!
  const nearest = Math.min(...points.filter((point) => !point.na).map((point) => Math.hypot(point.x - na.x, point.y - na.y)))
  assert.ok(Math.abs(nearest - 1.4 * 14.4) < 0.5, `nearest ${nearest} pt`)
})
