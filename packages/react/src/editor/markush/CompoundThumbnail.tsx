import { memo } from "react"
import { displayFormula, molecularWeight, plainFormula } from "@structura/core/formula"
import { MoleculeThumb } from "../common/MoleculeThumb.tsx"
import { picksText, rowName, type Row } from "./results.ts"

type Props = { row: Row; colorHetero: boolean; weight?: boolean; onPlace: (mol: Row["mol"]) => void }

/**
 * Whether a card would look the same: the list rebuilds its rows (numbering them, filtering)
 * on every update, so it is their content that counts, not their identity.
 */
const same = (a: Props, b: Props) =>
  a.row.mol === b.row.mol &&
  a.row.picks === b.row.picks &&
  a.row.number === b.row.number &&
  a.row.id === b.row.id &&
  a.row.formula === b.row.formula &&
  a.colorHetero === b.colorHetero &&
  a.weight === b.weight &&
  a.onPlace === b.onPlace

/**
 * One generated compound: numbered, its formula (and weight, when asked), what its variables
 * became, and a way onto the canvas, shown on hover.
 */
export const CompoundThumbnail = memo(function CompoundThumbnail({ row, colorHetero, weight = false, onPlace }: Props) {
  const picks = picksText(row.picks)
  return (
    <figure className="group relative rounded-sm border border-(--c-e0e0e0) bg-(--c-ffffff) p-1 text-center" data-testid="enumerated-compound">
      <MoleculeThumb mol={row.mol} colorHetero={colorHetero} className="mx-auto h-24 w-full object-contain" />
      <figcaption className="text-[11px] text-(--c-666666)">
        <span className="font-semibold text-(--c-333333)" data-testid="compound-id">{rowName(row)}</span>{row.id ? " " : ". "}{row.formula != null && <span className="mr-1 rounded-sm bg-(--c-eef3fd) px-1 text-(--c-1a73e8)">式 {row.formula}</span>}
        {displayFormula(plainFormula(row.mol))}
        {weight && <span className="text-(--c-999999)"> · {molecularWeight(row.mol).toFixed(1)}</span>}
        {picks && (
          <span className="block truncate text-[10px] text-(--c-888888)" title={picks}>
            {picks}
          </span>
        )}
      </figcaption>
      <button
        type="button"
        className="absolute top-1 right-1 rounded-sm bg-(--c-1a73e8) px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
        onClick={() => onPlace(row.mol)}
      >
        放到画布
      </button>
    </figure>
  )
}, same)
