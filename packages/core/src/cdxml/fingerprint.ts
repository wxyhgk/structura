// A CDXML file's structure in a few lines, and a hash of them: what tells a file Structura
// wrote apart from one changed since. Only nodes (n), bonds (b) and label text (s) are read,
// as written, in points with y downward, so the writer and the reader hash the very same thing.
// From version 2 the graphics are read too: arrows, brackets (graphic, bracketedgroup and
// their attachments and crossing bonds), curves and the count tag on a bracket. A file marked
// version 1 was fingerprinted without them, so it is still checked the old way.

/** The fingerprint's version: 2 includes the graphics, 1 is nodes, bonds and text only. */
export const FINGERPRINT_VERSION = 2

/** The elements besides nodes, bonds and text that version 2 reads. */
const GRAPHICS = new Set(["arrow", "graphic", "curve", "objecttag", "bracketedgroup", "bracketattachment", "crossingbond"])

/** A node as written: element or kind, charge, isotope, and where it sits, rounded. */
type Node = { id: string; line: string }

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }

function decode(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, name: string) => {
    if (name[0] !== "#") return ENTITIES[name] ?? whole
    const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1))
    return Number.isFinite(code) ? String.fromCodePoint(code) : whole
  })
}

function attributes(text: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const [, name, double, single] of text.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[name] = decode(double ?? single)
  return attrs
}

/** A coordinate pair rounded to a tenth of a point: reformatting the numbers is not a change, moving an atom is. */
function place(p: string | undefined): string {
  if (!p) return "-"
  return p
    .trim()
    .split(/\s+/)
    .map((value) => {
      const rounded = Math.round(Number(value) * 10) / 10
      return Object.is(rounded, -0) ? "0" : String(rounded)
    })
    .join(",")
}

/**
 * The structure of CDXML text, a line per node, bond and label run, in document order.
 * Comments, the declaration and the doctype are skipped, so the Structura comment is not part of it.
 */
export function cdxmlStructure(text: string, version = FINGERPRINT_VERSION): string[] {
  const nodes: Node[] = []
  const bonds: Array<Record<string, string>> = []
  // Graphics in document order; what they refer to (nodes, bonds, other graphics) is by id, worked out once all are read.
  const marks: Array<{ tag: string; attrs: Record<string, string> }> = []
  const graphics: string[] = []
  const runs: string[] = []
  let inRun = false
  const tokens = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g
  for (const [, closing, tag, attrText, selfClosing, content] of text.matchAll(tokens)) {
    if (content != null) {
      if (inRun) runs[runs.length - 1] += decode(content)
      continue
    }
    if (tag == null) continue
    if (closing) {
      if (tag === "s") inRun = false
      continue
    }
    if (tag === "s") {
      runs.push("")
      inRun = !selfClosing
    } else if (tag === "n") {
      const a = attributes(attrText)
      const kind = [a.NodeType ?? "Element", a.Element ?? "6", a.GenericNickname ?? "", a.Charge ?? "0", a.Isotope ?? "", a.NumHydrogens ?? "", a.Attachments?.split(/\s+/).length ?? ""].join("/")
      nodes.push({ id: a.id ?? "", line: `n ${kind} ${place(a.p)}` })
    } else if (tag === "b") {
      bonds.push(attributes(attrText))
    } else if (version >= 2 && GRAPHICS.has(tag)) {
      const attrs = attributes(attrText)
      if (tag === "graphic") graphics.push(attrs.id ?? "")
      marks.push({ tag, attrs })
    }
  }
  // Bonds by the order their nodes come in, not by id: renumbered ids are the same structure.
  const index = new Map(nodes.map((node, at) => [node.id, at]))
  const bondAt = new Map(bonds.map((b, at) => [b.id ?? "", at]))
  const graphicAt = new Map(graphics.map((id, at) => [id, at]))
  const nodeIndex = (id: string | undefined) => index.get(id ?? "") ?? "?"
  const drawn = marks.map(({ tag, attrs: a }) => {
    if (tag === "arrow") return `arrow ${place(a.Tail3D ?? a.BoundingBox)} ${place(a.Head3D)} ${a.ArrowheadHead ?? ""} ${a.ArrowheadType ?? ""}`
    if (tag === "graphic") return `graphic ${a.GraphicType ?? ""} ${a.BracketType ?? ""} ${a.BracketUsage ?? ""} ${a.PolymerRepeatPattern ?? ""} ${place(a.BoundingBox)}`
    if (tag === "curve") return `curve ${a.CurveType ?? ""} ${a.Closed ?? ""} ${place(a.CurvePoints)}`
    if (tag === "objecttag") return `tag ${a.Name ?? ""} ${a.Value ?? ""}`
    if (tag === "bracketedgroup") {
      const inside = (a.BracketedObjectIDs ?? "").split(/\s+/).filter(Boolean).map(nodeIndex)
      return `group ${a.BracketUsage ?? ""} ${a.PolymerRepeatPattern ?? ""} ${a.SRULabel ?? ""} ${inside.join(",")}`
    }
    if (tag === "bracketattachment") return `side ${graphicAt.get(a.GraphicID ?? "") ?? "?"}`
    return `through ${bondAt.get(a.BondID ?? "") ?? "?"} ${nodeIndex(a.InnerAtomID)}`
  })
  return [
    ...nodes.map((node) => node.line),
    ...bonds.map((b) => `b ${index.get(b.B) ?? "?"}-${index.get(b.E) ?? "?"} ${b.Order ?? "1"} ${b.Display ?? ""} ${b.Display2 ?? ""}`),
    ...runs.map((run) => `s ${run}`),
    ...drawn,
  ]
}

/** FNV-1a, 64 bits, as 16 hex digits: enough to notice a change, the same in every JavaScript. */
function hash(text: string): string {
  let value = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(text)) value = BigInt.asUintN(64, (value ^ BigInt(byte)) * 0x100000001b3n)
  return value.toString(16).padStart(16, "0")
}

/** The fingerprint of CDXML text's structure (see cdxmlStructure), by the algorithm of `version`. */
export function cdxmlFingerprint(text: string, version = FINGERPRINT_VERSION): string {
  return hash(cdxmlStructure(text, version).join("\n"))
}
