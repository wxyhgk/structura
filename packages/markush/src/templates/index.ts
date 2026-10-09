import type { Template } from "./model.ts"
import { arylGroups } from "./aryl.ts"
import { classes } from "./classes.ts"
import { heteroarylGroups } from "./heteroaryl.ts"
import { linkers } from "./linkers.ts"
import { ringAtoms } from "./ringAtoms.ts"
import { saturatedGroups } from "./saturated.ts"
import { smallGroups } from "./small.ts"

// The templates that come with the app: read-only, the same for every user, kept in code so
// they change with the app's versions. The user's own templates live elsewhere (the backend).
// Each shelf (group) is a file of its own; ids are `builtin:<key>` and never change.

let shipped: Template[] | null = null

/** Every built-in template, in the order the library shows them: shelf by shelf. */
export function builtinTemplates(): Template[] {
  shipped ??= [...smallGroups(), ...arylGroups(), ...heteroarylGroups(), ...saturatedGroups(), ...linkers(), ...ringAtoms(), ...classes()]
  // A copy each time, so a caller that changes one cannot change the library.
  return structuredClone(shipped)
}
