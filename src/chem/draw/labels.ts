import { elementColor } from "../elements/index.ts"
import { atomHydrogens } from "../formula.ts"
import { neighbors } from "../molecule/graph.ts"
import type { Atom, Molecule } from "../types.ts"
import type { LabelBox } from "./clip.ts"
import { measureText } from "./measure.ts"

/** Atom label font size, in drawing units. */
const LABEL_SIZE = 15

export type LabelRun = {
  text: string
  x: number
  y: number
  size: number
  anchor: "start" | "middle" | "end"
  dy: number
}

export type AtomLabel = {
  atomId: number
  color: string
  runs: LabelRun[]
  box: LabelBox
}

function chargeText(charge: number): string {
  const sign = charge > 0 ? "+" : "−"
  const magnitude = Math.abs(charge)
  return magnitude === 1 ? sign : `${magnitude}${sign}`
}

/** D and T are written as letters; other isotopes put the mass number in front. */
function symbolParts(atom: Atom): { symbol: string; mass: string } {
  if (atom.el === "H" && (atom.isotope === 2 || atom.isotope === 3)) return { symbol: atom.isotope === 2 ? "D" : "T", mass: "" }
  return { symbol: atom.el, mass: atom.isotope == null ? "" : String(atom.isotope) }
}

export function labelFor(mol: Molecule, atom: Atom, colorHetero: boolean): AtomLabel | null {
  if (atom.alias) {
    const width = measureText(atom.alias, LABEL_SIZE)
    const half = width / 2
    return {
      atomId: atom.id,
      color: elementColor(atom.el, colorHetero),
      runs: [{ text: atom.alias, x: atom.x, y: atom.y, size: LABEL_SIZE, anchor: "middle", dy: 0 }],
      box: { left: atom.x - half - 2, right: atom.x + half + 2, top: atom.y - 10, bottom: atom.y + 10 },
    }
  }
  const bonded = neighbors(mol, atom.id)
  const { h, error } = atomHydrogens(mol, atom.id)
  const show = atom.el !== "C" || atom.charge !== 0 || atom.isotope != null || error || bonded.length === 0
  if (!show) return null
  const color = error ? "#d1242f" : elementColor(atom.el, colorHetero)
  const displayH = !error && atom.el !== "H" ? h : 0
  const neighborX =
    bonded.length === 0 ? 0 : bonded.reduce((sum, item) => sum + item.x, 0) / bonded.length - atom.x
  const hOnLeft = neighborX > 4
  const { symbol, mass } = symbolParts(atom)
  const elWidth = measureText(symbol, LABEL_SIZE)
  const massWidth = mass ? measureText(mass, 11) + 0.5 : 0
  const hWidth = displayH > 0 ? measureText("H", LABEL_SIZE) : 0
  const subWidth = displayH > 1 ? measureText(String(displayH), 11) + 0.5 : 0
  const half = elWidth / 2
  const runs: LabelRun[] = [
    { text: symbol, x: atom.x, y: atom.y, size: LABEL_SIZE, anchor: "middle", dy: 0 },
  ]
  if (mass) runs.push({ text: mass, x: atom.x - half - 0.5, y: atom.y - 7, size: 11, anchor: "end", dy: 0 })
  if (displayH > 0) {
    if (hOnLeft) {
      const hRight = atom.x - half - massWidth - 1
      runs.push({ text: "H", x: hRight - subWidth, y: atom.y, size: LABEL_SIZE, anchor: "end", dy: 0 })
      if (displayH > 1) {
        runs.push({ text: String(displayH), x: hRight, y: atom.y + 4, size: 11, anchor: "end", dy: 0 })
      }
    } else {
      const hLeft = atom.x + half + 1
      runs.push({ text: "H", x: hLeft, y: atom.y, size: LABEL_SIZE, anchor: "start", dy: 0 })
      if (displayH > 1) {
        runs.push({ text: String(displayH), x: hLeft + hWidth, y: atom.y + 4, size: 11, anchor: "start", dy: 0 })
      }
    }
  }
  if (atom.charge !== 0) {
    const right = atom.x + half + (displayH > 0 && !hOnLeft ? 1 + hWidth + subWidth : 0)
    runs.push({
      text: chargeText(atom.charge),
      x: right + 1,
      y: atom.y - 7,
      size: 11,
      anchor: "start",
      dy: 0,
    })
  }

  const pad = 2.4
  const left = atom.x - half - pad - massWidth - (displayH > 0 && hOnLeft ? 1 + hWidth + subWidth : 0)
  const right =
    atom.x +
    half +
    pad +
    (displayH > 0 && !hOnLeft ? 1 + hWidth + subWidth : 0) +
    (atom.charge !== 0 ? measureText(chargeText(atom.charge), 11) + 1 : 0)
  const top = atom.y - 10 - (atom.charge !== 0 || mass ? 6 : 0)
  const bottom = atom.y + 10
  return { atomId: atom.id, color, runs, box: { left, right, top, bottom } }
}
