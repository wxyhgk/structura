import type { BondOrder } from "../types.ts"

/**
 * An abbreviation such as Ph or Boc, laid out by RDKit ahead of time. atoms[0] is the
 * anchor, which sits at the origin; every attachment bond leaves the anchor, and the
 * first one points left along -x. Coordinates are editor pixels.
 */
export type GroupTemplate = {
  label: string
  synonyms: string[]
  /** How the label reads when the group hangs off the left end of a bond, such as MeO. */
  labelLeft?: string
  attachments: number
  /** Hill formula of the group itself, with any net charge, for example C6H5. */
  formula: string
  atoms: Array<{ el: string; x: number; y: number; charge?: number; isotope?: number }>
  bonds: Array<[number, number, BondOrder]>
}
