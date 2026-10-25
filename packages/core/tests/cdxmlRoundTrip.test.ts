import assert from "node:assert/strict"
import test from "node:test"
import { cdxmlFingerprint, toCdxml } from "@structura/core/cdxml"
import { embedDocument, isCdxml, readCdxml } from "@structura/core/cdxmlDocument"
import type { Drawing, Molecule } from "@structura/core/types"
import { build } from "@structura/testkit"

// CDXML that comes back whole: the Structura document rides in a comment, and is used only
// while the structure written around it is unchanged.

/** –CH2CH2– with a * at each end, as a ring closure is given. */
const ETHANO: Molecule = {
  atoms: [
    { id: 1, el: "C", x: 0, y: 0, charge: 0 },
    { id: 2, el: "C", x: 40, y: 0, charge: 0 },
    { id: 3, el: "C", x: -20, y: 34.64, charge: 0, alias: "*" },
    { id: 4, el: "C", x: 60, y: -34.64, charge: 0, alias: "*" },
  ],
  bonds: [
    { id: 1, a: 1, b: 2, order: 1, stereo: "none" },
    { id: 2, a: 1, b: 3, order: 1, stereo: "none" },
    { id: 3, a: 2, b: 4, order: 1, stereo: "none" },
  ],
  groups: [],
  nextAtomId: 5,
  nextBondId: 4,
  nextGroupId: 1,
}

/** A generic formula with all CDXML cannot say: variables, a proviso, a ring closure, a repeat unit, a variable attachment. */
function formula(): Drawing {
  return build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "move", atoms: ["r"], dx: 110, dy: -70 },
    { op: "set_attachment", atom: "r", to: [1, 2, 3, 4, 5, 6], repeat: { min: 0, max: 3, name: "m" } },
    { op: "add_atom", el: "O", to: 4, as: "o" },
    { op: "add_atom", el: "C", to: "o", as: "c" },
    { op: "add_atom", el: "C", to: "c", as: "x" },
    { op: "label", atom: "x", text: "R2" },
    { op: "add_bracket", atoms: ["c"], kind: "repeat", repeat: { min: 1, max: 4, name: "n" } },
    { op: "set_variable", name: "R1", alternatives: [{ kind: "label", text: "H" }, { kind: "label", text: "Cl" }, { kind: "class", class: "alkyl", min: 1, max: 6 }] },
    { op: "set_variable", name: "R2", alternatives: [{ kind: "label", text: "H" }, { kind: "label", text: "Me" }] },
    { op: "add_proviso", proviso: { kind: "combination", when: [{ name: "R1", is: [{ kind: "label", text: "H" }] }, { name: "R2", is: [{ kind: "label", text: "H" }] }] } },
    { op: "set_ring_closure", closure: { a: "R1", b: "R2", ring: [{ kind: "fragment", molecule: ETHANO, name: "(CH2)2" }] } },
  ])
}

async function exported(drawing: Drawing): Promise<string> {
  return embedDocument(toCdxml(drawing, { notes: ["R1 = H、Cl", "n = 1–4"] }), drawing)
}

test("exported CDXML reads back as the very document it was written from", async () => {
  const drawing = formula()
  assert.ok(drawing.variables && drawing.provisos?.length && drawing.ringClosures?.length && drawing.brackets?.length && drawing.attachments?.length)
  const text = await exported(drawing)
  assert.ok(isCdxml(text))
  // Still CDXML ChemDraw reads: the comment sits inside the root, at its end, and is all that was added.
  assert.match(text, /<!--structura:v1:[\da-f]{16}:[A-Za-z\d+/=]+-->\n<\/CDXML>\n$/)
  assert.equal(text.replace(/<!--structura:[^>]*-->\n/, ""), toCdxml(drawing, { notes: ["R1 = H、Cl", "n = 1–4"] }))
  const read = await readCdxml(text)
  assert.ok("drawing" in read, JSON.stringify(read))
  // The same drawing, field for field (readDocument orders the fields its own way).
  assert.deepEqual(read.drawing, JSON.parse(JSON.stringify(drawing)))
})

test("CDXML changed after export is refused: an atom moved, an element changed, a bond removed, a label retyped", async () => {
  const text = await exported(formula())
  const firstPlain = /<n id="(\d+)" p="([\d.]+) ([\d.]+)"\/>/.exec(text)!
  const changes: Array<[string, string]> = [
    ["an atom moved", text.replace(firstPlain[0], `<n id="${firstPlain[1]}" p="${Number(firstPlain[2]) + 3} ${firstPlain[3]}"/>`)],
    ["an element changed", text.replace(/Element="8"/, 'Element="16"')],
    ["a carbon became nitrogen", text.replace(firstPlain[0], firstPlain[0].replace("/>", ' Element="7"/>'))],
    ["a bond removed", text.replace(/<b id="\d+" B="\d+" E="\d+"\/>\n/, "")],
    ["a definition retyped", text.replace("R1 = H、Cl", "R1 = H、Br")],
  ]
  for (const [what, changed] of changes) {
    assert.notEqual(changed, text, what)
    const read = await readCdxml(changed)
    assert.ok("reason" in read && read.reason === "changed", `${what}: ${JSON.stringify(read).slice(0, 80)}`)
  }
})

test("reformatting that leaves the structure alone is no change", async () => {
  const text = await exported(formula())
  // Another program's spacing, quotes and number format, and ids renumbered.
  const reformatted = text
    .replace(/ p="([\d.]+) ([\d.]+)"/g, (_, x: string, y: string) => ` p='${Number(x).toFixed(3)}  ${Number(y).toFixed(3)}'`)
    .replace(/\n/g, "\r\n")
  assert.equal(cdxmlFingerprint(reformatted), cdxmlFingerprint(text))
  assert.ok("drawing" in (await readCdxml(reformatted)))
})

test("CDXML with no Structura document in it, or a damaged one, says so", async () => {
  const plain = toCdxml(formula())
  assert.deepEqual(await readCdxml(plain), { reason: "foreign", error: "no Structura document in this CDXML" })
  const text = await exported(formula())
  const damaged = text.replace(/(<!--structura:v1:[\da-f]+:)[A-Za-z\d+/]{8}/, "$1AAAAAAAA")
  const read = await readCdxml(damaged)
  assert.ok("reason" in read && read.reason === "broken")
  const newer = await readCdxml(text.replace("structura:v1:", "structura:v9:"))
  assert.ok("reason" in newer && newer.reason === "broken" && /newer/.test(newer.error))
})
