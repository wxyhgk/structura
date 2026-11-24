import type { Drawing } from "@structura/core/types"
import { DEFAULT_LIMIT } from "./progressText.ts"

/** How a formula is expanded: what the document says, else these. */
export type GenerationOptions = { representatives: boolean; dedupe: boolean; limit: number; order: "first" | "spread" }

export const DEFAULT_GENERATION: GenerationOptions = { representatives: true, dedupe: true, limit: DEFAULT_LIMIT, order: "spread" }

/** The drawing's generation settings with the defaults for what it leaves out. */
export function generationOf(drawing: Drawing): GenerationOptions {
  return { ...DEFAULT_GENERATION, ...drawing.generation }
}
