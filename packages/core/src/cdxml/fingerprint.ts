// A CDXML file's structure in a few lines, and a hash of them: what tells a file Structura
// wrote apart from one changed since. Only nodes (n), bonds (b) and label text (s) are read,
// as written, in points with y downward, so the writer and the reader hash the very same thing.

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
export function cdxmlStructure(text: string): string[] {
  const nodes: Node[] = []
  const bonds: Array<Record<string, string>> = []
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
    }
  }
  // Bonds by the order their nodes come in, not by id: renumbered ids are the same structure.
  const index = new Map(nodes.map((node, at) => [node.id, at]))
  return [
    ...nodes.map((node) => node.line),
    ...bonds.map((b) => `b ${index.get(b.B) ?? "?"}-${index.get(b.E) ?? "?"} ${b.Order ?? "1"} ${b.Display ?? ""} ${b.Display2 ?? ""}`),
    ...runs.map((run) => `s ${run}`),
  ]
}

/** FNV-1a, 64 bits, as 16 hex digits: enough to notice a change, the same in every JavaScript. */
function hash(text: string): string {
  let value = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(text)) value = BigInt.asUintN(64, (value ^ BigInt(byte)) * 0x100000001b3n)
  return value.toString(16).padStart(16, "0")
}

/** The fingerprint of CDXML text's structure (see cdxmlStructure). */
export function cdxmlFingerprint(text: string): string {
  return hash(cdxmlStructure(text).join("\n"))
}
