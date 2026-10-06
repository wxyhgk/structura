import type { DrawOptions } from "@structura/core/draw"
import { isVariableName } from "@structura/markush"

/**
 * How the editor asks for labels to be written: with "raised numbers" on, a variable's
 * number goes up (R¹, Ar²) the way many patents print it; formulas (CO₂Me) stay low.
 * Used by the canvas and every export, so what is copied looks like what is seen.
 */
export function drawOptions(raisedNumbers: boolean): DrawOptions {
  return raisedNumbers ? { raiseNumbers: isVariableName } : {}
}
