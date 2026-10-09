import type { Alternative } from "@structura/core/types"

/** Whether two alternatives (or choices) are the same, field for field. */
export const sameAlternative = (a: Alternative, b: Alternative): boolean => JSON.stringify(a) === JSON.stringify(b)
