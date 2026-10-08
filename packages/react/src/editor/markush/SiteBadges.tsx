import { useSyncExternalStore } from "react"
import { atomById } from "@structura/core/molecule"
import type { Molecule } from "@structura/core/types"
import type { Viewport } from "@structura/engine"

/**
 * The sketch pad's sites drawn over its canvas: a ring round each site atom with its number
 * (1, 2, 3…). The default site, used while none is set, is dashed and says so.
 */
export function SiteBadges({ mol, sites, assumed, viewport }: { mol: Molecule; sites: number[]; assumed: boolean; viewport: Viewport }) {
  const view = useSyncExternalStore(viewport.subscribe, viewport.get)
  const atoms = [...new Set(sites)]
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {atoms.map((id) => {
        const atom = atomById(mol, id)
        if (!atom) return null
        const x = view.pan.x + atom.x * view.zoom
        const y = view.pan.y + atom.y * view.zoom
        const label = assumed ? "默认" : String(sites.indexOf(id) + 1)
        return (
          <g key={id} data-testid="site-badge">
            <circle cx={x} cy={y} r={13} fill="rgba(26,115,232,0.12)" stroke="#1a73e8" strokeWidth={1.5} strokeDasharray={assumed ? "3 3" : undefined} />
            <text x={x + 12} y={y - 11} fontSize={11} fontFamily="Arial, Helvetica, sans-serif" fill="#1a73e8" fontWeight={600}>
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
