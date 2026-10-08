import { ELECTRON, elementalAnalysis, exactMass, netCharge } from "@structura/core/analysis"
import { elementCounts, molecularWeight, plainFormula } from "@structura/core/formula"
import type { Molecule } from "@structura/core/types"

/** A proton: hydrogen without its electron. */
const PROTON = 1.00782503207 - ELECTRON
/** A sodium cation. */
const SODIUM = 22.98976966 - ELECTRON

/** A formula written the usual way, C first, then H, then alphabetical: from element counts. */
function formulaOf(counts: Map<string, number>): string {
  const order = (symbol: string) => (symbol === "C" ? 0 : symbol === "H" ? 1 : 2)
  return [...counts]
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
    .map(([symbol, count]) => (count === 1 ? symbol : `${symbol}${count}`))
    .join("")
}

/** One ion people look for in a mass spectrum: its name, its formula, its m/z. */
export type Ion = { name: string; formula: string; mz: number }

/** Everything the analysis shows for some atoms of a molecule (all of them when `atomIds` is empty). */
export type Report = {
  formula: string
  weight: number
  exact: number | null
  charge: number
  ions: Ion[]
  analysis: Array<{ symbol: string; percent: number }>
  /** "HRMS (ESI) m/z: [M+H]+ calcd for C6H7 79.0542", as an experimental section puts it. */
  hrmsLine: string | null
  /** "Anal. calcd for C6H6: C, 92.26; H, 7.74." */
  analysisLine: string | null
}

export function reportFor(mol: Molecule, atomIds: number[]): Report {
  const ids = atomIds.length > 0 ? atomIds : undefined
  const counts = elementCounts(mol, ids)
  const formula = plainFormula(mol, ids)
  const exact = exactMass(mol, ids)
  const charge = netCharge(mol, ids)
  const withH = (delta: number) => formulaOf(new Map([...counts, ["H", (counts.get("H") ?? 0) + delta]]))
  const ions: Ion[] =
    exact == null
      ? []
      : charge === 0
        ? [
            { name: "[M+H]⁺", formula: withH(1), mz: exact + PROTON },
            { name: "[M+Na]⁺", formula: `${formula}Na`, mz: exact + SODIUM },
            { name: "[M−H]⁻", formula: withH(-1), mz: exact - PROTON },
          ]
        : [{ name: charge > 0 ? `[M]${charge > 1 ? charge : ""}⁺` : `[M]${charge < -1 ? -charge : ""}⁻`, formula, mz: (exact - charge * ELECTRON) / Math.abs(charge) }]
  const analysis = elementalAnalysis(mol, ids)
  const first = ions[0]
  return {
    formula,
    weight: molecularWeight(mol, ids),
    exact,
    charge,
    ions,
    analysis,
    hrmsLine: first ? `HRMS (ESI) m/z: ${first.name.replace("⁺", "+").replace("⁻", "−")} calcd for ${first.formula} ${first.mz.toFixed(4)}` : null,
    analysisLine: analysis.length > 0 ? `Anal. calcd for ${formula}: ${analysis.map(({ symbol, percent }) => `${symbol}, ${percent.toFixed(2)}`).join("; ")}.` : null,
  }
}
