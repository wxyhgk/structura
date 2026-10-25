import { CHARGE_CODES } from "./codes.ts"
import { float, int, type Ctab, type CtabAtom, type Note } from "./ctab.ts"
import { readSgroupLine, type SgroupRead } from "./sgroups.ts"

/** Pairs of (atom number, value) on an `M  CHG`-style line. */
function propertyPairs(line: string): Array<[number, number]> {
  const count = int(line.slice(6, 9))
  const pairs: Array<[number, number]> = []
  for (let index = 0; index < count; index++) {
    const start = 9 + index * 8
    pairs.push([int(line.slice(start, start + 4)), int(line.slice(start + 4, start + 8))])
  }
  return pairs
}

/**
 * The connection table of a V2000 molfile, split into lines (header included), or null when
 * the counts line does not fit the file. Lines it does not read are noted.
 */
export function readV2000(lines: string[], note: Note): Ctab | null {
  const counts = lines[3] ?? ""
  const atomCount = int(counts.slice(0, 3))
  const bondCount = int(counts.slice(3, 6))
  if (atomCount < 0 || bondCount < 0) {
    note("bad-molfile", `the counts line says ${atomCount} atoms and ${bondCount} bonds`, "error")
    return null
  }
  if (lines.length < 4 + atomCount + bondCount) {
    note("bad-molfile", `expected ${atomCount} atoms and ${bondCount} bonds but the file ends early`, "error")
    return null
  }

  const atoms: CtabAtom[] = []
  for (let index = 0; index < atomCount; index++) {
    const line = lines[4 + index] ?? ""
    const chargeCode = int(line.slice(36, 39))
    atoms.push({
      symbol: line.slice(31, 34).trim(),
      x: float(line.slice(0, 10)),
      y: float(line.slice(10, 20)),
      z: float(line.slice(20, 30)),
      // Code 4 is a doublet radical, which has no charge.
      charge: CHARGE_CODES[chargeCode] ?? 0,
      radical: chargeCode === 4 ? 2 : 0,
      massDifference: int(line.slice(34, 36)),
      map: int(line.slice(60, 63)),
    })
  }
  const bonds = lines.slice(4 + atomCount, 4 + atomCount + bondCount).map((line) => ({
    a: int(line.slice(0, 3)),
    b: int(line.slice(3, 6)),
    type: int(line.slice(6, 9)),
    stereo: int(line.slice(9, 12)),
  }))

  // Property lines. CHG and RAD lines replace the atom block's charges and radicals, as the format says.
  let charges: Array<[number, number]> | null = null
  let radicals: Array<[number, number]> = []
  const sgroups = new Map<number, SgroupRead>()
  for (let index = 4 + atomCount + bondCount; index < lines.length; index++) {
    const line = lines[index] ?? ""
    if (line.startsWith("M  END")) break
    if (line.startsWith("M  CHG")) charges = [...(charges ?? []), ...propertyPairs(line)]
    else if (line.startsWith("M  RAD")) {
      charges ??= []
      radicals = [...radicals, ...propertyPairs(line)]
    } else if (line.startsWith("M  ISO")) {
      for (const [number, mass] of propertyPairs(line)) {
        const atom = atoms[number - 1]
        if (atom) atom.mass = mass
      }
    } else if (line.startsWith("M  RGP")) {
      for (const [number, group] of propertyPairs(line)) {
        const atom = atoms[number - 1]
        if (atom) atom.rGroup = group
      }
    } else if (line.startsWith("A  ")) {
      const atom = atoms[int(line.slice(3, 6)) - 1]
      const label = (lines[index + 1] ?? "").trim()
      if (atom && label) atom.alias = label
      index++
    } else if (/^M {2}S(TY|LB|ST|AL|BL|SL|MT|DI|AP|CN|BV|DS|PA|NN|DT|DD|CD|ED|PL)/.test(line)) {
      // The rest (labels, bonds, bracket corners…) are worked out again from the atoms.
      readSgroupLine(line, sgroups)
    } else if (line.startsWith("S  SKP")) {
      index += int(line.slice(6, 9))
    } else if (line.trim() !== "") {
      note("unsupported-mol-feature", `ignored "${line.slice(0, 6).trim()}" line`)
    }
  }
  if (charges) {
    for (const atom of atoms) {
      atom.charge = 0
      atom.radical = 0
    }
    for (const [number, charge] of charges) {
      const atom = atoms[number - 1]
      if (atom) atom.charge = charge
    }
    for (const [number, radical] of radicals) {
      const atom = atoms[number - 1]
      if (atom) atom.radical = radical
    }
  }
  return { atoms, bonds, sgroups }
}
