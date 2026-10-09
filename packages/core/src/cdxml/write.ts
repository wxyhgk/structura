import { crossingBonds } from "../drawing/brackets.ts"
import { bondLengthAt } from "../molecule/measure.ts"
import type { Atom, Bracket, Drawing, Point } from "../types.ts"
import { type BracketBox, bracketBox } from "./brackets.ts"
import { curveReach } from "./curves.ts"
import { elementLabel, textWidth } from "./labels.ts"
import { LABEL_FONT, type Structure, writeStructure } from "./structure.ts"
import { el, num, serialize, type XmlNode } from "./xml.ts"

// The drawing as a ChemDraw document (CDXML): the structure, its brackets, reaction arrows
// and, under it all, the lines of text a generic formula is defined by.

export type CdxmlOptions = {
  /**
   * Lines of text written under the drawing, one each: what the generic formula's
   * variables stand for ("R1 = H, Cl"), its counts ("n = 1–4"), provisos.
   */
  notes?: readonly string[]
  /** The labels whose numbers are raised (R¹) rather than lowered (R₁), as on the canvas. */
  raiseNumbers?: (label: string) => boolean
}

/** ChemDraw's "ACS Document 1996" style: a bond is 14.4 pt, so the drawing opens at the size journals and patents print. */
const BOND_POINTS = 14.4
/** Where the drawing starts on the page, in points. */
const MARGIN = 50
/** A printed page's drawing area, in points. */
const PAGE = { width: 540, height: 720 }
/** The notes' font size and line spacing, in points. */
const NOTE_SIZE = 10
const NOTE_LEADING = 14
/** A font for notes in Chinese (SimSun, charset GB2312), as Arial has no Chinese. */
const CJK_FONT = 4
const CJK = /[⺀-鿿＀-￯]/

/** Every point the drawing reaches, in drawing units. */
function extentOf(drawing: Drawing, boxes: readonly BracketBox[], curves: readonly Point[]): { left: number; top: number } {
  const points: Point[] = [
    ...drawing.molecule.atoms,
    ...curves,
    ...drawing.arrows.flatMap((arrow) => [{ x: arrow.x1, y: arrow.y1 }, { x: arrow.x2, y: arrow.y2 }]),
    ...boxes.flatMap((box) => [{ x: box.left, y: box.top }]),
  ]
  if (points.length === 0) return { left: 0, top: 0 }
  return { left: Math.min(...points.map((p) => p.x)), top: Math.min(...points.map((p) => p.y)) }
}

/**
 * A bracket as ChemDraw saves one: "[" and "]" as two Bracket graphics in the fragment (a
 * vertical line each, drawn upwards on the left and downwards on the right so their serifs
 * face in), the count's name in a tag on "]", and a bracketed group at page level naming
 * the atoms inside, the use (a repeat unit, SRU; a group, Generic) and the bonds through each side.
 */
function writeBracket(bracket: Bracket, box: BracketBox, drawing: Drawing, structure: Structure, at: (p: Point) => Point, nextId: () => number): { graphics: XmlNode[]; group: XmlNode } {
  const topLeft = at({ x: box.left, y: box.top })
  const bottomRight = at({ x: box.right, y: box.bottom })
  const [left, top, right, bottom] = [topLeft.x, topLeft.y, bottomRight.x, bottomRight.y]
  const usage = bracket.kind === "repeat" ? "SRU" : "Generic"
  const name = bracket.kind === "repeat" ? bracket.repeat?.name : undefined
  const pattern = bracket.kind === "repeat" ? "HeadToTail" : undefined
  const open = nextId()
  const close = nextId()
  const count = name
    ? [el("objecttag", { TagType: "String", Name: "bracketusage", Value: name }, [el("t", { p: `${num(right + 3.3)} ${num(bottom + 2)}` }, [el("s", { font: LABEL_FONT, size: 7.5, face: 2 }, [name])])])]
    : []
  const graphics = [
    el("graphic", { id: open, BoundingBox: `${num(left)} ${num(bottom)} ${num(left)} ${num(top)}`, GraphicType: "Bracket", BracketType: "Square" }),
    el("graphic", { id: close, BoundingBox: `${num(right)} ${num(top)} ${num(right)} ${num(bottom)}`, GraphicType: "Bracket", BracketType: "Square", BracketUsage: usage, PolymerRepeatPattern: pattern }, count),
  ]
  const mol = drawing.molecule
  const inside = new Set(bracket.atoms)
  const middle = (box.left + box.right) / 2
  const sides = { [open]: [] as XmlNode[], [close]: [] as XmlNode[] }
  for (const bondId of crossingBonds(mol, bracket.atoms)) {
    const bond = mol.bonds.find((item) => item.id === bondId)!
    const written = structure.bondOf(bondId)
    const innerAtom = inside.has(bond.a) ? bond.a : bond.b
    const outer = mol.atoms.find((atom) => atom.id === (innerAtom === bond.a ? bond.b : bond.a))
    if (written == null || !outer) continue
    sides[outer.x < middle ? open : close].push(el("crossingbond", { id: nextId(), BondID: written, InnerAtomID: structure.nodeOf(innerAtom) }))
  }
  const objects = [...new Set(bracket.atoms.flatMap((id) => structure.nodeOf(id) ?? []))]
  const group = el("bracketedgroup", { id: nextId(), BracketedObjectIDs: objects.join(" "), BracketUsage: usage, PolymerRepeatPattern: pattern, SRULabel: name }, [
    el("bracketattachment", { id: nextId(), GraphicID: open }, sides[open]),
    el("bracketattachment", { id: nextId(), GraphicID: close }, sides[close]),
  ])
  return { graphics, group }
}

/** A reaction arrow, tail to head, with ChemDraw's usual solid head. */
function writeArrow(id: number, tail: Point, head: Point): XmlNode {
  return el("arrow", {
    id,
    BoundingBox: `${num(Math.min(tail.x, head.x))} ${num(Math.min(tail.y, head.y))} ${num(Math.max(tail.x, head.x))} ${num(Math.max(tail.y, head.y))}`,
    FillType: "None",
    ArrowheadHead: "Full",
    ArrowheadType: "Solid",
    HeadSize: 1000,
    ArrowheadCenterSize: 875,
    ArrowheadWidth: 250,
    Head3D: `${num(head.x)} ${num(head.y)} 0`,
    Tail3D: `${num(tail.x)} ${num(tail.y)} 0`,
  })
}

/** The drawing as CDXML text for ChemDraw: atoms, bonds, labels, abbreviations, variable attachments, brackets, arrows and `notes`. */
export function toCdxml(drawing: Drawing, options: CdxmlOptions = {}): string {
  const mol = drawing.molecule
  const bondLength = bondLengthAt(mol)
  const scale = BOND_POINTS / bondLength
  const labelled = (atom: Atom) => Boolean(atom.alias) || elementLabel(mol, atom) != null || mol.groups.some((group) => group.collapsed && group.atoms[0] === atom.id)
  const boxes = (drawing.brackets ?? []).flatMap((bracket) => {
    const box = bracketBox(mol, bracket, bondLength, labelled)
    return box ? [{ bracket, box }] : []
  })
  const curves = curveReach(drawing)
  const origin = extentOf(drawing, boxes.map((item) => item.box), curves)
  const at = (p: Point): Point => ({ x: (p.x - origin.left) * scale + MARGIN, y: (p.y - origin.top) * scale + MARGIN })
  let lastId = 0
  const nextId = () => ++lastId

  const pageId = nextId()
  const structure = writeStructure(drawing, { at, nextId, raiseNumbers: options.raiseNumbers })
  const groups: XmlNode[] = []
  for (const { bracket, box } of boxes) {
    const written = writeBracket(bracket, box, drawing, structure, at, nextId)
    structure.fragmentOf(bracket.atoms.find((id) => structure.fragmentOf(id)) ?? -1)?.children.push(...written.graphics)
    groups.push(written.group)
  }
  const arrows = drawing.arrows.map((arrow) => writeArrow(nextId(), at({ x: arrow.x1, y: arrow.y1 }), at({ x: arrow.x2, y: arrow.y2 })))

  // How far everything reaches on the page, for the notes under it and the page's size.
  const placed = [...mol.atoms.map(at), ...curves.map(at), ...drawing.arrows.flatMap((arrow) => [at({ x: arrow.x1, y: arrow.y1 }), at({ x: arrow.x2, y: arrow.y2 })]), ...boxes.flatMap(({ box }) => [at({ x: box.right, y: box.bottom })])]
  let right = Math.max(MARGIN, ...placed.map((p) => p.x))
  let bottom = Math.max(MARGIN, ...placed.map((p) => p.y))
  const notes = (options.notes ?? []).filter((line) => line.trim() !== "")
  const cjk = notes.some((line) => CJK.test(line))
  let y = placed.length > 0 ? bottom + 2 * BOND_POINTS : MARGIN
  const texts = notes.map((line) => {
    const text = el("t", { id: nextId(), p: `${num(MARGIN)} ${num(y)}` }, [el("s", { font: cjk ? CJK_FONT : LABEL_FONT, size: NOTE_SIZE }, [line])])
    right = Math.max(right, MARGIN + textWidth(line, NOTE_SIZE))
    bottom = y
    y += NOTE_LEADING
    return text
  })

  const across = Math.max(1, Math.ceil((right + MARGIN) / PAGE.width))
  const down = Math.max(1, Math.ceil((bottom + MARGIN) / PAGE.height))
  const page = el(
    "page",
    { id: pageId, BoundingBox: `0 0 ${across * PAGE.width} ${down * PAGE.height}`, HeaderPosition: 36, FooterPosition: 36, PrintTrimMarks: "yes", WidthPages: across, HeightPages: down },
    [...structure.fragments, ...arrows, ...texts, ...groups],
  )
  const fonts = [el("font", { id: LABEL_FONT, charset: "iso-8859-1", name: "Arial" }), ...(cjk ? [el("font", { id: CJK_FONT, charset: "gb2312", name: "SimSun" })] : [])]
  const document = el(
    "CDXML",
    {
      CreationProgram: "Structura",
      BoundingBox: `${num(MARGIN)} ${num(MARGIN)} ${num(right)} ${num(bottom)}`,
      LabelFont: LABEL_FONT,
      LabelSize: 10,
      LabelFace: 96,
      CaptionFont: LABEL_FONT,
      CaptionSize: 10,
      HashSpacing: 2.5,
      MarginWidth: 1.6,
      LineWidth: 0.6,
      BoldWidth: 2,
      BondLength: BOND_POINTS,
      BondSpacing: 18,
      ChainAngle: 120,
      LabelJustification: "Auto",
      CaptionJustification: "Left",
      InterpretChemically: "yes",
      color: 0,
      bgcolor: 1,
    },
    [el("colortable", {}, [el("color", { r: 1, g: 1, b: 1 }), el("color", { r: 0, g: 0, b: 0 })]), el("fonttable", {}, fonts), page],
  )
  return `<?xml version="1.0" encoding="UTF-8" ?>\n<!DOCTYPE CDXML SYSTEM "http://www.cambridgesoft.com/xml/cdxml.dtd" >\n${serialize(document)}\n`
}
