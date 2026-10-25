import assert from "node:assert/strict"
import test from "node:test"
import initRDKitModule from "@rdkit/rdkit"
import { usableRecords } from "@structura/core/import"
import { smilesRecords } from "@structura/rdkit"
import { smilesNotes } from "../../../src/editor/imports/smiles.ts"

const rdkit = await initRDKitModule()
rdkit.prefer_coordgen(true)

const notes = (text: string) => {
  const records = smilesRecords(rdkit, text)
  return smilesNotes(records, usableRecords(records).problems)
}

test("a SMILES RDKit cannot read says why in Chinese, RDKit's own words after it", () => {
  const cases: Array<[string, string]> = [
    ["CC(=O", "无法读取，括号没有配对，少了右括号。"],
    ["C1CC1)C", "无法读取，括号没有配对，多了右括号。"],
    ["C1CC", "无法读取，环没有闭合，有个环编号只出现了一次。"],
    ["C[Xx]", "无法读取，第 3 个字符附近写法有误。"],
    ["FC(F)(F)(F)(F)F", "无法读取，第 2 个原子（C）超出化合价。"],
    ["Cc1ccnc1", "无法读取，第 2、3、4、5、6 个原子的芳香环无法确定单双键，可能少写了 [nH] 这样的氢。"],
  ]
  for (const [smiles, start] of cases) {
    const [line] = notes(smiles)
    assert.ok(line.startsWith(start), line)
    assert.ok(line.includes(`RDKit could not read "${smiles}": `), line)
  }
  // With several lines, the bad one is named as before.
  assert.match(notes("CCO\nC1CC")[0], /^第 2 条（C1CC）：无法读取，环没有闭合/)
})
