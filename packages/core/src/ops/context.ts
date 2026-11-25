import { elementOf } from "../elements/index.ts"
import { atomById, bondBetween, bondById } from "../molecule/graph.ts"
import type { HotTarget, Molecule } from "../types.ts"
import type { BondRef, Ref } from "./types.ts"

/** A mistake in the ops themselves; the batch is rejected with this message. */
export class OpError extends Error {}

/** `value` when it is one of `allowed`; otherwise the op is refused, naming `what` it should be. */
export function oneOf<T>(value: unknown, allowed: readonly T[], what: string): T {
  if (!allowed.includes(value as T)) throw new OpError(`${what} must be ${allowed.map((item) => JSON.stringify(item)).join(" or ")}, not ${JSON.stringify(value)}`)
  return value as T
}

/** What one op did: the new molecule, and where it leaves the hotspot (undefined keeps it). */
export type Step = { mol: Molecule; next?: HotTarget | null }

/** Resolves refs against the molecule as it is at this point in the batch. */
export type Context = {
  atom(ref: Ref): number
  bond(ref: BondRef): number
  name(as: string | undefined, id: number): void
  element(el: string): void
}

/** `names` maps the batch's `as` names to atom ids; a Map, so "constructor" or "__proto__" is a name like any other. */
export function makeContext(current: () => Molecule, names: Map<string, number>): Context {
  const atom = (ref: Ref): number => {
    const id = typeof ref === "string" ? names.get(ref) : ref
    if (id == null) throw new OpError(`no atom is named "${ref}" yet`)
    if (!atomById(current(), id)) throw new OpError(`atom #${id} does not exist`)
    return id
  }
  return {
    atom,
    bond(ref) {
      const mol = current()
      if (typeof ref === "number") {
        if (!bondById(mol, ref)) throw new OpError(`bond #${ref} does not exist`)
        return ref
      }
      const [a, b] = ref.between.map(atom)
      const found = bondBetween(mol, a, b)
      if (!found) throw new OpError(`atoms #${a} and #${b} are not bonded`)
      return found.id
    },
    name(as, id) {
      if (as == null) return
      if (names.has(as)) throw new OpError(`the name "${as}" is already used in this batch`)
      names.set(as, id)
    },
    element(el) {
      if (!elementOf(el)) throw new OpError(`"${el}" is not an element symbol`)
    },
  }
}
