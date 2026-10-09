import { elementOf } from "./elements/index.ts"
import { bondOrderSum } from "./molecule/graph.ts"
import { ANGSTROM_PER_PX, rGroupNumber, stereoCode } from "./molfile/codes.ts"
import { sgroupLines } from "./molfile/sgroups.ts"
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

/**
 * The atom block symbol. A labelled placeholder is R# for an R-group and * (any atom)
 * otherwise, never the carbon it sits on, so other programs do not read it as carbon.
 */
function symbolOf(atom: Molecule["atoms"][number]): string {
  if (!atom.alias) return atom.el
  return rGroupNumber(atom.alias) != null ? "R#" : "*"
}

/**
 * The atom block's valence field. Elements we give no implicit hydrogens to (metals, Sn…)
 * state their valence outright, 15 meaning zero, so readers do not add hydrogens we never
 * drew. Everything else is left to the reader's own rules (0).
 */
function valenceField(mol: Molecule, atom: Molecule["atoms"][number]): number {
  if (atom.alias || elementOf(atom.el)?.valences || atom.el === "H") return 0
  const bonds = bondOrderSum(mol, atom.id)
  return bonds === 0 ? 15 : Math.min(bonds, 14)
}

/** The molecule as a V2000 molfile; `brackets` (those wholly in it) go in as Sgroups. */
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
 * Molecules as one SD file, each record titled with its place in the list ("Structura 1",
 * …), with `fields[i]` written as record i's data items (> <name> lines).
 */
export function toSdf(molecules: readonly Molecule[], title = "Structura", fields: ReadonlyArray<Record<string, string>> = []): string {
  return molecules
    .map((mol, index) => {
      const items = Object.entries(fields[index] ?? {}).map(([name, value]) => `> <${name.replace(/[<>\r\n]/g, " ")}>\n${value.replace(/\r?\n\s*\n/g, "\n")}\n\n`)
      return `${toMolfile(mol, `${title} ${index + 1}`)}${items.join("")}$$$$\n`
    })
    .join("")
}
