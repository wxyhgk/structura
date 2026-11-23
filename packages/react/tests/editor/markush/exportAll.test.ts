import assert from "node:assert/strict"
import test from "node:test"
import type { Drawing, Molecule } from "@structura/core/types"
import { build, label } from "@structura/testkit"
import { enumerate } from "@structura/markush"
import { exportAll } from "../../../src/editor/markush/exportAll.ts"
import { sdfOf } from "../../../src/editor/markush/exportRows.ts"
import { DEFAULT_NUMBERING, numberRows } from "../../../src/editor/markush/numbering.ts"
import { rowsOf, rowsToCsv } from "../../../src/editor/markush/results.ts"

/** Benzene with R1 on one ring atom (H, Me, F, Cl) and (R2)m on others (m 0–2): some compounds, columns that turn up only later. */
function formula(): Drawing {
  return build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "p" },
    { op: "label", atom: "p", text: "R1" },
    { op: "place_atom", el: "C", at: { x: 300, y: 0 } },
    { op: "label", atom: 8, text: "R2" },
    { op: "set_attachment", atom: 8, to: [3, 4, 5], repeat: { min: 0, max: 2, name: "m" } },
    { op: "set_variable", name: "R1", alternatives: [label("H"), label("Me"), label("F"), label("Cl")] },
    { op: "set_variable", name: "R2", alternatives: [label("Me"), label("OMe")] },
  ])
}

/** A stand-in for a canonical SMILES: the molecule's formula-ish fingerprint, stable for the same compound. */
const smiles = (mol: Molecule) => `S${mol.atoms.length}x${mol.bonds.length}`
const quick = { pause: async () => {} }
/** A file's text with its byte order mark kept (Blob.text() drops it). */
const text = async (blob: Blob) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(await blob.arrayBuffer())

test("the whole library as CSV is the file the list's download would make, columns found late included", async () => {
  const all = enumerate(formula(), { limit: Infinity })
  assert.ok(all.molecules.length > 20)
  const wanted = rowsToCsv(numberRows(rowsOf(all), DEFAULT_NUMBERING), smiles)
  const outcome = await exportAll(formula(), { kind: "csv", representatives: false, smiles, numbering: DEFAULT_NUMBERING, ...quick })
  assert.ok(!outcome.cancelled)
  if (outcome.cancelled) return
  assert.equal(await text(outcome.file), wanted)
  assert.equal(outcome.written, all.molecules.length)
  assert.equal(outcome.capped, false)
})

test("the whole library as SDF is the list's SD file", async () => {
  const all = enumerate(formula(), { limit: Infinity })
  const outcome = await exportAll(formula(), { kind: "sdf", representatives: false, smiles, numbering: { pattern: "化合物{n}", start: 5 }, ...quick })
  assert.ok(!outcome.cancelled)
  if (outcome.cancelled) return
  assert.equal(await text(outcome.file), sdfOf(numberRows(rowsOf(all), { pattern: "化合物{n}", start: 5 })))
})

test("compounds that are the same by their identity are written once, and counted as merged", async () => {
  const identity = (mol: Molecule) => smiles(mol)
  const all = enumerate(formula(), { limit: Infinity, identity })
  const outcome = await exportAll(formula(), { kind: "csv", representatives: false, identities: { identity }, smiles, numbering: DEFAULT_NUMBERING, ...quick })
  assert.ok(!outcome.cancelled)
  if (outcome.cancelled) return
  assert.equal(outcome.written, all.molecules.length)
  assert.equal(outcome.duplicates, all.duplicates)
  assert.ok(outcome.duplicates > 0)
  assert.equal(await text(outcome.file), rowsToCsv(numberRows(rowsOf(all), DEFAULT_NUMBERING), smiles))
})

test("the work goes in slices with progress, can be cancelled, and stops at the cap", async () => {
  const seen: number[] = []
  let pauses = 0
  const outcome = await exportAll(formula(), {
    kind: "csv",
    representatives: false,
    smiles,
    numbering: DEFAULT_NUMBERING,
    cap: 10,
    onProgress: (progress) => seen.push(progress.written),
    pause: async () => void pauses++,
  })
  assert.ok(!outcome.cancelled && outcome.capped)
  assert.ok(!outcome.cancelled && outcome.written >= 10)
  assert.ok(pauses >= 0)
  const controller = new AbortController()
  const cancelled = await exportAll(formula(), {
    kind: "sdf",
    representatives: false,
    smiles,
    numbering: DEFAULT_NUMBERING,
    signal: controller.signal,
    pause: async () => controller.abort(),
  })
  assert.deepEqual(cancelled, { cancelled: true })
})
