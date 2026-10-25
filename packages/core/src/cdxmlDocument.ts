import { cdxmlFingerprint } from "./cdxml/fingerprint.ts"
import { readDocument, toDocument } from "./document.ts"
import type { Drawing } from "./types.ts"

// A CDXML file that comes back whole: the Structura document (variables, provisos, ring
// closures, brackets — all CDXML cannot say) rides along in an XML comment, which ChemDraw
// ignores, with the fingerprint of the structure written around it. Read back, the document
// is used only if the structure is still the one it was written with; a file changed since
// (or saved again by a program that drops the comment) is refused, never read as it was.
// Apart from cdxml.ts: reading the document checks the generic formula, which reaches the
// abbreviation tables a plain CDXML writer has no need of.

/** `<!--structura:v1:<fingerprint>:<base64 of the deflate-raw document>-->` */
const VERSION = 1
const MARK = /<!--structura:v(\d+):([\da-f]+):([A-Za-z\d+/=\s]*)-->/

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text.replace(/\s+/g, "")), (char) => char.charCodeAt(0))
}

/**
 * CDXML text (as toCdxml writes it) with `drawing`'s whole Structura document put in a
 * comment at the end of the root element, so readCdxml can bring it back. Asynchronous
 * because it compresses with CompressionStream (browsers and Node alike).
 */
export async function embedDocument(cdxml: string, drawing: Drawing): Promise<string> {
  const packed = toBase64(await through(new TextEncoder().encode(toDocument(drawing)), new CompressionStream("deflate-raw")))
  const mark = `<!--structura:v${VERSION}:${cdxmlFingerprint(cdxml)}:${packed}-->\n`
  const end = cdxml.lastIndexOf("</CDXML>")
  if (end < 0) throw new Error("not CDXML: no </CDXML>")
  return cdxml.slice(0, end) + mark + cdxml.slice(end)
}

/** Whether text looks like a CDXML file, before trying to read it. */
export function isCdxml(text: string): boolean {
  return /<CDXML[\s>/]/.test(text.slice(0, 1000))
}

/**
 * What reading CDXML gave: the drawing, or why not. `foreign`: no Structura document in it
 * (another program wrote it, or ChemDraw saved it again); `changed`: the structure is no
 * longer the one the document was written with; `broken`: the document cannot be read.
 */
export type CdxmlRead = { drawing: Drawing } | { reason: "foreign" | "changed" | "broken"; error: string }

/** The Structura document kept in CDXML text by embedDocument, if the structure around it is unchanged. */
export async function readCdxml(text: string): Promise<CdxmlRead> {
  const mark = MARK.exec(text)
  if (!mark) return { reason: "foreign", error: "no Structura document in this CDXML" }
  const [, version, fingerprint, packed] = mark
  if (Number(version) > VERSION) return { reason: "broken", error: `made by a newer Structura (version ${version})` }
  if (cdxmlFingerprint(text) !== fingerprint) return { reason: "changed", error: "the structure was changed after Structura wrote it" }
  let json: string
  try {
    json = new TextDecoder().decode(await through(fromBase64(packed), new DecompressionStream("deflate-raw")))
  } catch {
    return { reason: "broken", error: "the Structura document in it is damaged" }
  }
  const read = readDocument(json)
  return "error" in read ? { reason: "broken", error: read.error } : read
}
