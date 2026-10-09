import type { Drawing, Molecule } from "@structura/core/types"

/**
 * How a drawing from outside (a recognized picture) joins the page: on an empty page the
 * whole drawing goes in, variable attachments too; beside a drawing, only its molecule.
 */
export function placeDrawing(page: Drawing, incoming: Drawing): { load: Drawing } | { append: Molecule } {
  return page.molecule.atoms.length === 0 && page.arrows.length === 0 ? { load: incoming } : { append: incoming.molecule }
}
