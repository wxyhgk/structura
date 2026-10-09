import { BOND_LENGTH } from "../constants.ts"
import { elementMass, elementOf } from "../elements/index.ts"
import { kekulizeAromaticReport } from "../molecule/kekule.ts"
import { emptyMolecule } from "../molecule/graph.ts"
import type { Atom, Bond, Molecule } from "../types.ts"
import { validate, type Problem, type ProblemCode } from "../validate.ts"
import { CHARGE_CODES, PX_PER_ANGSTROM, R_GROUP_SYMBOLS, rGroupLabel, stereoFor } from "./codes.ts"

function int(text: string | undefined): number {
  const value = Number.parseInt((text ?? "").trim(), 10)
  return Number.isNaN(value) ? 0 : value
}

function float(text: string | undefined): number {
  const value = Number.parseFloat((text ?? "").trim())
  return Number.isFinite(value) ? value : 0
}

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
 * Reads one V2000 molfile (the part up to `M  END`). Atoms are numbered 1…n in file order.
 * Anything the editor cannot hold is dropped and reported rather than guessed at.
 */
export function readMolfile(text: string): { mol: Molecule; title: string; problems: Problem[] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const problems: Problem[] = []
  const note = (code: ProblemCode, message: string, severity: Problem["severity"] = "warning") =>
    problems.push({ code, severity, message })
  const title = (lines[0] ?? "").trim()
  const counts = lines[3] ?? ""
  if (counts.includes("V3000")) {
    note("bad-molfile", "V3000 molfiles are not supported yet", "error")
    return { mol: emptyMolecule(), title, problems }
  }
  const atomCount = int(counts.slice(0, 3))
  const bondCount = int(counts.slice(3, 6))
  if (atomCount < 0 || bondCount < 0) {
    note("bad-molfile", `the counts line says ${atomCount} atoms and ${bondCount} bonds`, "error")
    return { mol: emptyMolecule(), title, problems }
  }
  if (lines.length < 4 + atomCount + bondCount) {
    note("bad-molfile", `expected ${atomCount} atoms and ${bondCount} bonds but the file ends early`, "error")
    return { mol: emptyMolecule(), title, problems }
  }

  const atoms: Atom[] = []
  // R-group atoms still labelled from their symbol alone, which RGP or ISO lines may number.
  const unnumbered = new Set<number>()
  let depth = false
  for (let index = 0; index < atomCount; index++) {
    const line = lines[4 + index] ?? ""
    const symbol = line.slice(31, 34).trim()
    const atom: Atom = {
      id: index + 1,
      el: symbol,
      x: float(line.slice(0, 10)) * PX_PER_ANGSTROM,
      y: -float(line.slice(10, 20)) * PX_PER_ANGSTROM,
      charge: 0,
    }
    if (float(line.slice(20, 30)) !== 0) depth = true
    if (symbol === "D" || symbol === "T") {
      atom.el = "H"
      atom.isotope = symbol === "D" ? 2 : 3
    } else if (R_GROUP_SYMBOLS.has(symbol)) {
      atom.el = "C"
      atom.alias = rGroupLabel(int(line.slice(60, 63)))
      if (atom.alias === "R") unnumbered.add(index + 1)
    } else if (!elementOf(symbol)) {
      atom.el = "C"
      atom.alias = symbol
      note("unsupported-mol-feature", `atom ${index + 1} is "${symbol}", not an element; kept as a label on carbon`)
    }
    const massDifference = int(line.slice(34, 36))
    if (massDifference !== 0 && atom.isotope == null && !atom.alias) {
      const mass = Math.round(elementMass(atom.el)) + massDifference
      if (mass >= 1 && mass <= 999) atom.isotope = mass
      else note("bad-molfile", `atom ${index + 1} has a mass difference of ${massDifference}; ignored`)
    }
    const chargeCode = int(line.slice(36, 39))
    if (chargeCode === 4) note("unsupported-mol-feature", `atom ${index + 1} is a radical; radicals are not supported yet`)
    atom.charge = CHARGE_CODES[chargeCode] ?? 0
    atoms.push(atom)
  }

  const bonds: Bond[] = []
  let aromatic = false
  for (let index = 0; index < bondCount; index++) {
    const line = lines[4 + atomCount + index] ?? ""
    const a = int(line.slice(0, 3))
    const b = int(line.slice(3, 6))
    const type = int(line.slice(6, 9))
    const stereo = int(line.slice(9, 12))
    if (a < 1 || b < 1 || a > atomCount || b > atomCount || a === b) {
      note("bad-molfile", `bond ${index + 1} joins atoms ${a} and ${b}, which do not exist`, "error")
      continue
    }
    if (bonds.some((other) => (other.a === a && other.b === b) || (other.a === b && other.b === a))) {
      note("bad-molfile", `bond ${index + 1} repeats the bond between atoms ${a} and ${b}; kept the first`)
      continue
    }
    const bond: Bond = { id: index + 1, a, b, order: 1, stereo: "none" }
    if (type === 2 || type === 3) bond.order = type
    else if (type === 4) {
      bond.aromatic = true
      aromatic = true
    } else if (type !== 1) {
      note("unsupported-mol-feature", `bond ${index + 1} is a query bond (type ${type}); read as single`)
    }
    if (bond.order === 1 && !bond.aromatic) bond.stereo = stereoFor(stereo)
    else if (bond.order === 2 && stereo === 3) {
      note("unsupported-mol-feature", `bond ${index + 1} is a crossed double bond (either E or Z); drawn plain`)
    }
    bonds.push(bond)
  }

  // Property lines. CHG, RAD and ISO lines override the atom block, as the format says.
  let charges: Array<[number, number]> | null = null
  const sgroups = new Set<string>()
  for (let index = 4 + atomCount + bondCount; index < lines.length; index++) {
    const line = lines[index] ?? ""
    if (line.startsWith("M  END")) break
    if (line.startsWith("M  CHG")) charges = [...(charges ?? []), ...propertyPairs(line)]
    else if (line.startsWith("M  ISO")) {
      for (const [number, mass] of propertyPairs(line)) {
        const atom = atoms[number - 1]
        if (!atom) continue
        // RDKit writes the SMILES [1*] as an isotope on the R-group atom.
        if (unnumbered.has(number)) {
          atom.alias = rGroupLabel(mass)
          unnumbered.delete(number)
          continue
        }
        if (mass >= 1 && mass <= 999) atom.isotope = mass
        else note("bad-molfile", `atom ${number} has mass number ${mass}; ignored`)
      }
    } else if (line.startsWith("M  RGP")) {
      for (const [number, group] of propertyPairs(line)) {
        const atom = atoms[number - 1]
        if (atom && (!atom.alias || unnumbered.has(number))) atom.alias = rGroupLabel(group)
        unnumbered.delete(number)
      }
    } else if (line.startsWith("M  RAD")) {
      charges ??= []
      note("unsupported-mol-feature", "radicals (M  RAD) are not supported yet and were dropped")
    } else if (line.startsWith("A  ")) {
      const atom = atoms[int(line.slice(3, 6)) - 1]
      const label = (lines[index + 1] ?? "").trim()
      if (atom && label) {
        atom.alias = label
        unnumbered.delete(int(line.slice(3, 6)))
      }
      index++
    } else if (/^M {2}S(TY|LB|ST|AL|BL|SL|MT|DI|AP|CN|BV|DS|PA|NN)/.test(line)) {
      sgroups.add(line.slice(3, 6))
    } else if (line.startsWith("S  SKP")) {
      index += int(line.slice(6, 9))
    } else if (line.trim() !== "") {
      note("unsupported-mol-feature", `ignored "${line.slice(0, 6).trim()}" line`)
    }
  }
  if (charges) {
    for (const atom of atoms) atom.charge = 0
    for (const [number, charge] of charges) {
      const atom = atoms[number - 1]
      if (atom) atom.charge = charge
    }
  }
  if (sgroups.size > 0) {
    note("unsupported-mol-feature", "Sgroups (abbreviations, brackets) were ignored; their atoms are drawn out")
  }
  if (depth || (lines[1] ?? "").slice(20, 22) === "3D") {
    note("flattened-3d", "the file has 3D coordinates; they were projected onto the page")
  }
  if (atomCount > 1 && atoms.every((atom) => atom.x === 0 && atom.y === 0)) {
    note("missing-coordinates", "the file has no coordinates, so every atom sits on the same spot")
  }

  normaliseScale(atoms, bonds)
  bonds.forEach((bond, position) => {
    bond.id = position + 1
  })
  let mol: Molecule = { ...emptyMolecule(), atoms, bonds, nextAtomId: atomCount + 1, nextBondId: bonds.length + 1 }
  if (aromatic) {
    const kekulized = kekulizeAromaticReport(mol)
    mol = kekulized.mol
    if (kekulized.unresolved > 0) {
      note("aromatic-unresolved", "some aromatic bonds could not be given alternating single and double bonds")
    }
  }
  problems.push(...validate(mol))
  return { mol, title, problems }
}

