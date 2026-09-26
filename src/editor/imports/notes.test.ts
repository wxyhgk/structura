import assert from "node:assert/strict"
import test from "node:test"
import { emptyMolecule } from "../../chem/molecule.ts"
import { importNotes } from "./notes.ts"

test("import notes are in Chinese and name the record when there are several", () => {
  const record = (title: string) => ({ mol: emptyMolecule(), title, properties: {}, problems: [] })
  const lines = importNotes([record("aspirin"), record("ethanol in 3D")], [
    { code: "flattened-3d", severity: "warning", message: "projected", record: 2 },
  ])
  assert.deepEqual(lines, ["第 2 条（ethanol in 3D）：三维坐标已投影到平面。projected"])
  const single = importNotes([record("x")], [{ code: "valence", severity: "warning", message: "atom #1", record: 1 }])
  assert.deepEqual(single, ["有原子超价。atom #1"])
})
