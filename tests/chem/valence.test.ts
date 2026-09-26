import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { hydrogenCount } from "../../src/chem/formula.ts"

type Case = { el: string; charge: number; bonds: number; h: number | null }

const reference: { rdkit: string; cases: Case[] } = JSON.parse(
  readFileSync(new URL("./fixtures/rdkit-hydrogens.json", import.meta.url), "utf8"),
)

/**
 * RDKit rewrites drawn hypervalent groups such as N(=O)=O or Cl(=O)(=O)=O into their
 * charge-separated form before it checks valence, so it accepts them. We accept the
 * same bond counts directly, with no hydrogens, instead of rewriting the structure.
 */
const HYPERVALENT: Record<string, number[]> = { N: [5], Cl: [3, 5, 7], Br: [3, 5, 7], I: [7] }

test(`implicit hydrogens match RDKit ${reference.rdkit}`, () => {
  const wrong: string[] = []
  for (const { el, charge, bonds, h } of reference.cases) {
    const ours = hydrogenCount(el, charge, bonds)
    const tolerated = h == null && charge === 0 && HYPERVALENT[el]?.includes(bonds) && !ours.error && ours.h === 0
    const same = h == null ? ours.error : !ours.error && ours.h === h
    if (!same && !tolerated) {
      wrong.push(`${el}${charge > 0 ? "+" : ""}${charge || ""} with ${bonds} bonds: ours ${ours.error ? "error" : ours.h}, RDKit ${h ?? "error"}`)
    }
  }
  assert.deepEqual(wrong, [])
})

test("common ions and hypervalent groups", () => {
  assert.deepEqual(hydrogenCount("B", -1, 4), { h: 0, error: false }, "BF4-")
  assert.deepEqual(hydrogenCount("B", -1, 0), { h: 4, error: false }, "BH4-")
  assert.deepEqual(hydrogenCount("P", -1, 6), { h: 0, error: false }, "PF6-")
  assert.deepEqual(hydrogenCount("N", 1, 4), { h: 0, error: false }, "NR4+")
  assert.deepEqual(hydrogenCount("N", 0, 5), { h: 0, error: false }, "N(=O)=O")
  assert.deepEqual(hydrogenCount("Cl", 0, 7), { h: 0, error: false }, "Cl(=O)(=O)(=O)O-")
  assert.equal(hydrogenCount("N", 0, 4).error, true, "neutral N with four bonds")
  assert.equal(hydrogenCount("Cl", 0, 2).error, true, "neutral Cl with two bonds")
})
