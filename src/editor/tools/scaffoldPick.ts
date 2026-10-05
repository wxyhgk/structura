import { defaultEdge, defaultSite, scaffoldNamed } from "@structura/core/scaffolds"
import type { ScaffoldPick } from "./types.ts"

/** A scaffold as the template tool first takes it: its default site and fusing bond, as core decides them. */
export function defaultPick(name: string): ScaffoldPick {
  const scaffold = scaffoldNamed(name)
  if (!scaffold) throw new Error(`no scaffold "${name}"`)
  return { name, site: defaultSite(scaffold), edge: defaultEdge(scaffold) }
}
