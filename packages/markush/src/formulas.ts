import { bracketsWithin } from "@structura/core/drawing"
import { subMolecule } from "@structura/core/molecule"
import type { Drawing } from "@structura/core/types"
import { isVariableName } from "@structura/core/markush"

/**
 * The separate generic formulas on a drawing: pieces held together by bonds or by a variable
 * attachment's line, that carry a variable, an attachment or a repeat unit [ … ]n. Plain
 * molecules beside them are no part of any formula. A drawing with none of these at all is
 * one "formula", itself. Each formula keeps the brackets wholly on its atoms.
 */
export function formulasOf(drawing: Drawing): Drawing[] {
  const mol = drawing.molecule
  const parent = new Map(mol.atoms.map((atom) => [atom.id, atom.id]))
  const root = (id: number): number => {
    let at = id
    while (parent.get(at) !== at) at = parent.get(at)!
    parent.set(id, at)
    return at
  }
  const join = (a: number, b: number) => parent.has(a) && parent.has(b) && parent.set(root(a), root(b))
  for (const bond of mol.bonds) join(bond.a, bond.b)
  for (const attachment of drawing.attachments ?? []) for (const id of attachment.to) join(attachment.atom, id)
  const names = new Set(Object.keys(drawing.variables ?? {}))
  const marked = new Set([
    ...mol.atoms.filter((atom) => atom.alias && (names.has(atom.alias) || isVariableName(atom.alias))).map((atom) => root(atom.id)),
    ...(drawing.attachments ?? []).map((attachment) => root(attachment.atom)),
    ...(drawing.brackets ?? []).flatMap((bracket) => (bracket.kind === "repeat" && parent.has(bracket.atoms[0]) ? [root(bracket.atoms[0])] : [])),
  ])
  if (marked.size === 0) return [drawing]
  const pieces = new Map<number, number[]>()
  for (const atom of mol.atoms) if (marked.has(root(atom.id))) pieces.set(root(atom.id), [...(pieces.get(root(atom.id)) ?? []), atom.id])
  return [...pieces.values()].map((ids) => {
    const { brackets: _all, ...rest } = drawing
    const brackets = bracketsWithin(drawing.brackets, ids)
    return {
      ...rest,
      molecule: subMolecule(mol, ids),
      arrows: [],
      attachments: drawing.attachments?.filter((attachment) => ids.includes(attachment.atom)),
      ...(brackets.length > 0 ? { brackets } : {}),
    }
  })
}
