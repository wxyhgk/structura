import { memo, useMemo } from "react"
import { sceneToSvg } from "@structura/core/draw"
import type { Molecule } from "@structura/core/types"
import { svgSource, useDarkPicture } from "../../components/theme.ts"

/** A molecule as a small picture; drawn once, since a molecule handed in never changes. */
export const MoleculeThumb = memo(function MoleculeThumb({ mol, colorHetero = true, className }: { mol: Molecule; colorHetero?: boolean; className?: string }) {
  const dark = useDarkPicture()
  const src = useMemo(() => svgSource(sceneToSvg(mol, colorHetero), dark), [mol, colorHetero, dark])
  return <img src={src} alt="" className={className} />
})
