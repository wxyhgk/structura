import { ANGSTROM_PER_PX, rGroupNumber, stereoCode } from "./molfile/codes.ts"
import { symbolOf, valenceField } from "./molfile/fields.ts"
import { sgroupLines } from "./molfile/sgroups.ts"
import { toV3000 } from "./molfile/write3000.ts"
import type { Bracket, Molecule } from "./types.ts"

function pad3(value: number): string {
  return String(value).padStart(3, " ")
}

function fixed10(value: number): string {
  return (Object.is(value, -0) ? 0 : value).toFixed(4).padStart(10, " ")
}

/** Property lines such as `M  CHG` and `M  ISO`, eight atoms to a line. */
function propertyLines(tag: string, entries: Array<[number, number]>): string[] {
  const lines: string[] = []
  for (let start = 0; start < entries.length; start += 8) {
    const chunk = entries.slice(start, start + 8)
    lines.push(`M  ${tag}${pad3(chunk.length)}${chunk.map(([index, value]) => ` ${pad3(index)} ${pad3(value)}`).join("")}`)
  }
  return lines
}

/** V2000's counts line has three digits for atoms and for bonds. */
const V2000_LIMIT = 999

/**
 * The molecule as a molfile; `brackets` (those wholly in it) go in as Sgroups. V2000, unless
 * it has more atoms or bonds than that format's three-digit counts hold: then V3000.
 */
export function toMolfile(mol: Molecule, title = "Structura", brackets: readonly Bracket[] = []): string {
  const index = new Map(mol.atoms.map((atom, position) => [atom.id, position + 1]))
  const atomLines = mol.atoms.map((atom) => {
    const x = atom.x * ANGSTROM_PER_PX
    const y = -atom.y * ANGSTROM_PER_PX
    // dd ccc sss hhh bbb vvv, then six unused fields.
    return `${fixed10(x)}${fixed10(y)}${fixed10(0)} ${symbolOf(atom).padEnd(3, " ")} 0${"  0".repeat(4)}${pad3(valenceField(mol, atom))}${"  0".repeat(6)}`
  })
  const bondIndex = new Map<number, number>()
  const bondLines = mol.bonds.flatMap((bond) => {
    const a = index.get(bond.a)
    const b = index.get(bond.b)
    if (a == null || b == null) return []
    bondIndex.set(bond.id, bondIndex.size + 1)
    const stereo = bond.order === 1 ? stereoCode(bond.stereo) : 0
    return [`${pad3(a)}${pad3(b)}${pad3(bond.order)}${pad3(stereo)}  0  0  0`]
  })
  if (atomLines.length > V2000_LIMIT || bondLines.length > V2000_LIMIT) return toV3000(mol, title, brackets)
  const charged = mol.atoms
    .filter((atom) => atom.charge !== 0)
    .map((atom): [number, number] => [index.get(atom.id) ?? 0, atom.charge])
  const isotopes = mol.atoms
    .filter((atom) => atom.isotope != null)
    .map((atom): [number, number] => [index.get(atom.id) ?? 0, atom.isotope ?? 0])
  const rGroups = mol.atoms.flatMap((atom): Array<[number, number]> => {
    const number = atom.alias ? rGroupNumber(atom.alias) : null
    return number != null ? [[index.get(atom.id) ?? 0, number]] : []
  })
  // `A  ` lines keep the label text itself, one atom per two lines.
  const aliases = mol.atoms.flatMap((atom) => (atom.alias ? [`A  ${pad3(index.get(atom.id) ?? 0)}`, atom.alias] : []))
  const lines = [
    title,
    // Initials (2), program (8), date (10, left blank so output is reproducible), dimension code.
    `  Structur${" ".repeat(10)}2D`,
    "",
    `${pad3(atomLines.length)}${pad3(bondLines.length)}  0  0  0  0  0  0  0  0999 V2000`,
    ...atomLines,
    ...bondLines,
  ]
  lines.push(...aliases, ...propertyLines("CHG", charged), ...propertyLines("ISO", isotopes), ...propertyLines("RGP", rGroups), ...sgroupLines(mol, brackets, index, bondIndex), "M  END", "")
  return lines.join("\n")
}

/**
 * A data item's value as SD lines. A blank line ends the item, so blank (and blank-looking)
 * lines are dropped; a line that would read as the end of the record ($$$$) or the next
 * item (> <name>) is set in by a space.
 */
function sdfValue(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => (line.startsWith("$$$$") || line.startsWith(">") ? ` ${line}` : line))
    .join("\n")
}

/**
 * Molecules as one SD file, each record titled with its place in the list ("Structura 1",
 * …), or with titles[i] when `title` is a list (compound numbers such as "C-1"), with
 * `fields[i]` written as record i's data items (> <name> lines).
 */
export function toSdf(molecules: readonly Molecule[], title: string | readonly string[] = "Structura", fields: ReadonlyArray<Record<string, string>> = []): string {
  return molecules
    .map((mol, index) => {
      const items = Object.entries(fields[index] ?? {}).map(([name, value]) => `> <${name.replace(/[<>\r\n]/g, " ")}>\n${sdfValue(value)}\n\n`)
      const named = typeof title === "string" ? `${title} ${index + 1}` : (title[index] ?? `Structura ${index + 1}`)
      return `${toMolfile(mol, named.replace(/[\r\n]+/g, " "))}${items.join("")}$$$$\n`
    })
    .join("")
}
