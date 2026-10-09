import { BOND_LENGTH } from "../constants.ts"
import type { BondStereo } from "../types.ts"

/** MOL files use ångströms with y pointing up; a C–C bond is about 1.5 Å. */
export const ANGSTROM_PER_PX = 1.5 / BOND_LENGTH
export const PX_PER_ANGSTROM = BOND_LENGTH / 1.5

/** The atom block's charge field: code → charge. 4 is a radical, which has no charge. */
export const CHARGE_CODES: Record<number, number> = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 }

/** The bond block's stereo field for single bonds; anything else is "none" (0). */
const STEREO_CODES: ReadonlyArray<[BondStereo, number]> = [
  ["up", 1],
  ["down", 6],
  ["either", 4],
]

export function stereoCode(stereo: BondStereo): number {
  return STEREO_CODES.find(([name]) => name === stereo)?.[1] ?? 0
}

export function stereoFor(code: number): BondStereo {
  return STEREO_CODES.find(([, value]) => value === code)?.[0] ?? "none"
}

/** R, R1, R12…: an R-group, written as R# with its number in an `M  RGP` line. */
export function rGroupNumber(label: string): number | null {
  const match = /^R(\d{0,2})$/.exec(label)
  return match ? Number(match[1] || 1) : null
}

/** The label for R-group `number`; 0 (unnumbered) is plain R. */
export function rGroupLabel(number: number): string {
  return number > 0 ? `R${number}` : "R"
}

/**
 * Atom symbols other programs use for an R-group: R# (numbered by an `M  RGP` line), and
 * R or * as RDKit writes `[*:1]`, numbered by the atom-atom mapping field. They become a
 * labelled carbon, the same as typing R1 on an atom; a bare one is plain R.
 */
export const R_GROUP_SYMBOLS = new Set(["R#", "R", "*"])
