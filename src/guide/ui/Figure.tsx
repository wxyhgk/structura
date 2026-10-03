import { Fragment, useMemo } from "react"
import type { Drawing, Molecule } from "@structura/core/types"
import { figureSvg } from "../figures/build.ts"

export type Panel = { drawing: Drawing | Molecule; caption?: string }

const asDrawing = (item: Drawing | Molecule): Drawing => ("molecule" in item ? item : { molecule: item, arrows: [], nextArrowId: 1 })

/** One structure at its own size (shrunk only if it would not fit), with a caption under it. */
function Picture({ drawing, caption }: Panel) {
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(figureSvg(asDrawing(drawing)))}`, [drawing])
  return (
    <figure className="flex flex-col items-center gap-1">
      <img src={src} alt={caption ?? ""} className="max-h-40 max-w-full object-contain" />
      {caption && <figcaption className="text-center text-[11px] text-[#666]">{caption}</figcaption>}
    </figure>
  )
}

/**
 * Structures side by side, on a light card. `steps[i]` labels an arrow before panel i + 1,
 * saying what turns one into the next; an empty label puts no arrow there.
 */
export function Figure({ panels, steps }: { panels: Panel[]; steps?: string[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-sm border border-[#eee] bg-[#fcfcfc] px-3 py-2">
      {panels.map((panel, index) => (
        <Fragment key={index}>
          {index > 0 && steps?.[index - 1] && (
            <div className="flex flex-col items-center text-[11px] text-[#1a73e8]">
              <span>{steps[index - 1]}</span>
              <span className="text-[18px] leading-none">→</span>
            </div>
          )}
          <Picture {...panel} />
        </Fragment>
      ))}
    </div>
  )
}
