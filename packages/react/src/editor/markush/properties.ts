import type { MainModule } from "@rdkit/rdkit"
import { exactMass } from "@structura/core/analysis"
import { displayFormula, molecularWeight, plainFormula } from "@structura/core/formula"
import { toMolfile } from "@structura/core/molfile"
import type { Molecule } from "@structura/core/types"
import { inSlices } from "./asyncSlices.ts"

// The properties a compound table shows, filters on and exports. Weight and exact mass come
// from the formula (no RDKit needed); the rest from RDKit's descriptors, computed on demand
// and remembered per molecule.

export type PropertyKey = "mw" | "exact" | "logp" | "tpsa" | "hbd" | "hba" | "rotb" | "heavy"
/** What RDKit computes for a molecule; the other properties are the formula's. */
export type RdProps = Record<Exclude<PropertyKey, "mw" | "exact">, number>

export type PropertyDef = {
  key: PropertyKey
  /** The column's heading. */
  label: string
  /** What it is, for the heading's tooltip. */
  title: string
  digits: number
  /** The column in a CSV and the data item in an SD file. */
  field: string
  /** The descriptor RDKit's get_descriptors() reports it as; absent for those the formula gives. */
  descriptor?: string
}

export const PROPERTIES: readonly PropertyDef[] = [
  { key: "mw", label: "分子量", title: "平均分子量（按分子式）", digits: 2, field: "MW" },
  { key: "exact", label: "精确质量", title: "单同位素质量（按分子式）", digits: 4, field: "ExactMass" },
  { key: "logp", label: "cLogP", title: "Crippen cLogP（RDKit）", digits: 2, field: "cLogP", descriptor: "CrippenClogP" },
  { key: "tpsa", label: "TPSA", title: "拓扑极性表面积，Å²（RDKit）", digits: 1, field: "TPSA", descriptor: "tpsa" },
  { key: "hbd", label: "HBD", title: "氢键供体数，按 Lipinski 的算法（RDKit）", digits: 0, field: "HBD", descriptor: "lipinskiHBD" },
  { key: "hba", label: "HBA", title: "氢键受体数，按 Lipinski 的算法：N 和 O 的个数（RDKit）", digits: 0, field: "HBA", descriptor: "lipinskiHBA" },
  { key: "rotb", label: "可旋转键", title: "可旋转键数（RDKit）", digits: 0, field: "RotBonds", descriptor: "NumRotatableBonds" },
  { key: "heavy", label: "重原子数", title: "非氢原子数（RDKit）", digits: 0, field: "HeavyAtoms", descriptor: "NumHeavyAtoms" },
]

export const propertyDef = (key: PropertyKey): PropertyDef => PROPERTIES.find((def) => def.key === key)!

/** Reads RDKit's get_descriptors() JSON into the properties; null when one is missing or not a number. */
export function parseDescriptors(json: string): RdProps | null {
  const all = JSON.parse(json) as Record<string, unknown>
  const found: Partial<RdProps> = {}
  for (const def of PROPERTIES) {
    if (!def.descriptor) continue
    const value = all[def.descriptor]
    if (typeof value !== "number" || !Number.isFinite(value)) return null
    found[def.key as keyof RdProps] = value
  }
  return found as RdProps
}

/** What a molecule's descriptors came to: RDKit's numbers, or null when RDKit cannot read it. undefined: not computed yet. */
const cache = new WeakMap<Molecule, RdProps | null>()

/** The properties already computed for `mol` (null: RDKit cannot read it); undefined when not yet. */
export const peekProperties = (mol: Molecule): RdProps | null | undefined => cache.get(mol)

/** RDKit's properties of `mol`, computed once per molecule; null when RDKit cannot read it. */
export function rdProperties(rdkit: MainModule, mol: Molecule): RdProps | null {
  const known = cache.get(mol)
  if (known !== undefined) return known
  let found: RdProps | null = null
  try {
    const read = rdkit.get_mol(toMolfile(mol))
    if (read) {
      try {
        found = parseDescriptors(read.get_descriptors())
      } finally {
        read.delete()
      }
    }
  } catch {
    found = null
  }
  cache.set(mol, found)
  return found
}

/** A property's value for `mol`; undefined when it is not known (RDKit's not computed, not loaded, or cannot read the molecule). */
export function propertyValue(key: PropertyKey, mol: Molecule, rd: RdProps | null | undefined): number | undefined {
  if (key === "mw") return molecularWeight(mol)
  if (key === "exact") return exactMass(mol) ?? undefined
  return rd?.[key]
}

/** A value as the table and the exports write it. */
export const propertyText = (key: PropertyKey, value: number | undefined): string => (value == null ? "" : value.toFixed(propertyDef(key).digits))

/** The properties beside weight, as CSV columns: empty where unknown. */
export function propertyFields(mol: Molecule, rd: RdProps | null | undefined): Record<string, string> {
  return Object.fromEntries(PROPERTIES.filter((def) => def.key !== "mw").map((def) => [def.field, propertyText(def.key, propertyValue(def.key, mol, rd))]))
}

/** What an SD file's record carries beside the variables: formula, weight and the properties. */
export function sdfProperties(mol: Molecule, rd: RdProps | null | undefined): Record<string, string> {
  const fields = { Formula: displayFormula(plainFormula(mol)).normalize("NFKC"), MW: propertyText("mw", molecularWeight(mol)), ...propertyFields(mol, rd) }
  // An item with nothing to say is left out, rather than written empty.
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== ""))
}

/**
 * Computes the properties of `mols` (in slices, so the page stays alive),
 * skipping those known. `onSlice` hears when some more are ready; resolves false if cancelled.
 */
export function computeProperties(rdkit: MainModule, mols: readonly Molecule[], { cancelled, onSlice }: { cancelled?: () => boolean; onSlice?: () => void } = {}): Promise<boolean> {
  return inSlices(mols.filter((mol) => !cache.has(mol)), (mol) => rdProperties(rdkit, mol), { cancelled, onSlice })
}
