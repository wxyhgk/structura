import type { Bracket, Molecule } from "../types.ts"
import { ANGSTROM_PER_PX, rGroupLabel, rGroupNumber, stereoCode } from "./codes.ts"
import { symbolOf, valenceField } from "./fields.ts"
import { sgroupItems, v30Value } from "./sgroups.ts"

// A V3000 molfile for what V2000's three-digit counts cannot hold. It carries what the V2000
// writer does, read back by the same code: coordinates, charges, isotopes, R-groups, labels,
// wedges and hashes, repeat units and groups.

/** The longest an `M  V30` line may be, prefix included. */
const LINE = 80
const PREFIX = "M  V30 "

function fixed4(value: number): string {
  return (Object.is(value, -0) ? 0 : value).toFixed(4)
}

/** One item as `M  V30` lines: one that is too long breaks at a space (not in quotes) and goes on after a dash. */
function itemLines(item: string): string[] {
  const room = LINE - PREFIX.length - 1
  const lines: string[] = []
  let rest = item
  while (rest.length > room) {
    let cut = -1
    let inQuotes = false
    for (let at = 0; at < room; at++) {
      if (rest[at] === '"') inQuotes = !inQuotes
      else if (rest[at] === " " && !inQuotes) cut = at
    }
    // A single field too long for a line cannot be broken; it goes out whole.
    if (cut < 1) {
      cut = rest.indexOf(" ", room)
      if (cut === -1) break
    }
    lines.push(`${PREFIX}${rest.slice(0, cut + 1)}-`)
    rest = rest.slice(cut + 1)
  }
  lines.push(`${PREFIX}${rest}`)
  return lines
}

/** The molecule as a V3000 molfile; `brackets` (those wholly in it) go in as Sgroups. */
export function toV3000(mol: Molecule, title: string, brackets: readonly Bracket[]): string {
  const index = new Map(mol.atoms.map((atom, position) => [atom.id, position + 1]))
  const atomItems = mol.atoms.map((atom, position) => {
    const fields = [`${position + 1}`, symbolOf(atom), fixed4(atom.x * ANGSTROM_PER_PX), fixed4(-atom.y * ANGSTROM_PER_PX), fixed4(0), "0"]
    if (atom.charge !== 0) fields.push(`CHG=${atom.charge}`)
    if (atom.isotope != null) fields.push(`MASS=${atom.isotope}`)
    const group = atom.alias ? rGroupNumber(atom.alias) : null
    if (group != null) fields.push(`RGROUPS=(1 ${group})`)
    // Any other label rides along as ALIAS, as V2000's `A  ` lines carry it; so does a plain
    // R, written as R-group 1 (as V2000 writes it) but read back as R, not R1.
    if (atom.alias && (group == null || rGroupLabel(group) !== atom.alias)) fields.push(`ALIAS=${v30Value(atom.alias)}`)
    const valence = valenceField(mol, atom)
    // VAL=-1 is "no valence", V2000's 15.
    if (valence !== 0) fields.push(`VAL=${valence === 15 ? -1 : valence}`)
    return fields.join(" ")
  })
  const bondIndex = new Map<number, number>()
  const bondItems = mol.bonds.flatMap((bond) => {
    const a = index.get(bond.a)
    const b = index.get(bond.b)
    if (a == null || b == null) return []
    const number = bondIndex.size + 1
    bondIndex.set(bond.id, number)
    const fields = [`${number}`, `${bond.order}`, `${a}`, `${b}`]
    // V3000's CFG: 1 wedge, 2 either, 3 hash.
    const cfg = { 1: 1, 4: 2, 6: 3 }[bond.order === 1 ? stereoCode(bond.stereo) : 0]
    if (cfg != null) fields.push(`CFG=${cfg}`)
    return [fields.join(" ")]
  })
  const sgroups = sgroupItems(mol, brackets, index, bondIndex)
  const block = (name: string, items: string[]) => (items.length === 0 ? [] : [`BEGIN ${name}`, ...items, `END ${name}`])
  const items = [
    "BEGIN CTAB",
    `COUNTS ${atomItems.length} ${bondItems.length} ${sgroups.count} 0 0`,
    ...block("ATOM", atomItems),
    ...block("BOND", bondItems),
    ...block("SGROUP", sgroups.items),
    "END CTAB",
  ]
  const lines = [title, `  Structur${" ".repeat(10)}2D`, "", "  0  0  0     0  0            999 V3000", ...items.flatMap(itemLines), "M  END", ""]
  return lines.join("\n")
}
