import { memo } from "react"
import { displayFormula, molecularWeight, plainFormula } from "@structura/core/formula"
import { MoleculeThumb } from "@/editor/common/MoleculeThumb"
import { picksText, type Row } from "./results.ts"

/**
 * One generated compound: numbered, its formula (and weight, when asked), what its variables
 * became, and a way onto the canvas, shown on hover.
 */
export const CompoundThumbnail = memo(function CompoundThumbnail({ row, colorHetero, weight = false, onPlace }: { row: Row; colorHetero: boolean; weight?: boolean; onPlace: () => void }) {
  const picks = picksText(row.picks)
  return (
    <figure className="group relative rounded-sm border border-[#e0e0e0] bg-white p-1 text-center" data-testid="enumerated-compound">
      <MoleculeThumb mol={row.mol} colorHetero={colorHetero} className="mx-auto h-24 w-full object-contain" />
      <figcaption className="text-[11px] text-[#666]">
        {row.number}. {row.formula != null && <span className="mr-1 rounded-sm bg-[#eef3fd] px-1 text-[#1a73e8]">式 {row.formula}</span>}
        {displayFormula(plainFormula(row.mol))}
        {weight && <span className="text-[#999]"> · {molecularWeight(row.mol).toFixed(1)}</span>}
        {picks && (
          <span className="block truncate text-[10px] text-[#888]" title={picks}>
            {picks}
          </span>
        )}
      </figcaption>
      <button
        type="button"
        className="absolute top-1 right-1 rounded-sm bg-[#1a73e8] px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
        onClick={onPlace}
      >
        放到画布
      </button>
    </figure>
  )
})
