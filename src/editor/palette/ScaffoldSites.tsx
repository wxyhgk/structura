import { useMemo } from "react"
import { sceneToSvg } from "@structura/core/draw"
import { freeSites, type Scaffold } from "@structura/core/scaffolds"

/** Where a site's badge sits: a little outside its atom, away from the middle of the drawing. */
function outward(x: number, y: number, by: number) {
  const length = Math.hypot(x, y) || 1
  return { x: x + (x / length) * by, y: y + (y / length) * by }
}

/**
 * The scaffold drawn large, its numbered sites (or lettered bonds) as badges to click: the
 * one that will join (or fuse) is filled in.
 */
export function ScaffoldSites({
  scaffold,
  mode,
  site,
  edge,
  onSite,
  onEdge,
}: {
  scaffold: Scaffold
  mode: "site" | "edge"
  site: string
  edge: string
  onSite: (site: string) => void
  onEdge: (edge: string) => void
}) {
  const svg = useMemo(() => sceneToSvg(scaffold.molecule, true), [scaffold])
  const box = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg)!.slice(1).map(Number)
  const pad = 26
  const viewBox = `${box[0] - pad} ${box[1] - pad} ${box[2] + 2 * pad} ${box[3] + 2 * pad}`
  const atom = (id: number) => scaffold.molecule.atoms.find((item) => item.id === id)!
  const free = new Set(freeSites(scaffold))
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`).replace(/width="[^"]*" height="[^"]*"/, 'width="100%" height="100%"'))}`
  const badge = (key: string, at: { x: number; y: number }, label: string, chosen: boolean, onClick: () => void, testId: string) => (
    <g key={key} onClick={onClick} className="cursor-pointer" data-testid={testId}>
      <circle cx={at.x} cy={at.y} r={8.5} fill={chosen ? "#1a73e8" : "#fff"} stroke="#1a73e8" strokeWidth={1.2} />
      <text x={at.x} y={at.y + 3.2} fontSize={label.length > 2 ? 7 : 8.5} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fill={chosen ? "#fff" : "#1a73e8"}>
        {label}
      </text>
    </g>
  )
  return (
    <div className="relative aspect-[4/3] w-full">
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <svg viewBox={viewBox} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        {mode === "site"
          ? Object.entries(scaffold.atoms)
              .filter(([locant]) => free.has(locant))
              .map(([locant, id]) => badge(locant, outward(atom(id).x, atom(id).y, 16), locant.replace(/^C/, ""), locant === site, () => onSite(locant), `site-${locant}`))
          : Object.entries(scaffold.edges).map(([letter, [a, b]]) => {
              const mid = { x: (atom(a).x + atom(b).x) / 2, y: (atom(a).y + atom(b).y) / 2 }
              return badge(letter, outward(mid.x, mid.y, 12), letter, letter === edge, () => onEdge(letter), `edge-${letter}`)
            })}
      </svg>
    </div>
  )
}
