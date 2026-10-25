import { BOND_LENGTH } from "../constants.ts"
import { elementMass, elementOf } from "../elements/index.ts"
import { kekulizeAromaticReport } from "../molecule/kekule.ts"
import { emptyMolecule } from "../molecule/graph.ts"
import type { Atom, Bond, Bracket, Molecule } from "../types.ts"
import { validate, type Problem } from "../validate.ts"
import { PX_PER_ANGSTROM, R_GROUP_SYMBOLS, rGroupLabel, stereoFor } from "./codes.ts"
import type { Ctab, CtabAtom, Note } from "./ctab.ts"
import { REPEAT_FIELD, repeatFrom, type SgroupRead } from "./sgroups.ts"
import { readV2000 } from "./v2000.ts"
import { readV3000 } from "./v3000.ts"

/**
 * Programs disagree on bond length (RDKit's CoordGen uses 1.0 Å, older depictions 1.5 Å),
 * so each record is scaled until its median bond is one editor bond.
 */
function normaliseScale(atoms: Atom[], bonds: Bond[]): void {
  const lengths = bonds
    .map((bond) => {
      const a = atoms[bond.a - 1]
      const b = atoms[bond.b - 1]
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
    })
    .filter((length) => length > 1e-3)
    .sort((a, b) => a - b)
  if (lengths.length === 0) return
  const factor = BOND_LENGTH / lengths[Math.floor(lengths.length / 2)]
  if (Math.abs(factor - 1) < 0.01) return
  for (const atom of atoms) {
    atom.x *= factor
    atom.y *= factor
  }
}

/** A key for a set of atom numbers, whatever their order. */
function atomsKey(atoms: readonly number[]): string {
  return [...atoms].sort((a, b) => a - b).join(",")
}

/**
 * Brackets from the Sgroups read: a repeat unit (SRU) or a generic group (GEN), on atoms
 * numbered as in the file (which are their ids). A repeat unit's range comes from the data
 * Sgroup written with it on the same atoms, else from its label. The types of any other
 * Sgroups go in `others`.
 */
function bracketsOf(sgroups: Map<number, SgroupRead>, atomCount: number, others: Set<string>): Bracket[] {
  const atomsOf = (sgroup: SgroupRead) => [...new Set(sgroup.atoms.filter((number) => number >= 1 && number <= atomCount))]
  const ranges = new Map<string, string>()
  for (const sgroup of sgroups.values()) {
    if (sgroup.type === "DAT" && sgroup.field === REPEAT_FIELD && sgroup.data != null) ranges.set(atomsKey(atomsOf(sgroup)), sgroup.data)
  }
  const brackets: Bracket[] = []
  for (const sgroup of sgroups.values()) {
    if (sgroup.type === "DAT" && sgroup.field === REPEAT_FIELD) continue
    const atoms = atomsOf(sgroup)
    if ((sgroup.type !== "SRU" && sgroup.type !== "GEN") || atoms.length === 0) {
      others.add(sgroup.type ?? "?")
      continue
    }
    const id = brackets.length + 1
    brackets.push(sgroup.type === "SRU" ? { id, atoms, kind: "repeat", repeat: repeatFrom(sgroup.label, ranges.get(atomsKey(atoms))) } : { id, atoms, kind: "group" })
  }
  return brackets
}

/** What a table's atom means to the editor: an element, an isotope, an R-group or a label. */
function atomOf(source: CtabAtom, number: number, note: Note): Atom {
  const { symbol } = source
  const atom: Atom = { id: number, el: symbol, x: source.x * PX_PER_ANGSTROM, y: -source.y * PX_PER_ANGSTROM, charge: source.charge }
  let mass = source.mass
  if (symbol === "D" || symbol === "T") {
    atom.el = "H"
    atom.isotope = symbol === "D" ? 2 : 3
  } else if (R_GROUP_SYMBOLS.has(symbol)) {
    // Numbered by the mapping field (RDKit's [*:2]), else the R-group number, else a mass
    // number (RDKit's [4*]); a bare one is plain R.
    atom.el = "C"
    if (source.map > 0) atom.alias = rGroupLabel(source.map)
    else if (source.rGroup != null) atom.alias = rGroupLabel(source.rGroup)
    else {
      atom.alias = rGroupLabel(mass ?? 0)
      mass = undefined
    }
  } else if (!elementOf(symbol)) {
    atom.el = "C"
    atom.alias = symbol
    note("unsupported-mol-feature", `atom ${number} is "${symbol}", not an element; kept as a label on carbon`)
  } else if (source.rGroup != null) {
    atom.alias = rGroupLabel(source.rGroup)
  }
  if (mass != null) {
    if (mass >= 1 && mass <= 999) atom.isotope = mass
    else note("bad-molfile", `atom ${number} has mass number ${mass}; ignored`)
  } else if (source.massDifference && atom.isotope == null && !atom.alias) {
    const isotope = Math.round(elementMass(atom.el)) + source.massDifference
    if (isotope >= 1 && isotope <= 999) atom.isotope = isotope
    else note("bad-molfile", `atom ${number} has a mass difference of ${source.massDifference}; ignored`)
  }
  if (source.radical !== 0) note("unsupported-mol-feature", `atom ${number} is a radical; radicals are not supported yet and were dropped`)
  if (source.alias) atom.alias = source.alias
  return atom
}

/** The table's bonds the editor can hold, numbered in file order; the rest are noted. */
function bondsOf(table: Ctab, note: Note): { bonds: Bond[]; aromatic: boolean } {
  const bonds: Bond[] = []
  let aromatic = false
  table.bonds.forEach(({ a, b, type, stereo }, index) => {
    const count = table.atoms.length
    if (a < 1 || b < 1 || a > count || b > count || a === b) {
      note("bad-molfile", `bond ${index + 1} joins atoms ${a} and ${b}, which do not exist`, "error")
      return
    }
    if (bonds.some((other) => (other.a === a && other.b === b) || (other.a === b && other.b === a))) {
      note("bad-molfile", `bond ${index + 1} repeats the bond between atoms ${a} and ${b}; kept the first`)
      return
    }
    const bond: Bond = { id: index + 1, a, b, order: 1, stereo: "none" }
    if (type === 2 || type === 3) bond.order = type
    else if (type === 4) {
      bond.aromatic = true
      aromatic = true
    } else if (type === 9 || type === 10) {
      note("unsupported-mol-feature", `bond ${index + 1} is a ${type === 9 ? "coordination" : "hydrogen"} bond; read as single`)
    } else if (type !== 1) {
      note("unsupported-mol-feature", `bond ${index + 1} is a query bond (type ${type}); read as single`)
    }
    if (bond.order === 1 && !bond.aromatic) bond.stereo = stereoFor(stereo)
    else if (bond.order === 2 && stereo === 3) {
      note("unsupported-mol-feature", `bond ${index + 1} is a crossed double bond (either E or Z); drawn plain`)
    }
    bonds.push(bond)
  })
  return { bonds, aromatic }
}

/**
 * Reads one molfile, V2000 or V3000 (the part up to `M  END`). Atoms are numbered 1…n in
 * file order. Repeat units (SRU) and generic groups (GEN) become brackets, on those numbers.
 * Anything the editor cannot hold is dropped and reported rather than guessed at.
 */
export function readMolfile(text: string): { mol: Molecule; title: string; problems: Problem[]; brackets?: Bracket[] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const problems: Problem[] = []
  const note: Note = (code, message, severity = "warning") => problems.push({ code, severity, message })
  const title = (lines[0] ?? "").trim()
  const table = (lines[3] ?? "").includes("V3000") ? readV3000(lines, note) : readV2000(lines, note)
  if (!table) return { mol: emptyMolecule(), title, problems }

  const atoms = table.atoms.map((atom, index) => atomOf(atom, index + 1, note))
  const { bonds, aromatic } = bondsOf(table, note)
  const others = new Set<string>()
  const brackets = bracketsOf(table.sgroups, atoms.length, others)
  if (others.size > 0) {
    note("unsupported-mol-feature", `Sgroups other than repeat units and groups (${[...others].join(", ")}: abbreviations and the like) were ignored; their atoms are drawn out`)
  }
  if (table.atoms.some((atom) => atom.z !== 0) || (lines[1] ?? "").slice(20, 22) === "3D") {
    note("flattened-3d", "the file has 3D coordinates; they were projected onto the page")
  }
  if (atoms.length > 1 && atoms.every((atom) => atom.x === 0 && atom.y === 0)) {
    note("missing-coordinates", "the file has no coordinates, so every atom sits on the same spot")
  }

  normaliseScale(atoms, bonds)
  bonds.forEach((bond, position) => {
    bond.id = position + 1
  })
  let mol: Molecule = { ...emptyMolecule(), atoms, bonds, nextAtomId: atoms.length + 1, nextBondId: bonds.length + 1 }
  if (aromatic) {
    const kekulized = kekulizeAromaticReport(mol)
    mol = kekulized.mol
    if (kekulized.unresolved > 0) {
      note("aromatic-unresolved", "some aromatic bonds could not be given alternating single and double bonds")
    }
  }
  problems.push(...validate(mol))
  return { mol, title, problems, ...(brackets.length > 0 ? { brackets } : {}) }
}
