import { elementOf } from "../elements/index.ts"
import { hasVariableShape } from "../markush/shape.ts"
import type { Attachment } from "../markush/types.ts"
import type { Atom, Bond, Drawing, Group, Point } from "../types.ts"
import { attachmentCourse, curveElement } from "./curves.ts"
import { elementLabel, type Label, LABEL_SIZE, pointsLeft, repeated, runsWidth, textWidth, typedRuns } from "./labels.ts"
import { el, num, type XmlNode } from "./xml.ts"

// The molecule as CDXML fragments: one per connected piece (a variable attachment joins
// its atom to its ring), atoms as nodes, bonds, collapsed abbreviations as Fragment nodes
// holding their atoms, and variable attachments as ChemDraw's own VariableAttachment node
// (with a Curve graphic for an ellipse, an arc or a custom curve).

/** The Arial font the labels are written in (its id in the font table). */
export const LABEL_FONT = 3

export type StructureContext = {
  /** Drawing units to points on the page. */
  at: (point: Point) => Point
  /** A fresh object id. */
  nextId: () => number
  raiseNumbers?: (label: string) => boolean
}

/** What the brackets need to know of the written structure: ids by atom and bond, and the fragment each atom went into. */
export type Structure = {
  fragments: XmlNode[]
  /** The node an atom is shown by: its own, or its collapsed abbreviation's. */
  nodeOf: (atomId: number) => number | undefined
  /** The written bond for a molecule bond, unless it is inside an abbreviation. */
  bondOf: (bondId: number) => number | undefined
  fragmentOf: (atomId: number) => XmlNode | undefined
}

/** The atoms in connected pieces, joined by bonds and by variable attachments, in drawing order. */
function pieces(drawing: Drawing): number[][] {
  const parent = new Map(drawing.molecule.atoms.map((atom) => [atom.id, atom.id]))
  const find = (id: number): number => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    parent.set(id, root)
    return root
  }
  const join = (a: number, b: number) => {
    if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b))
  }
  for (const bond of drawing.molecule.bonds) join(bond.a, bond.b)
  for (const attachment of drawing.attachments ?? []) for (const id of attachment.to) join(attachment.atom, id)
  const byRoot = new Map<number, number[]>()
  for (const atom of drawing.molecule.atoms) {
    const root = find(atom.id)
    byRoot.set(root, [...(byRoot.get(root) ?? []), atom.id])
  }
  return [...byRoot.values()]
}

/** The label's text element: its runs, placed so the right character sits on the atom. */
function labelText(label: Label, at: Point): XmlNode {
  const first = label.runs[0]?.text[0] ?? ""
  const last = label.runs.at(-1)?.text.at(-1) ?? ""
  const x = label.justify === "Left" ? at.x - textWidth(first, LABEL_SIZE) / 2 : at.x - runsWidth(label.runs) + textWidth(last, LABEL_SIZE) / 2
  return el(
    "t",
    { p: `${num(x)} ${num(at.y + LABEL_SIZE * 0.35)}`, LabelJustification: label.justify },
    label.runs.map((run) => el("s", { font: LABEL_FONT, size: LABEL_SIZE, face: run.face || undefined }, [run.text])),
  )
}

/** CDXML's names for how a bond is drawn: wedges start at its first atom, as ours do. */
function bondDisplay(bond: Bond): Record<string, string | undefined> {
  if (bond.stereo === "up") return { Display: "WedgeBegin" }
  if (bond.stereo === "down") return { Display: "WedgedHashBegin" }
  if (bond.stereo === "either") return { Display: "Wavy" }
  if (bond.order === 1 && bond.look === "bold") return { Display: "Bold" }
  if (bond.order === 1 && bond.look === "dashed") return { Display: "Dash" }
  if (bond.order === 2 && bond.emphasis) return { Display2: bond.emphasis === "bold" ? "Bold" : "Dash" }
  return {}
}

function bondElement(id: number, begin: number, end: number, bond?: Bond): XmlNode {
  return el("b", { id, B: begin, E: end, Order: bond && bond.order !== 1 ? bond.order : undefined, ...(bond ? bondDisplay(bond) : {}) })
}

/**
 * The structure as fragments, ids taken from `context.nextId`. Kekulé bond orders are
 * written as stored (ChemDraw draws a 1.5 order as a dashed line, not as a benzene ring).
 */
export function writeStructure(drawing: Drawing, context: StructureContext): Structure {
  const mol = drawing.molecule
  const { at, nextId } = context
  const atoms = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  const collapsed = new Map<number, Group>()
  for (const group of mol.groups) if (group.collapsed) for (const id of group.atoms) collapsed.set(id, group)
  const repeats = new Map((drawing.attachments ?? []).flatMap((attachment) => (attachment.repeat ? [[attachment.atom, attachment.repeat.name] as const] : [])))

  // Ids first, so bonds and attachments can name nodes written later.
  const ownId = new Map(mol.atoms.map((atom) => [atom.id, nextId()]))
  const groupId = new Map(mol.groups.filter((group) => group.collapsed).map((group) => [group.id, { node: nextId(), fragment: nextId() }]))
  const nodeOf = (atomId: number) => {
    const group = collapsed.get(atomId)
    return group ? groupId.get(group.id)!.node : ownId.get(atomId)
  }
  const bondIds = new Map<number, number>()
  /** Bonds from outside into an abbreviation: an external connection point inside it for each, where the outside end is. */
  const entries = new Map<number, Array<{ id: number; bond: number; inner: number; from: Point }>>()
  const enter = (group: Group, inner: number, from: Point) => {
    entries.set(group.id, [...(entries.get(group.id) ?? []), { id: nextId(), bond: nextId(), inner, from }])
  }

  const groupNode = (group: Group): XmlNode => {
    const ids = groupId.get(group.id)!
    const anchor = atoms.get(group.atoms[0])!
    const members = new Set(group.atoms)
    const inner = group.atoms.flatMap((id) => (atoms.get(id) ? [atomNode(atoms.get(id)!)] : []))
    const ends = entries.get(group.id) ?? []
    const points = ends.map((end) => el("n", { id: end.id, p: point(end.from), NodeType: "ExternalConnectionPoint" }))
    const bonds = mol.bonds.filter((bond) => members.has(bond.a) && members.has(bond.b)).map((bond) => bondElement(nextId(), ownId.get(bond.a)!, ownId.get(bond.b)!, bond))
    const links = ends.map((end) => bondElement(end.bond, end.id, ownId.get(end.inner)!))
    let label: Label = { runs: typedRuns(group.label, false), justify: pointsLeft(mol, anchor) ? "Right" : "Left" }
    const count = group.atoms.map((id) => repeats.get(id)).find((name) => name != null)
    if (count) label = repeated(label, count)
    return el("n", { id: ids.node, p: point(anchor), NodeType: "Fragment" }, [el("fragment", { id: ids.fragment }, [...inner, ...points, ...bonds, ...links]), labelText(label, at(anchor))])
  }

  const point = (p: Point) => {
    const { x, y } = at(p)
    return `${num(x)} ${num(y)}`
  }

  const atomNode = (atom: Atom): XmlNode => {
    const attrs: XmlNode["attrs"] = { id: ownId.get(atom.id), p: point(atom) }
    let label: Label | null = null
    if (atom.alias) {
      // Text kept on an atom is never an element or a known abbreviation (those become atoms
      // and groups): shaped like R1, X or Ar it is a variable, ChemDraw's generic nickname.
      const variable = hasVariableShape(atom.alias)
      Object.assign(attrs, variable ? { NodeType: "GenericNickname", GenericNickname: atom.alias } : { NodeType: "Unspecified" })
      label = { runs: typedRuns(atom.alias, context.raiseNumbers?.(atom.alias) ?? false), justify: pointsLeft(mol, atom) ? "Right" : "Left" }
    } else {
      const z = elementOf(atom.el)?.z
      const shown = elementLabel(mol, atom)
      Object.assign(attrs, {
        Element: z != null && z !== 6 ? z : undefined,
        Charge: atom.charge || undefined,
        Isotope: atom.isotope,
        NumHydrogens: shown ? shown.hydrogens : undefined,
      })
      label = shown?.label ?? null
    }
    const count = collapsed.has(atom.id) ? undefined : repeats.get(atom.id)
    if (label && count) label = repeated(label, count)
    return el("n", attrs, label ? [labelText(label, at(atom))] : [])
  }

  // Bonds between pieces of what is shown: into an abbreviation through its node, with a connection point inside.
  const outerBonds = new Map<number, XmlNode>()
  for (const bond of mol.bonds) {
    const a = collapsed.get(bond.a)
    const b = collapsed.get(bond.b)
    if (a && a === b) continue
    const id = nextId()
    bondIds.set(bond.id, id)
    if (a) enter(a, bond.a, atoms.get(bond.b)!)
    if (b) enter(b, bond.b, atoms.get(bond.a)!)
    outerBonds.set(bond.id, bondElement(id, nodeOf(bond.a)!, nodeOf(bond.b)!, bond))
  }

  // "Attached at any of these atoms": a node naming them, bonded to the attached atom: at
  // their middle, or, drawn curved, where the straight part ends, the curve beside it.
  const attachmentNodes = new Map<number, XmlNode[]>()
  for (const attachment of drawing.attachments ?? []) {
    const written = variableAttachment(attachment)
    if (written) attachmentNodes.set(attachment.atom, written)
  }
  function variableAttachment(attachment: Attachment): XmlNode[] | null {
    const from = atoms.get(attachment.atom)
    const targets = attachment.to.flatMap((id) => atoms.get(id) ?? [])
    if (!from || targets.length === 0) return null
    const course = attachmentCourse(mol, attachment, drawing.brackets)
    const middle = course?.join ?? { x: targets.reduce((sum, atom) => sum + atom.x, 0) / targets.length, y: targets.reduce((sum, atom) => sum + atom.y, 0) / targets.length }
    const id = nextId()
    const bond = nextId()
    const group = collapsed.get(from.id)
    if (group) enter(group, from.id, middle)
    const candidates = [...new Set(targets.map((atom) => nodeOf(atom.id)!))]
    const curve = course ? curveElement(nextId(), course.cubics, course.closed, at) : null
    return [el("n", { id, p: point(middle), NodeType: "VariableAttachment", Attachments: candidates.join(" ") }), bondElement(bond, id, nodeOf(from.id)!), ...(curve ? [curve] : [])]
  }

  const fragmentAt = new Map<number, XmlNode>()
  const fragments = pieces(drawing).map((ids) => {
    const nodes = ids.flatMap((id) => {
      const group = collapsed.get(id)
      if (group) return group.atoms[0] === id ? [groupNode(group)] : []
      return [atomNode(atoms.get(id)!)]
    })
    const inside = new Set(ids)
    const bonds = mol.bonds.flatMap((bond) => (inside.has(bond.a) && outerBonds.has(bond.id) ? [outerBonds.get(bond.id)!] : []))
    const attachments = ids.flatMap((id) => attachmentNodes.get(id) ?? [])
    const vaNodes = attachments.filter((node) => node.tag === "n")
    const vaBonds = attachments.filter((node) => node.tag === "b")
    const vaCurves = attachments.filter((node) => node.tag === "curve")
    const fragment = el("fragment", { id: nextId() }, [...nodes, ...vaNodes, ...bonds, ...vaBonds, ...vaCurves])
    for (const id of ids) fragmentAt.set(id, fragment)
    return fragment
  })
  return { fragments, nodeOf, bondOf: (id) => bondIds.get(id), fragmentOf: (id) => fragmentAt.get(id) }
}
