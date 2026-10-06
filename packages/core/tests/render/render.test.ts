import { dirname, join, basename } from "node:path"
import test, { snapshot } from "node:test"
import { sceneToSvg } from "@structura/core/draw"
import type { Op } from "@structura/core/ops"
import { build } from "@structura/testkit"

// Golden pictures: what the renderer draws for typical structures, kept as text next to this
// file (render.test.ts.snapshot). Any change in how bonds, labels, rings or Markush marks come
// out fails here with a diff. If the change is meant, look at the diff, then run
//   npm test -w @structura/core -- --test-update-snapshots
// and commit the new snapshot with the change that caused it.

snapshot.setResolveSnapshotPath((file) => join(dirname(file!), `${basename(file!)}.snapshot`))

/** The SVG with every number cut to one decimal: tiny float noise is not a change in the picture. */
const normalized = (svg: string) => svg.replace(/-?\d+\.\d+/g, (number) => (Math.round(Number(number) * 10) / 10).toFixed(1))

const RING: Op = { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }

/** name → how to draw it (with ops) and whether heteroatoms are coloured. */
const CASES: Record<string, { ops: Op[]; colour?: boolean; markush?: boolean }> = {
  "ethane, one bond": { ops: [{ op: "draw_bond", start: { x: 0, y: 0 } }] },
  "butane, a zigzag chain": { ops: [{ op: "add_atom", el: "C", as: "a" }, { op: "add_atom", el: "C", to: "a", as: "b" }, { op: "add_atom", el: "C", to: "b", as: "c" }, { op: "add_atom", el: "C", to: "c" }] },
  benzene: { ops: [RING] },
  "cyclohexane, plain ring": { ops: [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "cyclohexane" }] },
  naphthalene: { ops: [{ op: "add_scaffold", name: "naphthalene" }] },
  carbazole: { ops: [{ op: "add_scaffold", name: "carbazole" }], colour: true },
  "dibenzofuran, coloured O": { ops: [{ op: "add_scaffold", name: "dibenzofuran" }], colour: true },
  "toluene, a substituent on a ring": { ops: [RING, { op: "add_atom", el: "C", to: 1 }] },
  "phenol, OH label": { ops: [RING, { op: "add_atom", el: "O", to: 1 }], colour: true },
  "aniline, NH2 label": { ops: [RING, { op: "add_atom", el: "N", to: 1 }], colour: true },
  "acetone, C=O double bond": { ops: [{ op: "add_atom", el: "C", as: "c" }, { op: "add_atom", el: "O", to: "c", order: 2 }, { op: "add_atom", el: "C", to: "c" }, { op: "add_atom", el: "C", to: "c" }] },
  "propyne, triple bond": { ops: [{ op: "add_atom", el: "C", as: "a" }, { op: "add_atom", el: "C", to: "a", order: 3, as: "b" }, { op: "add_atom", el: "C", to: "b" }] },
  "a wedge and a hash": {
    ops: [
      { op: "add_atom", el: "C", as: "c" },
      { op: "add_atom", el: "C", to: "c", as: "w" },
      { op: "add_atom", el: "C", to: "c", as: "h" },
      { op: "add_atom", el: "O", to: "c" },
      { op: "set_bond", bond: { between: ["c", "w"] }, stereo: "up" },
      { op: "set_bond", bond: { between: ["c", "h"] }, stereo: "down" },
    ],
  },
  "ammonium, a charge": { ops: [{ op: "add_atom", el: "N", as: "n" }, { op: "set_charge", atom: "n", charge: 1 }, { op: "add_atom", el: "C", to: "n" }] },
  "13C, an isotope": { ops: [{ op: "add_atom", el: "C", as: "c" }, { op: "set_isotope", atom: "c", isotope: 13 }, { op: "add_atom", el: "O", to: "c" }] },
  "deuterium, D": { ops: [{ op: "add_atom", el: "C", as: "c" }, { op: "add_atom", el: "H", to: "c", as: "d" }, { op: "set_isotope", atom: "d", isotope: 2 }] },
  "Ph and Boc shown as labels": { ops: [RING, { op: "add_atom", el: "C", to: 1, as: "p" }, { op: "label", atom: "p", text: "Ph" }, { op: "add_atom", el: "N", to: 4, as: "n" }, { op: "add_atom", el: "C", to: "n", as: "b" }, { op: "label", atom: "b", text: "Boc" }] },
  "tBu shown as a label": { ops: [RING, { op: "add_atom", el: "C", to: 1, as: "t" }, { op: "label", atom: "t", text: "tBu" }] },
  "R1 and R12, numbers as subscripts": { ops: [RING, { op: "add_atom", el: "C", to: 1, as: "a" }, { op: "label", atom: "a", text: "R1" }, { op: "add_atom", el: "C", to: 4, as: "b" }, { op: "label", atom: "b", text: "R12" }] },
  "Ar' and X in a ring": { ops: [{ op: "add_scaffold", name: "dibenzofuran", as: "d" }, { op: "label", atom: "d.O5", text: "X" }, { op: "add_atom", el: "C", to: "d.C2", as: "a" }, { op: "label", atom: "a", text: "Ar'" }] },
  "R1 attached anywhere on a ring": {
    ops: [RING, { op: "add_atom", el: "C", as: "r" }, { op: "label", atom: "r", text: "R1" }, { op: "move", atoms: ["r"], dx: 110, dy: -70 }, { op: "set_attachment", atom: "r", to: [1, 2, 3, 4, 5, 6] }],
    markush: true,
  },
  "(R1)m, repeated": {
    ops: [
      RING,
      { op: "add_atom", el: "C", as: "r" },
      { op: "label", atom: "r", text: "R1" },
      { op: "move", atoms: ["r"], dx: 110, dy: -70 },
      { op: "set_attachment", atom: "r", to: [1, 2, 3, 4, 5, 6], repeat: { min: 0, max: 4, name: "m" } },
    ],
    markush: true,
  },
  "a reaction arrow": { ops: [RING, { op: "add_arrow", atoms: [1, 2, 3, 4, 5, 6], direction: "right" }] },
  "two pieces side by side": { ops: [RING, { op: "add_ring", at: { x: 200, y: 0 }, kind: "cyclopentane" }] },
}

for (const [name, { ops, colour = false, markush = false }] of Object.entries(CASES)) {
  test(`renders ${name}`, (t) => {
    const drawing = build(ops)
    t.assert.snapshot(normalized(sceneToSvg(drawing.molecule, colour, drawing.arrows, markush ? drawing.attachments : undefined)))
  })
}
