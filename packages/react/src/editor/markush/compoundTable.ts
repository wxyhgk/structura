import { toCdxml, toCdxmlTable } from "@structura/core/cdxml"
import { emptyDrawing } from "@structura/core/drawing"
import { molecularWeight, plainFormula } from "@structura/core/formula"
import { bondLengthAt, componentOf, untangleGroups } from "@structura/core/molecule"
import { applyOps } from "@structura/core/ops"
import type { Molecule } from "@structura/core/types"
import type { ZipEntry } from "../zip.ts"
import { rowFields, rowName, type Row } from "./results.ts"

// Generated compounds as a patent's table of compounds: the structures drawn in full (no Ph,
// OMe…), a salt's ions side by side, one bond length throughout, each under its number. Two forms: table.cdxml, the whole
// table in one ChemDraw document; and a package for building the table elsewhere (chem2office
// makes it a Word table of editable ChemDraw objects): manifest.json, compounds.csv and a
// CDXML file per compound. The package's format, "structura-compound-table" version 1:
//
//   manifest.json  { format, version: 1, source, columns, compounds: [{ id, file, smiles?,
//                  formula, mw, fields }] }, compounds in the table's order. `file` is the
//                  compound's CDXML; `fields` what each variable became (and "Formula No"
//                  when the drawing holds several formulas); `smiles` only when RDKit gave it.
//   compounds.csv  the same for people: 编号, 文件, SMILES, 分子式, 分子量, then the variables.
//   cdxml/<id>.cdxml   one compound each, ACS 1996 (14.4 pt bonds), the formula's orientation.
//   table.cdxml    the table itself, `columns` to a row.

export const TABLE_FORMAT = "structura-compound-table"
export const TABLE_VERSION = 1

/**
 * The molecule as a patent draws it: every abbreviation shown in full. A template is placed
 * for its label, so drawn out two side by side can overlap (Bn beside Mes reads as a fused
 * ring); those groups are swung clear, the rest of the molecule staying where it is.
 */
export function drawnInFull(mol: Molecule): Molecule {
  const collapsed = mol.groups.filter((group) => group.collapsed).map((group) => group.id)
  if (collapsed.length === 0) return mol
  const expanded = applyOps({ ...emptyDrawing(), molecule: mol }, [{ op: "set_collapsed", collapsed: false }])
  return expanded.ok ? untangleGroups(expanded.drawing.molecule, collapsed) : mol
}

/** How far apart a salt's ions are drawn in a table, in bond lengths between the nearest atoms; and how far is too far. */
const ION_GAP = 1.4
const ION_TOO_FAR = 1.8
/** Closer than this to an atom of another fragment, a moved fragment would crowd it. */
const ION_CLEARANCE = 1

/**
 * A salt's other fragments (Na⁺, Cl⁻, a second ion…) next to the largest one, as a patent
 * draws them: each one moved straight towards the nearest atom already placed until it is
 * ION_GAP bond lengths away, or as near as it fits without crowding. Fragments drawn close
 * already stay where they are.
 */
export function ionsBeside(mol: Molecule): Molecule {
  const fragments: number[][] = []
  const seen = new Set<number>()
  for (const atom of mol.atoms) {
    if (seen.has(atom.id)) continue
    const ids = componentOf(mol, atom.id)
    for (const id of ids) seen.add(id)
    fragments.push(ids)
  }
  if (fragments.length < 2) return mol
  fragments.sort((a, b) => b.length - a.length)
  const bond = bondLengthAt(mol)
  const at = new Map(mol.atoms.map((atom) => [atom.id, { x: atom.x, y: atom.y }]))
  const placed = [...fragments[0]]
  for (const fragment of fragments.slice(1)) {
    let nearest = { from: placed[0], to: fragment[0], distance: Infinity }
    for (const from of placed)
      for (const to of fragment) {
        const distance = Math.hypot(at.get(to)!.x - at.get(from)!.x, at.get(to)!.y - at.get(from)!.y)
        if (distance < nearest.distance) nearest = { from, to, distance }
      }
    if (nearest.distance > ION_TOO_FAR * bond) {
      const from = at.get(nearest.from)!
      const to = at.get(nearest.to)!
      const direction = { x: (to.x - from.x) / nearest.distance, y: (to.y - from.y) / nearest.distance }
      for (let gap = ION_GAP * bond; gap < nearest.distance; gap += 0.25 * bond) {
        const shift = { x: from.x + direction.x * gap - to.x, y: from.y + direction.y * gap - to.y }
        const clear = fragment.every((id) => placed.every((other) => Math.hypot(at.get(id)!.x + shift.x - at.get(other)!.x, at.get(id)!.y + shift.y - at.get(other)!.y) >= ION_CLEARANCE * bond))
        if (!clear) continue
        for (const id of fragment) at.set(id, { x: at.get(id)!.x + shift.x, y: at.get(id)!.y + shift.y })
        break
      }
    }
    placed.push(...fragment)
  }
  return { ...mol, atoms: mol.atoms.map((atom) => ({ ...atom, ...at.get(atom.id)! })) }
}

/** A compound as the table draws it: abbreviations in full, a salt's ions side by side. */
export const tableMolecule = (mol: Molecule): Molecule => ionsBeside(drawnInFull(mol))

/** File names for the ids: what a file system takes, and no two alike. */
export function fileNames(ids: readonly string[]): string[] {
  const taken = new Set<string>()
  return ids.map((id) => {
    const base = id.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^\.+/, "_") || "compound"
    let name = base
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base}-${n}`
    taken.add(name.toLowerCase())
    return name
  })
}

/** The rows (numbered) as the table in one ChemDraw document. */
export function tableCdxml(rows: readonly Row[], columns: number): string {
  return toCdxmlTable(
    rows.map((row) => ({ molecule: tableMolecule(row.mol), caption: rowName(row) })),
    { columns },
  )
}

/** A CSV cell: quoted when it holds a comma, a quote or a line break. */
const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/**
 * The package's files for the rows (numbered, in the table's order). `smiles` gives each
 * compound's SMILES, or nothing when RDKit is not to hand; `source` names the document.
 */
export function compoundTableFiles(rows: readonly Row[], { columns, source, smiles }: { columns: number; source: string; smiles?: (mol: Molecule) => string | null }): ZipEntry[] {
  const names = fileNames(rows.map(rowName))
  const compounds = rows.map((row, index) => {
    const known = smiles?.(row.mol) ?? null
    return {
      id: rowName(row),
      file: `cdxml/${names[index]}.cdxml`,
      ...(known ? { smiles: known } : {}),
      formula: plainFormula(row.mol),
      mw: Number(molecularWeight(row.mol).toFixed(2)),
      fields: rowFields(row),
    }
  })
  const manifest = { format: TABLE_FORMAT, version: TABLE_VERSION, source, columns, compounds }
  const variables: string[] = []
  for (const compound of compounds) for (const name of Object.keys(compound.fields)) if (!variables.includes(name)) variables.push(name)
  const csv = [
    ["编号", "文件", "SMILES", "分子式", "分子量", ...variables],
    ...compounds.map((compound) => [compound.id, compound.file, compound.smiles ?? "", compound.formula, compound.mw.toFixed(2), ...variables.map((name) => compound.fields[name] ?? "")]),
  ]
  return [
    { path: "manifest.json", contents: `${JSON.stringify(manifest, null, 2)}\n` },
    // A byte order mark, so Excel reads the Chinese as UTF-8.
    { path: "compounds.csv", contents: `﻿${csv.map((line) => line.map(cell).join(",")).join("\n")}\n` },
    ...rows.map((row, index) => ({ path: compounds[index].file, contents: toCdxml({ ...emptyDrawing(), molecule: tableMolecule(row.mol) }) })),
    { path: "table.cdxml", contents: tableCdxml(rows, columns) },
  ]
}
