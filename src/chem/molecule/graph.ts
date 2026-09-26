import type { Atom, Bond, BondStyle, Molecule, Point, Selection } from "../types.ts"

export function emptyMolecule(): Molecule {
  return { atoms: [], bonds: [], nextAtomId: 1, nextBondId: 1 }
}

export function cloneMolecule(mol: Molecule): Molecule {
  return {
    atoms: mol.atoms.map((atom) => ({ ...atom })),
    bonds: mol.bonds.map((bond) => ({ ...bond })),
    nextAtomId: mol.nextAtomId,
    nextBondId: mol.nextBondId,
  }
}

export function atomById(mol: Molecule, id: number): Atom | undefined {
  return mol.atoms.find((atom) => atom.id === id)
}

export function bondById(mol: Molecule, id: number): Bond | undefined {
  return mol.bonds.find((bond) => bond.id === id)
}

export function neighbors(mol: Molecule, id: number): Atom[] {
  const found: Atom[] = []
  for (const bond of mol.bonds) {
    const otherId = bond.a === id ? bond.b : bond.b === id ? bond.a : 0
    if (!otherId) continue
    const other = atomById(mol, otherId)
    if (other) found.push(other)
  }
  return found
}

export function bondOrderSum(mol: Molecule, id: number): number {
  let sum = 0
  for (const bond of mol.bonds) {
    if (bond.a === id || bond.b === id) sum += bond.order
  }
  return sum
}

export function addAtom(
  mol: Molecule,
  el: string,
  x: number,
  y: number,
  charge = 0,
): { mol: Molecule; id: number } {
  const next = cloneMolecule(mol)
  const id = next.nextAtomId++
  next.atoms.push({ id, el, x, y, charge })
  return { mol: next, id }
}

export function addBond(
  mol: Molecule,
  a: number,
  b: number,
  style: BondStyle,
  overwrite = true,
): { mol: Molecule; id: number } | null {
  if (a === b) return null
  const existing = mol.bonds.find(
    (bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a),
  )
  if (existing) {
    if (!overwrite) return { mol, id: existing.id }
    const next = cloneMolecule(mol)
    const bond = next.bonds.find((item) => item.id === existing.id)
    if (!bond) return null
    bond.order = style.order
    bond.stereo = style.order === 1 ? style.stereo : "none"
    // A wedge starts at `a`, so redrawing one follows the direction it was drawn in.
    if (bond.stereo !== "none") {
      bond.a = a
      bond.b = b
    }
    return { mol: next, id: existing.id }
  }
  const next = cloneMolecule(mol)
  const id = next.nextBondId++
  next.bonds.push({
    id,
    a,
    b,
    order: style.order,
    stereo: style.order === 1 ? style.stereo : "none",
  })
  return { mol: next, id }
}

export function paintBond(mol: Molecule, bondId: number, style: BondStyle): Molecule {
  const bond = bondById(mol, bondId)
  if (!bond) return mol
  if (style.order === 1 && style.stereo === "none" && bond.stereo === "none") {
    const order = bond.order === 1 ? 2 : bond.order === 2 ? 3 : 1
    return addBond(mol, bond.a, bond.b, { order, stereo: "none" })?.mol ?? mol
  }
  return addBond(mol, bond.a, bond.b, style)?.mol ?? mol
}

export function setBondOrder(mol: Molecule, bondIds: number[], order: 1 | 2 | 3): Molecule {
  const wanted = new Set(bondIds)
  const next = cloneMolecule(mol)
  for (const bond of next.bonds) {
    if (!wanted.has(bond.id)) continue
    bond.order = order
    if (order !== 1) bond.stereo = "none"
    if (order !== 2) bond.emphasis = undefined
  }
  return next
}

export function deleteSelection(mol: Molecule, selection: Selection): Molecule {
  const atoms = new Set(selection.atoms)
  const bonds = new Set(selection.bonds)
  const next = cloneMolecule(mol)
  next.bonds = next.bonds.filter(
    (bond) => !bonds.has(bond.id) && !atoms.has(bond.a) && !atoms.has(bond.b),
  )
  next.atoms = next.atoms.filter((atom) => !atoms.has(atom.id))
  return next
}

export function deleteHit(mol: Molecule, hit: { type: "atom"; id: number } | { type: "bond"; id: number }): Molecule {
  if (hit.type === "atom") return deleteSelection(mol, { atoms: [hit.id], bonds: [] })
  return deleteSelection(mol, { atoms: [], bonds: [hit.id] })
}

export function moveAtoms(mol: Molecule, ids: number[], dx: number, dy: number): Molecule {
  if (dx === 0 && dy === 0) return mol
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    atom.x += dx
    atom.y += dy
  }
  return next
}

export function atomIdsOfSelection(mol: Molecule, selection: Selection): number[] {
  const ids = new Set(selection.atoms)
  for (const id of selection.bonds) {
    const bond = bondById(mol, id)
    if (!bond) continue
    ids.add(bond.a)
    ids.add(bond.b)
  }
  return [...ids]
}

export function centroidOf(mol: Molecule, ids: number[]): Point | null {
  const atoms = ids.flatMap((id) => {
    const atom = atomById(mol, id)
    return atom ? [atom] : []
  })
  if (atoms.length === 0) return null
  return {
    x: atoms.reduce((sum, atom) => sum + atom.x, 0) / atoms.length,
    y: atoms.reduce((sum, atom) => sum + atom.y, 0) / atoms.length,
  }
}

export function boundsCenter(mol: Molecule, ids: number[]): Point | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let count = 0
  for (const id of ids) {
    const atom = atomById(mol, id)
    if (!atom) continue
    count += 1
    minX = Math.min(minX, atom.x)
    minY = Math.min(minY, atom.y)
    maxX = Math.max(maxX, atom.x)
    maxY = Math.max(maxY, atom.y)
  }
  if (count === 0) return null
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

export function scaleAtoms(mol: Molecule, ids: number[], center: Point, sx: number, sy: number): Molecule {
  if (ids.length === 0 || (sx === 1 && sy === 1)) return mol
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    atom.x = center.x + (atom.x - center.x) * sx
    atom.y = center.y + (atom.y - center.y) * sy
  }
  if ((sx < 0) !== (sy < 0)) {
    for (const bond of next.bonds) {
      if (!wanted.has(bond.a) || !wanted.has(bond.b)) continue
      if (bond.stereo === "up") bond.stereo = "down"
      else if (bond.stereo === "down") bond.stereo = "up"
    }
  }
  return next
}

export function rotateAtoms(mol: Molecule, ids: number[], center: Point, angle: number): Molecule {
  if (angle === 0 || ids.length === 0) return mol
  const wanted = new Set(ids)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    const dx = atom.x - center.x
    const dyUp = -(atom.y - center.y)
    const rx = dx * cos - dyUp * sin
    const ry = dx * sin + dyUp * cos
    atom.x = center.x + rx
    atom.y = center.y - ry
  }
  return next
}

export function flipAtoms(mol: Molecule, ids: number[], axis: "horizontal" | "vertical"): Molecule {
  const center = centroidOf(mol, ids)
  if (!center || ids.length === 0) return mol
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    if (axis === "horizontal") atom.x = center.x * 2 - atom.x
    else atom.y = center.y * 2 - atom.y
  }
  for (const bond of next.bonds) {
    if (!wanted.has(bond.a) || !wanted.has(bond.b)) continue
    if (bond.stereo === "up") bond.stereo = "down"
    else if (bond.stereo === "down") bond.stereo = "up"
  }
  return next
}

export function setElement(mol: Molecule, ids: number[], el: string): Molecule {
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    atom.el = el
    atom.alias = undefined
    atom.hydrogens = undefined
  }
  return next
}

export function setAlias(mol: Molecule, id: number, alias: string | undefined): Molecule {
  const next = cloneMolecule(mol)
  const atom = next.atoms.find((item) => item.id === id)
  if (!atom) return mol
  atom.alias = alias
  return next
}

export function setHydrogens(mol: Molecule, id: number, hydrogens: number): Molecule {
  const next = cloneMolecule(mol)
  const atom = next.atoms.find((item) => item.id === id)
  if (!atom) return mol
  atom.hydrogens = hydrogens
  return next
}

export function bumpCharge(mol: Molecule, ids: number[], delta: number): Molecule {
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    atom.charge = Math.max(-3, Math.min(3, atom.charge + delta))
  }
  return next
}

export function selectAll(mol: Molecule): Selection {
  return {
    atoms: mol.atoms.map((atom) => atom.id),
    bonds: mol.bonds.map((bond) => bond.id),
  }
}

export function emptySelection(): Selection {
  return { atoms: [], bonds: [] }
}

export function selectionFromAtoms(mol: Molecule, atomIds: number[]): Selection {
  const set = new Set(atomIds)
  return {
    atoms: atomIds,
    bonds: mol.bonds.filter((bond) => set.has(bond.a) && set.has(bond.b)).map((bond) => bond.id),
  }
}

export function dragIds(
  mol: Molecule,
  selection: Selection,
  hit: { type: "atom"; id: number } | { type: "bond"; id: number },
): number[] {
  if (hit.type === "atom") {
    if (selection.atoms.includes(hit.id)) return [...selection.atoms]
    return [hit.id]
  }
  const bond = bondById(mol, hit.id)
  if (!bond) return []
  if (selection.bonds.includes(hit.id) || selection.atoms.includes(bond.a) || selection.atoms.includes(bond.b)) {
    return [...new Set([...selection.atoms, bond.a, bond.b])]
  }
  return [bond.a, bond.b]
}

export function setBondLook(mol: Molecule, bondId: number, style: BondStyle): Molecule {
  const next = cloneMolecule(mol)
  const bond = next.bonds.find((item) => item.id === bondId)
  if (!bond) return mol
  bond.order = style.order
  bond.stereo = style.order === 1 ? style.stereo : "none"
  bond.emphasis = style.order === 2 ? style.emphasis : undefined
  bond.aromatic = undefined
  return next
}

export function componentOf(mol: Molecule, atomId: number): number[] {
  const seen = new Set<number>([atomId])
  const queue = [atomId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current == null) continue
    for (const neighbor of neighbors(mol, current)) {
      if (seen.has(neighbor.id)) continue
      seen.add(neighbor.id)
      queue.push(neighbor.id)
    }
  }
  return [...seen]
}

export function tumbleAtoms(
  mol: Molecule,
  ids: number[],
  center: Point,
  axis: "x" | "y",
  angle: number,
): Molecule {
  if (angle === 0 || ids.length === 0) return mol
  const wanted = new Set(ids)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    const z = atom.z ?? 0
    if (axis === "x") {
      const yUp = -(atom.y - center.y)
      const yNext = yUp * cos - z * sin
      atom.z = yUp * sin + z * cos
      atom.y = center.y - yNext
    } else {
      const x = atom.x - center.x
      atom.x = center.x + x * cos - z * sin
      atom.z = x * sin + z * cos
    }
  }
  return next
}
