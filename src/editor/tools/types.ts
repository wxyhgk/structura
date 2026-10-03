/** The drawing tool picked in the palette or by a tool key. */
export type ToolId =
  | "lasso"
  | "marquee"
  | "bond"
  | "chain"
  | "ring"
  | "eraser"
  | "charge-plus"
  | "charge-minus"
  | "atom"
  /** Places a scaffold template (see ScaffoldPick). */
  | "scaffold"

/**
 * The scaffold the template tool places, and how: clicking empty canvas puts it there,
 * clicking an atom joins it there by `site` ("N9"), clicking a bond fuses it by `edge` ("b").
 */
export type ScaffoldPick = { name: string; site: string; edge: string }

export const DEFAULT_SCAFFOLD: ScaffoldPick = { name: "benzene", site: "C1", edge: "a" }
