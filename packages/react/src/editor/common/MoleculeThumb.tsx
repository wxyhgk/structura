import { memo, useMemo } from "react"
import { sceneToSvg } from "@structura/core/draw"
import type { Molecule } from "@structura/core/types"

/** A molecule as a small picture; drawn once, since a molecule handed in never changes. */
export const MoleculeThumb = memo(function MoleculeThumb({ mol, colorHetero = true, className }: { mol: Molecule; colorHetero?: boolean; className?: string }) {
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sceneToSvg(mol, colorHetero))}`, [mol, colorHetero])
  return <img src={src} alt="" className={className} />
})
