import { bracketsWithin } from "@structura/core/drawing"
import { subMolecule } from "@structura/core/molecule"
import type { Drawing } from "@structura/core/types"
import { isVariableName } from "@structura/core/markush"

/**
 * The separate generic formulas on a drawing: pieces held together by bonds or by a variable
 * attachment's line, that carry a variable, an attachment or a repeat unit [ … ]n. A plain
 * piece with a charge of its own (a counter-ion: Na⁺ beside a carboxylate, Cl⁻ beside an
 * ammonium) goes with the nearest formula, so its salts keep it; other plain molecules beside
 * them are no part of any formula. A drawing with none of these at all is one "formula",
 * itself. Each formula keeps the brackets wholly on its atoms.
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
  for (const atom of mol.atoms) pieces.set(root(atom.id), [...(pieces.get(root(atom.id)) ?? []), atom.id])
  const atomOf = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  for (const [piece, ids] of [...pieces]) {
    if (marked.has(piece)) continue
    pieces.delete(piece)
    if (ids.reduce((sum, id) => sum + atomOf.get(id)!.charge, 0) === 0) continue
    // An ion: to the formula with the atom closest to any of its atoms.
    let nearest: { piece: number; distance: number } | null = null
    for (const formula of marked)
      for (const id of pieces.get(formula) ?? [])
        for (const own of ids) {
          const distance = Math.hypot(atomOf.get(id)!.x - atomOf.get(own)!.x, atomOf.get(id)!.y - atomOf.get(own)!.y)
          if (!nearest || distance < nearest.distance) nearest = { piece: formula, distance }
        }
    if (nearest) pieces.set(nearest.piece, [...pieces.get(nearest.piece)!, ...ids])
  }
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
