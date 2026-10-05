/**
 * The preset zoom levels the zoom buttons, menu and ⌘+ / ⌘− step through, as ChemDraw
 * does; the wheel and pinch zoom smoothly in between. The ends match clampZoom.
 */
export const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const

/** Zooms within a hair of a preset count as on it, so a step never lands on the same level. */
const TOLERANCE = 0.005

/**
 * The next preset above (direction 1) or below (−1) the current zoom, from any zoom the
 * wheel left it at; the end preset once past the last one.
 */
export function steppedZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_LEVELS.find((level) => level > current * (1 + TOLERANCE)) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
  return ZOOM_LEVELS.findLast((level) => level < current * (1 - TOLERANCE)) ?? ZOOM_LEVELS[0]
}
