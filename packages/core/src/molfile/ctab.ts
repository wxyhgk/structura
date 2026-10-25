import type { Problem, ProblemCode } from "../validate.ts"
import type { SgroupRead } from "./sgroups.ts"

// A connection table as read from either molfile version, before it becomes a molecule. The
// V2000 and V3000 readers only parse; what the fields mean (R-groups, isotopes, Sgroups as
// brackets…) is worked out once, from this, so both versions read the same way.

/** One atom, numbered by its place in the table (from 1). Coordinates in ångströms, y up. */
export type CtabAtom = {
  symbol: string
  x: number
  y: number
  z: number
  charge: number
  /** 0 for none, else the files' code: 1 singlet, 2 doublet, 3 triplet. */
  radical: number
  /** A mass number given outright (V2000 `M  ISO`, V3000 MASS=). */
  mass?: number
  /** V2000's atom block mass difference from the element's usual mass. */
  massDifference?: number
  /** R-group number (V2000 `M  RGP`, V3000 RGROUPS=). */
  rGroup?: number
  /** Atom-atom mapping number; RDKit numbers its R-groups ([*:1]) with it. */
  map: number
  /** Label text (V2000 `A  ` lines). */
  alias?: string
}

/** One bond between atoms numbered as in the table; `type` and `stereo` use V2000's codes. */
export type CtabBond = { a: number; b: number; type: number; stereo: number }

export type Ctab = {
  atoms: CtabAtom[]
  bonds: CtabBond[]
  /** Sgroups by number, on atoms numbered as in the table. */
  sgroups: Map<number, SgroupRead>
}

export type Note = (code: ProblemCode, message: string, severity?: Problem["severity"]) => void

export function int(text: string | undefined): number {
  const value = Number.parseInt((text ?? "").trim(), 10)
  return Number.isNaN(value) ? 0 : value
}

export function float(text: string | undefined): number {
  const value = Number.parseFloat((text ?? "").trim())
  return Number.isFinite(value) ? value : 0
}
