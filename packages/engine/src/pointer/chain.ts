import { BOND_LENGTH } from "@structura/core/constants"

/** How many bonds a chain-tool drag of this length draws: one at least, then one per zigzag step. */
export function chainCount(distance: number, length = BOND_LENGTH): number {
  const step = length * Math.cos(Math.PI / 6)
  if (distance < length * 0.45) return 1
  return Math.max(1, Math.round(distance / step))
}
