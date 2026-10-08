import { useState } from "react"
import type { Molecule } from "@structura/core/types"
import { CompoundThumbnail } from "../CompoundThumbnail.tsx"
import type { Row } from "../results.ts"

/** Drawn at first, and added each time the user asks for more; drawing thousands only slows the page. */
export const PAGE = 200

/**
 * The generated compounds as cards filling the pane's width, the first PAGE of them and
 * more on request. Remount it (a new key) to start again from the first page.
 */
export function ResultGrid({ rows, colorHetero, onPlace }: { rows: readonly Row[]; colorHetero: boolean; onPlace: (mol: Molecule) => void }) {
  const [shown, setShown] = useState(PAGE)
  const more = rows.length - shown
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2" data-testid="results-grid">
        {rows.slice(0, shown).map((row) => (
          <CompoundThumbnail key={row.number} row={row} colorHetero={colorHetero} weight onPlace={() => onPlace(row.mol)} />
        ))}
      </div>
      {more > 0 && (
        <div className="flex justify-center pt-2">
          <button type="button" className="rounded-sm border border-[#d0d0d0] bg-white px-3 py-1 text-[12px] text-[#1a73e8] hover:bg-[#eef3fb]" onClick={() => setShown(shown + PAGE)}>
            显示更多（还有 {more} 个）
          </button>
        </div>
      )}
    </div>
  )
}
