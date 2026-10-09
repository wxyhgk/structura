import assert from "node:assert/strict"
import { basename, dirname, join } from "node:path"
import test, { snapshot } from "node:test"
import { toCdxml } from "@structura/core/cdxml"
import type { Op } from "@structura/core/ops"
import { build } from "@structura/testkit"

// The ChemDraw (CDXML) writer, read back with a small strict XML reader: the file must be
// well formed, and nodes, bonds, variable attachments and brackets must name each other right.

snapshot.setResolveSnapshotPath((file) => join(dirname(file!), `${basename(file!)}.snapshot`))

type Element = { tag: string; attrs: Record<string, string>; children: Element[]; text: string }

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }
const decode = (text: string) => text.replace(/&(\w+);/g, (_, name: string) => ENTITIES[name] ?? assert.fail(`unknown entity &${name};`))

/** The document's root element; throws on anything that is not well formed. */
function parse(xml: string): Element {
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8" \?>\n<!DOCTYPE CDXML [^>]*>\n/)
  const body = xml.replace(/^<\?xml[^>]*\?>\n<!DOCTYPE[^>]*>\n/, "")
  const root: Element = { tag: "#root", attrs: {}, children: [], text: "" }
  const stack = [root]
  const pattern = /<(\/?)([A-Za-z][\w-]*)((?:\s+[\w-]+="[^"<]*")*)\s*(\/?)>|([^<]+)/gy
  let match: RegExpExecArray | null
  let end = 0
  while ((match = pattern.exec(body))) {
    end = pattern.lastIndex
    const [, closing, tag, attrText, selfClosing, text] = match
    const top = stack.at(-1)!
    if (text != null) {
      assert.doesNotMatch(text, /&(?!(amp|lt|gt|quot|apos);)/, "a bare & in text")
      top.text += decode(text)
      continue
    }
    if (closing) {
      assert.equal(tag, top.tag, `</${tag}> closes <${top.tag}>`)
      stack.pop()
      continue
    }
    const attrs: Record<string, string> = {}
    for (const [, name, value] of attrText.matchAll(/([\w-]+)="([^"]*)"/g)) {
      assert.ok(!(name in attrs), `${name} twice on <${tag}>`)
      attrs[name] = decode(value)
    }
    const element: Element = { tag, attrs, children: [], text: "" }
    top.children.push(element)
    if (!selfClosing) stack.push(element)
  }
  assert.equal(end, body.length, `not XML from: ${body.slice(end, end + 40)}`)
  assert.equal(stack.length, 1, `<${stack.at(-1)!.tag}> is never closed`)
  const roots = root.children
  assert.equal(roots.length, 1)
  return roots[0]
}

/** Every element below `element` (itself not included), depth first. */
function all(element: Element, tag?: string): Element[] {
  const found = element.children.flatMap((child) => [child, ...all(child)])
  return tag ? found.filter((item) => item.tag === tag) : found
}

/** The elements directly in the page's fragments, not inside an abbreviation's own fragment. */
function topLevel(root: Element, tag: string): Element[] {
  return all(root, "page")[0].children.filter((child) => child.tag === "fragment").flatMap((fragment) => fragment.children.filter((child) => child.tag === tag))
}

const labelOf = (node: Element) => node.children.find((child) => child.tag === "t")?.children.map((run) => run.text).join("") ?? null
const ids = (text: string) => text.split(" ").map(Number)
const point = (node: Element) => node.attrs.p.split(" ").map(Number)

const RING: Op = { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }
const R1_ANYWHERE: Op[] = [RING, { op: "add_atom", el: "C", as: "r" }, { op: "label", atom: "r", text: "R1" }, { op: "move", atoms: ["r"], dx: 110, dy: -70 }]

test("an empty drawing is still a document ChemDraw opens", () => {
  const root = parse(toCdxml(build([])))
  assert.equal(root.tag, "CDXML")
  assert.equal(all(root, "page").length, 1)
  assert.equal(all(root, "n").length, 0)
})

test("atoms and bonds: elements, hydrogens, charge, isotope, orders and wedges", () => {
  const drawing = build([
    { op: "add_atom", el: "C", as: "c" },
    { op: "add_atom", el: "O", to: "c", order: 2 },
    { op: "add_atom", el: "N", to: "c", as: "n" },
    { op: "set_charge", atom: "n", charge: 1 },
    { op: "add_atom", el: "C", to: "c", as: "w" },
    { op: "set_isotope", atom: "w", isotope: 13 },
    { op: "add_atom", el: "C", to: "w", as: "h" },
    { op: "set_bond", bond: { between: ["c", "w"] }, stereo: "up" },
    { op: "set_bond", bond: { between: ["w", "h"] }, stereo: "down" },
  ])
  const root = parse(toCdxml(drawing))
  const nodes = all(root, "n")
  const bonds = all(root, "b")
  assert.equal(nodes.length, 5)
  assert.equal(bonds.length, 4)
  const oxygen = nodes.find((node) => node.attrs.Element === "8")!
  assert.equal(oxygen.attrs.NumHydrogens, "0")
  assert.equal(labelOf(oxygen), "O")
  const nitrogen = nodes.find((node) => node.attrs.Element === "7")!
  assert.equal(nitrogen.attrs.Charge, "1")
  assert.equal(nitrogen.attrs.NumHydrogens, "3")
  assert.match(labelOf(nitrogen)!, /^(NH3|H3N)\+$/)
  const carbon13 = nodes.find((node) => node.attrs.Isotope === "13")!
  assert.equal(carbon13.attrs.Element, undefined, "carbon is the default element")
  assert.match(labelOf(carbon13)!, /^13C/)
  assert.deepEqual(bonds.map((bond) => bond.attrs.Order ?? "1").sort(), ["1", "1", "1", "2"])
  const wedge = bonds.find((bond) => bond.attrs.Display === "WedgeBegin")!
  const hash = bonds.find((bond) => bond.attrs.Display === "WedgedHashBegin")!
  assert.equal(wedge.attrs.E, carbon13.attrs.id, "a wedge starts at its first atom")
  assert.equal(hash.attrs.B, carbon13.attrs.id)
  // Every bond joins two nodes of the file.
  const nodeIds = new Set(nodes.map((node) => node.attrs.id))
  for (const bond of bonds) assert.ok(nodeIds.has(bond.attrs.B) && nodeIds.has(bond.attrs.E))
  // Object ids are unique across the whole document (fonts are numbered on their own).
  const every = all(root).flatMap((item) => (item.attrs.id && item.tag !== "font" ? [item.attrs.id] : []))
  assert.equal(new Set(every).size, every.length)
})

test("the drawing is scaled so a bond is 14.4 pt, ChemDraw's ACS size, and the document says so", () => {
  const root = parse(toCdxml(build([RING])))
  assert.equal(root.attrs.BondLength, "14.4")
  const byId = new Map(all(root, "n").map((node) => [node.attrs.id, point(node)]))
  for (const bond of all(root, "b")) {
    const [ax, ay] = byId.get(bond.attrs.B)!
    const [bx, by] = byId.get(bond.attrs.E)!
    assert.ok(Math.abs(Math.hypot(ax - bx, ay - by) - 14.4) < 0.05)
  }
})

test("a variable is a generic nickname carrying its label; other typed text is an unspecified node", () => {
  const drawing = build([RING, { op: "add_atom", el: "C", to: 1, as: "a" }, { op: "label", atom: "a", text: "R1" }, { op: "add_atom", el: "C", to: 4, as: "b" }, { op: "label", atom: "b", text: "Xyz9q" }])
  const nodes = all(parse(toCdxml(drawing)), "n")
  const r1 = nodes.find((node) => node.attrs.GenericNickname === "R1")!
  assert.equal(r1.attrs.NodeType, "GenericNickname")
  assert.equal(labelOf(r1), "R1")
  assert.equal(r1.children[0].children[1].attrs.face, "32", "R₁ by default, as on the canvas")
  const other = nodes.find((node) => labelOf(node) === "Xyz9q")!
  assert.equal(other.attrs.NodeType, "Unspecified")
  const raised = all(parse(toCdxml(drawing, { raiseNumbers: (text) => text === "R1" })), "n").find((node) => node.attrs.GenericNickname === "R1")!
  assert.equal(raised.children[0].children[1].attrs.face, "64", "R¹ when numbers are raised")
})

test("an abbreviation is a Fragment node holding its atoms, joined through an external connection point", () => {
  const drawing = build([RING, { op: "add_atom", el: "N", to: 4, as: "n" }, { op: "add_atom", el: "C", to: "n", as: "b" }, { op: "label", atom: "b", text: "Boc" }])
  const root = parse(toCdxml(drawing))
  const boc = topLevel(root, "n").find((node) => node.attrs.NodeType === "Fragment")!
  assert.equal(labelOf(boc), "Boc")
  const inner = boc.children.find((child) => child.tag === "fragment")!
  const innerNodes = inner.children.filter((child) => child.tag === "n")
  const group = drawing.molecule.groups[0]
  assert.equal(innerNodes.length, group.atoms.length + 1)
  const point = innerNodes.find((node) => node.attrs.NodeType === "ExternalConnectionPoint")!
  const anchor = innerNodes[0]
  assert.ok(inner.children.some((child) => child.tag === "b" && child.attrs.B === point.attrs.id && child.attrs.E === anchor.attrs.id))
  const nitrogen = topLevel(root, "n").find((node) => node.attrs.Element === "7")!
  assert.ok(topLevel(root, "b").some((bond) => [bond.attrs.B, bond.attrs.E].sort().join() === [nitrogen.attrs.id, boc.attrs.id].sort().join()), "the outside bond ends on the Fragment node")
})

test("a variable attachment is ChemDraw's VariableAttachment node naming every candidate, bonded to the attached atom", () => {
  const drawing = build([...R1_ANYWHERE, { op: "set_attachment", atom: "r", to: [1, 2, 3, 4, 5, 6], repeat: { min: 0, max: 4, name: "m" } }])
  const root = parse(toCdxml(drawing))
  assert.equal(all(root, "fragment").length, 1, "the attachment joins R1 and the ring into one piece")
  const nodes = topLevel(root, "n")
  const attachment = nodes.find((node) => node.attrs.NodeType === "VariableAttachment")!
  const ring = nodes.filter((node) => !node.attrs.NodeType)
  assert.deepEqual(ids(attachment.attrs.Attachments).sort(), ring.map((node) => Number(node.attrs.id)).sort())
  const [x, y] = point(attachment)
  const middle = [ring.reduce((sum, node) => sum + point(node)[0], 0) / 6, ring.reduce((sum, node) => sum + point(node)[1], 0) / 6]
  assert.ok(Math.hypot(x - middle[0], y - middle[1]) < 0.05, "it stands in the ring's middle")
  const r1 = nodes.find((node) => node.attrs.GenericNickname === "R1")!
  assert.ok(topLevel(root, "b").some((bond) => bond.attrs.B === attachment.attrs.id && bond.attrs.E === r1.attrs.id))
  assert.equal(labelOf(r1), "(R1)m", "the repeat is written round the label")
})

test("a repeat bracket: two square brackets, a bracketed SRU group naming its atoms and the bonds through each side", () => {
  const drawing = build([{ op: "draw_chain", points: [{ x: 0, y: 0 }, { x: 35, y: -20 }, { x: 70, y: 0 }, { x: 105, y: -20 }] }, { op: "add_bracket", atoms: [2, 3], kind: "repeat" }])
  const root = parse(toCdxml(drawing))
  const nodes = all(root, "n")
  const graphics = all(root, "graphic")
  assert.equal(graphics.length, 2)
  assert.ok(graphics.every((graphic) => graphic.attrs.GraphicType === "Bracket" && graphic.attrs.BracketType === "Square"))
  const [open, close] = graphics.map((graphic) => graphic.attrs.BoundingBox.split(" ").map(Number))
  assert.ok(open[0] < close[0] && open[1] > open[3] && close[1] < close[3], "[ drawn upwards on the left, ] downwards on the right")
  assert.equal(graphics[1].attrs.BracketUsage, "SRU")
  assert.equal(all(graphics[1], "s")[0].text, "n")
  const group = all(root, "bracketedgroup")[0]
  assert.equal(group.attrs.BracketUsage, "SRU")
  assert.equal(group.attrs.PolymerRepeatPattern, "HeadToTail")
  assert.equal(group.attrs.SRULabel, "n")
  const inside = ids(group.attrs.BracketedObjectIDs).map(String)
  assert.deepEqual(inside, [nodes[1].attrs.id, nodes[2].attrs.id])
  const attachments = group.children
  assert.deepEqual(attachments.map((item) => item.attrs.GraphicID), graphics.map((graphic) => graphic.attrs.id))
  const bonds = new Map(all(root, "b").map((bond) => [bond.attrs.id, bond]))
  for (const side of attachments) {
    const [crossing] = side.children
    const bond = bonds.get(crossing.attrs.BondID)!
    assert.ok(inside.includes(crossing.attrs.InnerAtomID))
    assert.notEqual(inside.includes(bond.attrs.B), inside.includes(bond.attrs.E), "a crossing bond has one end inside")
  }
})

test("a group bracket is Generic; an attachment drawn into it names every atom in it", () => {
  const atoms = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const drawing = build([
    { op: "add_scaffold", name: "naphthalene" },
    { op: "add_bracket", atoms },
    { op: "add_atom", el: "C", as: "l" },
    { op: "label", atom: "l", text: "L" },
    { op: "move", atoms: ["l"], dx: 150, dy: 0 },
    { op: "set_attachment", atom: "l", to: atoms, shape: "bracket" },
  ])
  const root = parse(toCdxml(drawing))
  const group = all(root, "bracketedgroup")[0]
  assert.equal(group.attrs.BracketUsage, "Generic")
  assert.equal(group.attrs.SRULabel, undefined)
  const attachment = all(root, "n").find((node) => node.attrs.NodeType === "VariableAttachment")!
  assert.deepEqual(ids(attachment.attrs.Attachments).sort(), ids(group.attrs.BracketedObjectIDs).sort())
})

test("notes go under the drawing, escaped, one text a line; Chinese gets a Chinese font", () => {
  const notes = ["R1 = H、Cl、取代或未取代的(C1–C6)烷基", "m = 0–4", "<&> \"quoted\" 'too'"]
  const root = parse(toCdxml(build(R1_ANYWHERE), { notes }))
  const texts = all(root, "page")[0].children.filter((child) => child.tag === "t")
  assert.deepEqual(texts.map((text) => text.children[0].text), notes)
  const lowest = Math.max(...all(root, "n").map((node) => point(node)[1]))
  assert.ok(texts.every((text) => point(text)[1] > lowest))
  const fonts = all(root, "font")
  assert.ok(fonts.some((font) => font.attrs.charset === "gb2312" && texts[0].children[0].attrs.font === font.attrs.id))
  assert.equal(all(parse(toCdxml(build(R1_ANYWHERE), { notes: ["n = 1–4"] })), "font").length, 1, "no Chinese, no Chinese font")
})

test("a reaction arrow is an arrow from tail to head", () => {
  const root = parse(toCdxml(build([RING, { op: "add_arrow", atoms: [1, 2, 3, 4, 5, 6], direction: "right" }])))
  const [arrow] = all(root, "arrow")
  const [hx] = arrow.attrs.Head3D.split(" ").map(Number)
  const [tx] = arrow.attrs.Tail3D.split(" ").map(Number)
  assert.ok(hx > tx)
})

test("a generic formula as ChemDraw gets it", (t) => {
  const drawing = build([
    ...R1_ANYWHERE,
    { op: "set_attachment", atom: "r", to: [1, 2, 3, 4, 5, 6], repeat: { min: 0, max: 3, name: "m" } },
    { op: "add_atom", el: "O", to: 4, as: "o" },
    { op: "add_atom", el: "C", to: "o", as: "c1" },
    { op: "add_atom", el: "C", to: "c1", as: "c2" },
    { op: "add_atom", el: "C", to: "c2", as: "x" },
    { op: "label", atom: "x", text: "X" },
    { op: "add_bracket", atoms: ["c1"], kind: "repeat", repeat: { min: 1, max: 4, name: "n" } },
  ])
  t.assert.snapshot(toCdxml(drawing, { notes: ["R1 = H、Cl、取代或未取代的(C1–C6)烷基", "X = O、S", "m = 0–3", "n = 1–4"] }))
})
