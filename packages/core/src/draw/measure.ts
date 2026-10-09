let measureContext: CanvasRenderingContext2D | null | undefined

/**
 * Arial's advance widths for the printable ASCII characters (space to ~), in thousandths of
 * the font size: what text measures where there is no canvas to ask (an export made outside
 * a browser), so labels are spaced as on screen and a subscript never runs into its letter.
 */
const ARIAL = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]

/** A character's width in thousandths of the font size: Arial's, a full em for CJK, else about a digit's. */
function widthOf(char: string): number {
  const code = char.codePointAt(0)!
  if (code >= 32 && code <= 126) return ARIAL[code - 32]
  return code >= 0x2e80 ? 1000 : 580
}

export function measureText(text: string, size: number): number {
  if (measureContext === undefined && typeof document !== "undefined") {
    measureContext = document.createElement("canvas").getContext("2d")
  }
  if (measureContext) {
    measureContext.font = `${size}px Arial, Helvetica, sans-serif`
    return measureContext.measureText(text).width
  }
  let width = 0
  for (const char of text) width += widthOf(char)
  return (width * size) / 1000
}
