import { BOND_LENGTH } from "./constants.ts"
import type { BondStereo, Molecule } from "./types.ts"

/** MOL files use ångströms with y pointing up; a C–C bond is about 1.5 Å. */
const ANGSTROM_PER_PX = 1.5 / BOND_LENGTH

function pad3(value: number): string {
  return String(value).padStart(3, " ")
}

function fixed10(value: number): string {
  return (Object.is(value, -0) ? 0 : value).toFixed(4).padStart(10, " ")
}

function stereoCode(stereo: BondStereo): number {
  if (stereo === "up") return 1
  if (stereo === "down") return 6
  if (stereo === "either") return 4
  return 0
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

export function toMolfile(mol: Molecule, title = "Structura"): string {
  const index = new Map(mol.atoms.map((atom, position) => [atom.id, position + 1]))
  const atomLines = mol.atoms.map((atom) => {
    const x = atom.x * ANGSTROM_PER_PX
    const y = -atom.y * ANGSTROM_PER_PX
    return `${fixed10(x)}${fixed10(y)}${fixed10(0)} ${atom.el.padEnd(3, " ")} 0${"  0".repeat(11)}`
  })
  const bondLines = mol.bonds.flatMap((bond) => {
    const a = index.get(bond.a)
    const b = index.get(bond.b)
    if (a == null || b == null) return []
    const stereo = bond.order === 1 ? stereoCode(bond.stereo) : 0
    return [`${pad3(a)}${pad3(b)}${pad3(bond.order)}${pad3(stereo)}  0  0  0`]
  })
  const charged = mol.atoms
    .filter((atom) => atom.charge !== 0)
    .map((atom): [number, number] => [index.get(atom.id) ?? 0, atom.charge])
  const isotopes = mol.atoms
    .filter((atom) => atom.isotope != null)
    .map((atom): [number, number] => [index.get(atom.id) ?? 0, atom.isotope ?? 0])
  const lines = [
    title,
    // Initials (2), program (8), date (10, left blank so output is reproducible), dimension code.
    `  Structur${" ".repeat(10)}2D`,
    "",
    `${pad3(atomLines.length)}${pad3(bondLines.length)}  0  0  0  0  0  0  0  0999 V2000`,
    ...atomLines,
    ...bondLines,
  ]
  lines.push(...propertyLines("CHG", charged), ...propertyLines("ISO", isotopes), "M  END", "")
  return lines.join("\n")
}
