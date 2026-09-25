import { BOND_LENGTH } from "./constants.ts"
import type { Molecule } from "./types.ts"

function pad3(value: number): string {
  return String(value).padStart(3, " ")
}

function fixed10(value: number): string {
  return value.toFixed(4).padStart(10, " ")
}

function chargeCode(charge: number): number {
  if (charge === 3) return 1
  if (charge === 2) return 2
  if (charge === 1) return 3
  if (charge === -1) return 5
  if (charge === -2) return 6
  if (charge === -3) return 7
  return 0
}

export function toMolfile(mol: Molecule, title = "结构式"): string {
  const index = new Map(mol.atoms.map((atom, position) => [atom.id, position + 1]))
  const lines = [
    title,
    "  diy-chem-draw",
    "",
    `${pad3(mol.atoms.length)}${pad3(mol.bonds.length)}  0  0  0  0  0  0  0  0999 V2000`,
  ]
  for (const atom of mol.atoms) {
    const x = (atom.x / BOND_LENGTH) * 1.5
    const y = (-atom.y / BOND_LENGTH) * 1.5
    const symbol = atom.el.padEnd(3, " ")
    const charge = String(chargeCode(atom.charge)).padStart(3, " ")
    lines.push(`${fixed10(x)}${fixed10(y)}${fixed10(0)} ${symbol} 0${charge}  0  0  0  0  0  0  0  0  0`)
  }
  for (const bond of mol.bonds) {
    const stereo = bond.stereo === "up" ? 1 : bond.stereo === "down" ? 6 : bond.stereo === "either" ? 4 : 0
    lines.push(
      `${pad3(index.get(bond.a) ?? 0)}${pad3(index.get(bond.b) ?? 0)}${pad3(bond.order)}${pad3(stereo)}  0  0  0`,
    )
  }
  lines.push("M  END", "")
  return lines.join("\n")
}
