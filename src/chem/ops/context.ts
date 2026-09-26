import { elementOf } from "../elements/index.ts"
import { atomById, bondById } from "../molecule/graph.ts"
import type { HotTarget, Molecule } from "../types.ts"
import type { BondRef, Ref } from "./types.ts"

/** A mistake in the ops themselves; the batch is rejected with this message. */
export class OpError extends Error {}

/** What one op did: the new molecule, and where it leaves the hotspot (undefined keeps it). */
export type Step = { mol: Molecule; next?: HotTarget | null }

/** Resolves refs against the molecule as it is at this point in the batch. */
export type Context = {
  atom(ref: Ref): number
  bond(ref: BondRef): number
  name(as: string | undefined, id: number): void
  element(el: string): void
}

export function makeContext(current: () => Molecule, names: Record<string, number>): Context {
  const atom = (ref: Ref): number => {
    const id = typeof ref === "string" ? names[ref] : ref
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
      const found = mol.bonds.find((item) => (item.a === a && item.b === b) || (item.a === b && item.b === a))
      if (!found) throw new OpError(`atoms #${a} and #${b} are not bonded`)
      return found.id
    },
    name(as, id) {
      if (as == null) return
      if (as in names) throw new OpError(`the name "${as}" is already used in this batch`)
      names[as] = id
    },
    element(el) {
      if (!elementOf(el)) throw new OpError(`"${el}" is not an element symbol`)
    },
  }
}
