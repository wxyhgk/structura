import { memo, useMemo } from "react"
import type { AtomLabel } from "@/chem/draw"
import type { Molecule, Selection } from "@/chem/types"
import { atomCircle } from "./rings.ts"

/** A circle on every selected atom and a soft band along every selected bond. */
export const SelectionMarks = memo(function SelectionMarks({
  mol,
  selection,
  labels,
  zoom,
}: {
  mol: Molecule
  selection: Selection
  labels: AtomLabel[]
  zoom: number
}) {
  const marks = useMemo(() => {
    const atoms = new Map(mol.atoms.map((atom) => [atom.id, atom]))
    const labelOf = new Map(labels.map((label) => [label.atomId, label]))
    const bonds = new Map(mol.bonds.map((bond) => [bond.id, bond]))
    return {
      circles: selection.atoms.flatMap((id) => {
        const atom = atoms.get(id)
        return atom ? [{ id, ...atomCircle(atom, labelOf.get(id), zoom, 8) }] : []
      }),
      bands: selection.bonds.flatMap((id) => {
        const bond = bonds.get(id)
        const a = bond && atoms.get(bond.a)
        const b = bond && atoms.get(bond.b)
        return a && b ? [{ id, x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : []
      }),
    }
  }, [mol, selection, labels, zoom])
  if (zoom <= 0) return null
  return (
    <g data-testid="selection-marks" pointerEvents="none">
      {marks.bands.map((band) => (
        <line key={`b${band.id}`} x1={band.x1} y1={band.y1} x2={band.x2} y2={band.y2} stroke="#1a73e8" strokeOpacity={0.18} strokeWidth={7 / zoom} strokeLinecap="round" />
      ))}
      {marks.circles.map((circle) => (
        <circle
          key={`a${circle.id}`}
          data-testid="selected-atom"
          cx={circle.cx}
          cy={circle.cy}
          r={circle.r}
          fill="rgba(26, 115, 232, 0.14)"
          stroke="#1a73e8"
          strokeOpacity={0.75}
          strokeWidth={1.2 / zoom}
        />
      ))}
    </g>
  )
})
