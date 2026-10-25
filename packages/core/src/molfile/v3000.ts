import { float, int, type Ctab, type CtabAtom, type CtabBond, type Note } from "./ctab.ts"
import type { SgroupRead } from "./sgroups.ts"

// V3000 keeps one item a line, `M  V30 ` first, as positional fields then KEY=VALUE pairs;
// a line ending in "-" goes on in the next. Values may be (counted lists) or "quoted".

/** Atom and bond properties dropped without a word, as V2000's matching columns are. */
const QUIET_ATOM = new Set(["VAL", "CFG", "HCOUNT", "INVRET", "EXACHG", "STBOX"])
const QUIET_BOND = new Set(["TOPO", "RXCTR", "STBOX"])

/** V3000's bond CFG as V2000 stereo codes: 1 wedge, 2 either (crossed when double), 3 hash. */
function stereoOf(cfg: number, type: number): number {
  if (cfg === 1) return 1
  if (cfg === 3) return 6
  if (cfg === 2) return type === 2 ? 3 : 4
  return 0
}

/** The V30 lines up to `M  END`, prefixes off and continued lines joined. */
function v30Lines(lines: string[], note: Note): string[] {
  const joined: string[] = []
  let pending: string | null = null
  for (const line of lines.slice(4)) {
    if (line.startsWith("M  END")) break
    if (!line.startsWith("M  V30 ")) {
      if (line.trim() !== "") note("unsupported-mol-feature", `ignored "${line.slice(0, 6).trim()}" line`)
      continue
    }
    const text: string = (pending ?? "") + line.slice(7)
    if (text.endsWith("-")) pending = text.slice(0, -1)
    else {
      joined.push(text.trim())
      pending = null
    }
  }
  if (pending != null) joined.push(pending.trim())
  return joined
}

/** A line's fields, keeping (lists) and "quoted text" (with "" for a quote) whole. */
function fields(text: string): string[] {
  const out: string[] = []
  let at = 0
  while (at < text.length) {
    if (text[at] === " ") {
      at++
      continue
    }
    let field = ""
    while (at < text.length && text[at] !== " ") {
      if (text[at] === '"') {
        at++
        while (at < text.length) {
          if (text[at] === '"' && text[at + 1] === '"') {
            field += '"'
            at += 2
          } else if (text[at] === '"') {
            at++
            break
          } else field += text[at++]
        }
      } else if (text[at] === "(") {
        const end = text.indexOf(")", at)
        const stop = end === -1 ? text.length : end + 1
        field += text.slice(at, stop)
        at = stop
      } else field += text[at++]
    }
    out.push(field)
  }
  // An atom list's NOT stands apart from its list: NOT [C,N] is one atom type.
  for (let index = out.length - 2; index >= 0; index--) if (out[index] === "NOT") out.splice(index, 2, `NOT ${out[index + 1]}`)
  return out
}

/** Positional fields, then KEY=VALUE pairs by key. */
function split(text: string): { positional: string[]; keyed: Map<string, string> } {
  const positional: string[] = []
  const keyed = new Map<string, string>()
  for (const field of fields(text)) {
    const match = /^([A-Z0-9]+)=(.*)$/.exec(field)
    if (match) keyed.set(match[1], match[2])
    else positional.push(field)
  }
  return { positional, keyed }
}

/** The numbers of a counted list, "(3 1 2 3)" → [1, 2, 3]. */
function list(value: string | undefined): number[] {
  const numbers = (value ?? "").replace(/[()]/g, " ").trim().split(/\s+/).filter(Boolean).map(int)
  return numbers.slice(1, 1 + (numbers[0] ?? 0))
}

/**
 * The connection table of a V3000 molfile, split into lines (header included), or null when
 * it has none to read. Blocks, properties and lines it does not read are noted.
 */
export function readV3000(lines: string[], note: Note): Ctab | null {
  const items = v30Lines(lines, note)
  const atoms: CtabAtom[] = []
  const bonds: CtabBond[] = []
  const sgroups = new Map<number, SgroupRead>()
  // File atom indices need not run 1…n; the table numbers atoms by place.
  const place = new Map<number, number>()
  const ignored = new Map<string, number[]>()
  const ignore = (what: string, number: number) => ignored.set(what, [...(ignored.get(what) ?? []), number])
  let block: string | null = null
  let skipping: { name: string; depth: number } | null = null
  let ctab = false
  let ended = false
  for (const item of items) {
    const words = item.split(/\s+/)
    if (skipping) {
      if (words[0] === "BEGIN" && words[1] === skipping.name) skipping.depth++
      if (words[0] === "END" && words[1] === skipping.name && --skipping.depth === 0) skipping = null
      continue
    }
    if (words[0] === "BEGIN") {
      const name = words[1] ?? ""
      if (name === "CTAB" && !ctab && !ended) ctab = true
      else if (ctab && (name === "ATOM" || name === "BOND" || name === "SGROUP")) block = name
      else {
        note("unsupported-mol-feature", `ignored the V3000 ${name} block`)
        skipping = { name, depth: 1 }
      }
      continue
    }
    if (words[0] === "END") {
      if (words[1] === "CTAB" && ctab) {
        ctab = false
        ended = true
      }
      block = null
      continue
    }
    if (!ctab) {
      note("unsupported-mol-feature", `ignored V3000 "${words[0]}" line`)
      continue
    }
    if (block === "ATOM") {
      const { positional, keyed } = split(item)
      const number = atoms.length + 1
      place.set(int(positional[0]), number)
      const atom: CtabAtom = {
        symbol: positional[1] ?? "",
        x: float(positional[2]),
        y: float(positional[3]),
        z: float(positional[4]),
        charge: int(keyed.get("CHG")),
        radical: int(keyed.get("RAD")),
        map: int(positional[5]),
      }
      if (keyed.has("MASS")) atom.mass = int(keyed.get("MASS"))
      const groups = list(keyed.get("RGROUPS"))
      if (groups.length > 0) atom.rGroup = groups[0]
      if (groups.length > 1) note("unsupported-mol-feature", `atom ${number} may be any of R-groups ${groups.join(", ")}; read as R${groups[0]}`)
      for (const key of keyed.keys()) {
        if (!["CHG", "RAD", "MASS", "RGROUPS"].includes(key) && !QUIET_ATOM.has(key)) ignore(`atom property ${key}`, number)
      }
      atoms.push(atom)
    } else if (block === "BOND") {
      const { positional, keyed } = split(item)
      const number = bonds.length + 1
      const type = int(positional[1])
      const [a, b] = [positional[2], positional[3]].map((index) => place.get(int(index)))
      if (a == null || b == null) {
        note("bad-molfile", `bond ${positional[0]} joins atoms ${positional[2]} and ${positional[3]}, which do not exist`, "error")
        continue
      }
      bonds.push({ a, b, type, stereo: stereoOf(int(keyed.get("CFG")), type) })
      for (const key of keyed.keys()) {
        if (key !== "CFG" && !QUIET_BOND.has(key)) ignore(`bond property ${key}`, number)
      }
    } else if (block === "SGROUP") {
      // As for V2000, brackets' corners and crossing bonds are worked out again from the atoms.
      const { positional, keyed } = split(item)
      const read: SgroupRead = { type: positional[1], atoms: list(keyed.get("ATOMS")).map((index) => place.get(index) ?? 0) }
      if (keyed.has("LABEL")) read.label = keyed.get("LABEL")
      if (keyed.has("FIELDNAME")) read.field = keyed.get("FIELDNAME")
      if (keyed.has("FIELDDATA")) read.data = keyed.get("FIELDDATA")
      sgroups.set(int(positional[0]), read)
    } else if (words[0] !== "COUNTS") {
      note("unsupported-mol-feature", `ignored V3000 "${words[0]}" line`)
    }
  }
  if (!ended) {
    note("bad-molfile", "the V3000 connection table never ends (no END CTAB)", "error")
    return null
  }
  for (const [what, numbers] of ignored) note("unsupported-mol-feature", `ignored ${what} (on ${what.startsWith("atom") ? "atom" : "bond"} ${numbers.join(", ")})`)
  return { atoms, bonds, sgroups }
}
