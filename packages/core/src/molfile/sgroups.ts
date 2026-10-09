import { BOND_LENGTH } from "../constants.ts"
import { DEFAULT_REPEAT } from "../drawing/brackets.ts"
import type { Repeat } from "../markush/types.ts"
import type { Bracket, Molecule } from "../types.ts"
import { ANGSTROM_PER_PX } from "./codes.ts"

// Brackets as V2000 Sgroups: a repeat unit is an SRU (its count's name as the label, the
// bonds that cross it, head-to-tail), a group a GEN. Each gets its two brackets' corners
// (M  SDI) for programs that draw them as given. The SRU label is only the name (n, as
// other programs show it), so its range goes alongside as a data Sgroup on the same atoms:
// field STRUCTURA_REPEAT, value such as 1-4. Programs that do not know the field keep it as
// data and still open the file.

/** The data field that carries a repeat unit's range. */
export const REPEAT_FIELD = "STRUCTURA_REPEAT"

/** How far the written brackets stand off the atoms, in bond lengths. */
const PAD = 0.35

function pad3(value: number): string {
  return String(value).padStart(3, " ")
}

function fixed10(value: number): string {
  return (Object.is(value, -0) ? 0 : value).toFixed(4).padStart(10, " ")
}

/** `M  SAL`-style lines: the Sgroup, then up to 15 numbers a line. */
function listLines(tag: string, sgroup: number, numbers: number[]): string[] {
  const lines: string[] = []
  for (let start = 0; start < numbers.length; start += 15) {
    const chunk = numbers.slice(start, start + 15)
    lines.push(`M  ${tag} ${pad3(sgroup)}${pad3(chunk.length)}${chunk.map((number) => ` ${pad3(number)}`).join("")}`)
  }
  return lines
}

/** `M  STY`-style lines: (Sgroup, three-letter value) pairs, eight a line. */
function pairLines(tag: string, pairs: Array<[number, string]>): string[] {
  const lines: string[] = []
  for (let start = 0; start < pairs.length; start += 8) {
    const chunk = pairs.slice(start, start + 8)
    lines.push(`M  ${tag}${pad3(chunk.length)}${chunk.map(([sgroup, value]) => ` ${pad3(sgroup)} ${value.padEnd(3, " ")}`).join("")}`)
  }
  return lines
}

/**
 * The property lines for `brackets` in a molfile whose atoms are numbered by `atomIndex`
 * and bonds by `bondIndex` (file numbers, from 1). Brackets with an atom not in the file
 * are left out.
 */
export function sgroupLines(mol: Molecule, brackets: readonly Bracket[], atomIndex: ReadonlyMap<number, number>, bondIndex: ReadonlyMap<number, number>): string[] {
  const written = brackets.filter((bracket) => bracket.atoms.length > 0 && bracket.atoms.every((id) => atomIndex.has(id)))
  if (written.length === 0) return []
  // Each repeat unit's range is one more Sgroup, numbered after the brackets.
  const ranged = written.filter((bracket) => bracket.kind === "repeat")
  const lines = pairLines("STY", [
    ...written.map((bracket, index): [number, string] => [index + 1, bracket.kind === "repeat" ? "SRU" : "GEN"]),
    ...ranged.map((_bracket, index): [number, string] => [written.length + index + 1, "DAT"]),
  ])
  const atoms = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  const heads: Array<[number, string]> = []
  const data: string[] = []
  written.forEach((bracket, index) => {
    const sgroup = index + 1
    const inside = new Set(bracket.atoms)
    lines.push(...listLines("SAL", sgroup, bracket.atoms.map((id) => atomIndex.get(id)!)))
    if (bracket.kind === "repeat") {
      const crossing = mol.bonds.filter((bond) => inside.has(bond.a) !== inside.has(bond.b)).flatMap((bond) => bondIndex.get(bond.id) ?? [])
      if (crossing.length > 0) lines.push(...listLines("SBL", sgroup, crossing))
      lines.push(`M  SMT ${pad3(sgroup)} ${bracket.repeat?.name ?? DEFAULT_REPEAT.name}`)
      heads.push([sgroup, "HT"])
    }
    // Upright brackets just clear of the atoms, in ångströms with y up.
    const points = bracket.atoms.map((id) => atoms.get(id)!)
    const pad = PAD * BOND_LENGTH
    const left = (Math.min(...points.map((atom) => atom.x)) - pad) * ANGSTROM_PER_PX
    const right = (Math.max(...points.map((atom) => atom.x)) + pad) * ANGSTROM_PER_PX
    const top = -(Math.min(...points.map((atom) => atom.y)) - pad) * ANGSTROM_PER_PX
    const bottom = -(Math.max(...points.map((atom) => atom.y)) + pad) * ANGSTROM_PER_PX
    for (const x of [left, right]) lines.push(`M  SDI ${pad3(sgroup)}  4${fixed10(x)}${fixed10(bottom)}${fixed10(x)}${fixed10(top)}`)
    if (bracket.kind === "repeat") {
      // The range, as text, shown (by programs that show data) just past the count's name.
      const repeat = bracket.repeat ?? DEFAULT_REPEAT
      const number = written.length + ranged.indexOf(bracket) + 1
      data.push(...listLines("SAL", number, bracket.atoms.map((id) => atomIndex.get(id)!)))
      data.push(`M  SDT ${pad3(number)} ${REPEAT_FIELD.padEnd(30, " ")}T`)
      data.push(`M  SDD ${pad3(number)} ${fixed10(right + 0.3)}${fixed10(bottom - 0.3)}    DA    ALL  1       5`)
      data.push(`M  SED ${pad3(number)} ${repeat.min}-${repeat.max}`)
    }
  })
  lines.push(...pairLines("SCN", heads), ...data)
  return lines
}

/**
 * One Sgroup as read so far: its type and atoms (file numbers), its label, and for a data
 * Sgroup its field's name and value.
 */
export type SgroupRead = { type?: string; atoms: number[]; label?: string; field?: string; data?: string }

/**
 * Takes in an Sgroup property line (STY, SAL, SMT, and SDT, SCD, SED for data; the others
 * are worked out again from the atoms) into `sgroups`, by Sgroup number. Returns false for
 * a line it does not read.
 */
export function readSgroupLine(line: string, sgroups: Map<number, SgroupRead>): boolean {
  const int = (text: string) => Number.parseInt(text.trim(), 10) || 0
  const sgroup = (number: number) => {
    if (!sgroups.has(number)) sgroups.set(number, { atoms: [] })
    return sgroups.get(number)!
  }
  const tag = line.slice(3, 6)
  if (tag === "STY") {
    const count = int(line.slice(6, 9))
    for (let index = 0; index < count; index++) {
      const start = 9 + index * 8
      sgroup(int(line.slice(start, start + 4))).type = line.slice(start + 5, start + 8).trim()
    }
    return true
  }
  if (tag === "SAL") {
    const count = int(line.slice(10, 13))
    const read = sgroup(int(line.slice(6, 10)))
    for (let index = 0; index < count; index++) read.atoms.push(int(line.slice(13 + index * 4, 17 + index * 4)))
    return true
  }
  if (tag === "SMT") {
    sgroup(int(line.slice(6, 10))).label = line.slice(11).trim()
    return true
  }
  if (tag === "SDT") {
    sgroup(int(line.slice(6, 10))).field = line.slice(11, 41).trim()
    return true
  }
  // SCD lines carry a long value in pieces of 69, SED the last piece.
  if (tag === "SCD" || tag === "SED") {
    const read = sgroup(int(line.slice(6, 10)))
    read.data = (read.data ?? "") + (tag === "SCD" ? line.slice(11, 80) : line.slice(11).trimEnd())
    return true
  }
  return false
}

/**
 * A repeat unit's count from its label and, when the file has one, the range written with
 * it (REPEAT_FIELD): the range from there, the name from the label.
 */
export function repeatFrom(label: string | undefined, range: string | undefined): Repeat {
  const named = repeatFromLabel(label)
  const ranged = range == null ? null : /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(range)
  if (!ranged || Number(ranged[1]) > Number(ranged[2])) return named
  return { ...named, min: Number(ranged[1]), max: Number(ranged[2]) }
}

/**
 * A repeat unit's count from its label: a name such as n, or a range such as 1-4 (as
 * other programs write it), which is then called n. Anything else counts n = 1–4.
 */
export function repeatFromLabel(label: string | undefined): Repeat {
  const text = (label ?? "").trim()
  if (/^[a-z]\d{0,2}'?$/.test(text)) return { ...DEFAULT_REPEAT, name: text }
  const range = /^(\d+)\s*-\s*(\d+)$/.exec(text)
  if (range && Number(range[1]) <= Number(range[2])) return { ...DEFAULT_REPEAT, min: Number(range[1]), max: Number(range[2]) }
  const one = /^\d+$/.exec(text)
  if (one) return { ...DEFAULT_REPEAT, min: Number(text), max: Number(text) }
  return { ...DEFAULT_REPEAT }
}
