// Just enough XML for CDXML: elements with attributes, children and escaped text.

/** An element: its tag, attributes (left out when undefined) and what it holds. */
export type XmlNode = { tag: string; attrs: Record<string, string | number | undefined>; children: Array<XmlNode | string> }

export function el(tag: string, attrs: XmlNode["attrs"] = {}, children: XmlNode["children"] = []): XmlNode {
  return { tag, attrs, children }
}

/** Text made safe for XML content and attribute values. */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!)
}

/** A coordinate in points, two decimals, never "-0". */
export function num(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

/**
 * The element as text, one element a line so files diff well. Text content is kept as it
 * is, and a text object's styled runs (<t><s>…</s><s>…</s></t>) stay on one line, so no
 * line break between them can be read as part of the text.
 */
export function serialize(node: XmlNode): string {
  const attrs = Object.entries(node.attrs)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ` ${name}="${escapeXml(String(value))}"`)
    .join("")
  if (node.children.length === 0) return `<${node.tag}${attrs}/>`
  const inline = node.tag === "t" || node.children.every((child) => typeof child === "string")
  const inner = node.children.map((child) => (typeof child === "string" ? escapeXml(child) : serialize(child))).join(inline ? "" : "\n")
  return inline ? `<${node.tag}${attrs}>${inner}</${node.tag}>` : `<${node.tag}${attrs}>\n${inner}\n</${node.tag}>`
}
